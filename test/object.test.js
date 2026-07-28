import test from 'node:test'
import assert from 'node:assert/strict'
import object from '../src/object/object.js'

test('getType 返回统一的小写类型', () => {
    assert.equal(object.getType(null), 'null')
    assert.equal(object.getType(undefined), 'undefined')
    assert.equal(object.getType([]), 'array')
    assert.equal(object.getType(new Date()), 'date')
})

test('merge 深度合并对象和数组，并忽略 undefined', () => {
    const target = {user: {name: '旧名称'}, list: [1, 2], enabled: true}
    const result = object.merge(target, {
        user: {name: '新名称', age: 18},
        list: [3],
        enabled: undefined
    })

    assert.equal(result, target)
    assert.deepEqual(result, {
        user: {name: '新名称', age: 18},
        list: [3, 2],
        enabled: true
    })
})

test('merge 只复制自有属性并阻断原型污染', () => {
    const source = Object.create({inherited: true})
    source.safe = 1
    const malicious = JSON.parse('{"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}}}')
    const result = object.merge({}, source, malicious)

    assert.deepEqual(result, {safe: 1})
    assert.equal({}.polluted, undefined)
})
