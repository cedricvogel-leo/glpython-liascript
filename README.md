<!--

author:   Cedric Vogel
version:  0.1.0
language: en

comment:  Embed the glpython editor, execution visualizer, and turtle graphics
          in LiaScript courses.

@GLPython.eval: @GLPython.embed(@uid,eval,@0)

@GLPython.turtle: @GLPython.embed(@uid,turtle)

@GLPython.visual: @GLPython.embed(@uid,visual,@0)

@GLPython.embed
<script>
(() => {
  const session = window.__glpythonSessions?.get("@0")
  const source = "@'input"
  if (!session) {
    const primary = (tag) => (tag || "").toLowerCase().split("-")[0]
    const german = [primary(document.documentElement.lang), primary(navigator.language)].find((language) => ["de", "en"].includes(language)) === "de"
    const message = german
      ? "Die glpython-Laufzeit ist noch nicht bereit."
      : "The glpython runtime is not ready."
    send.lia(`HTML: <pre style='color:red'>${message}</pre>`)
    return
  }
  session.run(source)
  window.setTimeout(() => send.lia("LIA: stop"), 0)
})()

"LIA: wait"
</script>

<script run-once>
(() => {
  const protocolVersion = 3
  const embedOrigin = "https://cedricvogel-leo.github.io"
  const embedUrl = `${embedOrigin}/glpython-editor/index.html`
  const sessionId = "@0"
  const mode = "@1"
  // Optional per block, separated by spaces in any order: "box" or
  // "substitution" presets the visualizer's mode, and URLs of shared Python
  // files to load as libraries, e.g. @GLPython.eval(box https://…/parser.py).
  // Without the argument this is the literal "@2", which matches neither.
  const options = "@2".split(/\s+/).filter(Boolean)
  const visualizerMode = options.find((option) => option === "box" || option === "substitution") ?? null
  const libraryUrls = options.filter((option) => /^https?:\/\//.test(option))
  // The course's own language (its "language:" header, which LiaScript sets
  // as the page's lang attribute), else the browser's, else English. Only the
  // primary subtag counts ("de-CH" -> "de"); an unsupported language such as
  // "fr" falls through to the next step. A course without a header counts as
  // English, as LiaScript reports it.
  const primaryLanguage = (tag) => (tag || "").toLowerCase().split("-")[0]
  const language = [primaryLanguage(document.documentElement.lang), primaryLanguage(navigator.language)]
    .find((candidate) => ["de", "en"].includes(candidate)) ?? "en"
  const strings = {
    de: {
      reset: "Laufzeit zurücksetzen",
      visualize: "Visualisieren",
      tests: "Tests",
      frameTitle: "glpython-Laufzeit",
      sourceUnreadable: "Der LiaScript-Quelltext konnte nicht gelesen werden.",
      inputUnavailable: "Python-input() ist in dieser LiaScript-Einbettung nicht verfügbar.",
      embedError: "Die glpython-Einbettung hat einen Fehler gemeldet.",
      runFile: (name) => `${name} ausführen`,
      chooseFile: "Datei zum Ausführen wählen",
      library: "Bibliothek",
      viewFile: "Datei ansehen",
      hideFile: "Datei ausblenden",
      libraryFailed: (name, reason) => `Die Bibliothek ${name} konnte nicht geladen werden (${reason}).`,
      networkError: "Netzwerkfehler",
      timeout: "Zeitüberschreitung",
      filesUnsupported: "Diese glpython-Version kann nur eine Datei laden; es wird nur die gewählte Datei ausgeführt.",
    },
    en: {
      reset: "Reset runtime",
      visualize: "Visualize",
      tests: "Tests",
      frameTitle: "glpython runtime",
      sourceUnreadable: "The LiaScript source block could not be read.",
      inputUnavailable: "Python input() is unavailable in this LiaScript embedding context.",
      embedError: "The glpython embed reported an error.",
      runFile: (name) => `Run ${name}`,
      chooseFile: "Choose the file to run",
      library: "Library",
      viewFile: "View file",
      hideFile: "Hide file",
      libraryFailed: (name, reason) => `Could not load library ${name} (${reason}).`,
      networkError: "network error",
      timeout: "timeout",
      filesUnsupported: "This glpython version can only load one file; only the chosen file runs.",
    },
  }[language]
  const sessions = window.__glpythonSessions ??= new Map()
  const existingSession = sessions.get(sessionId)
  if (existingSession) {
    existingSession.attach()
    return
  }

  let frame = null
  let error = null
  let codeBlock = null
  let inputAvailable = false
  let filesSupported = false
  let testsSupported = false
  let runtimeReady = false
  let pendingRun = false
  // The code file chosen in the split button's menu; null runs the last one.
  let chosenFile = null

  const showError = (message) => {
    if (!error) return
    error.textContent = message
    error.hidden = false
  }

  // A block's file name (its header, e.g. ```python parser.py) as a Python
  // module file, so "from parser import parse" finds it.
  const moduleFileName = (name, fallback) => {
    const stem = (name || "").trim().replace(/\.py$/i, "").replace(/[^A-Za-z0-9_]/g, "_")
    if (!stem) return fallback
    return `${/^[0-9]/.test(stem) ? "_" : ""}${stem}.py`
  }

  // Every code block right before the iframe (LiaScript groups consecutive
  // blocks into one project), with its file name and its current text.
  const readCodeFiles = () => {
    const editors = [...(codeBlock?.querySelectorAll("lia-editor") ?? [])]
    const files = editors.map((editor, index) => ({
      path: moduleFileName(
        editor.closest(".lia-accordion__item")?.querySelector(".lia-accordion__headline")?.textContent,
        editors.length === 1 ? "main.py" : `datei${index + 1}.py`,
      ),
      source: editor.value,
    }))
    if (files.some((file) => typeof file.source !== "string")) return null
    return files.filter((file, index) => files.findIndex((other) => other.path === file.path) === index)
  }

  // Shared files loaded by URL, fetched once per block. A file that can't be
  // loaded is reported and left out, so Python's own ModuleNotFoundError
  // follows when the program imports it.
  const fileNameOfUrl = (url) => decodeURIComponent(new URL(url).pathname.split("/").pop() || "")
  const libraries = Promise.all(libraryUrls.map(async (url) => {
    const path = moduleFileName(fileNameOfUrl(url), "bibliothek.py")
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), 15000)
    try {
      const response = await fetch(url, { signal: controller.signal })
      if (!response.ok) return { path, url, failure: `HTTP ${response.status}` }
      return { path, url, source: await response.text() }
    } catch (fetchError) {
      return { path, url, failure: fetchError?.name === "AbortError" ? strings.timeout : strings.networkError }
    } finally {
      window.clearTimeout(timer)
    }
  }))

  // Lists the libraries below the buttons: each can be opened read-only, and
  // one that failed to load says so.
  const showLibraries = (list) => {
    const container = document.getElementById(`glpython-files-${sessionId}`)
    if (!container || container.dataset.filled === "true" || list.length === 0) return
    container.dataset.filled = "true"
    container.hidden = false
    for (const library of list) {
      const row = document.createElement("div")
      row.style.margin = "4px 0"
      const label = document.createElement("span")
      label.textContent = `${strings.library}: `
      const name = document.createElement("code")
      name.textContent = library.path
      row.append(label, name)
      if (library.failure) {
        const failure = document.createElement("span")
        failure.className = "glpython-error"
        failure.style.color = "#b23a3a"
        failure.textContent = ` ${strings.libraryFailed(library.path, library.failure)}`
        row.append(failure)
      } else {
        const toggle = document.createElement("button")
        toggle.type = "button"
        toggle.textContent = strings.viewFile
        toggle.style.marginLeft = "8px"
        const view = document.createElement("pre")
        view.hidden = true
        view.textContent = library.source
        view.style.cssText = "max-height:320px;overflow:auto;margin:6px 0;padding:8px;background:#f6f6f3;border:1px solid #ddd;border-radius:6px"
        toggle.onclick = () => {
          view.hidden = !view.hidden
          toggle.textContent = view.hidden ? strings.viewFile : strings.hideFile
        }
        row.append(toggle, view)
      }
      container.append(row)
    }
  }
  libraries.then(showLibraries)

  const reportInputCapability = (source) => {
    if (!error) return
    if (!inputAvailable && /(^|[^\w])input\s*\(/.test(source)) {
      showError(strings.inputUnavailable)
    } else {
      error.hidden = true
    }
  }

  // The program to send: the libraries plus the block's files, and which one
  // runs - the chosen file, else the last block (materials put the file to
  // run last). Without readable blocks, LiaScript's own text of the block.
  const readProgram = async (fallbackSource) => {
    const codeFiles = readCodeFiles() ?? (typeof fallbackSource === "string" ? [{ path: "main.py", source: fallbackSource }] : null)
    if (!codeFiles || codeFiles.length === 0) {
      showError(strings.sourceUnreadable)
      return null
    }
    const mainFile = codeFiles.some((file) => file.path === chosenFile) ? chosenFile : codeFiles[codeFiles.length - 1].path
    const loaded = (await libraries).filter((library) => library.source !== undefined && !codeFiles.some((file) => file.path === library.path))
    return { mainFile, files: [...loaded.map(({ path, source }) => ({ path, source })), ...codeFiles] }
  }

  const postProgram = async (type, fallbackSource) => {
    const program = await readProgram(fallbackSource)
    if (!program || !frame?.contentWindow) return
    const main = program.files.find((file) => file.path === program.mainFile)
    reportInputCapability(main.source)
    if (filesSupported) {
      // Version 3 ("glpython:test") only with embeds that understand it.
      frame.contentWindow.postMessage({ type, version: testsSupported ? protocolVersion : 2, source: main.source, mode, files: program.files, mainFile: program.mainFile }, embedOrigin)
    } else {
      if (program.files.length > 1) showError(strings.filesUnsupported)
      frame.contentWindow.postMessage({ type, version: 1, source: main.source, mode }, embedOrigin)
    }
  }

  const sendCommand = (type, fallbackSource) => {
    if (!frame?.contentWindow) return
    if (type === "glpython:reset") {
      frame.contentWindow.postMessage({ type, version: testsSupported ? protocolVersion : filesSupported ? 2 : 1 }, embedOrigin)
      return
    }
    postProgram(type, fallbackSource)
  }

  const run = (fallbackSource) => {
    attach()
    if (runtimeReady) {
      sendCommand("glpython:run", fallbackSource)
    } else {
      pendingRun = true
    }
  }

  const onMessage = (event) => {
    if (!frame || event.origin !== embedOrigin || event.source !== frame.contentWindow) return
    const message = event.data
    // The embed answers in the version this macro last used (1 until it knows
    // the embed understands version 2).
    if (!message || (message.version !== 1 && message.version !== protocolVersion)) return

    if (message.type === "glpython:ready") {
      runtimeReady = true
      inputAvailable = message.capabilities?.input === true
      filesSupported = message.capabilities?.files === true
      testsSupported = message.capabilities?.tests === true
      frame.dataset.inputAvailable = String(inputAvailable)
      sendCommand(mode === "visual" ? "glpython:visualize" : "glpython:load")
      if (pendingRun) {
        sendCommand("glpython:run")
        pendingRun = false
      }
      for (const id of ["visualize", "reset", "run", "run-menu", "tests"]) {
        const button = document.getElementById(`glpython-${id}-${sessionId}`)
        if (button) button.disabled = false
      }
      const testsButton = document.getElementById(`glpython-tests-${sessionId}`)
      if (testsButton) testsButton.hidden = !testsSupported || mode === "visual"
      send.lia("LIA: stop")
    } else if (message.type === "glpython:resize" && Number.isFinite(message.height)) {
      const minimumHeight = mode === "visual" ? 420 : 170
      frame.style.height = `${Math.max(minimumHeight, Math.min(message.height, 1200))}px`
    } else if (message.type === "glpython:error") {
      showError(message.message || strings.embedError)
    }
  }

  // The split button for blocks of several files: the icon runs the chosen
  // file (the last one until another is chosen), the caret opens the list.
  const updateRunButton = (codeFiles) => {
    const split = document.getElementById(`glpython-run-split-${sessionId}`)
    const runButton = document.getElementById(`glpython-run-${sessionId}`)
    const menuButton = document.getElementById(`glpython-run-menu-${sessionId}`)
    const menu = document.getElementById(`glpython-run-list-${sessionId}`)
    if (!split || !runButton || !menuButton || !menu) return
    // Toggled through display, not the hidden attribute: the split button's
    // inline-flex display would override hidden.
    const show = mode !== "visual" && codeFiles.length > 1
    const display = show ? "inline-flex" : "none"
    if (split.style.display !== display) split.style.display = display
    if (!show) return
    const mainFile = codeFiles.some((file) => file.path === chosenFile) ? chosenFile : codeFiles[codeFiles.length - 1].path
    const title = strings.runFile(mainFile)
    if (runButton.title !== title) {
      runButton.title = title
      runButton.setAttribute("aria-label", title)
    }
    if (menuButton.title !== strings.chooseFile) {
      menuButton.title = strings.chooseFile
      menuButton.setAttribute("aria-label", strings.chooseFile)
    }
    runButton.onclick = () => run()
    menuButton.onclick = () => {
      menu.hidden = !menu.hidden
      menuButton.setAttribute("aria-expanded", String(!menu.hidden))
    }
    const names = codeFiles.map((file) => file.path).join("\n")
    if (menu.dataset.files === names && menu.dataset.chosen === mainFile) return
    menu.dataset.files = names
    menu.dataset.chosen = mainFile
    menu.replaceChildren(...codeFiles.map((file) => {
      const item = document.createElement("button")
      item.type = "button"
      item.setAttribute("role", "menuitemradio")
      item.setAttribute("aria-checked", String(file.path === mainFile))
      item.textContent = `${file.path === mainFile ? "✓ " : ""}${file.path}`
      item.style.cssText = "display:block;width:100%;padding:6px 12px;border:0;background:none;text-align:left;font:inherit;cursor:pointer"
      item.onclick = () => {
        chosenFile = file.path
        menu.hidden = true
        menuButton.setAttribute("aria-expanded", "false")
        updateRunButton(codeFiles)
        if (runtimeReady) sendCommand("glpython:load")
      }
      return item
    }))
  }

  const attach = () => {
    const nextFrame = document.getElementById(`glpython-frame-${sessionId}`)
    if (!nextFrame) return
    if (frame !== nextFrame) runtimeReady = false
    frame = nextFrame
    error = document.getElementById(`glpython-error-${sessionId}`)
    const controls = document.getElementById(`glpython-controls-${sessionId}`)
    const visualizeButton = document.getElementById(`glpython-visualize-${sessionId}`)
    const resetButton = document.getElementById(`glpython-reset-${sessionId}`)
    const codeBlocks = [
      ...(frame.closest(".lia-slide__content")?.querySelectorAll(".lia-code--block") ?? []),
    ]
    codeBlock = codeBlocks.findLast((block) =>
      block.compareDocumentPosition(frame) & Node.DOCUMENT_POSITION_FOLLOWING
    ) ?? null
    if (codeBlock && codeBlock.hidden !== (mode === "visual")) codeBlock.hidden = mode === "visual"
    if (controls) controls.style.display = mode === "visual" ? "none" : "flex"
    // Only when it differs: attach() runs on every DOM change (see the
    // MutationObserver below), and replacing a text is such a change.
    if (resetButton && resetButton.textContent !== strings.reset) resetButton.textContent = strings.reset
    if (visualizeButton) {
      if (visualizeButton.textContent !== strings.visualize) visualizeButton.textContent = strings.visualize
      visualizeButton.hidden = mode !== "eval"
      visualizeButton.onclick = () => sendCommand("glpython:visualize")
    }
    if (resetButton) resetButton.onclick = () => sendCommand("glpython:reset")
    // Runs the doctests of the file that would run; shown once the embed
    // says it understands them.
    const testsButton = document.getElementById(`glpython-tests-${sessionId}`)
    if (testsButton) {
      if (testsButton.textContent !== strings.tests) testsButton.textContent = strings.tests
      if (testsButton.hidden !== (!testsSupported || mode === "visual")) testsButton.hidden = !testsSupported || mode === "visual"
      testsButton.onclick = () => sendCommand("glpython:test")
    }
    updateRunButton(readCodeFiles() ?? [])
    libraries.then(showLibraries)
    if (frame.dataset.glpythonInitialized === "true") return
    frame.dataset.glpythonInitialized = "true"
    if (mode === "visual") frame.style.height = "420px"
    frame.title = `${strings.frameTitle} (${mode})`
    frame.src = `${embedUrl}?parentOrigin=${encodeURIComponent(window.location.origin)}&mode=${mode}&lang=${language}${visualizerMode ? `&visualizer=${visualizerMode}` : ""}`
  }

  const session = { attach, run }
  sessions.set(sessionId, session)
  window.addEventListener("message", onMessage)
  new MutationObserver(attach).observe(document.body, { childList: true, subtree: true })
  attach()
})()

