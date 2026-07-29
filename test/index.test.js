import test from 'node:test'
import assert from 'node:assert/strict'
import sTools from '../src/index.js'

test('公共入口只暴露具有实际能力的模块', () => {
    assert.deepEqual(Object.keys(sTools).sort(), ['compare', 'object', 'request'])
    assert.deepEqual(Object.keys(sTools.compare).sort(), ['isNumber', 'isObject'])
    assert.deepEqual(Object.keys(sTools.object).sort(), ['getType', 'merge'])
    assert.deepEqual(
        Object.keys(sTools.request).sort(),
        ['createRequestPatch', 'eventSource', 'fetch', 'xhr']
    )
})
