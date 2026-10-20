<!--

author:   Cedric Vogel
version:  0.1.0
language: en

comment:  Embed the glpython editor, execution visualizer, and turtle graphics
          in LiaScript courses.

@GLPython.eval: @GLPython.embed(@uid,eval)

@GLPython.turtle: @GLPython.embed(@uid,turtle)

@GLPython.embed
<script run-once>
(() => {
  const protocolVersion = 1
  const embedOrigin = "https://cedricvogel-leo.github.io"
  const embedUrl = `${embedOrigin}/glpython-editor/index.html`
  const frame = document.getElementById("glpython-frame-@0")
  const error = document.getElementById("glpython-error-@0")
  const runButton = document.getElementById("glpython-run-@0")
  const visualizeButton = document.getElementById("glpython-visualize-@0")
  const resetButton = document.getElementById("glpython-reset-@0")
  const mode = "@1"
  const codeBlocks = [
    ...(frame.closest(".lia-slide__content")?.querySelectorAll(".lia-code--block") ?? []),
  ]
  const nativeCodeBlock = codeBlocks.findLast((block) =>
    block.compareDocumentPosition(frame) & Node.DOCUMENT_POSITION_FOLLOWING
  )
  const nativeEditor = nativeCodeBlock?.querySelector("lia-editor")
  let inputAvailable = false

  const showError = (message) => {
    error.textContent = message
    error.hidden = false
  }

  const readSource = () => {
    const source = nativeEditor?.value
    if (typeof source !== "string") {
      showError("The LiaScript source block could not be read.")
      return null
    }
    return source
  }

  const reportInputCapability = (source) => {
    if (!inputAvailable && /(^|[^\w])input\s*\(/.test(source)) {
      showError("Python input() is unavailable in this LiaScript embedding context.")
    } else {
      error.hidden = true
    }
  }

  const sendCommand = (type) => {
    if (!frame.contentWindow) return
    if (type === "glpython:reset") {
      frame.contentWindow.postMessage({ type, version: protocolVersion }, embedOrigin)
      return
    }
    const source = readSource()
    if (source === null) return
    reportInputCapability(source)
    frame.contentWindow.postMessage({
      type,
      version: protocolVersion,
      source,
      mode,
    }, embedOrigin)
  }

  runButton.addEventListener("click", () => sendCommand("glpython:run"))
  visualizeButton.addEventListener("click", () => sendCommand("glpython:visualize"))
  resetButton.addEventListener("click", () => sendCommand("glpython:reset"))
  visualizeButton.hidden = mode !== "eval"

  const onMessage = (event) => {
    if (event.origin !== embedOrigin || event.source !== frame.contentWindow) return
    const message = event.data
    if (!message || message.version !== protocolVersion) return

    if (message.type === "glpython:ready") {
      inputAvailable = message.capabilities?.input === true
      frame.dataset.inputAvailable = String(inputAvailable)
      sendCommand("glpython:load")
      runButton.disabled = false
      visualizeButton.disabled = false
      resetButton.disabled = false
      send.lia("LIA: stop")
    } else if (message.type === "glpython:resize" && Number.isFinite(message.height)) {
      frame.style.height = `${Math.max(170, Math.min(message.height, 1200))}px`
    } else if (message.type === "glpython:error") {
      showError(message.message || "The glpython embed reported an error.")
    }
  }

  window.addEventListener("message", onMessage)
  frame.addEventListener("load", () => {
    window.setTimeout(() => {
      if (!frame.contentWindow) showError("The glpython embed could not be loaded.")
    }, 5000)
  })
  frame.src = `${embedUrl}?parentOrigin=${encodeURIComponent(window.location.origin)}&mode=${mode}`
})()

"LIA: wait"
</script>

<div class="glpython-embed">
  <div style="display:flex;gap:8px;justify-content:flex-end;margin:8px 0">
    <button id="glpython-reset-@0" type="button" disabled>Reset runtime</button>
    <button id="glpython-visualize-@0" type="button" disabled>Visualize</button>
    <button id="glpython-run-@0" type="button" disabled>Run</button>
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
state. The glpython runtime provides normal execution, output, and the step-by-step
visualizer without mounting a second editor. It does not reserve space for turtle
graphics.

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