"LIA: wait"
</script>

<div class="glpython-embed">
  <div id="glpython-controls-@0" style="display:flex;gap:8px;justify-content:flex-end;align-items:center;margin:8px 0">
    <span id="glpython-run-split-@0" style="position:relative;display:none">
      <button id="glpython-run-@0" type="button" disabled style="border-top-right-radius:0;border-bottom-right-radius:0;padding-left:12px;padding-right:10px">▶</button>
      <button id="glpython-run-menu-@0" type="button" disabled aria-haspopup="true" aria-expanded="false" style="border-top-left-radius:0;border-bottom-left-radius:0;border-left:1px solid rgba(0,0,0,.15);padding-left:6px;padding-right:8px">▾</button>
      <span id="glpython-run-list-@0" role="menu" hidden style="position:absolute;top:100%;right:0;z-index:10;min-width:180px;margin-top:4px;padding:4px 0;background:#fff;border:1px solid #ccc;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,.15)"></span>
    </span>
    <button id="glpython-reset-@0" type="button" disabled>Reset runtime</button>
    <button id="glpython-tests-@0" type="button" disabled hidden>Tests</button>
    <button id="glpython-visualize-@0" type="button" disabled>Visualize</button>
  </div>
  <div id="glpython-files-@0" hidden style="margin:4px 0 8px"></div>
  <p id="glpython-error-@0" class="glpython-error" hidden></p>
  <iframe
    id="glpython-frame-@0"
    title="glpython @1 runtime"
    loading="lazy"
    referrerpolicy="strict-origin"
    allow="clipboard-read; clipboard-write"
    style="display:block;width:100%;height:220px;border:0;border-radius:8px;background:#f4f1e9"
  ></iframe>
