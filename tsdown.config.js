import {defineConfig} from 'tsdown'
import packageData from './package.json' with {type: 'json'}

const outputFiles = {
    es: 'simple-js-tools.es.js',
    cjs: 'simple-js-tools.cjs',
    iife: 'simple-js-tools.js',
    umd: 'simple-js-tools.umd.js'
}

export default defineConfig({
    entry: ['./src/index.js'],
    outDir: './publish/dist',
    format: ['esm', 'cjs', 'iife', 'umd'],
    outputOptions(options, format) {
        // 保留历史文件名，避免现有 npm 与 CDN 引用在迁移构建器后失效。
        options.entryFileNames = outputFiles[format]
    },
    globalName: 'sTools',
    target: 'es2018',
    minify: true,
    clean: true,
    banner: `/* simple-js-tools v${packageData.version} */`,
    footer: '/* End */'
})
