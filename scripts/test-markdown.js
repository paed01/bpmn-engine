/* eslint no-console:0 */

const fs = require('fs');
const vm = require('vm');
const nock = require('nock');

const { name, main } = require('../package.json');

process.on('unhandledRejection', (error) => {
  console.log('unhandledRejection', error);
});

nock.enableNetConnect(/(localhost|127\.0\.0\.1):\d+/);
nock('https://example.com')
  .get(/.*/)
  .reply(200, { data: 1 })
  .persist();

const exPattern = /```javascript\n([\s\S]*?)```/ig;
let lines = 0;
let prevCharIdx = 0;

const file = process.argv[2] || './docs/API.md';
const blockIdx = Number(process.argv[3]);

function parseDoc(filePath) {
  fs.readFile(filePath, (err, fileContent) => {
    if (err) throw err;

    const blocks = [];
    const content = fileContent.toString();

    content.replace(exPattern, (match, block, idx) => {
      block = block.replace(`require('${name}')`, `require('../${main}')`);

      const blockLine = calculateLine(content, idx);

      blocks.push({
        block,
        line: blockLine,
        len: block.length,
        script: parse(`${filePath}`, block, blockLine)
      });
    });

    blocks.forEach(({ line, script }, idx) => {
      if (isNaN(blockIdx) || idx === blockIdx) {
        console.log(`${idx}: ${filePath}:${line}`);
        execute(script);
      }
    });
  });

  function parse(filename, scriptBody, lineOffset) {
    return new vm.Script(scriptBody, {
      filename: filename,
      displayErrors: true,
      lineOffset: lineOffset
    });
  }
}

function execute(script) {
  const context = {
    require: require,
    console: console,
    setTimeout,
    db: {
      getSavedState: (id, callback) => {
        if (fs.existsSync('./tmp/some-random-id.json')) {
          const state = require('../tmp/some-random-id.json');
          return callback(null, state);
        }
        callback(new Error('No state'));
      },
      getState: (id, callback) => {
        callback(null, { definitions: [] });
      }
    }
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
