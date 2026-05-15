{
  "name": "{{name}}",
  "version": "0.1.0",
  "description": "{{description}}",
  "type": "module",
  "private": true,
  "engines": {
    "node": ">=18"
  },
  "scripts": {
    "start": "node src/index.js",
    "test": "node --test 'test/**/*.test.js'",
    "aiad:trace": "npx aiad-sdd trace --fail-on-gap",
    "aiad:doctor": "npx aiad-sdd doctor"
  },
  "license": "{{license}}"
}
