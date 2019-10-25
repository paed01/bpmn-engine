import { terser } from 'rollup-plugin-terser';

import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import json from 'rollup-plugin-json';

import pkg from './package.json';

function pgl(plugins=[]) {
  return [
    json(),
    ...plugins
  ];
}

const srcEntry = pkg.source;

const umdDist = pkg['umd:mainDist'];

const umdName = 'BpmnEngine';

export default [
  // browser-friendly UMD build
  {
    input: srcEntry,
    output: {
      file: umdDist.replace(/\.js$/, '.prod.js'),
      format: 'umd',
      name: umdName
    },
    plugins: pgl([
      resolve(),
      commonjs(),
      terser()
    ])
  },
  {
    input: srcEntry,
    output: {
      file: umdDist,
      format: 'umd',
      name: umdName
    },
    plugins: pgl([
      resolve(),
      commonjs()
    ])
  },
  {
    input: srcEntry,
    output: [
      { file: pkg.main, format: 'cjs' },
      { file: pkg.module, format: 'es' }
    ],
    external: [
      'min-dash',
      'moddle',
      'moddle-xml'
    ],
    plugins: pgl()
  }
];