const { expect, test } = require('@jest/globals')
const { SourceMapConsumer } = require('source-map')
const { mfs, bundle } = require('./utils')

test('source map', async () => {
  const { code } = await bundle({
    entry: 'basic.vue',
    devtool: 'source-map',
  })
  const map = mfs.readFileSync('/test.build.js.map', 'utf-8')
  const smc = await new SourceMapConsumer(JSON.parse(map))
  let line
  let col
  const targetRE = /^\s+msg: 'Hello from Component A!'/
  const lines = code.split(/\r?\n/g)
  for (let i = 0; i < lines.length; i += 1) {
    if (targetRE.test(lines[i])) {
      line = i + 1
      col = 0
      break
    }
  }
  const pos = smc.originalPositionFor({
    line,
    column: col,
  })
  expect(pos.source.includes('basic.vue'))
  expect(pos.line).toBe(9)
})
