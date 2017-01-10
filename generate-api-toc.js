'use strict';
// From https://github.com/hapijs/joi/blob/master/generate-readme-toc.js

// Load modules

const Toc = require('markdown-toc');
const Fs = require('fs');
const Package = require('./package.json');

// Declare internals

const internals = {
  filename: process.argv[2] || './API.md'
};


internals.generate = function() {
  const api = Fs.readFileSync(internals.filename, 'utf8');
  const tocOptions = {
    bullets: '-',
    slugify: function(text) {

      return text.toLowerCase()
        .replace(/\s/g, '-')
        .replace(/[^\w-]/g, '');
    }
  };

  const output = Toc.insert(api, tocOptions)
    .replace(/<!-- version -->(.|\n)*<!-- versionstop -->/, '<!-- version -->\n# ' + Package.version + ' API Reference\n<!-- versionstop -->');

  Fs.writeFileSync(internals.filename, output);
};

internals.generate();
