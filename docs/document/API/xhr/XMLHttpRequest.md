---
sidebar_position: 3
---
# XMLHttpRequest
对浏览器XMLHttpRequest对象的操作。

## 模拟XMLHttpRequest对象

``` javascript
// 备份原生 XMLHttpRequest
window._XMLHttpRequest = window.XMLHttpRequest
window._ActiveXObject = window.ActiveXObject

/*
    PhantomJS
    TypeError: '[object EventConstructor]' is not a constructor (evaluating 'new Event("readystatechange")')

    https://github.com/bluerail/twitter-bootstrap-rails-confirm/issues/18
    https://github.com/ariya/phantomjs/issues/11289
*/
try {
    new window.Event('config')
} catch (exception) {
    window.Event = function (type, bubbles, cancelable, detail) {
        let event = document.createEvent('CustomEvent') // MUST be 'CustomEvent'
        event.initCustomEvent(type, bubbles, cancelable, detail)
        return event
    }
}

let XHR_STATES = {
    // The object has been constructed.
    UNSENT: 0,
    // The open() method has been successfully invoked.
    OPENED: 1,
    // All redirects (if any) have been followed and all HTTP headers of the response have been received.
    HEADERS_RECEIVED: 2,
    // The response's body is being received.
    LOADING: 3,
    // The data transfer has been completed or something went wrong during the transfer (e.g. infinite redirects).
    DONE: 4
}

let XHR_EVENTS = 'readystatechange loadstart progress abort error load timeout loadend'.split(' ')
let XHR_REQUEST_PROPERTIES = 'timeout withCredentials'.split(' ')
let XHR_RESPONSE_PROPERTIES = 'readyState responseURL status statusText responseType response responseText responseXML'.split(' ')

// https://github.com/trek/FakeXMLHttpRequest/blob/master/fake_xml_http_request.js#L32
let HTTP_STATUS_CODES = {
    100: "Continue",
    101: "Switching Protocols",
    200: "OK",
    201: "Created",
    202: "Accepted",
    203: "Non-Authoritative Information",
    204: "No Content",
    205: "Reset Content",
    206: "Partial Content",
    300: "Multiple Choice",
    301: "Moved Permanently",
    302: "Found",
    303: "See Other",
    304: "Not Modified",
    305: "Use Proxy",
    307: "Temporary Redirect",
    400: "Bad Request",
    401: "Unauthorized",
    402: "Payment Required",
    403: "Forbidden",
    404: "Not Found",
    405: "Method Not Allowed",
    406: "Not Acceptable",
    407: "Proxy Authentication Required",
    408: "Request Timeout",
    409: "Conflict",
    410: "Gone",
    411: "Length Required",
    412: "Precondition Failed",
    413: "Request Entity Too Large",
    414: "Request-URI Too Long",
    415: "Unsupported Media Type",
    416: "Requested Range Not Satisfiable",
    417: "Expectation Failed",
    422: "Unprocessable Entity",
    500: "Internal Server Error",
    501: "Not Implemented",
    502: "Bad Gateway",
    503: "Service Unavailable",
    504: "Gateway Timeout",
    505: "HTTP Version Not Supported"
}

/*
    MiniXMLHttpRequest
*/

function MiniXMLHttpRequest() {
    // 初始化 config 对象，用于存储自定义属性
    this.config = {
        events: {},
        headers: {},
    }

    //返回hook
    this.proxy = false
    this.debug = false
}

object.deepCopy(MiniXMLHttpRequest, XHR_STATES)
object.deepCopy(MiniXMLHttpRequest.prototype, XHR_STATES)

// 标记当前对象为 MiniXMLHttpRequest
MiniXMLHttpRequest.prototype.mini = true

// 禁止代理
MiniXMLHttpRequest.prototype.noProxy = false

// 初始化 Request 相关的属性和方法
object.deepCopy(MiniXMLHttpRequest.prototype, {
    // https://xhr.spec.whatwg.org/#the-open()-method
    // Sets the request method, request URL, and synchronous flag.
    open: function (method, url, async, username, password) {
        let that = this

        object.deepCopy(this.config, {
            method: method,
            url: url,
            async: typeof async === 'boolean' ? async : true,
            username: username,
            password: password,
            body: '',
            options: {
                url: url,
                method: method,
            }
        })

        function handle(event) {
            // 同步属性 NativeXMLHttpRequest => MiniXMLHttpRequest
            for (let i = 0; i < XHR_RESPONSE_PROPERTIES.length; i++) {
                try {
                    that[XHR_RESPONSE_PROPERTIES[i]] = xhr[XHR_RESPONSE_PROPERTIES[i]]
                } catch (e) {
                }
            }
            // 触发 MiniXMLHttpRequest 上的同名事件
            that.dispatchEvent(new Event(event.type /*, false, false, that*/))
        }

        // 禁止代理时，则采用原生 XHR 发送请求。
        if (this.noProxy || this.proxy) {
            // 创建原生 XHR 对象，调用原生 open()，监听所有原生事件
            let xhr = createNativeXMLHttpRequest()
            this.config.xhr = xhr

            // 初始化所有事件，用于监听原生 XHR 对象的事件
            for (let i = 0; i < XHR_EVENTS.length; i++) {
                xhr.addEventListener(XHR_EVENTS[i], handle)
            }

            if (username) {
                xhr.open(method, url, async, username, password)
            } else {
                xhr.open(method, url, async)
            }

            // 同步属性 MiniXMLHttpRequest => NativeXMLHttpRequest
            for (let j = 0; j < XHR_REQUEST_PROPERTIES.length; j++) {
                try {
                    xhr[XHR_REQUEST_PROPERTIES[j]] = that[XHR_REQUEST_PROPERTIES[j]]
                } catch (e) {
                }
            }

            return
        }
        // 开始拦截 XHR 请求
        this.readyState = MiniXMLHttpRequest.OPENED
        this.dispatchEvent(new Event('readystatechange' /*, false, false, this*/))
    },
    // https://xhr.spec.whatwg.org/#the-setrequestheader()-method
    // Combines a header in author request headers.
    setRequestHeader: function (name, value) {
        // 原生 XHR
        if (this.noProxy || this.proxy) {
            this.config.xhr.setRequestHeader(name, value)
            return
        }

        // 拦截 XHR
        let headers = this.config.headers
        if (headers[name]) headers[name] += ',' + value
        else headers[name] = value
    },
    timeout: 0,
    withCredentials: false,
    upload: {},
    // https://xhr.spec.whatwg.org/#the-send()-method
    // Initiates the request.
    send: function send(data) {
        let that = this
        this.config.body = data
        this.config.timeout = this.timeout

        // 原生 XHR
        if (this.noProxy || this.proxy) {
            this.config.xhr.send(data)
            return
        }

        // 拦截 XHR

        // X-Requested-With header
        this.setRequestHeader('X-Requested-With', 'MiniXMLHttpRequest')

        // loadstart The fetch initiates.
        this.dispatchEvent(new Event('loadstart' /*, false, false, this*/))

        that.readyState = MiniXMLHttpRequest.HEADERS_RECEIVED
        that.dispatchEvent(new Event('readystatechange' /*, false, false, that*/))
        that.readyState = MiniXMLHttpRequest.LOADING
        that.dispatchEvent(new Event('readystatechange' /*, false, false, that*/))


        if (MiniXMLHttpRequest.proxy) {
            if (MiniXMLHttpRequest.debug) console.log("[XHR] 请求xhr:", that.config)
            let doProxy = MiniXMLHttpRequest.proxy(that)
            if(compare.isPromise(doProxy)){
                doProxy.then(data => {
                    done(data)
                }).catch(e => {
                    done(e, 502)
                })
            }
        } else {
            console.warn("[tools-xhr] proxy param is not a Promise")
        }

        function done(data, status) {
            if (MiniXMLHttpRequest.debug) console.log("[XHR] 响应data:", data)

            if (data.responseHeaders) that.responseHeaders = data.responseHeaders
            if (data.response) that.response = data.response || ''
            if (typeof data.response === "string") that.responseText = data.response
            if (data.responseType) that.responseType = data.responseType
            if (data.responseURL) that.responseURL = data.responseURL
            if (data.responseXML) that.responseXML = data.responseXML
            that.status = data.status || 200
            that.statusText = data.statusText || HTTP_STATUS_CODES[that.status]
            if (data.timeout) that.timeout = data.timeout
            if (data.withCredentials) that.withCredentials = data.withCredentials

            that.readyState = MiniXMLHttpRequest.DONE
            that.dispatchEvent(new Event('readystatechange' /*, false, false, that*/))
            that.dispatchEvent(new Event('load' /*, false, false, that*/));
            that.dispatchEvent(new Event('loadend' /*, false, false, that*/));
        }
    },
    // https://xhr.spec.whatwg.org/#the-abort()-method
    // Cancels any network activity.
    abort: function abort() {
        // 原生 XHR
        if (this.noProxy) {
            this.config.xhr.abort()
            return
        }

        // 拦截 XHR
        this.readyState = MiniXMLHttpRequest.UNSENT
        this.dispatchEvent(new Event('abort', false, false, this))
        this.dispatchEvent(new Event('error', false, false, this))
    }
})

// 初始化 Response 相关的属性和方法
object.deepCopy(MiniXMLHttpRequest.prototype, {
    status: MiniXMLHttpRequest.UNSENT,
    statusText: '',
    // https://xhr.spec.whatwg.org/#the-getresponseheader()-method
    getResponseHeader: function (name) {
        // 原生 XHR
        if (this.noProxy || this.proxy) {
            return this.config.xhr.getResponseHeader(name)
        }

        // 拦截 XHR
        return this.responseHeaders[name.toLowerCase()]
    },
    // https://xhr.spec.whatwg.org/#the-getallresponseheaders()-method
    // http://www.utf8-chartable.de/
    getAllResponseHeaders: function () {
        // 原生 XHR
        if (this.noProxy || this.proxy) {
            return this.config.xhr.getAllResponseHeaders()
        }

        // 拦截 XHR
        let responseHeaders = this.responseHeaders
        let headers = ''
        for (let h in responseHeaders) {
            if (!responseHeaders.hasOwnProperty(h)) continue
            headers += h + ': ' + responseHeaders[h] + '\r\n'
        }
        return headers
    },
    overrideMimeType: function ( /*mime*/) {
    },
    responseHeaders: {},
    responseURL: '',
    responseType: '', // '', 'text', 'arraybuffer', 'blob', 'document', 'json'
    response: null,
    responseText: '',
    responseXML: null
})

// EventTarget
object.deepCopy(MiniXMLHttpRequest.prototype, {
    addEventListener: function addEventListener(type, handle) {
        let events = this.config.events
        if (!events[type]) events[type] = []
        events[type].push(handle)
    },
    removeEventListener: function removeEventListener(type, handle) {
        let handles = this.config.events[type] || []
        for (let i = 0; i < handles.length; i++) {
            if (handles[i] === handle) {
                handles.splice(i--, 1)
            }
        }
    },
    dispatchEvent: function dispatchEvent(event) {
        let handles = this.config.events[event.type] || []
        for (let i = 0; i < handles.length; i++) {
            handles[i].call(this, event)
        }

        let ontype = 'on' + event.type
        if (this[ontype]) this[ontype](event)
    }
})

// Inspired by jQuery
function createNativeXMLHttpRequest() {
    let isLocal = function () {
        let rlocalProtocol = /^(?:about|app|app-storage|.+-extension|file|res|widget):$/
        let rurl = /^([\w.+-]+:)(?:\/\/([^\/?#:]*)(?::(\d+)|)|)/
        let ajaxLocation = location.href
        let ajaxLocParts = rurl.exec(ajaxLocation.toLowerCase()) || []
        return rlocalProtocol.test(ajaxLocParts[1])
    }()

    return window.ActiveXObject ?
        (!isLocal && createStandardXHR() || createActiveXHR()) : createStandardXHR()

    function createStandardXHR() {
        try {
            return new window._XMLHttpRequest();
        } catch (e) {
        }
    }

    function createActiveXHR() {
        try {
            return new window._ActiveXObject("Microsoft.XMLHTTP");
        } catch (e) {
        }
    }
}

export default MiniXMLHttpRequest
```