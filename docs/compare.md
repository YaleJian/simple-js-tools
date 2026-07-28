# compare 类型判断

```js
const {compare} = sTools
```

本模块只保留具有额外稳定语义的判断。数组和函数请直接使用 `Array.isArray` 与 `typeof`。

## `isObject(value)`

判断 `value` 是否具有普通对象的内部类型标签。数组、日期、正则、函数和 `null` 均返回 `false`。

- 参数：任意值。
- 返回：`boolean`。

```js
compare.isObject({name: 'Yale'}) // true
compare.isObject([]) // false
```

类实例通常也会返回 `true`，因此该方法不是“对象字面量”检测器。

## `isNumber(value)`

判断 `value` 是否为有限数字或非空数字字符串。

- 参数：任意值。
- 返回：`boolean`。

```js
compare.isNumber(12.5) // true
compare.isNumber('12.5') // true
compare.isNumber('') // false
compare.isNumber('12px') // false
```

该方法有意支持表单中常见的数字字符串。只判断 JavaScript 数字类型时，请直接使用
`typeof value === 'number' && Number.isFinite(value)`。
