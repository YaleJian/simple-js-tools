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
    }, target)

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
        target
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
    }, target)

    await assert.rejects(target.fetch('https://example.com/error'), /通道失败/)
    controller.restore()
})

test('fetch AbortSignal 中止等待并传递给 transport', async () => {
    const target = createTarget()
    let transportSignal
    const controller = fetchInterceptor.install((request, {signal}) => {
        transportSignal = signal
        return new Promise(() => {})
    }, target)
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
    const controller = fetchInterceptor.install(async () => new Response(), target)

    assert.throws(
        () => fetchInterceptor.install(async () => new Response(), target),
        /已安装/
    )
    controller.restore()
})
