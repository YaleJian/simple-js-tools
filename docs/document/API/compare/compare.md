---
sidebar_position: 1
---
# 比较
对象之间的比较判断。

## 判断是否为数组

```javascript
isArray(arg) {
    return Array.isArray(arg)
}
```

## 判断是否为对象
```javascript
isObject(arg){
    return Object.prototype.toString.call(arg) === '[object Object]'
}
```

## 判断是否为Promise对象
```javascript
isPromise(arg){
    return Object.prototype.toString.call(arg) === '[object Promise]'
}
```

## 判断是否为数字
```javascript
isNumber: function(arg) {
    return !isNaN(parseFloat(arg)) && isFinite(arg)
}
```

## 判断是否为JS方法
```javascript
isFunction: function (arg) {
    return Object.prototype.toString.call(arg) === '[object Function]'
}
```