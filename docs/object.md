# object 对象操作

```js
const {object} = sTools
```

## `getType(value)`

返回统一的小写类型名称。

- 参数：任意值。
- 返回：类型字符串。

```js
object.getType([]) // 'array'
object.getType(new Date()) // 'date'
object.getType(null) // 'null'
object.getType(undefined) // 'undefined'
```

## `merge(target, ...sources)`

把多个来源中的普通对象和数组递归合并到 `target`，并返回同一个 `target`。

- `undefined` 不覆盖已有值。
- 数组按索引合并，不是拼接数组。
- 只复制来源对象的自有可枚举属性。
- 忽略 `__proto__`、`prototype` 和 `constructor`，防止原型污染。

```js
const target = {
    user: {name: '旧名称'},
    list: [1, 2]
}

object.merge(target, {
    user: {name: '新名称', age: 18},
    list: [3]
})

// {
//   user: {name: '新名称', age: 18},
//   list: [3, 2]
// }
```

必须显式传入目标对象。需要克隆数据时优先使用平台的 `structuredClone`；本库不再提供语义受限的
JSON 克隆包装。
