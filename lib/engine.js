'use strict';
/* Adapted from camunda-bpmn.js https://github.com/camunda/camunda-bpmn.js, Apache License, Version 2.0 */

const debug = require('debug')('bpmn-engine:engine');
const DOMParser = require('xmldom').DOMParser;
const Transformer = require('./transformer');
const Async = require('async');

function _init(executor) {
  if (typeof executor !== 'function') {
    executor = require('./activity-execution');
  }
  this.executor = executor;
  this.transformer = new Transformer();
}

module.exports = _init;

function getXmlObject(source, callback) {
  if (Buffer.isBuffer(source)) { // Add ability to load from buffer, e.g. from http-request
    source.toString();
    return setImmediate(callback, null, source.toString());
  } else if (typeof source === 'string') {
    return setImmediate(callback, null, source);
  } else {
    return setImmediate(callback, new Error('Failed to parse source'));
  }
}

_init.prototype.startInstance = function(bpmnXml, variables, listeners, callback) {
  const self = this;
  debug('start');
  Async.waterfall([
    getXmlObject.bind(null, bpmnXml),
    (source, next) => {
      self.transformer.transform(source, true, next);
    },
    (definition, next) => {
      if (!definition) return next(new Error('No flow'));

      debug('elements', definition.rootElements);
      if (!definition.rootElements) return next(new Error('No flow elements'));

      const execution = new self.executor(definition.rootElements[0]);
      execution.variables = variables ? variables : {};
      return next(null, execution);
    }
  ], (err, execution) => {
    if (err) return callback(err);
    callback(null, execution);
    execution.start();
  });
};
