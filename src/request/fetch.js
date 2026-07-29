import {applyBeforeRequest, normalizeHeaders} from './request-patch.js'

const runtime = typeof window === 'undefined' ? globalThis : window
const installations = new WeakMap()

function createAbortError(target) {
    if (typeof target.DOMException === 'function') {
        return new target.DOMException('The operation was aborted.', 'AbortError')
    }
    const error = new Error('The operation was aborted.')
    error.name = 'AbortError'
    return error
}

function waitForTransport(promise, signal, target) {
    if (!signal) return promise
    if (signal.aborted) return Promise.reject(signal.reason || createAbortError(target))

    return new Promise((resolve, reject) => {
        const abort = () => reject(signal.reason || createAbortError(target))
        signal.addEventListener('abort', abort, {once: true})
        promise.then(
            value => {
                signal.removeEventListener('abort', abort)
                resolve(value)
            },
            error => {
                signal.removeEventListener('abort', abort)
                reject(error)
            }
        )
    })
}

const fetchInterceptor = {
    install(transport, {target = runtime, beforeRequest} = {}) {
        if (typeof transport !== 'function') throw new TypeError('fetch.install 需要 transport 函数')
        if (installations.has(target)) throw new Error('fetch 劫持器已安装到当前运行环境')
        if (typeof target.fetch !== 'function' || typeof target.Request !== 'function' || typeof target.Response !== 'function') {
            throw new Error('当前运行环境不支持 fetch、Request 或 Response')
        }

        const originalFetch = target.fetch
        const nativeFetch = originalFetch.bind(target)

        function interceptedFetch(input, init) {
            return Promise.resolve().then(() => {
                const originalRequest = new target.Request(input, init)
                const rawUrl = input instanceof target.Request ? input.url : String(input)
                const snapshot = {
                    protocol: 'fetch',
                    url: rawUrl,
                    method: originalRequest.method,
                    headers: normalizeHeaders(originalRequest.headers),
                    body: init && Object.prototype.hasOwnProperty.call(init, 'body') ? init.body : undefined,
                    signal: originalRequest.signal
                }

                return applyBeforeRequest(snapshot, beforeRequest).then(patched => {
                    const headersChanged = JSON.stringify(patched.headers) !== JSON.stringify(snapshot.headers)
                    const bodyChanged = patched.body !== snapshot.body
                    const request = patched.url === snapshot.url && !headersChanged && !bodyChanged
                        ? originalRequest
                        : createRequest(target, originalRequest, patched, bodyChanged)
                    const transportPromise = Promise.resolve().then(() => transport(request, {
                        signal: request.signal,
                        nativeFetch
                    }))
                    return waitForTransport(transportPromise, request.signal, target)
                }).then(result => {
                    if (result instanceof target.Response) return result
                    if (!result || typeof result !== 'object') {
                        throw new TypeError('fetch transport 必须返回 Response 或响应对象')
                    }
                    return new target.Response(result.body ?? null, {
                        status: result.status ?? 200,
                        statusText: result.statusText ?? '',
                        headers: result.headers
                    })
                })
            })
        }

        target.fetch = interceptedFetch
        let active = true
        const controller = {
            restore() {
                if (!active) return
                if (target.fetch === interceptedFetch) target.fetch = originalFetch
                installations.delete(target)
                active = false
            }
        }
        installations.set(target, controller)
        return controller
    }
}

function createRequest(target, original, patched, bodyChanged) {
    const body = bodyChanged ? patched.body : original.body
    const init = {
        method: original.method,
        headers: patched.headers,
        body: original.method === 'GET' || original.method === 'HEAD' ? undefined : body,
        signal: original.signal,
        credentials: original.credentials,
        mode: original.mode,
        cache: original.cache,
        redirect: original.redirect,
        referrer: original.referrer,
        referrerPolicy: original.referrerPolicy,
        integrity: original.integrity,
        keepalive: original.keepalive
    }
    if (body && original.duplex) init.duplex = original.duplex
    return new target.Request(patched.url, init)
}

export default fetchInterceptor
