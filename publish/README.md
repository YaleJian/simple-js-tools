# Javascrip 工具集

```npm
npm i simple-js-tools
```

## 使用案例
```javascript
import tools from 'simple-js-tools'
const {xhr, object} = tools

//深拷贝
let str1 = {
    a: {
        a: 1,
        b: {
            a: 1
        },
        c: 1,
        d: [1, 1, 1]
    },
    b: {
        b: 2
    },
    c: 2
}

let str2 = {
    a: {
        a: 2,
        b: 2,
        c: {
            a: 2
        },
        d: [2, 2, 2]
    },
    b: {
        a: 2,
        b: 2
    },
}

let str3 ={
    a:{
        a: 1,
        b:{
            a:2
        },
        c:2
    }
}
let str4 = {
    a:{
        a: 2
    }
}

console.log(object.deepCopy(str1, str2))
Object.prototype.deepCopy = object.deepCopy
console.log(str1.deepCopy(str2))
console.log(str3.deepCopy(str4))


// 重写XHR，代理请求
xhr.proxy = xhr => new Promise((resolve, reject) => {
    xhr.response = xhr.responseText = JSON.stringify({...{hook: "响应数据已修改！"}})
    resolve(xhr)
})
window.XMLHttpRequest = xhr

doXHR()

function doXHR() {
    let xhr = new XMLHttpRequest();
    xhr.open("post", "http://y.cc", true); // 异步请求
    xhr.setRequestHeader("Content-type", "application/json")
    xhr.send(JSON.stringify({id: 1}));

    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) { // 监听请求完成
            if ((xhr.status >= 200 && xhr.status < 300) || xhr.status === 304) {
                console.log(xhr.response)
            } else {

            }
        }
    }
}
```