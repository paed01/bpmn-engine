module.exports = {
  env: {
    node: true,
    es6: true,
  },
  parserOptions: {
    sourceType: 'module',
    ecmaVersion: '2020',
  },
  extends: 'eslint:recommended',
  plugins: ['import'],
  rules: {
    'import/extensions': ['error', 'ignorePackages'],
    'arrow-parens': 'error',
    'brace-style': ['error', '1tbs', { allowSingleLine: false }],
    curly: ['error', 'multi-line'],
    'dot-notation': ['error', { allowKeywords: true }],
    'eol-last': 'error',
    eqeqeq: 'error',
    'handle-callback-err': 'error',
    indent: ['error', 2, { SwitchCase: 1 }],
    'key-spacing': [
      'error',
      {
        beforeColon: false,
        afterColon: true,
      },
    ],
    'linebreak-style': ['error', 'unix'],
    'new-parens': 'error',
    'no-alert': 'error',
    'no-array-constructor': 'error',
    'no-caller': 'error',
    'no-catch-shadow': 'error',
    'no-console': 'error',
    'no-eval': 'error',
    'no-extend-native': 'error',
    'no-extra-bind': 'error',
    'no-extra-parens': ['error', 'functions'],
    'no-implied-eval': 'error',
    'no-iterator': 'error',
    'no-label-var': 'error',
    'no-labels': 'error',
    'no-lone-blocks': 'error',
    'no-loop-func': 'error',
    'no-multi-spaces': 'error',
    'no-multi-str': 'error',
    'no-native-reassign': 'error',
    'no-nested-ternary': 'error',
    'no-new-func': 'error',
    'no-new-object': 'error',
    'no-new-wrappers': 'error',
    'no-octal-escape': 'error',
    'no-path-concat': 'error',
    'no-process-exit': 'error',
    'no-proto': 'error',
    'no-return-assign': 'error',
    'no-script-url': 'error',
    'no-sequences': 'error',
    'no-shadow': 'error',
    'no-spaced-func': 'error',
    'no-trailing-spaces': 'error',
    'no-undef-init': 'error',
    'no-underscore-dangle': 'off',
    'no-unused-expressions': 'error',
    'no-use-before-define': ['error', 'nofunc'],
    'no-useless-concat': 'error',
    'no-var': 'error',
    'object-shorthand': ['error', 'properties'],
    'prefer-arrow-callback': 'error',
    'prefer-const': ['error', { destructuring: 'all' }],
    'quote-props': ['error', 'as-needed'],
    'require-await': 2,
    'switch-colon-spacing': 'error',
    'template-curly-spacing': ['error', 'never'],
    quotes: ['error', 'single', { avoidEscape: true }],
    semi: ['error', 'always'],
    yoda: ['error', 'never'],
  },
};
