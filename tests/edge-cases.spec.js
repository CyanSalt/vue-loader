const path = require('path')
const normalizeNewline = require('normalize-newline')
const webpack = require('webpack')
const HTMLPlugin = require('html-webpack-plugin')

const {
  mfs,
  bundle,
  mockRender,
  mockBundleAndRun,
  DEFAULT_VUE_USE
} = require('./utils')

const assertComponent = ({
  window,
  module,
  expectedMsg = 'Hello from Component A!'
}) => {
  if (typeof module === 'function') {
    module = module.options
  }

  const vnode = mockRender(module, {
    msg: 'hi'
  })

  // <h2 class="red">{{msg}}</h2>
  expect(vnode.tag).toBe('h2')
  expect(vnode.data.staticClass).toBe('red')
  expect(vnode.children[0].text).toBe('hi')

  expect(module.data().msg).toContain(expectedMsg)
  let style = window.document.querySelector('style').textContent
  style = normalizeNewline(style)
  expect(style).toContain('comp-a h2 {\n  color: #f00;\n}')
}

test('vue rule with include', async () => {
  const res = await mockBundleAndRun({
    entry: 'basic.vue',
    modify: config => {
      config.module.rules[0] = {
        test: /\.vue$/,
        include: /fixtures/,
        use: [DEFAULT_VUE_USE]
      }
    }
  })
  assertComponent(res)
})

test('test-less oneOf rules', async () => {
  const res = await mockBundleAndRun({
    entry: 'basic.vue',
    modify: config => {
      config.module.rules = [
        {
          test: /\.vue$/,
          use: [DEFAULT_VUE_USE]
        },
        {
          oneOf: [
            {
              test: /\.css$/,
              use: ['vue-style-loader', 'css-loader']
            }
          ]
        }
      ]
    }
  })
  assertComponent(res)
})

test('babel-loader inline options', async () => {
  await bundle({
    entry: 'basic.vue',
    module: {
      rules: [
        {
          test: /\.js/,
          loader: 'babel-loader',
          options: {
            babelrc: false,
            presets: [
              [require('babel-preset-env'), { modules: false }]
            ]
          }
        }
      ]
    }
  }, true)
})

// #1210
test('normalize multiple use + options', async () => {
  await bundle({
    entry: 'basic.vue',
    modify: config => {
      config.module.rules[0] = {
        test: /\.vue$/,
        use: [DEFAULT_VUE_USE]
      }
    }
  }, true)
})

test('should not duplicate css modules value imports', async () => {
  const { window, exports, code } = await mockBundleAndRun({
    entry: './tests/fixtures/duplicate-cssm.js',
    modify: config => {
      config.module.rules[1] = {
        test: /\.css$/,
        use: [
          'vue-style-loader',
          {
            loader: 'css-loader',
            options: {
              modules: true
            }
          }
        ]
      }
    }
  })
  const localsRE = /exports.locals = {\s+"color": "red"\s+};/
  const matches = code.match(localsRE)
  expect(matches.length).toBe(1)

  const styles = window.document.querySelectorAll('style')
  expect(styles.length).toBe(2) // one for values, one for the component
  const style = normalizeNewline(styles[1].textContent)
  // value should be injected
  expect(style).toMatch('color: red;')
  // exports is set as the locals imported from values.css
  expect(exports.color).toBe('red')
})

test('html-webpack-plugin', async () => {
  await bundle({
    entry: 'basic.vue',
    plugins: [
      new HTMLPlugin({
        inject: true,
        template: path.resolve(__dirname, 'fixtures/index.html'),
        filename: 'output.html'
      })
    ]
  }, true)
  const html = mfs.readFileSync('/output.html', 'utf-8')
  expect(html).toMatch('test.build.js')
})

test('usage with null-loader', async () => {
  await mockBundleAndRun({
    entry: 'basic.vue',
    modify: config => {
      config.module.rules[1] = {
        test: /\.css$/,
        use: ['null-loader']
      }
    }
  })
})

test('proper dedupe on src-imports with options', async () => {
  const res = await mockBundleAndRun({
    entry: 'ts.vue',
    resolve: {
      extensions: ['.ts', '.js']
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          loader: 'ts-loader',
          options: { appendTsSuffixTo: [/\.vue$/], transpileOnly: true }
        }
      ]
    }
  })
  assertComponent(res)
}, 30000)

// #1351
test('use with postLoader', async () => {
  const { window, module } = await mockBundleAndRun({
    entry: 'basic.vue',
    module: {
      rules: [
        {
          test: /\.js$/,
          use: {
            loader: require.resolve('./mock-loaders/js')
          },
          enforce: 'post'
        }
      ]
    }
  })
  assertComponent({
    window,
    module,
    expectedMsg: 'Changed!'
  })
})

// #1711
test('data: URI as entry', async () => {
  // this feature is only available in webpack 5
  if (webpack.version.startsWith('4')) {
    return
  }

  await bundle({
    entry: {
      main: 'data:text/javascript,console.log("hello world")'
    }
  })
})
