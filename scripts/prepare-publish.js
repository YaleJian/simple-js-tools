import {cp, mkdir, readFile, rm, writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'

const rootDir = resolve(import.meta.dirname, '..')
const publishDir = resolve(rootDir, 'publish')
const rootPackage = JSON.parse(await readFile(resolve(rootDir, 'package.json'), 'utf8'))

const publishPackage = {
    name: rootPackage.name,
    version: rootPackage.version,
    description: rootPackage.description,
    type: 'module',
    main: './dist/simple-js-tools.cjs',
    module: './dist/simple-js-tools.es.js',
    exports: {
        '.': {
            import: './dist/simple-js-tools.es.js',
            require: './dist/simple-js-tools.cjs'
        }
    },
    unpkg: './dist/simple-js-tools.js',
    jsdelivr: './dist/simple-js-tools.js',
    files: [
        'dist',
        'docs',
        'README.md',
        'LICENSE'
    ],
    sideEffects: false,
    repository: rootPackage.repository,
    keywords: rootPackage.keywords,
    author: rootPackage.author,
    license: rootPackage.license,
    bugs: rootPackage.bugs,
    homepage: rootPackage.homepage,
    publishConfig: {
        access: 'public'
    }
}

// publish 是纯生成目录；每次构建都从仓库源文件重新同步，避免发布旧文档或旧版本号。
await mkdir(publishDir, {recursive: true})
await rm(resolve(publishDir, 'docs'), {recursive: true, force: true})
await Promise.all([
    cp(resolve(rootDir, 'README.md'), resolve(publishDir, 'README.md')),
    cp(resolve(rootDir, 'LICENSE'), resolve(publishDir, 'LICENSE')),
    cp(resolve(rootDir, 'docs'), resolve(publishDir, 'docs'), {recursive: true}),
    writeFile(
        resolve(publishDir, 'package.json'),
        `${JSON.stringify(publishPackage, null, 2)}\n`
    )
])

console.log(`已生成 npm 发布目录：publish/ (${publishPackage.name}@${publishPackage.version})`)
