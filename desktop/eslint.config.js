// ESLint 9 扁平配置（T8 工程化守门）
// 仅做静态校验、不改动功能；规则以「不阻断既有代码」为底，作为增量质量信号。
const js = require('@eslint/js')

module.exports = [
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        global: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        setImmediate: 'readonly',
        clearImmediate: 'readonly'
      }
    },
    rules: {
      // 存量代码存在未使用变量/参数，降级为 warn，避免 CI 阻断，仅作信号
      'no-unused-vars': 'warn',
      // Node 全局已通过 globals 声明；关闭 no-undef 以免存量代码误报阻断
      'no-undef': 'off'
    }
  }
]
