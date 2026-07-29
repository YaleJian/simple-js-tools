import {applyBeforeRequest} from './request-patch.js'

const runtime = typeof window === 'undefined' ? globalThis : window
const installations = new WeakMap()

const CONNECTING = 0
const OPEN = 1
const CLOSED = 2

function createEvent(target, type) {
    if (typeof target.Event === 'function') return new target.Event(type)
    return {type}
}

function createMessageEvent(target, type, data, lastEventId) {
    if (typeof target.MessageEvent === 'function') {
        return new target.MessageEvent(type, {data, lastEventId, origin: ''})
    }
    return {type, data, lastEventId, origin: ''}
}

function resolvePublicUrl(target, url) {
    try {
        return new target.URL(url, target.location?.href).href
    } catch {
        return String(url)
    }
}

function isAsyncIterable(value) {
    return Boolean(value && typeof value[Symbol.asyncIterator] === 'function')
}

function createParser(target, source, token) {
    const decoder = new TextDecoder()
    let buffer = ''
    let dataLines = []
    let eventType = ''

    function dispatchBufferedEvent() {
        if (dataLines.length === 0) {
            eventType = ''
            return
        }
        const type = eventType || 'message'
        const event = createMessageEvent(target, type, dataLines.join('\n'), source.lastEventId)
        dataLines = []
        eventType = ''
        source._dispatchIfActive(event, token)
    }

    function processLine(line) {
        if (line === '') {
            dispatchBufferedEvent()
            return
        }
        if (line.startsWith(':')) return

        const separator = line.indexOf(':')
        const field = separator < 0 ? line : line.slice(0, separator)
        let value = separator < 0 ? '' : line.slice(separator + 1)
        if (value.startsWith(' ')) value = value.slice(1)

        if (field === 'data') dataLines.push(value)
        else if (field === 'event') eventType = value
        else if (field === 'id' && value && !value.includes('\0')) source.lastEventId = value
        else if (field === 'retry' && /^\d+$/.test(value)) source._retry = Number(value)
    }

    function consumeLines(final = false) {
        let start = 0
        for (let index = 0; index < buffer.length; index += 1) {
            const character = buffer[index]
            if (character !== '\n' && character !== '\r') continue
            if (character === '\r' && index === buffer.length - 1 && !final) break

            processLine(buffer.slice(start, index))
            if (character === '\r' && buffer[index + 1] === '\n') index += 1
            start = index + 1
        }
        buffer = buffer.slice(start)
        if (final && buffer) {
            processLine(buffer)
            buffer = ''
        }
    }

    return {
        push(chunk) {
            if (typeof chunk === 'string') buffer += chunk
            else if (chunk instanceof Uint8Array) buffer += decoder.decode(chunk, {stream: true})
            else throw new TypeError('SSE 文本块必须是 string 或 Uint8Array')
            consumeLines()
        },
        finish() {
            buffer += decoder.decode()
            consumeLines(true)
        }
    }
}

function dispatchStructuredChunk(target, source, chunk, token) {
    if (chunk.id !== undefined && chunk.id !== '' && !String(chunk.id).includes('\0')) {
        source.lastEventId = String(chunk.id)
    }
    if (Number.isFinite(chunk.retry) && chunk.retry >= 0) source._retry = chunk.retry
    const type = chunk.type || 'message'
    source._dispatchIfActive(
        createMessageEvent(target, type, String(chunk.data), source.lastEventId),
        token
    )
}

