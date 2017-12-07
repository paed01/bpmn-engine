'use strict';

const vm = require('vm');

module.exports = {
  execute,
  isJavascript,
  parse
};

function isJavascript(scriptType) {
  if (!scriptType) return false;
  return /^javascript$/i.test(scriptType);
}

function parse(filename, scriptBody) {
  return new vm.Script(scriptBody, {
    filename: filename,
    displayErrors: true
  });
}

function execute(script, context, callback) {
  const executionContext = Object.assign({}, context);

  if (callback) {
    executionContext.next = next(callback);
  }

  const vmContext = new vm.createContext(executionContext);
  return script.runInContext(vmContext);
}

function next(callback) {
  return function executeCallback(err, output) {
    if (err) return callback(new Error(err.message), output);
    callback(null, output);
  };
}
