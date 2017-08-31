'use strict';
// From https://github.com/hapijs/joi/blob/master/generate-readme-toc.js

// Load modules

const Toc = require('markdown-toc');
const Fs = require('fs');
const {version} = require('../package.json');

// Declare internals

const filenames = getFileNames();

function getFileNames() {
  const arg = process.argv[2] || './API.md';
  return arg.split(',');
}

function generate(filename) {
  const api = Fs.readFileSync(filename, 'utf8');
  const tocOptions = {
    bullets: '-',
    slugify: function(text) {

      return text.toLowerCase()
        .replace(/\s/g, '-')
        .replace(/[^\w-]/g, '');
    }
  };

  const output = Toc.insert(api, tocOptions)
    .replace(/<!-- version -->(.|\n)*<!-- versionstop -->/, '<!-- version -->\n# ' + version + ' API Reference\n<!-- versionstop -->');

  Fs.writeFileSync(filename, output);
}

filenames.forEach(generate);
