# xhr 请求模拟与钩子

`xhr` 仅适用于存在 `XMLHttpRequest` 的浏览器环境：

```js
const {mock: MockXHR, hook} = sTools.xhr
```

## `MockXHR`

模拟 `XMLHttpRequest` 的构造函数。设置静态代理后，可替换浏览器原生实现：

```js
MockXHR.proxy = async xhr => ({
    status: 200,
    response: JSON.stringify({
        method: xhr.config.method,
        body: xhr.config.body
    }),
    responseHeaders: {'content-type': 'application/json'}
})

window.XMLHttpRequest = MockXHR
```

### 静态配置

#### `MockXHR.proxy`

接收当前 MockXHR 实例并返回 Promise。Promise 最终值可以包含：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `status` | `number` | HTTP 状态码，默认 `200` |
| `statusText` | `string` | 状态描述，默认根据状态码推导 |
| `response` | `any` | 响应内容；字符串会同步到 `responseText` |
| `responseHeaders` | `object` | 响应头键值对象；名称不区分大小写 |
| `responseType` | `string` | 响应类型 |
| `responseURL` | `string` | 最终响应地址 |
| `responseXML` | `Document` | XML 响应 |
| `timeout` | `number` | 超时时间 |
| `withCredentials` | `boolean` | 是否携带凭证 |

代理抛出异常时，MockXHR 会完成请求并生成状态码 `502`；代理不存在或未返回 Promise 时生成
`500`，避免请求一直停留在未完成状态。

#### `MockXHR.debug`

设为 `true` 时在控制台输出请求配置和代理响应，默认 `false`。

### 实例配置

#### `xhr.noProxy`

设为 `true` 后，该实例转交给模块内部保存的原生 `XMLHttpRequest`。默认 `false`。模块不会为此向
`window` 写入额外的备份变量。

#### `xhr.config`

保存当前请求的方法、地址、请求体、请求头、认证信息和事件监听器。它主要提供给
`MockXHR.proxy` 使用，不建议业务代码直接修改。

### XHR 兼容方法

#### `open(method, url, async?, username?, password?)`

初始化请求。`async` 默认值为 `true`。拦截模式下会把状态改为 `OPENED`。

#### `setRequestHeader(name, value)`

设置请求头。重复设置同名请求头时使用逗号连接值。

#### `send(body?)`

发送请求并调用 `MockXHR.proxy`。依次触发 `loadstart`、状态变化、`load` 和 `loadend`。

#### `abort()`

取消请求，把状态恢复为 `UNSENT`，并触发 `abort` 和 `error`。

#### `getResponseHeader(name)`

不区分大小写地读取一个响应头；不存在时返回 `null`。

#### `getAllResponseHeaders()`

返回与原生 XHR 类似的 CRLF 分隔响应头字符串。

#### `addEventListener(type, handler)`

注册事件监听器。

#### `removeEventListener(type, handler)`

移除指定的事件监听器。

#### `dispatchEvent(event)`

同步触发已注册的监听器以及对应的 `on<type>` 回调。

#### `overrideMimeType()`

为兼容原生 XHR 保留的空实现，当前不会改变响应解析方式。

## `hook`

在不替换构造函数的情况下劫持当前环境的原生 `XMLHttpRequest`。

### `hook.createHooks()`

安装请求和响应钩子。全局只需调用一次，重复调用不会重复注册。

```js
hook.requestHook = request => ({
    ...request,
    headers: {'x-debug': 'true'}
})

hook.responseHook = (request, xhr) => {
    xhr.response = xhr.responseText = '修改后的响应'
}

hook.createHooks()
```

### `hook.requestHook`

在 `send` 前执行，接收 `{url, method, body, headers}`。其中 `headers` 是调用方在 `open` 和
`send` 之间设置的请求头。钩子可以只返回需要修改的字段：

```js
hook.requestHook = ({body}) => ({
    method: 'PUT',
    body: JSON.stringify({...JSON.parse(body), updated: true})
})
```

修改方法或地址时，内部会重新执行 `open` 并重放之前设置的请求头。

### `hook.responseHook`

请求进入 `readyState === 4` 后执行，参数为请求信息和当前 XHR 实例。即使没有配置
`requestHook`，请求信息仍然完整。钩子可以修改 `response` 与 `responseText`。

### `hook.debug`

设为 `true` 时输出钩子输入和结果，默认 `false`。

警告：Hook 会修改全局 `XMLHttpRequest.prototype`，目前没有卸载方法。只应在确定需要全局劫持的
调试、适配或受控运行环境中使用。
