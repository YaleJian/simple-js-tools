import {applyBeforeRequest, normalizeHeaders} from './request-patch.js'

const runtime = typeof window === 'undefined' ? globalThis : window
const NativeXMLHttpRequest = runtime.XMLHttpRequest

const STATES = {
    UNSENT: 0,
    OPENED: 1,
    HEADERS_RECEIVED: 2,
    LOADING: 3,
    DONE: 4
}

const STATUS_TEXT = {
    200: 'OK',
    201: 'Created',
    202: 'Accepted',
    204: 'No Content',
    301: 'Moved Permanently',
    302: 'Found',
    304: 'Not Modified',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    408: 'Request Timeout',
    409: 'Conflict',
    422: 'Unprocessable Entity',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout'
}

let activeInstallation = null

function createEvent(type) {
    try {
        return new runtime.Event(type)
    } catch {
        const event = runtime.document.createEvent('CustomEvent')
        event.initCustomEvent(type, false, false, undefined)
        return event
    }
}

function createError(name, message) {
    if (typeof runtime.DOMException === 'function') return new runtime.DOMException(message, name)
    const error = new Error(message)
    error.name = name
    return error
}

class XHRInterceptor {
    static transport = null
    static beforeRequest = null
    static debug = false
    static nativeXMLHttpRequest = NativeXMLHttpRequest

    static install(transport, {target = runtime, beforeRequest} = {}) {
        if (typeof transport !== 'function') throw new TypeError('request.xhr.install 需要 transport 函数')
        if (activeInstallation) throw new Error('XHR 劫持器已安装到运行环境')

        const nativeXMLHttpRequest = target.XMLHttpRequest
        const previousTransport = XHRInterceptor.transport
        const previousBeforeRequest = XHRInterceptor.beforeRequest
        XHRInterceptor.transport = transport
        XHRInterceptor.beforeRequest = beforeRequest
        XHRInterceptor.nativeXMLHttpRequest = nativeXMLHttpRequest
        target.XMLHttpRequest = XHRInterceptor

        let active = true
        const controller = {
            restore() {
                if (!active) return
                if (target.XMLHttpRequest === XHRInterceptor) target.XMLHttpRequest = nativeXMLHttpRequest
                XHRInterceptor.transport = previousTransport
                XHRInterceptor.beforeRequest = previousBeforeRequest
                XHRInterceptor.nativeXMLHttpRequest = NativeXMLHttpRequest
                activeInstallation = null
                active = false
            }
        }
        activeInstallation = controller
        return controller
    }

    constructor() {
        this.readyState = STATES.UNSENT
        this.status = 0
        this.statusText = ''
        this.response = null
        this.responseText = ''
        this.responseXML = null
        this.responseURL = ''
        this.responseType = ''
        this.responseHeaders = {}
        this.timeout = 0
        this.withCredentials = false
        this.upload = {}

        this.config = {
            events: {},
            headers: {},
            method: '',
            url: '',
            async: true,
            username: undefined,
            password: undefined,
            body: null
        }

        this._sent = false
        this._finished = false
        this._timer = null
        this._abortController = null
        this._requestToken = 0
    }

    open(method, url, async = true, username, password) {
        if (async === false) {
            throw createError('NotSupportedError', '自定义 transport 不支持同步 XMLHttpRequest')
        }

        this._invalidateRequest()
        Object.assign(this.config, {
            method: String(method).toUpperCase(),
            url: String(url),
            async: true,
            username,
            password,
            body: null,
            headers: {}
        })
        this.status = 0
        this.statusText = ''
        this.response = null
        this.responseText = ''
        this.responseXML = null
        this.responseHeaders = {}
        this.readyState = STATES.OPENED
        this.dispatchEvent(createEvent('readystatechange'))
    }

    setRequestHeader(name, value) {
        if (this.readyState !== STATES.OPENED || this._sent) {
            throw createError('InvalidStateError', 'setRequestHeader 只能在 open 之后、send 之前调用')
        }

        const key = String(name).toLowerCase()
        const nextValue = String(value)
        this.config.headers[key] = this.config.headers[key]
            ? `${this.config.headers[key]}, ${nextValue}`
            : nextValue
    }

    send(body = null) {
        if (this.readyState !== STATES.OPENED || this._sent) {
            throw createError('InvalidStateError', 'send 只能在 open 之后调用一次')
        }
        if (typeof XHRInterceptor.transport !== 'function') {
            throw new Error('未安装 XHR transport')
        }

        this._sent = true
        this._finished = false
        this.config.body = body
        this.config.timeout = this.timeout
        this._abortController = new AbortController()
        const token = ++this._requestToken

        this.dispatchEvent(createEvent('loadstart'))

        if (this.timeout > 0) {
            this._timer = setTimeout(() => this._timeout(token), this.timeout)
        }

        const signal = this._abortController.signal
        const context = {
            signal,
            nativeXMLHttpRequest: XHRInterceptor.nativeXMLHttpRequest
        }
        const snapshot = {
            protocol: 'xhr',
            url: this.config.url,
            method: this.config.method,
            headers: {...this.config.headers},
            body,
            signal
        }

        // 从已决 Promise 开始，确保同步抛错和异步拒绝进入同一错误路径。
        Promise.resolve()
            .then(() => applyBeforeRequest(snapshot, XHRInterceptor.beforeRequest))
            .then(request => {
                if (!this._isActive(token)) return
                this.config.url = request.url
                this.config.headers = {...request.headers}
                this.config.body = request.body
                return XHRInterceptor.transport(request, context)
            })
            .then(result => this._complete(result, token))
            .catch(error => this._fail(error, token))
    }

