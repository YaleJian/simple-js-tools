import {access, readFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {resolve} from 'node:path'
import {pathToFileURL} from 'node:url'

const rootDir = resolve(import.meta.dirname, '..')
const publishDir = resolve(rootDir, 'publish')
const rootPackage = JSON.parse(await readFile(resolve(rootDir, 'package.json'), 'utf8'))
const publishPackage = JSON.parse(await readFile(resolve(publishDir, 'package.json'), 'utf8'))

if (!rootPackage.private) throw new Error('根 package.json 必须保持 private，避免从错误目录发布')
if (publishPackage.version !== rootPackage.version) {
    throw new Error(`发布版本不一致：root=${rootPackage.version}, publish=${publishPackage.version}`)
}

const requiredFiles = [
    'README.md',
    'LICENSE',
    'docs/README.md',
    'docs/request-event-source.md',
    'docs/request-patch.md',
    'dist/simple-js-tools.es.js',
    'dist/simple-js-tools.cjs',
    'dist/simple-js-tools.js',
    'dist/simple-js-tools.umd.js'
]
await Promise.all(requiredFiles.map(file => access(resolve(publishDir, file))))

const esm = await import(`${pathToFileURL(resolve(publishDir, publishPackage.module)).href}?verify=${Date.now()}`)
const require = createRequire(import.meta.url)
const cjs = require(resolve(publishDir, publishPackage.main))

for (const [format, tools] of [['ESM', esm.default], ['CJS', cjs]]) {
    if (typeof tools?.request?.xhr?.install !== 'function') {
        throw new Error(`${format} 缺少 request.xhr.install`)
    }
    if (typeof tools?.request?.fetch?.install !== 'function') {
        throw new Error(`${format} 缺少 request.fetch.install`)
    }
    if (typeof tools?.request?.eventSource?.install !== 'function') {
        throw new Error(`${format} 缺少 request.eventSource.install`)
    }
    if (typeof tools?.request?.createRequestPatch !== 'function') {
        throw new Error(`${format} 缺少 request.createRequestPatch`)
    }
    if ('xhr' in tools) throw new Error(`${format} 仍暴露已删除的顶层 xhr`)
}

const banner = await readFile(resolve(publishDir, 'dist/simple-js-tools.es.js'), 'utf8')
if (!banner.includes(`simple-js-tools v${publishPackage.version}`)) {
    throw new Error('构建产物版本横幅与 package.json 不一致')
}

console.log(`npm 发布目录校验通过：${publishPackage.name}@${publishPackage.version}`)
