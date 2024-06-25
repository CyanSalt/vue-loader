const { expect, test } = require('@jest/globals')
const normalizeNewline = require('normalize-newline')
const {
  genId,
  mockRender,
  mockBundleAndRun,
  initStylesForAllSubComponents,
} = require('./utils')

test('basic', async () => {
  const { window, module } = await mockBundleAndRun({
    entry: 'basic.vue',
  })
  const vnode = mockRender(module, {
    msg: 'hi',
  })

  // <h2 class="red">{{msg}}</h2>
  expect(vnode.tag).toBe('h2')
  expect(vnode.data.staticClass).toBe('red')
  expect(vnode.children[0].text).toBe('hi')

  expect(module.data().msg).toContain('Hello from Component A!')
  let style = window.document.querySelector('style').textContent
  style = normalizeNewline(style)
  expect(style).toContain('comp-a h2 {\n  color: #f00;\n}')
})

test('pre-processors', async () => {
  const { window, module, code } = await mockBundleAndRun({
    entry: 'pre.vue',
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          loader: 'babel-loader',
          options: {
            presets: ['babel-preset-env'],
          },
        },
        {
          test: /\.pug$/,
          loader: 'pug-plain-loader',
        },
        {
          test: /\.stylus$/,
          use: [
            'vue-style-loader',
            'css-loader',
            'stylus-loader',
          ],
        },
      ],
    },
  })
  // make sure babel is actually applied
  expect(code).toMatch('data: function data()')

  const vnode = mockRender(module)
  // div
  //   h1 This is the app
  //   comp-a
  //   comp-b
  expect(vnode.children[0].tag).toBe('h1')
  expect(vnode.children[1].tag).toBe('comp-a')
  expect(vnode.children[2].tag).toBe('comp-b')

  // script
  expect(module.data().msg).toContain('Hello from Babel')

  // style
  const style = window.document.querySelector('style').textContent
  expect(style).toContain('body {\n  font: 100% Helvetica, sans-serif;\n  color: #999;\n}')
})

test('style import', async () => {
  const { window } = await mockBundleAndRun({
    entry: 'style-import.vue',
  })
  const styles = window.document.querySelectorAll('style')
  expect(styles[0].textContent).toContain('h1 { color: red;\n}')
  // import with scoped
  const id = 'data-v-' + genId('style-import.vue')
  expect(styles[1].textContent).toContain('h1[' + id + '] { color: green;\n}')
})

test('style import for a same file twice', async () => {
  const { window, module } = await mockBundleAndRun({
    entry: 'style-import-twice.vue',
  })
  initStylesForAllSubComponents(module)
  const styles = window.document.querySelectorAll('style')
  expect(styles.length).toBe(3)
  expect(styles[0].textContent).toContain('h1 { color: red;\n}')
  // import with scoped
  const id = 'data-v-' + genId('style-import-twice-sub.vue')
  expect(styles[1].textContent).toContain('h1[' + id + '] { color: green;\n}')
  const id2 = 'data-v-' + genId('style-import-twice.vue')
  expect(styles[2].textContent).toContain('h1[' + id2 + '] { color: green;\n}')
})

test('template import', async () => {
  const { module } = await mockBundleAndRun({
    entry: 'template-import.vue',
  })
  const vnode = mockRender(module)
  // '<div><h1>hello</h1></div>'
  expect(vnode.children[0].tag).toBe('h1')
  expect(vnode.children[0].children[0].text).toBe('hello')
})

test('template import with pre-processors', async () => {
  const { module } = await mockBundleAndRun({
    entry: 'template-import-pre.vue',
    module: {
      rules: [
        {
          test: /\.pug$/,
          loader: 'pug-plain-loader',
        },
      ],
    },
  })
  const vnode = mockRender(module)
  // '<div><h1>hello</h1></div>'
  expect(vnode.children[0].tag).toBe('h1')
  expect(vnode.children[0].children[0].text).toBe('hello')
})

test('script import', async () => {
  const { module } = await mockBundleAndRun({
    entry: 'script-import.vue',
  })
  expect(module.data().msg).toContain('Hello from Component A!')
})

// #1620
test('cloned rules should not intefere with each other', async () => {
  await mockBundleAndRun({
    entry: 'basic.vue',
    module: {
      rules: [{
        test: /\.js$/,
        use: [
          {
            loader: 'babel-loader',
            options: {},
          },
        ],
      }, {
        test: /\.some-random-extension$/,
        use: [
          {
            loader: 'css-loader',
            options: {
              url: true,
            },
          },
        ],
      }],
    },
  })
})
