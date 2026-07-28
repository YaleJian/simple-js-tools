const toString = Object.prototype.toString

export default {
    // 仅匹配普通对象，不把数组、日期等对象误判为普通对象。
    isObject(value) {
        return toString.call(value) === '[object Object]'
    },

    // 保留原有宽松语义：数字以及非空数字字符串都返回 true。
    isNumber(value) {
        return value !== '' && value !== null && typeof value !== 'boolean'
            && Number.isFinite(Number(value))
    }
}
