'use strict';

const babel = require('rollup-plugin-babel');
const commonjs = require('rollup-plugin-commonjs');
const {rollup} = require('rollup');

const rollupConfig = {
  input: 'scripts/bundle-bpmn-io.js',
  plugins: [
    commonjs({
      include: ['scripts/bundle-bpmn-io.js']
    }),
    babel(babelConfig),
  ]
};
