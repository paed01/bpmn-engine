import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, extname, resolve as resolvePath, sep } from 'node:path';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import nock from 'nock';

if (!('SourceTextModule' in vm)) throw new Error('No SourceTextModule in vm, try using node --experimental-vm-modules flag');

const CWD = process.cwd();

const nodeRequire = createRequire(fileURLToPath(import.meta.url));
const { name, version, module: myModule } = nodeRequire(resolvePath(CWD, 'package.json'));

const exPattern = /```javascript\n([\s\S]*?)```/gi;
const packageName = `${name} v${version}`;

nock.enableNetConnect(/(localhost|127\.0\.0\.1):\d+/);
nock('https://example.com').get(/.*/).reply(200, { data: 1 }).persist();

const markdownFiles = process.argv[2] || './docs/API.md';
const blockIdx = Number(process.argv[3]);

class ExampleEvaluator {
  constructor(filePath, sandbox) {
    const exampleFile = (this.exampleFile = resolvePath(CWD, filePath));
    this.line = 0;
    this.prevCharIdx = 0;
    this.identifier = pathToFileURL(exampleFile).toString();
    this.sandbox = sandbox;
  }
  async evaluate() {
    const fileContent = await fs.readFile(this.exampleFile);
    const blocks = [];
    const content = fileContent.toString();

    content.replace(exPattern, (_, scriptBody, idx) => {
      const lineOffset = this.calculateLineOffset(content, idx);
      blocks.push({
        scriptSource: scriptBody,
        lineOffset,
        script: this.parse(scriptBody, lineOffset),
      });
    });

    for (let idx = 0; idx < blocks.length; idx++) {
      const { script, lineOffset } = blocks[idx];

      if (!isNaN(blockIdx) && idx !== blockIdx) continue;

      this.sandbox.console?.log(`${idx}: ${this.identifier}:${lineOffset}`);

      const loader = new ScriptLoader();
      await script.link(loader.link);
      await script.evaluate();
    }
  }
  parse(scriptBody, lineOffset) {
    const identifier = this.identifier;
    return new vm.SourceTextModule(scriptBody, {
      identifier,
      context: vm.createContext(this.sandbox, {
        name: packageName,
      }),
      lineOffset,
      displayErrors: true,
      initializeImportMeta(meta) {
        meta.url = identifier;
      },
    });
  }
  execute(script) {
    const vmContext = new vm.createContext(this.sandbox);
    return script.run(vmContext);
  }
  calculateLineOffset(content, charIdx) {
    const blockLines = content.substring(this.prevCharIdx, charIdx).split(/\n/g).length;
    this.line = blockLines + (this.line > 0 ? this.line - 1 : 0);
    this.prevCharIdx = charIdx;
    return this.line;
  }
}

(async () => {
  for (const file of markdownFiles.split(',')) {
    await new ExampleEvaluator(file, {
      Buffer,
      console,
      setTimeout,
      clearTimeout,
      db: {
        getSavedState: (_, callback) => {
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
    }).evaluate();
  }
})();

export function ScriptLoader(fileCache) {
  this.fileCache = fileCache ?? new Map();
  this.cache = new Map();
  this.link = this.link.bind(this);
}

ScriptLoader.prototype.link = function link(specifier, reference) {
  let modulePath;
  if (specifier === name) {
    modulePath = resolvePath(CWD, myModule);
    return this.linkScriptSource(modulePath, reference.context);
  } else if (isRelative(specifier)) {
    modulePath = resolvePath(dirname(fileURLToPath(reference.identifier)), specifier.split(sep).join(sep));
    return this.linkScriptSource(modulePath, reference.context);
  } else {
    return this.linkNodeModule(specifier, reference);
  }
};

ScriptLoader.prototype.linkScriptSource = async function linkScriptSource(scriptPath, context) {
  const source = await this.getInternalScriptSource(scriptPath);
  return this.linkInternalScript(scriptPath, source, context);
};

ScriptLoader.prototype.linkNodeModule = async function linkNodeModule(identifier, reference) {
  const imported = await import(identifier);
  const exported = Object.keys(imported);

  return new vm.SyntheticModule(
    exported,
    function evaluateCallback() {
      exported.forEach((key) => this.setExport(key, imported[key]));
    },
    { identifier, context: reference.context }
  );
};

ScriptLoader.prototype.linkInternalScript = async function linkInternalScript(scriptPath, source, context) {
  const identifier = pathToFileURL(scriptPath).toString();
  const module = new vm.SourceTextModule(source, {
    identifier,
    context,
    initializeImportMeta(meta) {
      meta.url = identifier;
    },
  });
  await module.link(this.link).catch((e) => {
    throw e;
  });
  return module;
};

ScriptLoader.prototype.getInternalScriptSource = async function getInternalScriptSource(scriptPath) {
  const fileCache = this.fileCache;
  let content = fileCache?.get(scriptPath);
  if (content) return content;

  content = (await fs.readFile(scriptPath)).toString();
  if (extname(scriptPath) === '.json') {
    content = `export default ${content};`;
  }

  fileCache?.set(scriptPath, content);
  return content;
};

function isRelative(p) {
  const p0 = p.split(sep).shift();
  return p0 === '.' || p0 === '..';
}
