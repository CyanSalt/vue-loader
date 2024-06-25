const normalizeNewline = require('normalize-newline')
const {
  genId,
  mockRender,
  mockBundleAndRun,
  DEFAULT_VUE_USE
} = require('./utils')

test('scoped style', async () => {
  const { window, module } = await mockBundleAndRun({
    entry: 'scoped-css.vue'
  })
  const shortId = genId('scoped-css.vue')
  const id = 'data-v-' + shortId
  expect(module._scopeId).toBe(id)

  const vnode = mockRender(module, {
    ok: true
  })
  // <div>
  //   <div><h1>hi</h1></div>
  //   <p class="abc def">hi</p>
  //   <template v-if="ok"><p class="test">yo</p></template>
  //   <svg><template><p></p></template></svg>
  // </div>
  expect(vnode.children[0].tag).toBe('div')
  expect(vnode.children[1].text).toBe(' ')
  expect(vnode.children[2].tag).toBe('p')
  expect(vnode.children[2].data.staticClass).toBe('abc def')
  expect(vnode.children[4].tag).toBe('p')
  expect(vnode.children[4].data.staticClass).toBe('test')

  let style = window.document.querySelector('style').textContent
  style = normalizeNewline(style)
  expect(style).toContain(`.test[${id}] {\n  color: yellow;\n}`)
  expect(style).toContain(`.test[${id}]:after {\n  content: \'bye!\';\n}`)
  expect(style).toContain(`h1[${id}] {\n  color: green;\n}`)
  // scoped keyframes
  expect(style).toContain(`.anim[${id}] {\n  animation: color-${shortId} 5s infinite, other 5s;`)
  expect(style).toContain(`.anim-2[${id}] {\n  animation-name: color-${shortId}`)
  expect(style).toContain(`.anim-3[${id}] {\n  animation: 5s color-${shortId} infinite, 5s other;`)
  expect(style).toContain(`@keyframes color-${shortId} {`)
  expect(style).toContain(`@-webkit-keyframes color-${shortId} {`)

  expect(style).toContain(
    `.anim-multiple[${id}] {\n  animation: color-${shortId} 5s infinite,opacity-${shortId} 2s;`
  )
  expect(style).toContain(`.anim-multiple-2[${id}] {\n  animation-name: color-${shortId},opacity-${shortId};`)
  expect(style).toContain(`@keyframes opacity-${shortId} {`)
  expect(style).toContain(`@-webkit-keyframes opacity-${shortId} {`)
  // >>> combinator
  expect(style).toContain(`.foo p[${id}] .bar {\n  color: red;\n}`)
})

test('media-query', async () => {
  const { window } = await mockBundleAndRun({
    entry: 'media-query.vue'
  })
  let style = window.document.querySelector('style').textContent
  style = normalizeNewline(style)
  const id = 'data-v-' + genId('media-query.vue')
  expect(style).toContain('@media print {\n.foo[' + id + '] {\n    color: #000;\n}\n}')
})

test('supports-query', async () => {
  const { window } = await mockBundleAndRun({
    entry: 'supports-query.vue'
  })
  let style = window.document.querySelector('style').textContent
  style = normalizeNewline(style)
  const id = 'data-v-' + genId('supports-query.vue')
  expect(style).toContain('@supports ( color: #000 ) {\n.foo[' + id + '] {\n    color: #000;\n}\n}')
})

test('postcss', async () => {
  const { window } = await mockBundleAndRun({
    entry: 'postcss.vue',
    module: {
      rules: [
        {
          test: /\.postcss$/,
          use: [
            'vue-style-loader',
            'css-loader',
            {
              loader: 'postcss-loader',
              options: {
                parser: require('sugarss')
              }
            }
          ]
        }
      ]
    }
  })
  const id = 'data-v-' + genId('postcss.vue')
  let style = window.document.querySelector('style').textContent
  style = normalizeNewline(style)
  expect(style).toContain(`h1[${id}] {\n  color: red;\n  font-size: 14px\n}`)
})

test('CSS Modules', async () => {
  async function testWithIdent (localIdentName, regexToMatch) {
    const baseLoaders = [
      'vue-style-loader',
      {
        loader: 'css-loader',
        options: {
          modules: true,
          localIdentName
        }
      }
    ]
    const { window, instance } = await mockBundleAndRun({
      entry: 'css-modules.vue',
      modify: config => {
        config.module.rules = [
          {
            test: /\.vue$/,
            use: [DEFAULT_VUE_USE]
          },
          {
            test: /\.css$/,
            use: baseLoaders
          },
          {
            test: /\.stylus$/,
            use: [
              ...baseLoaders,
              'stylus-loader'
            ]
          }
        ]
      }
    })

    // get local class name
    const className = instance.style.red
    expect(className).toMatch(regexToMatch)

    // class name in style
    let style = [].slice.call(window.document.querySelectorAll('style')).map((style) => {
      return style.textContent
    }).join('\n')
    style = normalizeNewline(style)
    expect(style).toContain('.' + className + ' {\n  color: red;\n}')

    // animation name
    const match = style.match(/@keyframes\s+(\S+)\s+{/)
    expect(match).toHaveLength(2)
    const animationName = match[1]
    expect(animationName).not.toBe('fade')
    expect(style).toContain('animation: ' + animationName + ' 1s;')

    // default module + pre-processor + scoped
    const anotherClassName = instance.$style.red
    expect(anotherClassName).toMatch(regexToMatch)
    const id = 'data-v-' + genId('css-modules.vue')
    expect(style).toContain('.' + anotherClassName + '[' + id + ']')
  }

  // default ident
  await testWithIdent(undefined, /^\w{21,}/)

  // custom ident
  await testWithIdent(
    '[path][name]---[local]---[hash:base64:5]',
    /css-modules---red---\w{5}/
  )
})

test('CSS Modules Extend', async () => {
  const baseLoaders = [
    'vue-style-loader',
    {
      loader: 'css-loader',
      options: {
        modules: true
      }
    }
  ]
  const { window, module, instance } = await mockBundleAndRun({
    entry: 'css-modules-extend.vue',
    modify: config => {
      config.module.rules = [
        {
          test: /\.vue$/,
          use: [DEFAULT_VUE_USE]
        },
        {
          test: /\.css$/,
          use: baseLoaders
        }
      ]
    }
  })

  const vnode = mockRender(module)
  expect(vnode.data.class).toBe(instance.$style.red)

  const style = window.document.querySelectorAll('style')[1].textContent
  expect(style).toContain(`.${instance.$style.red} {\n  color: #FF0000;\n}`)
})
