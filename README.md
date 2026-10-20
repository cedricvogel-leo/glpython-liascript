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
  const source = "@'input"
  const mode = "@1"
  const nativeCodeBlock = frame
    .closest(".lia-slide__content")
    ?.querySelector(".lia-code--block")
  if (nativeCodeBlock) nativeCodeBlock.hidden = true

  const showError = (message) => {
    error.textContent = message
    error.hidden = false
  }

  const sendSource = () => {
    frame.contentWindow.postMessage({
      type: "glpython:load",
      version: protocolVersion,
      source,
      mode,
    }, embedOrigin)
  }

  const onMessage = (event) => {
    if (event.origin !== embedOrigin || event.source !== frame.contentWindow) return
    const message = event.data
    if (!message || message.version !== protocolVersion) return

    if (message.type === "glpython:ready") {
      const inputAvailable = message.capabilities?.input === true
      frame.dataset.inputAvailable = String(inputAvailable)
      if (!inputAvailable && /(^|[^\w])input\s*\(/.test(source)) {
        showError("Python input() is unavailable in this LiaScript embedding context.")
      } else {
        error.hidden = true
      }
      sendSource()
      send.lia("LIA: stop")
    } else if (message.type === "glpython:resize" && Number.isFinite(message.height)) {
      frame.style.height = `${Math.max(420, Math.min(message.height, 1200))}px`
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
  <p id="glpython-error-@0" class="glpython-error" hidden></p>
  <iframe
    id="glpython-frame-@0"
    title="glpython @1 editor"
    loading="lazy"
    referrerpolicy="strict-origin"
    allow="clipboard-read; clipboard-write"
    style="display:block;width:100%;height:620px;border:0;border-radius:8px;background:#f4f1e9"
  ></iframe>
</div>
@end

-->

# glpython for LiaScript

Run and visualize Python directly in a LiaScript course with the browser-based
[glpython](https://github.com/cedricvogel-leo/glpython) editor.

The macros use a separately hosted iframe. Python runs locally in the learner's
browser through Pyodide; source code is sent to the iframe only after an
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

The compact eval layout provides editing, normal execution, output, and the
step-by-step visualizer. It does not show or reserve space for turtle graphics.

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
