// Syntax check of the macro: every <script> block in README.md, as LiaScript
// runs it, goes through `node --check`. LiaScript replaces the placeholders
// (@0, @1, @'input, …) before running a block; they all sit inside string
// literals, so the blocks are checked as written - a placeholder outside a
// string would be a syntax error here, as it would be in most courses.
//
//   node scripts/check-macro.mjs
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8')
const blocks = [...readme.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((match) => ({
  code: match[1],
  line: readme.slice(0, match.index).split('\n').length,
}))
if (blocks.length === 0) {
  console.error('No <script> blocks found in README.md.')
  process.exit(1)
}

const folder = mkdtempSync(join(tmpdir(), 'glpython-macro-'))
let failed = 0
for (const [index, block] of blocks.entries()) {
  const file = join(folder, `block-${index + 1}.js`)
  writeFileSync(file, block.code)
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' })
  if (result.status !== 0) {
    failed += 1
    // node reports the line within the block; the block's first line is the
    // one with <script>.
    const blockLine = Number(result.stderr.match(/\.js:(\d+)/)?.[1] ?? 1)
    console.error(`README.md line ${block.line + blockLine - 1}: syntax error in the <script> block starting at line ${block.line}:\n${result.stderr}`)
  }
}
if (failed > 0) process.exit(1)
console.log(`Macro check passed: ${blocks.length} <script> blocks.`)
