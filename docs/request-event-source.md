# `request.eventSource`

`request.eventSource` 无感替换目标环境的 `EventSource`，由自定义 transport 提供增量 SSE 数据。

```js
const controller = sTools.request.eventSource.install(
    (request, {signal, nativeEventSource}) => subscribeByBridge(request, signal),
    {target: window, beforeRequest}
)

const source = new EventSource('/events', {withCredentials: true})
source.onmessage = event => console.log(event.data)
controller.restore()
```

## `eventSource.install(transport, options?)`

- `transport(request, context)` 可同步或异步返回 `AsyncIterable<SSEChunk>`。
- `options.target` 默认当前 `window`。
- `options.beforeRequest` 使用统一请求改写协议；EventSource 始终强制 `GET` 且没有 Body。
- 同一目标重复安装会抛错；`restore()` 可重复调用且只恢复本次安装的构造器。

请求在公共快照外增加 `withCredentials` 和 `lastEventId`。上下文的 `signal` 用于取消当前连接；
`nativeEventSource` 是安装前的构造器，Transport 可用它显式绕过拦截。

## SSEChunk

Transport 可逐次产出 Event Stream 字符串、`Uint8Array`，或结构化对象：

```js
{type: 'notice', data: 'text', id: 'event-1', retry: 1000}
```

文本和字节按 WHATWG Event Stream 格式增量解析，支持 UTF-8 与行跨块、多行 `data`、`event`、
非空 `id` 和非负整数 `retry`。无 `event` 时派发 `message`，否则派发指定类型。

## 实例行为

实例提供 `CONNECTING`、`OPEN`、`CLOSED`，以及浏览器常用属性、事件监听方法和 `close()`。
获取首个可用流后触发 `open`。流正常结束或异常断开都会触发 `error`，未关闭时按最近的 `retry`
重连。重连请求在 `lastEventId` 和 `last-event-id` Header 中携带最后的非空 ID；HTTP Transport
应将其映射为 `Last-Event-ID`。

`close()` 中止 Transport、停止重连并进入 `CLOSED`，可重复调用。关闭或连接失效后的迟到数据
不会派发。

一次性 Bridge RPC 返回值不是真正 SSE。Bridge 必须具备开始订阅、增量事件、结束和取消四类消息，
才能实现该 Transport。
