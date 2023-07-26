export default {
    isArray(arg) {
        return Array.isArray(arg)
    },
    isObject(arg){
        return Object.prototype.toString.call(arg) === '[object Object]'
    },
    isPromise(arg){
        return Object.prototype.toString.call(arg) === '[object Promise]'
    }
}