const eventSourceInterceptor = {
    install(transport, {target = runtime, beforeRequest} = {}) {
        if (typeof transport !== 'function') throw new TypeError('eventSource.install 需要 transport 函数')
        if (installations.has(target)) throw new Error('EventSource 劫持器已安装到当前运行环境')

        const nativeEventSource = target.EventSource

        class InterceptedEventSource {
            static CONNECTING = CONNECTING
            static OPEN = OPEN
            static CLOSED = CLOSED

            constructor(url, options = {}) {
                this.CONNECTING = CONNECTING
                this.OPEN = OPEN
                this.CLOSED = CLOSED
                this.url = resolvePublicUrl(target, url)
                this.withCredentials = Boolean(options.withCredentials)
                this.readyState = CONNECTING
                this.onopen = null
                this.onmessage = null
                this.onerror = null
                this.lastEventId = ''

                this._inputUrl = String(url)
                this._events = {}
                this._retry = 3000
                this._timer = null
                this._abortController = null
                this._connectionToken = 0
                this._closed = false

                queueMicrotask(() => this._connect())
            }

            addEventListener(type, handler) {
                if (typeof handler !== 'function') return
                const handlers = this._events[type] ||= []
                if (!handlers.includes(handler)) handlers.push(handler)
            }

            removeEventListener(type, handler) {
                const handlers = this._events[type]
                if (!handlers) return
                const index = handlers.indexOf(handler)
                if (index >= 0) handlers.splice(index, 1)
            }

            dispatchEvent(event) {
                for (const handler of [...(this._events[event.type] || [])]) {
                    handler.call(this, event)
                }
                const eventHandler = this[`on${event.type}`]
                if (typeof eventHandler === 'function') eventHandler.call(this, event)
                return true
            }

            close() {
                if (this._closed) return
                this._closed = true
                this.readyState = CLOSED
                ++this._connectionToken
                clearTimeout(this._timer)
                this._timer = null
                this._abortController?.abort()
            }

            async _connect() {
                if (this._closed) return
                const token = ++this._connectionToken
                this.readyState = CONNECTING
                this._abortController = new AbortController()
                const signal = this._abortController.signal
                const headers = this.lastEventId ? {'last-event-id': this.lastEventId} : {}

                try {
                    const snapshot = await applyBeforeRequest({
                        protocol: 'eventsource',
                        url: this._inputUrl,
                        method: 'GET',
                        headers,
                        signal
                    }, beforeRequest)
                    if (!this._isActive(token)) return

                    // EventSource 固定为 GET，忽略 Hook 中任何 body 字段。
                    const request = {
                        ...snapshot,
                        method: 'GET',
                        body: undefined,
                        withCredentials: this.withCredentials,
                        lastEventId: this.lastEventId
                    }
                    this.url = resolvePublicUrl(target, request.url)

                    const stream = await transport(request, {signal, nativeEventSource})
                    if (!isAsyncIterable(stream)) {
                        throw new TypeError('EventSource transport 必须返回 AsyncIterable')
                    }
                    if (!this._isActive(token)) return

                    this.readyState = OPEN
                    this.dispatchEvent(createEvent(target, 'open'))
                    const parser = createParser(target, this, token)

                    for await (const chunk of stream) {
                        if (!this._isActive(token)) break
                        if (typeof chunk === 'string' || chunk instanceof Uint8Array) parser.push(chunk)
                        else if (chunk && typeof chunk === 'object' && 'data' in chunk) {
                            dispatchStructuredChunk(target, this, chunk, token)
                        } else {
                            throw new TypeError('无效的 SSEChunk')
                        }
                    }
                    parser.finish()
                    if (this._isActive(token)) this._reconnect(token)
                } catch (error) {
                    if (this._isActive(token)) this._reconnect(token, error)
                }
            }

            _dispatchIfActive(event, token) {
                if (this._isActive(token)) this.dispatchEvent(event)
            }

            _isActive(token) {
                return !this._closed && token === this._connectionToken
            }

            _reconnect(token) {
                if (!this._isActive(token)) return
                this._abortController?.abort()
                this.readyState = CONNECTING
                this.dispatchEvent(createEvent(target, 'error'))
                this._timer = setTimeout(() => this._connect(), this._retry)
            }
        }

        target.EventSource = InterceptedEventSource
        let active = true
        const controller = {
            restore() {
                if (!active) return
                if (target.EventSource === InterceptedEventSource) target.EventSource = nativeEventSource
                installations.delete(target)
                active = false
            }
        }
        installations.set(target, controller)
        return controller
    }
}

export default eventSourceInterceptor
