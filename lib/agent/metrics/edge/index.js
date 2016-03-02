var consts = require('../../../consts')

function EdgeMetrics (options) {
  var _this = this
  this.collectorApi = options.collectorApi
  this.config = options.config
  this.collectInterval = this.config.collectInterval

  // metrics
  this.metrics = {}

  this.interval = setInterval(function () {
    _this.sendMetrics()
  }, this.collectInterval)
}

EdgeMetrics.prototype.initHost = function (data) {
  if (!this.metrics[data.protocol][data.targetHost]) {
    this.metrics[data.protocol][data.targetHost] = {
      targetServiceKey: data.targetServiceKey,
      responseTime: [],
      networkDelayIncoming: [],
      networkDelayOutgoing: [],
      status: {
        ok: 0,
        notOk: 0
      }
    }
  }
  return this.metrics[data.protocol][data.targetHost]
}

EdgeMetrics.prototype.initProtocol = function (data) {
  if (!this.metrics[data.protocol]) {
    this.metrics[data.protocol] = {}
  }
  return this.metrics[data.protocol]
}

EdgeMetrics.prototype.report = function (data) {
  this.initProtocol(data)
  var edge = this.initHost(data)

  edge.networkDelayIncoming.push(data.networkDelay.incoming)
  edge.networkDelayOutgoing.push(data.networkDelay.outgoing)
  edge.responseTime.push(data.responseTime)

  if (data.status === consts.EDGE_STATUS.OK) {
    edge.status.ok += 1
  } else if (data.status === consts.EDGE_STATUS.NOT_OK) {
    edge.status.notOk += 1
  }
}

EdgeMetrics.prototype.calculateTimes = function (items) {
  var sorted = items.sort(function (a, b) {
    return a - b
  })

  var medianElementIndex = Math.round(sorted.length / 2) - 1
  var ninetyFiveElementIndex = Math.round(sorted.length * 0.95) - 1

  return {
    median: sorted[medianElementIndex],
    ninetyFive: sorted[ninetyFiveElementIndex]
  }
}

EdgeMetrics.prototype.sendMetrics = function () {
  var _this = this

  var dataToSend = Object.keys(this.metrics).map(function (protocol) {
    var targetHosts = Object.keys(_this.metrics[protocol]).map(function (hostName) {
      var host = _this.metrics[protocol][hostName]
      return {
        name: hostName,
        metrics: {
          targetServiceKey: host.targetServiceKey,
          responseTime: _this.calculateTimes(host.responseTime),
          networkDelayIncoming: _this.calculateTimes(host.networkDelayIncoming),
          networkDelayOutgoing: _this.calculateTimes(host.networkDelayOutgoing),
          status: {
            ok: host.status.ok,
            notOk: host.status.notOk
          }
        }
      }
    })

    return {
      protocol: protocol,
      targetHosts: targetHosts
    }
  })
  this.metrics = {}
  this.collectorApi.sendEdgeMetrics(dataToSend)
}

function create (options) {
  return new EdgeMetrics(options)
}

module.exports.create = create
