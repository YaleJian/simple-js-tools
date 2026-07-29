# `request.createRequestPatch`

`createRequestPatch(snapshot, patch?)` 标准化合并 URL、Query 和 Header，并按需替换 Body。
三个拦截器和上层 SDK 可复用它，避免产生不同的大小写与删除规则。

## 合并规则

- 未提供 `url` 时沿用快照地址；相对地址不会被转成绝对地址。
- `query` 使用 `URLSearchParams` 语义合并：`null` 删除，`undefined` 忽略，其他值转字符串。
- Header 名称不区分大小写：`null` 删除，`undefined` 忽略。
- 只有补丁显式拥有 `body` 字段时才替换 Body；`body: undefined` 也是显式替换。
- 返回新对象和新的 Header 对象，不修改输入。

```js
const next = sTools.request.createRequestPatch(snapshot, {
    url: '/proxy?keep=1',
    query: {page: 2, remove: null},
    headers: {Authorization: 'new-token', 'x-remove': null}
})
```

该方法不会发送请求、读取 Body、解析绝对地址或执行 Hook。它作为公共 API 是必要的，因为三个协议
和上层 SDK 都需要严格共享同一套合并语义；其他业务改写逻辑不应继续下沉到本库。
