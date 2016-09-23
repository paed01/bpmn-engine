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

pub.execute = function(script, variables, callback) {
  const context = {
    context: variables
  };
  if (callback) {
    context.next = function(err) {
      if (err) return callback(new Error(err.message));
      callback();
    };
  }

  const vmContext = new vm.createContext(context);
  return script.runInContext(vmContext);
};

module.exports = pub;