    abort() {
        if (!this._sent || this._finished) {
            this._invalidateRequest()
            this.readyState = STATES.UNSENT
            return
        }

        const token = this._requestToken
        this._finish(token, true)
        this.readyState = STATES.UNSENT
        this.status = 0
        this.statusText = ''
        this.response = null
        this.responseText = ''
        this.dispatchEvent(createEvent('readystatechange'))
        this.dispatchEvent(createEvent('abort'))
        this.dispatchEvent(createEvent('loadend'))
    }

    getResponseHeader(name) {
        if (this.readyState < STATES.HEADERS_RECEIVED) return null
        return this.responseHeaders[String(name).toLowerCase()] ?? null
    }

    getAllResponseHeaders() {
        if (this.readyState < STATES.HEADERS_RECEIVED) return ''
        return Object.entries(this.responseHeaders)
            .map(([name, value]) => `${name}: ${value}\r\n`)
            .join('')
    }

    overrideMimeType() {
        // 自定义 transport 直接提供响应内容，暂不执行浏览器 MIME 转换。
    }

    addEventListener(type, handler) {
        if (typeof handler !== 'function') return
        const handlers = this.config.events[type] ||= []
        if (!handlers.includes(handler)) handlers.push(handler)
    }

    removeEventListener(type, handler) {
        const handlers = this.config.events[type]
        if (!handlers) return
        const index = handlers.indexOf(handler)
        if (index >= 0) handlers.splice(index, 1)
    }

    dispatchEvent(event) {
        for (const handler of [...(this.config.events[event.type] || [])]) {
            handler.call(this, event)
        }
        const eventHandler = this[`on${event.type}`]
        if (typeof eventHandler === 'function') eventHandler.call(this, event)
        return true
    }

    _complete(result = {}, token) {
        if (!this._isActive(token)) return
        if (!result || typeof result !== 'object') {
            this._fail(new TypeError('XHR transport 必须返回响应对象'), token)
            return
        }

        this.responseHeaders = normalizeHeaders(result.responseHeaders || result.headers)
        this.status = Number.isFinite(result.status) ? result.status : 200
        this.statusText = result.statusText || STATUS_TEXT[this.status] || ''
        this.responseURL = result.responseURL || this.config.url

        this.readyState = STATES.HEADERS_RECEIVED
        this.dispatchEvent(createEvent('readystatechange'))
        this.readyState = STATES.LOADING
        this.dispatchEvent(createEvent('readystatechange'))

        this._setResponse('response' in result ? result.response : result.body)
        if (result.responseXML) this.responseXML = result.responseXML

        this._finish(token)
        this.readyState = STATES.DONE
        this.dispatchEvent(createEvent('readystatechange'))
        this.dispatchEvent(createEvent('load'))
        this.dispatchEvent(createEvent('loadend'))
    }

    _setResponse(value) {
        if (this.responseType === 'json') {
            if (typeof value !== 'string') {
                this.response = value ?? null
            } else {
                try {
                    this.response = JSON.parse(value)
                } catch {
                    this.response = null
                }
            }
            this.responseText = ''
            return
        }

        if (this.responseType === 'arraybuffer') {
            if (value instanceof ArrayBuffer) {
                this.response = value
            } else if (ArrayBuffer.isView(value)) {
                this.response = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength)
            } else {
                this.response = new TextEncoder().encode(String(value ?? '')).buffer
            }
            this.responseText = ''
            return
        }

        if (this.responseType === 'blob' && typeof Blob === 'function') {
            this.response = value instanceof Blob ? value : new Blob([value ?? ''])
            this.responseText = ''
            return
        }

        this.responseText = value == null ? '' : String(value)
        this.response = this.responseText
    }

    _fail(error, token) {
        if (!this._isActive(token)) return
        if (XHRInterceptor.debug) console.error('[XHRInterceptor] transport error', error)

        this._finish(token)
        this.status = 0
        this.statusText = ''
        this.response = null
        this.responseText = ''
        this.readyState = STATES.DONE
        this.dispatchEvent(createEvent('readystatechange'))
        this.dispatchEvent(createEvent('error'))
        this.dispatchEvent(createEvent('loadend'))
    }

    _timeout(token) {
        if (!this._isActive(token)) return
        this._finish(token, true)
        this.status = 0
        this.statusText = ''
        this.response = null
        this.responseText = ''
        this.readyState = STATES.DONE
        this.dispatchEvent(createEvent('readystatechange'))
        this.dispatchEvent(createEvent('timeout'))
        this.dispatchEvent(createEvent('loadend'))
    }

    _finish(token, abortTransport = false) {
        if (token !== this._requestToken) return
        this._finished = true
        clearTimeout(this._timer)
        this._timer = null
        if (abortTransport) this._abortController?.abort()
    }

    _invalidateRequest() {
        ++this._requestToken
        clearTimeout(this._timer)
        this._timer = null
        this._abortController?.abort()
        this._abortController = null
        this._sent = false
        this._finished = false
    }

    _isActive(token) {
        return token === this._requestToken && this._sent && !this._finished
    }
}

Object.assign(XHRInterceptor, STATES)
Object.assign(XHRInterceptor.prototype, STATES)

export default XHRInterceptor
