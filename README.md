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
    const message = document.documentElement.lang.toLowerCase().startsWith("de")
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
  const protocolVersion = 1
  const embedOrigin = "https://cedricvogel-leo.github.io"
  const embedUrl = `${embedOrigin}/glpython-editor/index.html`
  const sessionId = "@0"
  const mode = "@1"
  // Optional per block: @GLPython.eval(box) or @GLPython.eval(substitution)
  // presets the visualizer's mode; without it this is the literal "@2".
  const visualizerMode = ["box", "substitution"].includes("@2") ? "@2" : null
  // The course's own language (its "language:" header), which LiaScript sets
  // as the page's lang attribute. German for "de"/"de-CH" etc., else English.
  const language = document.documentElement.lang.toLowerCase().startsWith("de") ? "de" : "en"
  const strings = {
    de: {
      reset: "Laufzeit zurücksetzen",
      visualize: "Visualisieren",
      frameTitle: "glpython-Laufzeit",
      sourceUnreadable: "Der LiaScript-Quelltext konnte nicht gelesen werden.",
      inputUnavailable: "Python-input() ist in dieser LiaScript-Einbettung nicht verfügbar.",
      embedError: "Die glpython-Einbettung hat einen Fehler gemeldet.",
    },
    en: {
      reset: "Reset runtime",
      visualize: "Visualize",
      frameTitle: "glpython runtime",
      sourceUnreadable: "The LiaScript source block could not be read.",
      inputUnavailable: "Python input() is unavailable in this LiaScript embedding context.",
      embedError: "The glpython embed reported an error.",
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
  let nativeEditor = null
  let inputAvailable = false
  let runtimeReady = false
  let pendingRun = null

  const showError = (message) => {
    if (!error) return
    error.textContent = message
    error.hidden = false
  }

  const readSource = () => {
    const source = nativeEditor?.value
    if (typeof source !== "string") {
      showError(strings.sourceUnreadable)
      return null
    }
    return source
  }

  const reportInputCapability = (source) => {
    if (!error) return
    if (!inputAvailable && /(^|[^\w])input\s*\(/.test(source)) {
      showError(strings.inputUnavailable)
    } else {
      error.hidden = true
    }
  }

  const postSource = (type, source) => {
    if (!frame?.contentWindow) return
    reportInputCapability(source)
    frame.contentWindow.postMessage({
      type,
      version: protocolVersion,
      source,
      mode,
    }, embedOrigin)
  }

  const sendCommand = (type) => {
    if (!frame?.contentWindow) return
    if (type === "glpython:reset") {
      frame.contentWindow.postMessage({ type, version: protocolVersion }, embedOrigin)
      return
    }
    const source = readSource()
    if (source !== null) postSource(type, source)
  }

  const onMessage = (event) => {
    if (!frame || event.origin !== embedOrigin || event.source !== frame.contentWindow) return
    const message = event.data
    if (!message || message.version !== protocolVersion) return

    if (message.type === "glpython:ready") {
      runtimeReady = true
      inputAvailable = message.capabilities?.input === true
      frame.dataset.inputAvailable = String(inputAvailable)
      sendCommand(mode === "visual" ? "glpython:visualize" : "glpython:load")
      if (pendingRun !== null) {
        postSource("glpython:run", pendingRun)
        pendingRun = null
      }
      const visualizeButton = document.getElementById(`glpython-visualize-${sessionId}`)
      const resetButton = document.getElementById(`glpython-reset-${sessionId}`)
      if (visualizeButton) visualizeButton.disabled = false
      if (resetButton) resetButton.disabled = false
      send.lia("LIA: stop")
    } else if (message.type === "glpython:resize" && Number.isFinite(message.height)) {
      const minimumHeight = mode === "visual" ? 420 : 170
      frame.style.height = `${Math.max(minimumHeight, Math.min(message.height, 1200))}px`
    } else if (message.type === "glpython:error") {
      showError(message.message || strings.embedError)
    }
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
    const nativeCodeBlock = codeBlocks.findLast((block) =>
      block.compareDocumentPosition(frame) & Node.DOCUMENT_POSITION_FOLLOWING
    )
    nativeEditor = nativeCodeBlock?.querySelector("lia-editor") ?? null
    if (nativeCodeBlock) nativeCodeBlock.hidden = mode === "visual"
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
    if (frame.dataset.glpythonInitialized === "true") return
    frame.dataset.glpythonInitialized = "true"
    if (mode === "visual") frame.style.height = "420px"
    frame.title = `${strings.frameTitle} (${mode})`
    frame.src = `${embedUrl}?parentOrigin=${encodeURIComponent(window.location.origin)}&mode=${mode}&lang=${language}${visualizerMode ? `&visualizer=${visualizerMode}` : ""}`
  }

  const session = {
    attach,
    run(source) {
      attach()
      if (runtimeReady) {
        postSource("glpython:run", source)
      } else {
        pendingRun = source
      }
    },
  }
  sessions.set(sessionId, session)
  window.addEventListener("message", onMessage)
  new MutationObserver(attach).observe(document.body, { childList: true, subtree: true })
  attach()
})()

"LIA: wait"
</script>

<div class="glpython-embed">
  <div id="glpython-controls-@0" style="display:flex;gap:8px;justify-content:flex-end;margin:8px 0">
    <button id="glpython-reset-@0" type="button" disabled>Reset runtime</button>
    <button id="glpython-visualize-@0" type="button" disabled>Visualize</button>
  </div>
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
`de` (including regional variants such as `de-CH`), English for anything else.
Python's own error messages are never translated.

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
