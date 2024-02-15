/* eslint no-console:0 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import nock from 'nock';

const nodeRequire = createRequire(fileURLToPath(import.meta.url));
const { name, main } = nodeRequire('../package.json');

process.on('unhandledRejection', (error) => {
  console.log('unhandledRejection', error);
});

nock.enableNetConnect(/(localhost|127\.0\.0\.1):\d+/);
nock('https://example.com').get(/.*/).reply(200, { data: 1 }).persist();

const exPattern = /```javascript\n([\s\S]*?)```/gi;
let lines = 0;
let prevCharIdx = 0;

const file = process.argv[2] || './docs/API.md';
const blockIdx = Number(process.argv[3]);

async function parseDoc(filePath) {
  const fileContent = await fs.readFile(filePath);
  const blocks = [];
  const content = fileContent.toString();
  const mainFile = path.join('..', main);

  content.replace(exPattern, (match, block, idx) => {
    block = block.replace(`require('${name}')`, `require('${mainFile}')`);

    const blockLine = calculateLine(content, idx);

    blocks.push({
      block,
      line: blockLine,
      len: block.length,
      script: parse(`${filePath}`, block, blockLine),
    });
  });

  for (let idx = 0; idx < blocks.lenght; idx++) {
    const { line, script } = blocks[idx];
    console.log(`${idx}: ${filePath}:${line}`);
    await execute(script);
  }

  blocks.forEach(({ line, script }, idx) => {
    if (isNaN(blockIdx) || idx === blockIdx) {
      console.log(`${idx}: ${filePath}:${line}`);
      execute(script);
    }
  });

  function parse(filename, scriptBody, lineOffset) {
    return new vm.Script(scriptBody, {
      filename,
      displayErrors: true,
      lineOffset,
    });
  }
}

function execute(script) {
  const context = {
    require,
    console,
    setTimeout,
    db: {
      getSavedState: (id, callback) => {
        if (fs.existsSync('./tmp/some-random-id.json')) {
          const state = nodeRequire('../tmp/some-random-id.json');
          return callback(null, state);
        }
        callback(new Error('No state'));
      },
      getState: (id, callback) => {
        callback(null, { definitions: [] });
      },
    },
  };
  const vmContext = new vm.createContext(context);
  return script.runInContext(vmContext);
}

function calculateLine(content, charIdx) {
  const blockLine = content.substring(prevCharIdx, charIdx).split(/\n/).length;
  prevCharIdx = charIdx;
  lines = blockLine + (lines > 0 ? lines - 1 : 0);
  return lines;
}

parseDoc(file);
