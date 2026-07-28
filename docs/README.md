# 使用文档

## 安装与导入

```bash
npm install simple-js-tools
```

```js
import sTools from 'simple-js-tools'

const {compare, object, request} = sTools
```

按模块阅读完整 API：

- [`compare`](./compare.md)：判断值的类型。
- [`object`](./object.md)：获取类型、克隆和深度合并普通数据。
- [`request`](./request.md)：无感接管浏览器 `XMLHttpRequest` 和 fetch。

## 使用边界

- `compare` 和 `object` 可用于浏览器及支持 ESM 的 Node.js。
- `request` 面向浏览器；在 Node.js 中可以导入，但实际劫持需要对应的 `XMLHttpRequest` 或 fetch API。
- 本库不追求方法数量。平台原生 API 已足够清晰时，不再包装同义方法。
