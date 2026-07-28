const hook = {
    debug: false,
    requestHook: false,
    responseHook: false,

    // 劫持当前环境的 XMLHttpRequest；重复调用不会重复绑定事件。
    createHooks() {
        const prototype = XMLHttpRequest.prototype
        if (prototype.hooked) {
            console.warn('[XHR Hook]', 'createHooks 只需调用一次')
            return
        }

        const nativeOpen = prototype.open
        const nativeSend = prototype.send
        const nativeSetRequestHeader = prototype.setRequestHeader

        prototype.open = function (...openArgs) {
            let requestParams = {}
            const requestHeaders = []

            // 记录业务方在 open 与 send 之间设置的请求头，以便请求参数变化后重放。
            this.setRequestHeader = function (name, value) {
                requestHeaders.push([name, value])
                return nativeSetRequestHeader.call(this, name, value)
            }

            this.send = function (body) {
                requestParams = {
                    url: openArgs[1],
                    method: openArgs[0],
                    body,
                    headers: Object.fromEntries(requestHeaders)
                }

                const requestHook = hook.requestHook
                if (typeof requestHook === 'function') {
                    // 允许钩子只返回想修改的字段。
                    const result = requestHook(requestParams) || {}
                    const nextMethod = result.method ?? openArgs[0]
                    const nextUrl = result.url ?? openArgs[1]
                    body = result.body ?? body

                    if (nextMethod !== openArgs[0] || nextUrl !== openArgs[1]) {
                        openArgs[0] = nextMethod
                        openArgs[1] = nextUrl
                        nativeOpen.apply(this, openArgs)
                        for (const [name, value] of requestHeaders) {
                            nativeSetRequestHeader.call(this, name, value)
                        }
                    }

                    for (const [name, value] of Object.entries(result.headers || {})) {
                        this.setRequestHeader(name, value)
                    }

                    if (hook.debug) console.log('[XHR Hook] requestHook', requestParams)
                }

                return nativeSend.call(this, body)
            }

            // 请求完成后开放响应字段，供 responseHook 按需修改。
            this.addEventListener('readystatechange', () => {
                if (this.readyState !== 4 || typeof hook.responseHook !== 'function') return

                const responseText = this.responseText
                const response = this.response
                Object.defineProperty(this, 'responseText', {writable: true})
                Object.defineProperty(this, 'response', {writable: true})
                this.responseText = responseText
                this.response = response

                hook.responseHook(requestParams, this)
                if (hook.debug) console.log('[XHR Hook] responseHook', requestParams, this)
            }, false)

            return nativeOpen.apply(this, openArgs)
        }

        // 使用不可枚举标记，避免污染正常的原型遍历。
        Object.defineProperty(prototype, 'hooked', {
            value: true,
            configurable: true
        })
    }
}

export default hook
