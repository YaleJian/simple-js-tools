export default {
    //是否为数组
    isArray(arg) {
        return Array.isArray(arg)
    },
    //是否为JS对象
    isObject(arg){
        return Object.prototype.toString.call(arg) === '[object Object]'
    },
    //是否为Promise对象
    isPromise(arg){
        return Object.prototype.toString.call(arg) === '[object Promise]'
    },
    //是否为数字
    isNumber: function(arg) {
        return !isNaN(parseFloat(arg)) && isFinite(arg)
    },
    //是否为JS方法
    isFunction: function (arg) {
        return Object.prototype.toString.call(arg) === '[object Function]'
    }
}