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

pub.execute = function(script, context, callback) {
  const executionContext = Object.assign({}, context);

  if (callback) {
    executionContext.next = function(err, output) {
      if (err) return callback(new Error(err.message), output);
      callback(null, output);
    };
  }

  const vmContext = new vm.createContext(executionContext);
  return script.runInContext(vmContext);
};

pub.executeWithMessage = function(script, context, message, callback) {
  if (message && typeof message !== 'object') {
    const typeErr = new TypeError('message is not an object');
    if (callback) return callback(typeErr);
  }

  const executionContext = Object.assign({}, context, message || {});
  return pub.execute(script, executionContext, callback);
};

module.exports = pub;
