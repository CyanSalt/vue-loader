const path = require('path')
const qs = require('querystring')
const hash = require('hash-sum')
const loaderUtils = require('loader-utils')
const genCustomBlocksCode = require('./codegen/custom-blocks')
const { genHotReloadCode } = require('./codegen/hot-reload')
const genStylesCode = require('./codegen/style-injection')
const {
  attrsToQuery,
  testWebpack5,
  genMatchResource,
} = require('./codegen/utils')
const { resolveCompiler } = require('./compiler')
const { setDescriptor } = require('./descriptor-cache')
const { NS } = require('./plugin')
const plugin = require('./plugin')
const selectBlock = require('./select')

const componentNormalizerPath = require.resolve('./runtime/component-normalizer')

let errorEmitted = false

module.exports = function (source) {
  const loaderContext = this

  if (!errorEmitted && !loaderContext['thread-loader'] && !loaderContext[NS]) {
    loaderContext.emitError(
      new Error(
        `@legacy-vue/vue-loader was used without the corresponding plugin. `
          + `Make sure to include VueLoaderPlugin in your webpack config.`,
      ),
    )
    errorEmitted = true
  }

  const stringifyRequest = (r) => loaderUtils.stringifyRequest(loaderContext, r)

  const {
    mode,
    target,
    request,
    minimize,
    sourceMap,
    rootContext,
    resourcePath,
    resourceQuery: _resourceQuery = '',
    _compiler,
  } = loaderContext
  const isWebpack5 = testWebpack5(_compiler)
  const rawQuery = _resourceQuery.slice(1)
  const resourceQuery = rawQuery ? `&${rawQuery}` : ''
  const incomingQuery = qs.parse(rawQuery)
  const options = loaderUtils.getOptions(loaderContext) || {}
  const enableInlineMatchResource
    = isWebpack5 && Boolean(options.experimentalInlineMatchResource)
  const isServer = target === 'node'
  const isShadow = Boolean(options.shadowMode)
  const isProduction
    = mode === 'production'
    || options.productionMode
    || minimize
    || process.env.NODE_ENV === 'production'

  const filename = path.basename(resourcePath)
  const context = rootContext || process.cwd()
  const sourceRoot = path.dirname(path.relative(context, resourcePath))

  const { compiler, templateCompiler } = resolveCompiler(context, loaderContext)

  const descriptor = compiler.parse({
    source,
    compiler: options.compiler || templateCompiler,
    filename,
    sourceRoot,
    needMap: sourceMap,
  })

  // cache descriptor
  setDescriptor(resourcePath, descriptor)

  // module id for scoped CSS & hot-reload
  const rawShortFilePath = path
    .relative(context, resourcePath)
    .replace(/^(\.\.[/\\])+/, '')
  const shortFilePath = rawShortFilePath.replace(/\\/g, '/')
  const id = hash(
    isProduction
      ? shortFilePath + '\n' + source.replace(/\r\n/g, '\n')
      : shortFilePath,
  )

  // if the query has a type field, this is a language block request
  // e.g. foo.vue?type=template&id=xxxxx
  // and we will return early
  if (incomingQuery.type) {
    return selectBlock(
      descriptor,
      id,
      options,
      loaderContext,
      incomingQuery,
      Boolean(options.appendExtension),
    )
  }

  // feature information
  const hasScoped = descriptor.styles.some((s) => s.scoped)
  const hasFunctional
    = descriptor.template && descriptor.template.attrs.functional
  const needsHotReload
    = !isServer
    && !isProduction
    && (descriptor.script || descriptor.scriptSetup || descriptor.template)
    && options.hotReload !== false

  // script
  let scriptImport = `var script = {}`
  let isTS = false
  const { script, scriptSetup } = descriptor
  if (script || scriptSetup) {
    const lang = (script && script.lang) || (scriptSetup && scriptSetup.lang)
    isTS = Boolean(lang && /tsx?/.test(lang))
    const externalQuery
      = script && !scriptSetup && script.src ? `&external` : ``
    const src = (script && !scriptSetup && script.src) || resourcePath
    const attrsQuery = attrsToQuery((scriptSetup || script).attrs, 'js')
    const query = `?vue&type=script${attrsQuery}${resourceQuery}${externalQuery}`

    let scriptRequest
    if (enableInlineMatchResource) {
      scriptRequest = stringifyRequest(
        genMatchResource(loaderContext, src, query, lang || 'js'),
      )
    } else {
      scriptRequest = stringifyRequest(src + query)
    }
    scriptImport
      = `import script from ${scriptRequest}\nexport * from ${scriptRequest}` // support named exports
  }

  // template
  let templateImport = `var render, staticRenderFns`
  let templateRequest
  if (descriptor.template) {
    const src = descriptor.template.src || resourcePath
    const externalQuery = descriptor.template.src ? `&external` : ``
    const idQuery = `&id=${id}`
    const scopedQuery = hasScoped ? `&scoped=true` : ``
    const attrsQuery = attrsToQuery(descriptor.template.attrs)
    const tsQuery = options.enableTsInTemplate !== false && isTS ? `&ts=true` : ``
    const query = `?vue&type=template${idQuery}${scopedQuery}${tsQuery}${attrsQuery}${resourceQuery}${externalQuery}`
    if (enableInlineMatchResource) {
      templateRequest = stringifyRequest(
        genMatchResource(loaderContext, src, query, options.enableTsInTemplate !== false && isTS ? 'ts' : 'js'),
      )
    } else {
      templateRequest = stringifyRequest(src + query)
    }
    templateImport = `import { render, staticRenderFns } from ${templateRequest}`
  }

  // styles
  let stylesCode = ``
  if (descriptor.styles.length) {
    stylesCode = genStylesCode(
      loaderContext,
      descriptor.styles,
      id,
      resourcePath,
      stringifyRequest,
      needsHotReload,
      isServer || isShadow, // needs explicit injection?
      isProduction,
      enableInlineMatchResource,
    )
  }

  let code
    = `
${templateImport}
${scriptImport}
${stylesCode}

/* normalize component */
import normalizer from ${stringifyRequest(`!${componentNormalizerPath}`)}
var component = normalizer(
  script,
  render,
  staticRenderFns,
  ${hasFunctional ? `true` : `false`},
  ${/injectStyles/.test(stylesCode) ? `injectStyles` : `null`},
  ${hasScoped ? JSON.stringify(id) : `null`},
  ${isServer ? JSON.stringify(hash(request)) : `null`}
  ${isShadow ? `,true` : ``}
)
  `.trim() + `\n`

  if (descriptor.customBlocks && descriptor.customBlocks.length) {
    code += genCustomBlocksCode(
      loaderContext,
      descriptor.customBlocks,
      resourcePath,
      resourceQuery,
      stringifyRequest,
      enableInlineMatchResource,
    )
  }

  if (needsHotReload) {
    code += `\n` + genHotReloadCode(id, hasFunctional, templateRequest)
  }

  // Expose filename. This is used by the devtools and Vue runtime warnings.
  if (!isProduction) {
    // Expose the file's full path in development, so that it can be opened
    // from the devtools.
    code += `\ncomponent.options.__file = ${JSON.stringify(
      rawShortFilePath.replace(/\\/g, '/'),
    )}`
  } else if (options.exposeFilename) {
    // Libraries can opt-in to expose their components' filenames in production builds.
    // For security reasons, only expose the file's basename in production.
    code += `\ncomponent.options.__file = ${JSON.stringify(filename)}`
  }

  code += `\nexport default component.exports`
  return code
}

module.exports.VueLoaderPlugin = plugin
