---
name: simple-js-tools-maintainer
description: 维护 simple-js-tools 的小型公共 API，优先复用原生能力，审查新增方法的必要性与重复性，并同步中文注释、单元测试、Markdown 文档和 tsdown 构建。修改本仓库的源码、API、测试、文档或发布配置时使用。Maintain simple-js-tools APIs, tests, docs, and builds with a minimal-library policy.
---

# Simple JS Tools 维护规范

## 中文版

### 原则

保持库小而清晰。新增公共 API 会带来长期的兼容、测试和文档成本，因此默认不新增。

修改前读取相关源码、测试、`docs/development.md` 和对应的 `docs/<module>.md`。代码与测试是当前行为的主要证据。

### API 准入

新增方法前只回答三个问题：

1. 是否解决了多个调用方会重复遇到的通用问题？
2. 原生 API、现有方法或简单组合是否已经足够清晰？
3. 新方法的稳定语义是否明显大于它带来的公共 API 成本？

第 1 或第 3 项为“否”，或第 2 项为“是”时，不新增。优先补文档、组合现有能力或直接使用原生 API。

同时拒绝：

- 业务专用的便捷函数；
- 与现有方法仅有名称或参数差异的重复能力；
- 行为需要大量例外才能说明的方法；
- 为未来需求预留的空模块、占位方法或推测性抽象。

删除无有效能力的占位 API。真实兼容性变化必须明确说明。

### 实现边界

- 一个方法只做一件可预测的事，名称、输入、输出、错误和副作用保持直观。
- 优先使用标准 JavaScript 和浏览器 API，不轻易增加运行时依赖。
- 保留现有行为，除非修复了可验证缺陷或用户明确授权破坏性调整。
- 防范原型污染、共享可变状态、环境全局变量和异步失败。
- 中文注释只解释安全边界、兼容决策、副作用和不直观原因，不逐行翻译代码。
- 文档保持纯 Markdown；不要恢复文档站框架。

### 公共行为的完成条件

每次新增、修改或删除公共行为时：

1. 更新 `test/` 下的 `node:test` 用例，覆盖正常、边界和失败路径。
2. 更新对应的 `docs/<module>.md`，说明签名、示例、限制及必要的错误或环境信息。
3. 仅在模块导航变化时更新 `docs/README.md`；文档过长时按模块拆分。
4. 不复制实现源码充当 API 文档，只描述调用者可观察的行为。

运行：

```bash
npm test
npm run build
git diff --check
```

确认公共入口、测试、文档和 ESM/CJS/IIFE/UMD 产物一致。交付时只报告结果、兼容性变化和已知限制。

---

## English translation

### Principle

Keep the library small and clear. A public API creates permanent compatibility, testing, and documentation costs, so adding one is not the default.

Before editing, read the relevant source, tests, `docs/development.md`, and `docs/<module>.md`. Treat code and tests as the primary evidence of current behavior.

### API admission

Before adding a method, answer only:

1. Does it solve a general problem repeated by multiple callers?
2. Is a native API, existing method, or simple composition already clear enough?
3. Does its stable semantic value clearly exceed its public API cost?

Do not add it when question 1 or 3 is “no”, or question 2 is “yes”. Prefer documentation, composition, or the native API.

Also reject business-specific helpers, near-duplicates, APIs requiring many exceptions, and speculative placeholders. Remove placeholders with no useful behavior and report real compatibility changes.

### Implementation boundaries

- Give each method one predictable responsibility with intuitive inputs, output, errors, and side effects.
- Prefer standard JavaScript and browser APIs; avoid runtime dependencies without clear library-wide value.
- Preserve established behavior unless fixing a demonstrated defect or making a user-authorized breaking change.
- Guard prototype pollution, shared mutable state, runtime globals, and asynchronous failures.
- Use Chinese comments only for security boundaries, compatibility decisions, side effects, and non-obvious reasoning.
- Keep documentation as plain Markdown; do not restore a documentation-site framework.

### Definition of done for public behavior

For every public addition, change, or removal:

1. Update `node:test` coverage for normal, boundary, and failure paths.
2. Update `docs/<module>.md` with the signature, example, limitations, and relevant error or runtime information.
3. Update `docs/README.md` only when navigation changes; split long documentation by module.
4. Document observable behavior instead of pasting implementation source.

Run:

```bash
npm test
npm run build
git diff --check
```

Confirm that exports, tests, docs, and ESM/CJS/IIFE/UMD outputs agree. Report only outcomes, compatibility changes, and known limitations.
