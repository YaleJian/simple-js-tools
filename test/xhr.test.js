import test from 'node:test'
import assert from 'node:assert/strict'
import XHRInterceptor from '../src/request/xhr.js'

function waitForEvent(xhr, type) {
    return new Promise(resolve => xhr.addEventListener(type, resolve))
}

test.afterEach(() => {
    XHRInterceptor.transport = null
    XHRInterceptor.beforeRequest = null
    XHRInterceptor.debug = false
})

test('XHRInterceptor 的可变数据按实例隔离', () => {
    const first = new XHRInterceptor()
    const second = new XHRInterceptor()

    first.config.headers.token = 'first'
    first.responseHeaders.token = 'first'

    assert.deepEqual(second.config.headers, {})
    assert.deepEqual(second.responseHeaders, {})
})

test('install 无感替换 XMLHttpRequest 并可恢复', () => {
    function NativeXHR() {}
    const target = {XMLHttpRequest: NativeXHR}
    const controller = XHRInterceptor.install(async () => ({}), {target})

    assert.equal(target.XMLHttpRequest, XHRInterceptor)
    assert.throws(() => XHRInterceptor.install(async () => ({}), {target}), /已安装/)

    controller.restore()
    controller.restore()
    assert.equal(target.XMLHttpRequest, NativeXHR)
})

test('成功响应遵循 XHR 状态与事件顺序', async () => {
    let transportSignal
    XHRInterceptor.transport = async (request, {signal}) => {
        transportSignal = signal
        return {
            status: 201,
            response: request.body,
            responseHeaders: {'Content-Type': 'application/json'}
        }
    }

    const xhr = new XHRInterceptor()
    const events = []
    for (const name of ['loadstart', 'readystatechange', 'load', 'loadend']) {
        xhr.addEventListener(name, () => events.push(name))
    }

    xhr.open('POST', '/items')
    xhr.setRequestHeader('X-Token', 'one')
    xhr.setRequestHeader('x-token', 'two')
    const completed = waitForEvent(xhr, 'loadend')
    xhr.send('{"name":"测试"}')
    await completed

    assert.equal(xhr.readyState, XHRInterceptor.DONE)
    assert.equal(xhr.status, 201)
    assert.equal(xhr.responseText, '{"name":"测试"}')
    assert.equal(xhr.getResponseHeader('content-type'), 'application/json')
    assert.equal(xhr.getResponseHeader('missing'), null)
    assert.equal(xhr.config.headers['x-token'], 'one, two')
    assert.equal(transportSignal.aborted, false)
    assert.deepEqual(events, [
        'readystatechange',
        'loadstart',
        'readystatechange',
        'readystatechange',
        'readystatechange',
        'load',
        'loadend'
    ])
})

test('transport 同步异常按网络错误处理', async () => {
    XHRInterceptor.transport = () => {
        throw new Error('通道断开')
    }

    const xhr = new XHRInterceptor()
    const events = []
    xhr.addEventListener('load', () => events.push('load'))
    xhr.addEventListener('error', () => events.push('error'))
    xhr.addEventListener('loadend', () => events.push('loadend'))

    xhr.open('GET', '/failed')
    const completed = waitForEvent(xhr, 'loadend')
    xhr.send()
    await completed

    assert.equal(xhr.status, 0)
    assert.equal(xhr.readyState, XHRInterceptor.DONE)
    assert.deepEqual(events, ['error', 'loadend'])
})

test('beforeRequest 可异步改写请求且快照与内部状态隔离', async () => {
    function NativeXHR() {}
    const target = {XMLHttpRequest: NativeXHR}
    let captured
    const controller = XHRInterceptor.install(request => {
        captured = request
        return {status: 200, response: request.body}
    }, {
        target,
        beforeRequest: async snapshot => {
            assert.equal(Object.isFrozen(snapshot), true)
            assert.equal(Object.isFrozen(snapshot.headers), true)
            return {
                url: '/rewritten?remove=yes',
                query: {remove: null, page: 2},
                headers: {'X-Token': 'new', 'x-delete': null},
                body: 'patched'
            }
        }
    })

    const xhr = new target.XMLHttpRequest()
    xhr.open('POST', '/original')
    xhr.setRequestHeader('x-token', 'old')
    xhr.setRequestHeader('x-delete', 'yes')
    const completed = waitForEvent(xhr, 'loadend')
    xhr.send('original')
    await completed

    assert.equal(captured.protocol, 'xhr')
    assert.equal(captured.url, '/rewritten?page=2')
    assert.deepEqual(captured.headers, {'x-token': 'new'})
    assert.equal(captured.body, 'patched')
    assert.equal(xhr.responseText, 'patched')
    controller.restore()
})

