'use strict';

const babel = require('rollup-plugin-babel');
const commonjs = require('rollup-plugin-commonjs');
const json = require('rollup-plugin-json');
const nodeResolve = require('rollup-plugin-node-resolve');
const license = require('rollup-plugin-license');
const path = require('path');

module.exports = {
  input: './node_modules/bpmn-moddle/index.js',
  output: {
    format: 'cjs',
    file: 'dist/bpmn-moddle.js'
  },
  plugins: [
    json(),
    commonjs({
      include: ['node_modules/**']
    }),
    license({
      banner: {
        file: path.join(__dirname, 'node_modules/bpmn-moddle/LICENSE'),
      },
      thirdParty: {
        output: path.join(__dirname, 'dist', 'dependencies.txt'),
      },
    }),
    nodeResolve({
      mainFields: ['module', 'main'],
    }),
    babel({
      babelrc: false,
      presets: ['@babel/env']
    })
  ],
};

