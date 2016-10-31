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

pub.execute = function(script, context, messageOrCallback, callback) {
  let message;
  if (typeof messageOrCallback === 'function') {
    callback = messageOrCallback;
    message = {};
  } else {
    message = messageOrCallback;
  }

  const executionContext = Object.assign({}, message);
  if (context) {
    executionContext.variables = context.variables;
    executionContext.services = context.services;
  }

  if (callback) {
    executionContext.next = function(err, output) {
      if (err) return callback(new Error(err.message), output);
      callback(null, output);
    };
  }

  const vmContext = new vm.createContext(executionContext);
  return script.runInContext(vmContext);
};

module.exports = pub;