test('beforeRequest 拒绝时按 XHR 网络失败语义结束', async () => {
    function NativeXHR() {}
    const target = {XMLHttpRequest: NativeXHR}
    let transportCalled = false
    const controller = XHRInterceptor.install(() => {
        transportCalled = true
        return {}
    }, {
        target,
        beforeRequest: async () => {
            throw new Error('Hook 失败')
        }
    })
    const xhr = new target.XMLHttpRequest()
    xhr.open('GET', '/failed-hook')
    const failed = waitForEvent(xhr, 'error')
    xhr.send()
    await failed

    assert.equal(xhr.status, 0)
    assert.equal(transportCalled, false)
    controller.restore()
})

test('abort 取消 transport 并忽略迟到响应', async () => {
    let resolveTransport
    let transportSignal
    let markTransportStarted
    const transportStarted = new Promise(resolve => {
        markTransportStarted = resolve
    })
    XHRInterceptor.transport = (request, {signal}) => {
        transportSignal = signal
        markTransportStarted()
        return new Promise(resolve => {
            resolveTransport = resolve
        })
    }

    const xhr = new XHRInterceptor()
    const events = []
    for (const name of ['abort', 'load', 'loadend']) {
        xhr.addEventListener(name, () => events.push(name))
    }

    xhr.open('GET', '/slow')
    xhr.send()
    await transportStarted
    xhr.abort()
    resolveTransport({status: 200, response: '迟到响应'})
    await Promise.resolve()
    await Promise.resolve()

    assert.equal(transportSignal.aborted, true)
    assert.equal(xhr.readyState, XHRInterceptor.UNSENT)
    assert.equal(xhr.responseText, '')
    assert.deepEqual(events, ['abort', 'loadend'])
})

test('timeout 取消 transport 并触发 timeout', async () => {
    let transportSignal
    XHRInterceptor.transport = (request, {signal}) => {
        transportSignal = signal
        return new Promise(() => {})
    }

    const xhr = new XHRInterceptor()
    const events = []
    xhr.timeout = 5
    xhr.addEventListener('timeout', () => events.push('timeout'))
    xhr.addEventListener('loadend', () => events.push('loadend'))

    xhr.open('GET', '/timeout')
    const completed = waitForEvent(xhr, 'loadend')
    xhr.send()
    await completed

    assert.equal(transportSignal.aborted, true)
    assert.equal(xhr.readyState, XHRInterceptor.DONE)
    assert.equal(xhr.status, 0)
    assert.deepEqual(events, ['timeout', 'loadend'])
})

test('responseType=json 解析字符串且无效 JSON 返回 null', async () => {
    XHRInterceptor.transport = async () => ({response: '{"ok":true}'})
    const xhr = new XHRInterceptor()
    xhr.responseType = 'json'
    xhr.open('GET', '/json')
    let completed = waitForEvent(xhr, 'loadend')
    xhr.send()
    await completed
    assert.deepEqual(xhr.response, {ok: true})
    assert.equal(xhr.responseText, '')

    XHRInterceptor.transport = async () => ({response: 'invalid'})
    const invalid = new XHRInterceptor()
    invalid.responseType = 'json'
    invalid.open('GET', '/invalid-json')
    completed = waitForEvent(invalid, 'loadend')
    invalid.send()
    await completed
    assert.equal(invalid.response, null)
})

test('拒绝同步 XHR 和非法调用顺序', () => {
    const xhr = new XHRInterceptor()
    assert.throws(() => xhr.open('GET', '/', false), {name: 'NotSupportedError'})
    assert.throws(() => xhr.send(), {name: 'InvalidStateError'})

    XHRInterceptor.transport = async () => ({})
    xhr.open('GET', '/')
    xhr.send()
    assert.throws(() => xhr.send(), {name: 'InvalidStateError'})
    assert.throws(() => xhr.setRequestHeader('x-test', 'value'), {name: 'InvalidStateError'})
    xhr.abort()
})
