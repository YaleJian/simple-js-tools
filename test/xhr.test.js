import test from 'node:test'
import assert from 'node:assert/strict'
import MockXHR from '../src/xhr/mock.js'

test.afterEach(() => {
    MockXHR.proxy = false
    MockXHR.debug = false
})

test('MockXHR 的请求和响应容器按实例隔离', () => {
    const first = new MockXHR()
    const second = new MockXHR()

    first.config.headers.token = 'first'
    first.responseHeaders.token = 'first'

    assert.deepEqual(second.config.headers, {})
    assert.deepEqual(second.responseHeaders, {})
})

test('导入 MockXHR 不会向全局写入原生实现备份', () => {
    assert.equal(Object.hasOwn(globalThis, '_XMLHttpRequest'), false)
    assert.equal(Object.hasOwn(globalThis, '_ActiveXObject'), false)
})

test('MockXHR 完成代理请求并按顺序触发核心事件', async () => {
    MockXHR.proxy = async request => ({
        status: 201,
        response: request.config.body,
        responseHeaders: {'Content-Type': 'application/json'}
    })

    const xhr = new MockXHR()
    const events = []
    for (const name of ['loadstart', 'readystatechange', 'load', 'loadend']) {
        xhr.addEventListener(name, () => events.push(name))
    }

    xhr.open('POST', '/items')
    xhr.send('{"name":"测试"}')
    await new Promise(resolve => xhr.addEventListener('loadend', resolve))

    assert.equal(xhr.readyState, MockXHR.DONE)
    assert.equal(xhr.status, 201)
    assert.equal(xhr.responseText, '{"name":"测试"}')
    assert.equal(xhr.getResponseHeader('content-type'), 'application/json')
    assert.equal(xhr.getResponseHeader('missing'), null)
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

test('MockXHR 将代理异常转换为 502 响应', async () => {
    MockXHR.proxy = async () => {
        throw new Error('网络失败')
    }

    const xhr = new MockXHR()
    xhr.open('GET', '/failed')
    xhr.send()
    await new Promise(resolve => xhr.addEventListener('loadend', resolve))

    assert.equal(xhr.status, 502)
    assert.match(xhr.responseText, /网络失败/)
})
