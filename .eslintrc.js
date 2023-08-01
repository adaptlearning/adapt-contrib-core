module.exports = {
  'env': {
    'browser': true,
    'es2021': true,
    'node': true
  },
  'extends': 'eslint:recommended',
  'globals': {
    '$': 'readonly',
    '_': 'readonly',
    'Backbone': 'readonly',
    'Handlebars': 'readonly',
    'Modernizr': 'readonly',
  },
  'parserOptions': {
    'ecmaVersion': 12,
    'sourceType': 'module'
  },
  'rules': {
    'quotes': ['error', 'single'],
    'semi': ['error', 'always'],
    'indent': ['error', 2, { 'SwitchCase': 1 }],
    'no-multi-spaces': ['error']
  }
};
