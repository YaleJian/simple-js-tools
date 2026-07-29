# `request.xhr`

调用入口保持为：

```js
const XHRInterceptor = sTools.request.xhr
```

## 推荐安装方式

```js
const controller = XHRInterceptor.install(async (request, {signal, nativeXMLHttpRequest}) => {
    const result = await sendByAnotherChannel({
        method: request.method,
        url: request.url,
        headers: request.headers,
        body: request.body,
        signal
    })

    return {
        status: result.status,
        statusText: result.statusText,
        headers: result.headers,
        body: result.body
    }
})

// 不再接管请求时恢复原生 XMLHttpRequest。
controller.restore()
```

安装后，原业务代码保持不变：

```js
const xhr = new XMLHttpRequest()
xhr.open('POST', '/api/items')
xhr.setRequestHeader('content-type', 'application/json')
xhr.send(JSON.stringify({name: '测试'}))
```

### `XHRInterceptor.install(transport, options?)`

把目标环境的 `XMLHttpRequest` 替换为 `XHRInterceptor`，并返回 `{restore()}`。

- `transport`：发送请求的函数。
- `options.target`：可选运行环境，默认当前 `window`。
- `options.beforeRequest`：统一请求改写 Hook，详见[请求劫持总览](./request.md)。
- 重复安装会抛出错误。
- `restore()` 可重复调用，不会重复恢复。

Transport 的第二个参数包含：

| 字段 | 说明 |
| --- | --- |
| `signal` | 当前请求的 AbortSignal |
| `nativeXMLHttpRequest` | 安装前的原生构造函数，供 transport 明确绕过劫持 |

Transport 的第一个参数是改写后的请求快照。beta.9 以前接收 XHR 实例的 transport 不再兼容；
本版本按新 API 直接升级。

## 兼容原调用方式

仍支持直接配置并替换：

```js
XHRInterceptor.transport = transport
window.XMLHttpRequest = XHRInterceptor
```

手动替换不会自动恢复；需要完整生命周期管理时使用 `install()`。

## Transport 响应

Transport 可以同步返回或返回 Promise，结果支持：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `status` | `number` | HTTP 状态码，默认 `200` |
| `statusText` | `string` | 状态描述 |
| `headers` / `responseHeaders` | `object` | 响应头，名称不区分大小写 |
| `body` / `response` | `any` | 响应内容 |
| `responseURL` | `string` | 最终响应地址，默认请求地址 |
| `responseXML` | `Document` | 可选 XML 文档 |

Transport 抛出异常或 Promise 拒绝表示网络失败：XHR 的 `status` 为 `0`，依次触发
`readystatechange`、`error`、`loadend`，不会触发 `load`。HTTP 4xx/5xx 应作为正常响应对象返回，
这时仍触发 `load`，与原生 XHR 语义一致。

## 取消和超时

- `xhr.abort()` 会中止 `signal`，触发 `abort` 和 `loadend`，并忽略迟到响应。
- `xhr.timeout > 0` 时会计时；超时后中止 `signal`，触发 `timeout` 和 `loadend`。
- Transport 必须监听 `signal`，否则只能阻止结果回写，不能真正停止底层任务。

## `responseType`

当前支持：

- `''`、`'text'`：转成字符串，同时设置 `response` 和 `responseText`。
- `'json'`：解析字符串；无效 JSON 返回 `null`。
- `'arraybuffer'`：接受 ArrayBuffer、TypedArray 或可转成文本的值。
- `'blob'`：在环境支持 Blob 时构造 Blob。

同步 XHR（`open(..., false)`）无法等待异步 transport，因此明确抛出 `NotSupportedError`。

## XHR 方法

实现以下常用接口：

- `open`
- `setRequestHeader`
- `send`
- `abort`
- `getResponseHeader`
- `getAllResponseHeaders`
- `overrideMimeType`（兼容空实现）
- `addEventListener`
- `removeEventListener`
- `dispatchEvent`

它不是完整浏览器网络栈，不模拟上传进度、重定向、Cookie、CORS 或浏览器缓存；这些能力应由
transport 或宿主环境负责。
