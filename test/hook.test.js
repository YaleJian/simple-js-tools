import test from 'node:test'
import assert from 'node:assert/strict'
import hook from '../src/xhr/hook.js'

class FakeXMLHttpRequest {
    constructor() {
        this.readyState = 0
        this.openCalls = []
        this.headers = []
        this.listeners = {}
        this.response = '原始响应'
        this.responseText = '原始响应'
    }

    open(...args) {
        this.openCalls.push(args)
        this.headers = []
        this.readyState = 1
    }

    setRequestHeader(name, value) {
        this.headers.push([name, value])
    }

    send(body) {
        this.sentBody = body
    }

    addEventListener(name, listener) {
        this.listeners[name] = listener
    }
}

test.before(() => {
    globalThis.XMLHttpRequest = FakeXMLHttpRequest
    hook.createHooks()
})

test.after(() => {
    delete globalThis.XMLHttpRequest
    hook.requestHook = false
    hook.responseHook = false
})

test('requestHook 支持只返回部分字段并修改请求', () => {
    hook.requestHook = params => {
        assert.deepEqual(params.headers, {'content-type': 'text/plain'})
        return {
            method: 'PUT',
            body: `${params.body}-已修改`,
            headers: {'x-hook': 'true'}
        }
    }

    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/items')
    xhr.setRequestHeader('content-type', 'text/plain')
    xhr.send('请求体')

    assert.deepEqual(xhr.openCalls.at(-1), ['PUT', '/items'])
    assert.equal(xhr.sentBody, '请求体-已修改')
    assert.deepEqual(xhr.headers, [
        ['content-type', 'text/plain'],
        ['x-hook', 'true']
    ])
})

test('responseHook 可在请求完成后修改响应', () => {
    hook.requestHook = false
    hook.responseHook = (params, xhr) => {
        assert.deepEqual(params, {
            url: '/items',
            method: 'GET',
            body: undefined,
            headers: {}
        })
        xhr.response = xhr.responseText = '修改后的响应'
    }

    const xhr = new XMLHttpRequest()
    xhr.open('GET', '/items')
    xhr.send()
    xhr.readyState = 4
    xhr.listeners.readystatechange()

    assert.equal(xhr.response, '修改后的响应')
    assert.equal(xhr.responseText, '修改后的响应')
})

test('重复使用同一 XHR 实例不会叠加请求头包装', () => {
    hook.requestHook = false
    hook.responseHook = false

    const xhr = new XMLHttpRequest()
    xhr.open('GET', '/first')
    xhr.setRequestHeader('x-request', 'first')
    xhr.open('GET', '/second')
    xhr.setRequestHeader('x-request', 'second')

    assert.deepEqual(xhr.headers, [['x-request', 'second']])
})
