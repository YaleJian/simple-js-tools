import test from 'node:test'
import assert from 'node:assert/strict'
import compare from '../src/compare/compare.js'

test('isObject 仅排除明确的非普通对象', () => {
    assert.equal(compare.isObject({}), true)
    assert.equal(compare.isObject([]), false)
    assert.equal(compare.isObject(new Date()), false)
    assert.equal(compare.isObject(null), false)
})

test('isNumber 保留数字字符串支持，但排除空值和布尔值', () => {
    assert.equal(compare.isNumber(12.5), true)
    assert.equal(compare.isNumber('12.5'), true)
    assert.equal(compare.isNumber(''), false)
    assert.equal(compare.isNumber(null), false)
    assert.equal(compare.isNumber(true), false)
    assert.equal(compare.isNumber('12px'), false)
})
