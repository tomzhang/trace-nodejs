'use strict'

var path = require('path')
var os = require('os')
var url = require('url')
var debug = require('debug')('risingstack/trace')
var defaults = require('lodash.defaults')
var format = require('util').format

function ConfigReader (config) {
  this.parameterConfig = config || { }
}

ConfigReader.prototype._getSystemConfig = function () {
  return {
    system: {
      osArch: process.arch,
      osPlatform: process.platform,
      osRelease: os.release(),
      hostname: os.hostname(),
      cpus: os.cpus().map(function (cpu) {
        delete cpu.times
        return cpu
      }),
      processName: process.title,
      processId: process.pid,
      processVersion: process.version
    }
  }
}

ConfigReader.prototype._getEnvVarConfig = function () {
  var envVarConfig = {
    collectInterval: process.env.TRACE_COLLECT_INTERVAL,
    initialSampleRate: process.env.TRACE_INITIAL_SAMPLE_RATE,
    collectorApiUrl: process.env.TRACE_COLLECTOR_API_URL,
    serviceName: process.env.TRACE_SERVICE_NAME,
    configPath: process.env.TRACE_CONFIG_PATH,
    apiKey: process.env.TRACE_API_KEY
  }

  if (process.env.TRACE_IGNORE_HEADERS) {
    try {
      var ignoreHeaders = JSON.parse(process.env.TRACE_IGNORE_HEADERS)
      defaults(envVarConfig, { ignoreHeaders: ignoreHeaders })
    } catch (err) {
      console.error(format('%s trace: warning: Cannot parse TRACE_IGNORE_HEADERS. Error: %s', new Date(), err.message))
    }
  }

  return envVarConfig
}

ConfigReader.prototype._getDefaultConfig = function () {
  return require('../config')
}

ConfigReader.prototype._readConfigFile = function (file) {
  return require(file)
}

ConfigReader.prototype._getFileConfig = function (file) {
  if (file) {
    try {
      return this._readConfigFile(path.resolve(file))
    } catch (ex) {
      if (ex.code === 'MODULE_NOT_FOUND') {
        debug('Configuration file not found')
        return { }
      } else {
        throw new Error('Invalid trace.config.js configuration file')
      }
    }
  } else /* no file path given */ {
    return { }
  }
}

ConfigReader.prototype.getConfig = function () {
  var parameterConfig = this.parameterConfig
  var systemConfig = this._getSystemConfig()
  var envVarConfig = this._getEnvVarConfig()
  var defaultConfig = this._getDefaultConfig()

  var config = defaults({}, parameterConfig, systemConfig, envVarConfig)

  var configFilePath = parameterConfig.configPath || envVarConfig.configPath || defaultConfig.configPath

  var fileConfig = this._getFileConfig(configFilePath)

  config = defaults(
    config,
    fileConfig,
    defaultConfig
  )

  config.whiteListHosts = [url.parse(config.collectorApiUrl).host]

  if (!config.apiKey) {
    throw new Error('Missing apiKey')
  }

  if (!config.serviceName) {
    throw new Error('Missing serviceName')
  }

  return config
}

module.exports = ConfigReader
module.exports.create = function (config) {
  return new ConfigReader(config)
}
