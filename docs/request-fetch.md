# `request.fetch`

调用入口：

```js
const fetchInterceptor = sTools.request.fetch
```

## 安装

```js
const controller = fetchInterceptor.install(async (request, {signal, nativeFetch}) => {
    const result = await sendByAnotherChannel({
        method: request.method,
        url: request.url,
        headers: Object.fromEntries(request.headers),
        body: await request.clone().arrayBuffer(),
        signal
    })

    return {
        status: result.status,
        statusText: result.statusText,
        headers: result.headers,
        body: result.body
    }
})

controller.restore()
```

安装后，业务代码不变：

```js
const response = await fetch('/api/items', {
    method: 'POST',
    body: JSON.stringify({name: '测试'})
})

const data = await response.json()
```

### `fetch.install(transport, options?)`

把目标环境的 `fetch` 替换为拦截函数。

- `transport` 接收标准 `Request`。
- `options.target` 默认当前 `window`，必须提供 `fetch`、`Request` 和 `Response`。
- `options.beforeRequest` 使用统一请求改写协议，详见[请求劫持总览](./request.md)。
- 返回 `{restore()}`，用于恢复安装前的原生 fetch。
- 同一环境重复安装会抛出错误。

Transport 的第二个参数包含：

| 字段 | 说明 |
| --- | --- |
| `signal` | `Request.signal` |
| `nativeFetch` | 已绑定当前环境的原生 fetch，供 transport 明确绕过劫持 |

## Transport 响应

可以直接返回标准 `Response`：

```js
return new Response('ok', {status: 200})
```

也可以返回描述对象：

```js
return {
    status: 200,
    statusText: 'OK',
    headers: {'content-type': 'application/json'},
    body: '{"ok":true}'
}
```

描述对象会转换成标准 `Response`，因此调用方仍可使用 `text()`、`json()`、`blob()` 等原生方法。

## SSE 与流式响应

标准 `Response` 会原样返回。描述对象的 `body` 也可以是 `ReadableStream`，不会转成字符串或
预先缓存完整响应。调用方可直接使用 `response.body.getReader()` 逐块读取。

`content-type: text/event-stream` 不改变 Fetch 的 Promise/Response 语义。Transport 必须监听
收到的 `signal`，并在取消时结束或报错底层 Stream。未通过 Hook 显式返回 `body` 时，拦截器
不会读取或消费原 Body。

## 错误与取消

- Transport 同步抛错或 Promise 拒绝时，`fetch()` 返回的 Promise 拒绝。
- 请求的 AbortSignal 被中止时，等待中的 `fetch()` 以 `AbortError` 拒绝。
- Transport 应监听同一个 `signal`，才能真正取消底层任务。
- HTTP 4xx/5xx 应返回对应状态的 `Response`，不会自动转成 Promise 拒绝。
