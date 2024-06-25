const { expect, test } = require('@jest/globals')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const normalizeNewline = require('normalize-newline')

const {
  mfs,
  genId,
  bundle,
  mockBundleAndRun,
  DEFAULT_VUE_USE,
} = require('./utils')

test('support chaining with other loaders', async () => {
  const { module } = await mockBundleAndRun({
    entry: 'basic.vue',
    modify: config => {
      config.module.rules[0] = {
        test: /\.vue$/,
        use: [
          DEFAULT_VUE_USE,
          require.resolve('./mock-loaders/js'),
        ],
      }
    },
  })
  expect(module.data().msg).toBe('Changed!')
})

test('inherit queries on files', async () => {
  const { module } = await mockBundleAndRun({
    entry: 'basic.vue?change',
    modify: config => {
      config.module.rules[0] = {
        test: /\.vue$/,
        use: [
          DEFAULT_VUE_USE,
          require.resolve('./mock-loaders/query'),
        ],
      }
    },
  })
  expect(module.data().msg).toBe('Changed!')
})

test('expose file path as __file outside production', async () => {
  const { module } = await mockBundleAndRun({
    entry: 'basic.vue',
  })
  expect(module.__file).toBe('tests/fixtures/basic.vue')
})

test('no __file in production when exposeFilename disabled', async () => {
  const { module } = await mockBundleAndRun({
    mode: 'production',
    entry: 'basic.vue',
  })
  expect(module.__file).toBe(undefined)
})

test('expose file basename as __file in production when exposeFilename enabled', async () => {
  const { module } = await mockBundleAndRun({
    mode: 'production',
    entry: 'basic.vue',
    vue: {
      exposeFilename: true,
    },
  })
  expect(module.__file).toBe('basic.vue')
})

test('extract CSS', async () => {
  await bundle({
    entry: 'extract-css.vue',
    modify: config => {
      config.module.rules = [
        {
          test: /\.vue$/,
          use: [DEFAULT_VUE_USE],
        },
        {
          test: /\.css$/,
          use: [
            MiniCssExtractPlugin.loader,
            'css-loader',
          ],
        },
        {
          test: /\.stylus$/,
          use: [
            MiniCssExtractPlugin.loader,
            'css-loader',
            'stylus-loader',
          ],
        },
      ]
    },
    plugins: [
      new MiniCssExtractPlugin({
        filename: 'test.output.css',
      }),
    ],
  })
  const css = normalizeNewline(mfs.readFileSync('/test.output.css').toString())
  const id = `data-v-${genId('extract-css.vue')}`
  expect(css).toContain(`h1 {\n  color: #f00;\n}`)
  // extract + scoped
  expect(css).toContain(`h2[${id}] {\n  color: green;\n}`)
})

test('extract CSS with code spliting', async () => {
  await bundle({
    entry: 'extract-css-chunks.vue',
    modify: config => {
      config.module.rules = [
        {
          test: /\.vue$/,
          use: [DEFAULT_VUE_USE],
        },
        {
          test: /\.css$/,
          use: [
            MiniCssExtractPlugin.loader,
            'css-loader',
          ],
        },
      ]
    },
    plugins: [
      new MiniCssExtractPlugin({
        filename: 'test.output.css',
      }),
    ],
  })
  const css = normalizeNewline(mfs.readFileSync('/test.output.css').toString())
  expect(css).toContain(`h1 {\n  color: red;\n}`)
  expect(mfs.existsSync('/empty.test.output.css')).toBe(false)
  expect(mfs.existsSync('/basic.test.output.css')).toBe(true)
})

test('support rules with oneOf', async () => {
  const run = entry => mockBundleAndRun({
    entry,
    modify: config => {
      config.module.rules = [
        { test: /\.vue$/, use: [DEFAULT_VUE_USE] },
        {
          test: /\.css$/,
          use: 'vue-style-loader',
          oneOf: [
            {
              resourceQuery: /module/,
              use: [
                {
                  loader: 'css-loader',
                  options: {
                    modules: true,
                    localIdentName: '[local]_[hash:base64:5]',
                  },
                },
              ],
            },
            {
              use: ['css-loader'],
            },
          ],
        },
      ]
    },
  })

  await run('basic.vue', ({ window }) => {
    let style = window.document.querySelector('style').textContent
    style = normalizeNewline(style)
    expect(style).toContain('comp-a h2 {\n  color: #f00;\n}')
  })

  await run('css-modules-simple.vue', ({ window, instance }) => {
    const className = instance.$style.red
    expect(className).toMatch(/^red_\w{5}/)
    let style = window.document.querySelector('style').textContent
    style = normalizeNewline(style)
    expect(style).toContain('.' + className + ' {\n  color: red;\n}')
  })
})

test('should work with eslint loader', async () => {
  await bundle({
    entry: 'basic.vue',
    modify: config => {
      config.module.rules.unshift({
        test: /\.vue$/, use: [DEFAULT_VUE_USE], enforce: 'pre',
      })
    },
  })
})
