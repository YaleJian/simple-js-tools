let hook = {
    debug: false,
    requestHook: false,
    responseHook: false,
    //创建劫持钩子
    createHooks(params) {
        if (XMLHttpRequest.prototype.hooked) {
            console.warn("[XHR Hook]", "createHooks only need to create it once")
        } else {
            let raw_open = XMLHttpRequest.prototype.open;
            let raw_send = XMLHttpRequest.prototype.send;

            XMLHttpRequest.prototype.open = function () {
                let requestData = ""
                let openArgs = arguments
                let requestParams = {}
                this.send = function (data) {
                    requestData = data;
                    // 请求前钩子处理
                    let requestHook = hook.requestHook
                    if (requestHook) {
                        requestParams = {
                            url: openArgs[1],
                            method: openArgs[0],
                            body: arguments[0],
                            headers: this.getAllResponseHeaders()
                        }
                        if (typeof requestHook === 'function') {
                            let {url, method, body, headers} = requestHook(requestParams)
                            openArgs[0] = method
                            openArgs[1] = url
                            arguments[0] = body
                            for (let key in headers) {
                                if (headers.hasOwnProperty(key)) this.setRequestHeader(key, headers[key])
                            }
                        }
                        if (hook.debug) console.log("[Net Hook] requestHook", requestParams)
                    }

                    return raw_send.apply(this, arguments)
                }

                //当 readyState 属性发生变化时，调用的事件处理器
                this.addEventListener('readystatechange', () => {
                    if (this.readyState === 4) {
                        let _responseText = this.responseText
                        let _response = this.response
                        Object.defineProperty(this, "responseText", {
                            writable: true,
                        });
                        Object.defineProperty(this, "response", {
                            writable: true,
                        });

                        this.responseText = _responseText
                        this.response = _response

                        // 请求后钩处理
                        let responseHook = hook.responseHook
                        if (responseHook) {
                            if (typeof responseHook === 'function') {
                                responseHook(requestParams, this)
                            }
                            if (hook.debug) console.log("[Net Hook] responseHook", requestParams, this)
                        }
                    }
                }, false)

                return raw_open.apply(this, [].slice.call(arguments));
            }

            XMLHttpRequest.prototype.hooked = true//防止事件重复绑定
        }

    },
}
export default hook