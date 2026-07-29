import test from 'node:test'
import assert from 'node:assert/strict'
import eventSourceInterceptor from '../src/request/event-source.js'

function createTarget() {
    class NativeEventSource {}
    return {
        EventSource: NativeEventSource,
        Event,
        MessageEvent,
        URL,
        location: {href: 'https://app.test/page'}
    }
}

function once(source, type) {
    return new Promise(resolve => {
        const handler = event => {
            source.removeEventListener(type, handler)
            resolve(event)
        }
        source.addEventListener(type, handler)
    })
}

test('EventSource 增量解析 UTF-8、跨 Chunk 行、多行 data、自定义事件、id 和 retry', async () => {
    const target = createTarget()
    let release
    let capturedRequest
    const transport = async function* (request) {
        capturedRequest = request
        const bytes = new TextEncoder().encode(
            'id: event-1\r\nretry: 7\r\nevent: custom\r\ndata: 第一行\r\ndata: 第二行\r\n\r\n'
        )
        const chineseByte = bytes.indexOf(0xe7)
        yield bytes.slice(0, chineseByte + 1)
        yield bytes.slice(chineseByte + 1, chineseByte + 9)
        yield bytes.slice(chineseByte + 9)
        await new Promise(resolve => {
            release = resolve
        })
    }
    const controller = eventSourceInterceptor.install(transport, {
        target,
        beforeRequest: snapshot => ({
            url: '/rewritten?remove=yes',
            query: {remove: null, page: 3},
            headers: {'x-sdk': snapshot.protocol}
        })
    })

    const source = new target.EventSource('/events', {withCredentials: true})
    const opened = once(source, 'open')
    const custom = once(source, 'custom')
    await opened
    const event = await custom

    assert.equal(source.CONNECTING, 0)
    assert.equal(source.OPEN, 1)
    assert.equal(source.CLOSED, 2)
    assert.equal(source.readyState, source.OPEN)
    assert.equal(source.withCredentials, true)
    assert.equal(source.url, 'https://app.test/rewritten?page=3')
    assert.equal(event.data, '第一行\n第二行')
    assert.equal(event.lastEventId, 'event-1')
    assert.equal(capturedRequest.protocol, 'eventsource')
    assert.equal(capturedRequest.method, 'GET')
    assert.equal(capturedRequest.body, undefined)
    assert.equal(capturedRequest.headers['x-sdk'], 'eventsource')

    source.close()
    source.close()
    release()
    assert.equal(source.readyState, source.CLOSED)
    controller.restore()
})

test('EventSource 异常断流后按 retry 重连并携带 Last-Event-ID', async () => {
    const target = createTarget()
    const requests = []
    let holdSecond
    let calls = 0
    const controller = eventSourceInterceptor.install(async function* (request) {
        requests.push(request)
        calls += 1
        if (calls === 1) {
            yield {data: 'first', id: 'last-1', retry: 1}
            throw new Error('断流')
        }
        yield {data: 'second'}
        await new Promise(resolve => {
            holdSecond = resolve
        })
    }, {target})

    const source = new target.EventSource('/events')
    const messages = []
    const gotSecond = new Promise(resolve => {
        source.onmessage = event => {
            messages.push(event.data)
            if (event.data === 'second') resolve()
        }
    })
    const error = once(source, 'error')
    await error
    await gotSecond

    assert.deepEqual(messages, ['first', 'second'])
    assert.equal(requests[1].lastEventId, 'last-1')
    assert.equal(requests[1].headers['last-event-id'], 'last-1')
    source.close()
    holdSecond()
    controller.restore()
})

test('EventSource close 中止 Transport、丢弃迟到数据并停止重连', async () => {
    const target = createTarget()
    let transportSignal
    let release
    let messageCount = 0
    const controller = eventSourceInterceptor.install(async function* (request, {signal}) {
        transportSignal = signal
        await new Promise(resolve => {
            release = resolve
        })
        yield {data: 'late'}
    }, {target})
    const source = new target.EventSource('/events')
    source.onmessage = () => {
        messageCount += 1
    }
    await once(source, 'open')
    source.close()
    release()
    await new Promise(resolve => setTimeout(resolve, 5))

    assert.equal(transportSignal.aborted, true)
    assert.equal(source.readyState, source.CLOSED)
    assert.equal(messageCount, 0)
    controller.restore()
})

test('EventSource 安装保护、恢复幂等且提供原生旁路', async () => {
    const target = createTarget()
    const NativeEventSource = target.EventSource
    let capturedNative
    let release
    const controller = eventSourceInterceptor.install(async function* (request, context) {
        capturedNative = context.nativeEventSource
        yield {data: 'ready'}
        await new Promise(resolve => {
            release = resolve
        })
    }, {target})
    assert.throws(() => eventSourceInterceptor.install(async function* () {}, {target}), /已安装/)

    const source = new target.EventSource('/events')
    await once(source, 'message')
    assert.equal(capturedNative, NativeEventSource)
    assert.equal(new capturedNative() instanceof NativeEventSource, true)
    source.close()
    release()
    controller.restore()
    controller.restore()
    assert.equal(target.EventSource, NativeEventSource)

    const second = eventSourceInterceptor.install(async function* () {}, {target})
    class OtherEventSource {}
    target.EventSource = OtherEventSource
    second.restore()
    assert.equal(target.EventSource, OtherEventSource)
})

test('EventSource Hook 同步抛错和 Promise 拒绝均触发网络 error', async () => {
    for (const beforeRequest of [
        () => {
            throw new Error('同步失败')
        },
        async () => {
            throw new Error('异步失败')
        }
    ]) {
        const target = createTarget()
        let transportCalled = false
        const controller = eventSourceInterceptor.install(async function* () {
            transportCalled = true
        }, {target, beforeRequest})
        const source = new target.EventSource('/events')
        await once(source, 'error')
        source.close()
        assert.equal(transportCalled, false)
        controller.restore()
    }
})