</div>
@end

-->

# glpython for LiaScript

Run and visualize Python directly in a LiaScript course with the browser-based
[glpython](https://github.com/cedricvogel-leo/glpython) editor.

The macros use LiaScript's native editor as the source of truth and a separately
hosted iframe for execution and visualization. Python runs locally in the learner's browser through Pyodide; the current source is sent for each action through an
origin-checked, versioned handshake.

## Import

Add the template to the header of a LiaScript course:

```text
import: https://raw.githubusercontent.com/cedricvogel-leo/glpython-liascript/main/README.md
```

## Editor and visualizer

Attach `@GLPython.eval` to a Python code block:

```python
import sys

for i in range(5):
    print("Hello", "World #" + str(i))

sys.version
```
@GLPython.eval

LiaScript owns the visible editor and preserves its source through its course and PWA
state. LiaScript's native Execute action runs the current source through glpython. The
glpython runtime provides output and the step-by-step visualizer without mounting a
second editor. It does not reserve space for turtle graphics.

## State and navigation

The fenced source belongs to LiaScript. Edits therefore survive slide navigation and
leaving the course followed by browser Back in the same way as the official Pyodide
macro. A hard reload returns to the Markdown source baseline, which also matches the
official macro's behavior.

Each macro has an isolated runtime iframe. If LiaScript recreates that iframe, the
macro reattaches a clean worker and reloads the current LiaScript source; Python
globals, output, turtle state, and visualization position are intentionally not
serialized. **Reset runtime** also terminates the current worker and creates a clean
one. The post-run REPL below the output uses this per-block worker lifecycle: Run
keeps the program's namespace while the worker survives, and Reset discards it
without changing LiaScript's source.

## Turtle graphics

Use `@GLPython.turtle` for a graphics-focused layout:

```python
from gturtle import *

makeTurtle()
for _ in range(4):
    forward(100)
    right(90)
```
@GLPython.turtle

## Visualization only

Use `@GLPython.visual` when learners should explore a prepared program without
editing it. The fenced source is hidden and the visualization starts
automatically. The visualizer keeps its scrubber, restart, step, play/pause,
animation, and synchronized output controls.

```python
total = 0
for value in range(1, 5):
    total += value
print(total)
```
@GLPython.visual

## Several files

Put consecutive code blocks with a file name in their header before the macro;
LiaScript shows them as one project, and glpython loads all of them, so one file
can import another. Start a file's name with `-` to show it collapsed (and `+`
to show it open):

