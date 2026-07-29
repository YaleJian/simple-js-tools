import test from 'node:test'
import assert from 'node:assert/strict'
import fetchInterceptor from '../src/request/fetch.js'

function createTarget(nativeFetch = async () => new Response('native')) {
    return {
        fetch: nativeFetch,
        Request,
        Response,
        DOMException
    }
}

test('fetch 劫持保持原调用方式并返回标准 Response', async () => {
    const nativeFetch = async () => new Response('native')
    const target = createTarget(nativeFetch)
    let capturedRequest
    let capturedNativeFetch

    const controller = fetchInterceptor.install(async (request, context) => {
        capturedRequest = request
        capturedNativeFetch = context.nativeFetch
        return {
            status: 201,
            headers: {'content-type': 'application/json'},
            body: JSON.stringify({body: await request.clone().text()})
        }
    }, {target})

    const response = await target.fetch('https://example.com/items', {
        method: 'POST',
        headers: {'x-token': 'test'},
        body: '请求体'
    })

    assert.equal(capturedRequest.method, 'POST')
    assert.equal(capturedRequest.headers.get('x-token'), 'test')
    assert.equal(typeof capturedNativeFetch, 'function')
    assert.equal(response.status, 201)
    assert.deepEqual(await response.json(), {body: '请求体'})

    controller.restore()
    controller.restore()
    assert.equal(target.fetch, nativeFetch)
})

test('fetch transport 可以直接返回 Response', async () => {
    const target = createTarget()
    const controller = fetchInterceptor.install(
        async () => new Response('直接响应', {status: 202}),
        {target}
    )

    const response = await target.fetch('https://example.com/direct')
    assert.equal(response.status, 202)
    assert.equal(await response.text(), '直接响应')
    controller.restore()
})

test('fetch 同步异常保持 Promise 拒绝语义', async () => {
    const target = createTarget()
    const controller = fetchInterceptor.install(() => {
        throw new Error('通道失败')
    }, {target})

    await assert.rejects(target.fetch('https://example.com/error'), /通道失败/)
    controller.restore()
})

test('fetch AbortSignal 中止等待并传递给 transport', async () => {
    const target = createTarget()
    let transportSignal
    const controller = fetchInterceptor.install((request, {signal}) => {
        transportSignal = signal
        return new Promise(() => {})
    }, {target})
    const abortController = new AbortController()

    const responsePromise = target.fetch('https://example.com/slow', {
        signal: abortController.signal
    })
    await Promise.resolve()
    await Promise.resolve()
    abortController.abort()

    await assert.rejects(responsePromise, {name: 'AbortError'})
    assert.equal(transportSignal.aborted, true)
    controller.restore()
})

test('同一环境不能重复安装 fetch 劫持器', () => {
    const target = createTarget()
    const controller = fetchInterceptor.install(async () => new Response(), {target})

    assert.throws(
        () => fetchInterceptor.install(async () => new Response(), {target}),
        /已安装/
    )
    controller.restore()
})

test('beforeRequest 合并 URL、Query、Header 且不消费未替换的 Stream Body', async () => {
    class BrowserRequest extends Request {
        constructor(input, init) {
            super(typeof input === 'string' && input.startsWith('/')
                ? `https://app.test${input}`
                : input, init)
        }
    }
    const target = {
        ...createTarget(),
        Request: BrowserRequest
    }
    const stream = new ReadableStream({
        start(controller) {
            controller.enqueue(new TextEncoder().encode('stream-body'))
            controller.close()
        }
    })
    let captured
    const controller = fetchInterceptor.install(async request => {
        captured = request
        return new Response(await request.text())
    }, {
        target,
        beforeRequest: async snapshot => {
            assert.equal(snapshot.url, '/items?remove=yes')
            assert.equal(snapshot.body, stream)
            return {
                url: '/rewritten?remove=yes',
                query: {remove: null, page: 1},
                headers: {'X-Token': 'new', 'x-delete': null}
            }
        }
    })

    const response = await target.fetch('/items?remove=yes', {
        method: 'POST',
        headers: {'x-token': 'old', 'x-delete': 'yes'},
        body: stream,
        duplex: 'half'
    })

    assert.equal(captured.url, 'https://app.test/rewritten?page=1')
    assert.equal(captured.headers.get('x-token'), 'new')
    assert.equal(captured.headers.has('x-delete'), false)
    assert.equal(await response.text(), 'stream-body')
    controller.restore()
})

test('Fetch SSE 保持 ReadableStream 分片，并把 Abort 传给底层订阅', async () => {
    const target = createTarget()
    const abortController = new AbortController()
    let transportCancelled = false
    let streamController
    const controller = fetchInterceptor.install((request, {signal}) => {
        const body = new ReadableStream({
            start(value) {
                streamController = value
                signal.addEventListener('abort', () => {
                    transportCancelled = true
                    value.error(signal.reason || new DOMException('Aborted', 'AbortError'))
                }, {once: true})
            }
        })
        return new Response(body, {headers: {'content-type': 'text/event-stream'}})
    }, {target})

    const response = await target.fetch('https://example.com/events', {
        signal: abortController.signal
    })
    const reader = response.body.getReader()
    streamController.enqueue(new TextEncoder().encode('data: one\n\n'))
    const first = await reader.read()
    assert.equal(new TextDecoder().decode(first.value), 'data: one\n\n')

    abortController.abort()
    await assert.rejects(reader.read(), {name: 'AbortError'})
    assert.equal(transportCancelled, true)
    controller.restore()
})

test('响应描述对象接受 ReadableStream body', async () => {
    const target = createTarget()
    const body = new ReadableStream({
        start(controller) {
            controller.enqueue(new TextEncoder().encode('chunk'))
            controller.close()
        }
    })
    const controller = fetchInterceptor.install(() => ({
        body,
        headers: {'content-type': 'text/event-stream'}
    }), {target})

    const response = await target.fetch('https://example.com/events')
    assert.equal(response.body instanceof ReadableStream, true)
    assert.equal(await response.text(), 'chunk')
    controller.restore()
})

test('beforeRequest 同步抛错和异步拒绝都保持 Fetch Promise 拒绝语义', async () => {
    for (const beforeRequest of [
        () => {
            throw new Error('同步 Hook 失败')
        },
        async () => {
            throw new Error('异步 Hook 失败')
        }
    ]) {
        const target = createTarget()
        const controller = fetchInterceptor.install(() => new Response(), {target, beforeRequest})
        await assert.rejects(target.fetch('https://example.com/error'), /Hook 失败/)
        controller.restore()
    }
})
