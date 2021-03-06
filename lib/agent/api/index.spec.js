var util = require('util')
var url = require('url')

var CollectorApi = require('./')

var expect = require('chai').expect
var nock = require('nock')
var libPackage = require('../../../package')

describe('The Trace CollectorApi module', function () {
  var defaultConfig = {
    serviceName: 'testName',
    apiKey: 'testApiKey',
    collectorApiUrl: 'https://collector.api.mock',
    collectorApiSampleEndpoint: '/service/sample',
    collectorApiServiceEndpoint: '/service',
    collectorApiApmMetricsEndpoint: '/service/%s/apm-metrics',
    collectorApiRpmMetricsEndpoint: '/service/%s/rpm-metrics',
    hostname: 'test.org',
    processId: '7777'
  }

  it('can be instantiated w/ serviceName and apiKey', function () {
    var collectorApi = CollectorApi.create(defaultConfig)
    expect(collectorApi).to.be.ok
  })

  it('sends rpm metrics to the collector server', function () {
    var serviceKey = 12

    var data = {
      trace: 'very data',
      hostname: 'test.org',
      pid: 7777
    }

    var path = util.format(defaultConfig.collectorApiRpmMetricsEndpoint, serviceKey)
    var sendUrl = url.resolve(defaultConfig.collectorApiUrl, path)

    var collectorApi = CollectorApi.create(defaultConfig)
    collectorApi.serviceKey = serviceKey

    var sendStub = this.sandbox.stub(collectorApi, '_send')

    collectorApi.sendRpmMetrics(data)

    expect(sendStub).to.have.been.calledWith(sendUrl, data)
  })

  it('sends samples to the collector server', function (done) {
    var collectorApi = CollectorApi.create(defaultConfig)
    var data = {
      trace: 'very data',
      hostname: 'test.org',
      pid: 7777
    }

    nock(defaultConfig.collectorApiUrl, {
      reqheaders: {
        'Authorization': 'Bearer testApiKey',
        'Content-Type': 'application/json',
        'X-Reporter-Version': libPackage.version
      }
    })
      .post(defaultConfig.collectorApiSampleEndpoint, function (body) {
        expect(body).to.eql(data)
        return JSON.stringify(data)
      })
      .reply(201, function () {
        done()
      })

    collectorApi.sendSamples(data)
  })

  it('can get the service key of serviceName from HttpTransaction server', function (done) {
    var collectorApi = CollectorApi.create(defaultConfig)
    var data = {
      name: defaultConfig.serviceName
    }

    nock(defaultConfig.collectorApiUrl, {
      reqheaders: {
        'Authorization': 'Bearer testApiKey',
        'Content-Type': 'application/json',
        'X-Reporter-Version': libPackage.version
      }
    })
      .post(defaultConfig.collectorApiServiceEndpoint, JSON.stringify(data))
      .reply(201, {
        key: 1
      })

    collectorApi.getService(function (err, key) {
      expect(key).to.eql(1)
      done(err)
    })
  })

  it('retries on 409 error', function (done) {
    var collectorApi = CollectorApi.create(defaultConfig)
    var _getRetryIntervalSpy = this.sandbox.spy(collectorApi, '_getRetryInterval')

    var data = {
      name: defaultConfig.serviceName
    }

    nock(defaultConfig.collectorApiUrl, {
      reqheaders: {
        'Authorization': 'Bearer testApiKey',
        'Content-Type': 'application/json',
        'X-Reporter-Version': libPackage.version
      }
    })
      .post(defaultConfig.collectorApiServiceEndpoint, JSON.stringify(data))
      .times(2)
      .reply(409, {})

    collectorApi.getService()

    // FIXME: this is not nice, who can I test it better?
    setTimeout(function () {
      expect(_getRetryIntervalSpy).to.be.called
      done()
    }, 100)
  })
})
