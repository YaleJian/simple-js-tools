# 请求无感劫持

`sTools.request` 让现有项目在不修改业务请求代码的情况下，把 XHR、fetch 和 EventSource
转交给自定义 transport。

```js
const {xhr, fetch, eventSource, createRequestPatch} = sTools.request
```

- [`request.xhr`](./request-xhr.md)：替换 `XMLHttpRequest`，保持 `open`、`send` 和事件回调风格。
- [`request.fetch`](./request-fetch.md)：替换全局 `fetch`，保持标准 `Request`、`Response` 和 Promise 风格。
- [`request.eventSource`](./request-event-source.md)：替换 `EventSource`，增量解析 SSE 并支持断线重连。
- [`request.createRequestPatch`](./request-patch.md)：统一合并 URL、Query 和 Header。

三种劫持只处理安装之后发起的请求。已经缓存原生实现的代码不会被接管。

## 统一的 `beforeRequest`

三种 `install()` 都接受相同的可选 Hook：

```js
const beforeRequest = snapshot => ({
    url: '/proxy',
    query: {source: snapshot.protocol},
    headers: {'x-sdk': 'vrv'}
})

sTools.request.fetch.install(transport, {target: window, beforeRequest})
```

快照包含 `protocol`、`url`、`method`、`headers`、可选 `body` 和 `signal`。它与内部状态隔离，
直接修改不会改变请求。Hook 可同步返回，也可返回 Promise；返回 `undefined` 表示不修改，
补丁可包含 `url`、`query`、`headers` 和 `body`。合并细节见
[`createRequestPatch`](./request-patch.md)。

Hook 失败时，XHR 触发网络错误，Fetch Promise 拒绝，EventSource 触发 `error` 并按策略重连。

## Transport 设计

Transport 是真正发送请求的函数，可以使用 WebSocket、Electron IPC、客户端桥接或其他通信方式。
它应监听收到的 `AbortSignal`，及时停止底层任务。

三种 transport 不强行共用同一种响应对象：

- XHR transport 返回适合 XHR 状态和事件的响应描述。
- fetch transport 返回标准 `Response` 或可构造 `Response` 的描述对象。
- EventSource transport 返回 `AsyncIterable<SSEChunk>`。

这样可以保留两套平台 API 各自可预测的错误和响应语义。
