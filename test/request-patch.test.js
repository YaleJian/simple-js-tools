import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequestPatch} from '../src/request/request-patch.js'
import xhrInterceptor from '../src/request/xhr.js'
import fetchInterceptor from '../src/request/fetch.js'
import eventSourceInterceptor from '../src/request/event-source.js'

test('createRequestPatch 保留相对 URL，并按约定合并 Query 与 Header', () => {
    const signal = new AbortController().signal
    const result = createRequestPatch({
        protocol: 'fetch',
        url: '/items?keep=old&remove=yes#detail',
        method: 'POST',
        headers: {
            Authorization: 'old',
            'X-Remove': 'yes',
            'X-Keep': 'keep'
        },
        body: 'original',
        signal
    }, {
        query: {
            keep: 2,
            remove: null,
            ignored: undefined,
            enabled: false
        },
        headers: {
            authorization: 'new',
            'x-remove': null,
            'x-ignored': undefined
        }
    })

    assert.equal(result.url, '/items?keep=2&enabled=false#detail')
    assert.deepEqual(result.headers, {
        authorization: 'new',
        'x-keep': 'keep'
    })
    assert.equal(result.body, 'original')
    assert.equal(result.signal, signal)
})

test('createRequestPatch 仅在补丁显式提供 body 时替换请求体', () => {
    const body = {value: 1}
    const snapshot = {url: '/', headers: {}, body}

    assert.equal(createRequestPatch(snapshot, {}).body, body)
    assert.equal(createRequestPatch(snapshot, {body: undefined}).body, undefined)
})

test('同一个 beforeRequest 可改写 XHR、Fetch 和 EventSource 的 URL 与 Query', async () => {
    const beforeRequest = snapshot => ({
        url: `/proxy/${snapshot.protocol}?remove=yes`,
        query: {remove: null, shared: 1}
    })
    const urls = {}

    const xhrTarget = {XMLHttpRequest: class NativeXHR {}}
    const xhrController = xhrInterceptor.install(request => {
        urls.xhr = request.url
        return {}
    }, {target: xhrTarget, beforeRequest})
    const xhr = new xhrTarget.XMLHttpRequest()
    const xhrDone = new Promise(resolve => xhr.addEventListener('loadend', resolve))
    xhr.open('GET', '/original')
    xhr.send()
    await xhrDone
    xhrController.restore()

    class BrowserRequest extends Request {
        constructor(input, init) {
            super(typeof input === 'string' && input.startsWith('/')
                ? `https://app.test${input}`
                : input, init)
        }
    }
    const fetchTarget = {
        fetch: async () => new Response(),
        Request: BrowserRequest,
        Response,
        DOMException
    }
    const fetchController = fetchInterceptor.install(request => {
        urls.fetch = new URL(request.url).pathname + new URL(request.url).search
        return new Response()
    }, {target: fetchTarget, beforeRequest})
    await fetchTarget.fetch('/original')
    fetchController.restore()

    const eventTarget = {
        EventSource: class NativeEventSource {},
        Event,
        MessageEvent,
        URL,
        location: {href: 'https://app.test/'}
    }
    let release
    const eventController = eventSourceInterceptor.install(async function* (request) {
        urls.eventsource = request.url
        yield {data: 'ready'}
        await new Promise(resolve => {
            release = resolve
        })
    }, {target: eventTarget, beforeRequest})
    const source = new eventTarget.EventSource('/original')
    await new Promise(resolve => source.addEventListener('message', resolve))
    source.close()
    release()
    eventController.restore()

    assert.deepEqual(urls, {
        xhr: '/proxy/xhr?shared=1',
        fetch: '/proxy/fetch?shared=1',
        eventsource: '/proxy/eventsource?shared=1'
    })
})
