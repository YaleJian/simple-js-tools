# simple-js-tools

一个保持小而清晰的 JavaScript 工具库。新增能力前必须先判断是否必要、是否与平台 API 或现有方法重复。

## 安装

```bash
npm install simple-js-tools
```

```js
import sTools from 'simple-js-tools'

sTools.compare.isNumber('12.5')
```

浏览器也可以通过 IIFE 产物使用全局变量 `sTools`：

```html
<script src="https://unpkg.com/simple-js-tools/dist/simple-js-tools.js"></script>
```

## 文档

- [快速开始](./docs/README.md)
- [类型判断 compare](./docs/compare.md)
- [对象操作 object](./docs/object.md)
- [XHR 模拟与钩子](./docs/xhr.md)
- [方法设计与贡献规范](./docs/development.md)

## 开发

```bash
npm test
npm run build
```

项目使用 tsdown 输出 ESM、CommonJS、IIFE 和 UMD 四种格式。AI 修改本项目时应使用
[`simple-js-tools-maintainer`](./skills/simple-js-tools-maintainer/SKILL.md) Skill。
