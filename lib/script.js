'use strict';

const vm = require('vm');

const pub = {};

pub.isJavascript = function(scriptType) {
  if (!scriptType) return false;
  return /^javascript$/i.test(scriptType);
};

pub.parse = function(filename, scriptBody) {
  return new vm.Script(scriptBody, {
    filename: filename,
    displayErrors: true
  });
};

pub.execute = function(script, variables, contextOrCallback, callback) {
  if (!callback && contextOrCallback) {
    callback = contextOrCallback;
    contextOrCallback = {};
  }

  const context = Object.assign({}, contextOrCallback, {
    context: variables
  });

  if (callback) {
    context.next = function(err, output) {
      if (err) return callback(new Error(err.message), output);
      callback(null, output);
    };
  }

  const vmContext = new vm.createContext(context);
  return script.runInContext(vmContext);
};

module.exports = pub;
