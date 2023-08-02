---
sidebar_position: 2
---
# 对象
对对象的操作。

# 获取对象类型

## 判断是否为JS方法
```javascript
getType(obj) {
    return (obj === null || obj === undefined) ? String(obj) : Object.prototype.toString.call(obj).match(/\[object (\w+)\]/)[1].toLowerCase()
}
```
## 对象拷贝
```javascript
clone(obj){
    return JSON.parse(JSON.stringify(obj))
}
```
## 对象合并
```
merge(...args) {
    //初始化变量
    let target = args[0] || {},
        i = 1,
        length = args.length,
        options, name, src, copy, copyIsArray, clone
    
    //传入一个变量时，自身合并参数对象
    if (length === 1) {
        target = this
        i = 0
    }
    
    //循环拷贝
    for (; i < length; i++) {
        options = args[i]
        if (!options) continue //只处理不是undefined和null的值
    
        for (name in options) {
            copy = options[name] //要拷贝的对象属性
    
            if (name === "_proto_" || target[name] === copy) continue //只处理值不同的,不改变_proto_
    
            //属性值为数组和对象需要进一步拷贝
            if (copy && (Compare.isObject(copy) || (copyIsArray = Compare.isArray(copy)))) {
                src = target[name] //原来对象属性
                if (copyIsArray && !Compare.isArray(src)) {
                    //copy是数组，但是原来对象属性不是数组
                    clone = []
                } else if (!copyIsArray && !Compare.isObject(src)) {
                    //copy不是数组，原来对象属性不是对象
                    clone = {}
                } else {
                    clone = src
                }
                copyIsArray = false //避免影响下次循环
    
                target[name] = object.deepCopy(clone, copy)
            } else if (copy !== undefined) {
                target[name] = copy
            }
        }
    }
    
    return target
    }
```