const qs = require('querystring')
const loaderUtils = require('loader-utils')
const { resolveCompiler } = require('../compiler')
const { getDescriptor } = require('../descriptor-cache')
const { resolveScript } = require('../resolve-script')

// Loader that compiles raw template into JavaScript functions.
// This is injected by the global pitcher (../pitch) for template
// selection requests initiated from vue files.
module.exports = function (source) {
  const loaderContext = this
  const filename = this.resourcePath
  const ctx = this.rootContext
  const query = qs.parse(this.resourceQuery.slice(1))

  // although this is not the main vue-loader, we can get access to the same
  // vue-loader options because we've set an ident in the plugin and used that
  // ident to create the request for this loader in the pitcher.
  const options = loaderUtils.getOptions(loaderContext) || {}
  const { id } = query
  const isServer = loaderContext.target === 'node'
  const isProduction = options.productionMode
    || loaderContext.minimize
    || process.env.NODE_ENV === 'production'
  const isFunctional = query.functional

  const compilerOptions = {
    outputSourceRange: true,
    ...options.compilerOptions,
    scopeId: query.scoped ? `data-v-${id}` : null,
    comments: query.comments,
  }

  const { compiler, templateCompiler } = resolveCompiler(ctx, loaderContext)

  const descriptor = getDescriptor(filename, options, loaderContext)
  const script = resolveScript(descriptor, id, options, loaderContext)
  const isTS = options.enableTsInTemplate !== false && (
    descriptor.scriptSetup?.lang === 'ts' || descriptor.script?.lang === 'ts'
  )

  // Prettier 3 APIs are all async
  // but `vue/compiler-sfc` and `@vue/component-compiler-utils` can only use sync function to format code
  let hasCompatiblePrettier = false
  try {
    const prettier = require('prettier/package.json')
    const major = parseInt(prettier.version.split('.')[0], 10)
    if (major === 1 || major === 2) {
      hasCompatiblePrettier = true
    }
  } catch (e) {
    // ignore
  }

  // for vue/compiler-sfc OR @vue__component-compiler-utils
  const finalOptions = {
    source,
    filename: this.resourcePath,
    compiler: options.compiler || templateCompiler,
    compilerOptions,
    // allow customizing behavior of vue-template-es2015-compiler
    transpileOptions: options.transpileOptions,
    transformAssetUrls: options.transformAssetUrls || true,
    isProduction,
    isFunctional,
    isTS,
    optimizeSSR: isServer && options.optimizeSSR !== false,
    prettify: options.prettify === undefined ? hasCompatiblePrettier : options.prettify,
    bindings: script ? script.bindings : undefined,
  }

  const compiled = compiler.compileTemplate(finalOptions)

  // tips
  if (compiled.tips && compiled.tips.length) {
    compiled.tips.forEach((tip) => {
      loaderContext.emitWarning(typeof tip === 'object' ? tip.msg : tip)
    })
  }

  // errors
  if (compiled.errors && compiled.errors.length) {
    const generateCodeFrame
      = (templateCompiler && templateCompiler.generateCodeFrame)
      || compiler.generateCodeFrame
    const REGEXP_SYNTAX_ERROR = /^invalid (expression:|function parameter expression:|v-)/
    // 2.6 compiler outputs errors as objects with range
    if (generateCodeFrame && finalOptions.compilerOptions.outputSourceRange) {
      // Ignore syntax error detection when using TS
      const errors = isTS
        ? compiled.errors.filter(({ msg }) => !REGEXP_SYNTAX_ERROR.test(msg))
        : compiled.errors
      if (errors.length) {
        // TODO account for line offset in case template isn't placed at top
        // of the file
        loaderContext.emitError(
          `\n\n  Errors compiling template:\n\n`
            + errors
              .map(({ msg, start, end }) => {
                const frame = generateCodeFrame(source, start, end)
                return `  ${msg}\n\n${pad(frame)}`
              })
              .join(`\n\n`)
            + '\n',
        )
      }
    } else {
      // Ignore syntax error detection when using TS
      const errors = isTS
        ? compiled.errors.filter(error => !REGEXP_SYNTAX_ERROR.test(error))
        : compiled.errors
      if (errors.length) {
        loaderContext.emitError(
          `\n  Error compiling template:\n${pad(compiled.source)}\n`
            + errors.map((e) => `  - ${e}`).join('\n')
            + '\n',
        )
      }
    }
  }

  const { code } = compiled

  // finish with ESM exports
  return code + `\nexport { render, staticRenderFns }`
}

function pad(source) {
  return source
    .split(/\r?\n/)
    .map((line) => `  ${line}`)
    .join('\n')
}
