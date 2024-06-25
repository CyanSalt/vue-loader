let yaml = require('js-yaml')

module.exports = function (source) {
  if (this.cacheable) {
    this.cacheable()
  }
  let res = yaml.safeLoad(source)
  return JSON.stringify(res)
}
