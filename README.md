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
- [请求无感劫持](./docs/request.md)
- [方法设计与贡献规范](./docs/development.md)

## 开发

```bash
npm test
npm run build
```

项目使用 tsdown 输出 ESM、CommonJS、IIFE 和 UMD 四种格式。AI 修改本项目时应使用
[`simple-js-tools-maintainer`](./skills/simple-js-tools-maintainer/SKILL.md) Skill。

## 发布

根 `package.json` 是版本和 npm 元数据的唯一来源，根包设为 `private`，不能误发布。构建会在
忽略版本控制的 `publish/` 中生成完整 npm 包：

```bash
# 测试、构建并验证发布目录
npm run release:check

# 查看 npm tarball 内容，不发布
npm run pack:check

# 发布当前预发布版本到 beta 标签
npm run publish:beta
```

发布前只需修改根 `package.json` 的 `version`，不要手工编辑 `publish/`。
