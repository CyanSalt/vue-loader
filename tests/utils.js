const Vue = require('vue')
const path = require('path')
const hash = require('hash-sum')
const { JSDOM, VirtualConsole } = require('jsdom')
const webpack = require('webpack')
const merge = require('webpack-merge')
const { createFsFromVolume, Volume } = require('memfs')

const mfs = createFsFromVolume(new Volume())
const VueLoaderPlugin = require('../lib/plugin')

const DEFAULT_VUE_USE = {
  loader: 'vue-loader',
  options: {
    experimentalInlineMatchResource: Boolean(process.env.INLINE_MATCH_RESOURCE)
  }
}

const baseConfig = {
  mode: 'development',
  devtool: false,
  output: {
    path: '/',
    publicPath: '',
    filename: 'test.build.js'
  },
  resolveLoader: {
    alias: {
      'vue-loader': require.resolve('../lib')
    }
  },
  module: {
    rules: [
      {
        test: /\.vue$/,
        use: [DEFAULT_VUE_USE]
      }
    ]
  },
  plugins: [
    new VueLoaderPlugin(),
    new webpack.optimize.ModuleConcatenationPlugin()
  ],
  // https://github.com/webpack/webpack/issues/10542
  optimization: {
    usedExports: false
  }
}

function genId (file) {
  return hash(path.join('tests', 'fixtures', file).replace(/\\/g, '/'))
}

function bundle (options, wontThrowError) {
  let config = merge({}, baseConfig, options)
  if (!options.experiments || !options.experiments.css) {
    config.module && config.module.rules && config.module.rules.push({
      test: /\.css$/,
      use: ['vue-style-loader', 'css-loader']
    })
  }
  if (config.vue) {
    const vueOptions = {
      // Test experimental inline match resource by default
      experimentalInlineMatchResource: Boolean(
        process.env.INLINE_MATCH_RESOURCE
      ),
      ...options.vue
    }
    delete config.vue
    const vueIndex = config.module.rules.findIndex(r => r.test.test('.vue'))
    const vueRule = config.module.rules[vueIndex]

    // Detect `Rule.use` or `Rule.loader` and `Rule.options` combination
    if (vueRule && typeof vueRule === 'object' && Array.isArray(vueRule.use)) {
      // Vue usually locates at the first loader
      if (vueRule.use && typeof vueRule.use[0] === 'object') {
        vueRule.use[0] = Object.assign({}, vueRule.use[0], {
          options: vueOptions
        })
      }
    } else {
      config.module.rules[vueIndex] = Object.assign({}, vueRule, {
        options: vueOptions
      })
    }
  }

  if (/\.vue/.test(config.entry)) {
    const vueFile = config.entry
    config = merge(config, {
      entry: require.resolve('./fixtures/entry'),
      resolve: {
        alias: {
          '~target': path.resolve(__dirname, './fixtures', vueFile)
        }
      }
    })
  }

  if (options.modify) {
    delete config.modify
    options.modify(config)
  }

  const webpackCompiler = webpack(config)
  webpackCompiler.outputFileSystem = mfs
  webpackCompiler.outputFileSystem.join = path.join.bind(path)

  return new Promise((resolve, reject) => {
    webpackCompiler.run((err, stats) => {
      if (!wontThrowError) {
        expect(err).toBeNull()

        if (stats.hasErrors()) {
          return console.error(stats.toString('errors-only'))
        }
        expect(stats.hasErrors()).toBeFalsy()
      }
      if (err) {
        reject(err)
      } else {
        resolve({
          code: mfs.readFileSync('/test.build.js').toString(),
          stats
        })
      }
    })
  })
}

async function mockBundleAndRun (options, wontThrowError) {
  const { code, stats } = await bundle(options, wontThrowError)

  let dom
  try {
    dom = new JSDOM(`<!DOCTYPE html><html><head></head><body></body></html>`, {
      runScripts: 'outside-only',
      virtualConsole: new VirtualConsole()
    })
    dom.window.eval(code)
  } catch (e) {
    console.error(`JSDOM error:\n${e.stack}`)
    throw e
  }

  const { window } = dom
  const { module, exports } = window
  const instance = {}
  if (module && module.beforeCreate) {
    module.beforeCreate.forEach(hook => hook.call(instance))
  }
  return {
    window,
    module,
    exports,
    instance,
    code,
    stats
  }
}

function mockRender (options, data = {}) {
  const vm = new Vue(Object.assign({}, options, { data () { return data } }))
  vm.$mount()
  return vm._vnode
}

function interopDefault (module) {
  return module
    ? module.default ? module.default : module
    : module
}

function initStylesForAllSubComponents (module) {
  if (module.components) {
    for (const name in module.components) {
      const sub = module.components[name]
      const instance = {}
      if (sub && sub.beforeCreate) {
        sub.beforeCreate.forEach(hook => hook.call(instance))
      }
      initStylesForAllSubComponents(sub)
    }
  }
}

module.exports = {
  mfs,
  baseConfig,
  genId,
  bundle,
  mockBundleAndRun,
  mockRender,
  interopDefault,
  initStylesForAllSubComponents,
  DEFAULT_VUE_USE
}
