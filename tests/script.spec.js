const {
  mockRender,
  mockBundleAndRun
} = require('./utils')

test('allow exporting extended constructor', async () => {
  const { module } = await mockBundleAndRun({
    entry: 'extend.vue'
  })
  // extend.vue should export Vue constructor
  const Component = module
  const vnode = mockRender(Component.options, {
    msg: 'success'
  })
  expect(vnode.tag).toBe('div')
  expect(vnode.children[0].text).toBe('success')
  expect(new Component().msg === 'success')
})

test('named exports', async () => {
  const { exports } = await mockBundleAndRun({
    entry: 'named-exports.vue'
  })
  expect(exports.default.name).toBe('named-exports')
  expect(exports.foo()).toBe(1)
})
