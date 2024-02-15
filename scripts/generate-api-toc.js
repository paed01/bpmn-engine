import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import Toc from 'markdown-toc';

const nodeRequire = createRequire(fileURLToPath(import.meta.url));
const { version } = nodeRequire('../package.json');

const filenames = getFileNames();

function getFileNames() {
  const arg = process.argv[2] || './API.md';
  return arg.split(',');
}

function generate(filename) {
  const api = fs.readFileSync(filename, 'utf8');
  const tocOptions = {
    bullets: '-',
    slugify(text) {
      return text
        .toLowerCase()
        .replace(/\s/g, '-')
        .replace(/[^\w-]/g, '');
    },
  };

  const output = Toc.insert(api, tocOptions).replace(
    /<!-- version -->(.|\n)*<!-- versionstop -->/,
    '<!-- version -->\n\n# ' + version + ' API Reference\n\n<!-- versionstop -->'
  );

  fs.writeFileSync(filename, output);
}

filenames.forEach(generate);
