# 请求无感劫持

`sTools.request` 让现有项目在不修改业务请求代码的情况下，把 XHR 和 fetch 转交给自定义 transport。

```js
const {xhr, fetch} = sTools.request
```

- [`request.xhr`](./request-xhr.md)：替换 `XMLHttpRequest`，保持 `open`、`send` 和事件回调风格。
- [`request.fetch`](./request-fetch.md)：替换全局 `fetch`，保持标准 `Request`、`Response` 和 Promise 风格。

两种劫持只处理安装之后发起的请求。已经缓存原生构造函数或原生 `fetch` 引用的代码不会被接管。

## Transport 设计

Transport 是真正发送请求的函数，可以使用 WebSocket、Electron IPC、客户端桥接或其他通信方式。
它应监听收到的 `AbortSignal`，及时停止底层任务。

XHR 和 fetch 不强行共用同一种响应对象：

- XHR transport 返回适合 XHR 状态和事件的响应描述。
- fetch transport 返回标准 `Response` 或可构造 `Response` 的描述对象。

这样可以保留两套平台 API 各自可预测的错误和响应语义。