```python -helpers.py
def doppelt(x):
    return 2 * x
```
```python +main.py
from helpers import doppelt

print(doppelt(21))
```
@GLPython.eval

The **last** file runs. A split button next to the other buttons (▶ ▾) runs it,
and its ▾ menu chooses another file to run; LiaScript's own Execute action and
**Visualize** follow that choice. Only the file that runs is visualized step by
step; imported files run as a black box.

Shared files that live elsewhere, e.g. a parser used in several lessons, are
loaded by URL: list them in the macro's argument, separated by spaces and
together with `box`/`substitution` if needed. The file name of the URL is the
module name, e.g. for `from parser import parse`:

```text
@GLPython.eval(https://raw.githubusercontent.com/<user>/<repo>/main/materials/00-auswerter/parser.py)
@GLPython.eval(box https://…/parser.py https://…/auswerter.py)
```

A working example, loading Python's own `colorsys.py` from GitHub:

```python
from colorsys import rgb_to_hsv

print(rgb_to_hsv(1, 0, 0))
```
@GLPython.eval(https://raw.githubusercontent.com/python/cpython/main/Lib/colorsys.py)

Such a library is listed below the buttons with **View file** to read it. If it
can't be loaded (e.g. HTTP 404, no network, or a server without CORS), the list
says so and the program runs without it, so Python reports the missing module.
Raw GitHub URLs work; URLs must not contain parentheses.

## Tests

The **Tests** button runs the examples written as doctests in the docstrings of
the file that would run (with several files: the chosen one), as
`python -m doctest` does. It shows how many examples passed and each failing
example in doctest's own words (`Expected:` / `Got:`), with a button to
visualize that example step by step. An example that only printed the expected
value while the function returned `None` passes, as in doctest, with a hint
that it probably should `return` instead.

```python
def quadrat(x):
    """
    Gibt das Quadrat von x zurück.

    >>> quadrat(3)
    9
    >>> quadrat(-2)
    4
    """
    return x * x
```
@GLPython.eval

## Box or substitution

The visualizer shows a call to a function whose body is a single `return` either
as a box or replaced by its return expression (substitution, the default), and
learners can switch with the toggle in its toolbar. To preset the mode for one
block, pass `box` or `substitution` to `@GLPython.eval` or `@GLPython.visual`:

```python
def quadrat(x):
    return x * x

quadrat(7)
```
@GLPython.visual(box)

Without an argument the block uses the mode the learner last chose, and
substitution at first.

## Language

The buttons and the embed follow the course's `language:` header: German for
`de` (including regional variants such as `de-CH`), English for `en`. For a
language glpython doesn't support (e.g. `fr`), they follow the browser's
language instead, and English if that isn't supported either. LiaScript reports
a course without a `language:` header as English, so such a course is shown in
English. Python's own values and error messages are never translated.

## Hosting and compatibility

The template currently targets:

```text
https://cedricvogel-leo.github.io/glpython-editor/
```

The embed protocol is versioned independently of the course template.
Synchronous Python `input()` depends on cross-origin isolation in the complete
top-level LiaScript embedding context. The iframe reports that capability during
its handshake. If a snippet uses `input()` where the capability is unavailable,
the macro displays a warning; editing, normal execution, visualization, and
turtle graphics remain available.

## Development

Open this file through the LiaScript LiveEditor to exercise the real macro
environment:

```text
https://liascript.github.io/LiveEditor/?/show/file/https://raw.githubusercontent.com/cedricvogel-leo/glpython-liascript/main/README.md
```

For local embed development, change `embedOrigin` and `embedUrl` in the template
header to the origin printed by `npm run dev:embed` in `glpython-editor`.
