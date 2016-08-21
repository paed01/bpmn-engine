'use strict';
/* Adapted from camunda-bpmn.js https://github.com/camunda/camunda-bpmn.js, Apache License, Version 2.0 */

const Async = require('async');
const debug = require('debug')('bpmn-engine:engine');
const mapper = require('./mapper');
const transformer = require('./transformer');
const validation = require('./validation');

const internals = {};

module.exports = internals.Engine = function(sourceXml) {
  this.source = sourceXml;
};

internals.Engine.prototype.startInstance = function(variables, listeners, callback) {
  debug('start');
  Async.waterfall([
    getXmlObject.bind(null, this.source),
    transformer.transform.bind(null),
    (definition, context, next) => {
      this.definition = definition;
      this.context = context;
      next(null, definition, context);
    },
    validation.validate.bind(null),
    (next) => {
      this.entryPointId = findExecutableProcessId(this.context);
      debug(`start with ${this.entryPointId}`);
      this.entryPoint = this.context.elementsById[this.entryPointId];
      this.execution = new (mapper(this.entryPoint))(this.entryPoint, this.context, listeners);
      return next(null, this.execution);
    }
  ], (err, execution) => {
    if (err) return callback(err);
    callback(null, execution);
    execution.run(variables);
  });
};

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

function findExecutableProcessId(context) {
  return Object.keys(context.elementsById).find((key) => {
    return context.elementsById[key].isExecutable;
  });
}
