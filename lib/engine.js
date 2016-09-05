'use strict';
/* Adapted from camunda-bpmn.js https://github.com/camunda/camunda-bpmn.js, Apache License, Version 2.0 */

const Async = require('async');
const debug = require('debug')('bpmn-engine:engine');
const mapper = require('./mapper');
const transformer = require('./transformer');
const validation = require('./validation');

const internals = {};

module.exports = internals.Engine = function(sourceXml) {
  if (Buffer.isBuffer(sourceXml)) { // Add ability to load from buffer, e.g. from http-request
    this.source = sourceXml.toString();
  } else if (typeof sourceXml === 'string') {
    this.source = sourceXml;
  } else {
    throw new Error('Unparsable Bpmn source');
  }
};

internals.Engine.prototype.startInstance = function(variables, listeners, callback) {
  debug('start');
  this.getInstance(variables, listeners, (err, execution) => {
    if (err) return callback(err);
    callback(null, execution);
    execution.run(variables);
  });
};

internals.Engine.prototype.getInstance = function(variables, listeners, callback) {
  Async.waterfall([
    transformer.transform.bind(null, this.source),
    (definition, context, next) => {
      this.definition = definition;
      this.context = context;
      next(null, definition, context);
    },
    validation.validate.bind(null),
    (next) => {
      this.entryPointId = findExecutableProcessId(this.context);
      if (!this.entryPointId) {
        return next(new Error('definition has no executable process'));
      }
      debug(`start with ${this.entryPointId}`);
      this.entryPoint = this.context.elementsById[this.entryPointId];
      this.execution = new (mapper(this.entryPoint))(this.entryPoint, this.context, listeners);
      return next(null, this.execution);
    }
  ], (err, execution) => {
    if (err) return callback(err);
    callback(null, execution);
  });
};

function findExecutableProcessId(context) {
  return Object.keys(context.elementsById).find((key) => {
    return context.elementsById[key].isExecutable;
  });
}
