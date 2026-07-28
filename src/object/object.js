import compare from "../compare/compare.js"

const object = {
    // 返回统一的小写类型名称，例如 array、date、null。
    getType(value) {
        if (value === null || value === undefined) return String(value)
        return Object.prototype.toString.call(value).slice(8, -1).toLowerCase()
    },

    // 深度合并普通对象和数组，后传入的同名属性覆盖先前属性。
    merge(target, ...sources) {
        target ||= {}

        for (const source of sources) {
            if (source == null) continue

            for (const name of Object.keys(source)) {
                // 阻断修改对象原型或构造器的常见污染入口。
                if (name === '__proto__' || name === 'prototype' || name === 'constructor') continue

                const value = source[name]
                if (value === undefined || target[name] === value) continue

                if (Array.isArray(value)) {
                    target[name] = object.merge(
                        Array.isArray(target[name]) ? target[name] : [],
                        value
                    )
                } else if (compare.isObject(value)) {
                    target[name] = object.merge(
                        compare.isObject(target[name]) ? target[name] : {},
                        value
                    )
                } else {
                    target[name] = value
                }
            }
        }

        return target
    }
}

export default object
