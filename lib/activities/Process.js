'use strict';

const debug = require('debug')('bpmn-engine:bpmn:process');
const {EventEmitter} = require('events');
const processExecution = require('./process-execution');
const Environment = require('../Environment');

function Process(activity, moddleContext, options, listener) {
  this.id = activity.id;
  this.type = activity.$type;
  this.name = activity.name;
  this.activity = activity;
  this.listener = listener;
  this.isMainProcess = true;

  const Context = require('../Context');
  this.context = new Context(this.id, moddleContext, Environment(options));
}

Process.prototype = Object.create(EventEmitter.prototype);

Process.prototype.run = function runProcess(onStart) {
  const id = this.id;
  const emit = this.emit.bind(this);
  const listener = this.listener;

  debug(`<${id}> run`);

  const execution = processExecution(this.context, listener, emit, (err, source, executionContext) => {
    if (err) return emit('error', err, source, executionContext);
    debug(`<${id}> completed`);
    return emit('end', this, executionContext);
  });

  execution.execute((executionContext) => {
    emit('start', this, executionContext);
    if (onStart) onStart(executionContext);
  });
};

Process.prototype.resume = function resumeProcess(state, onStart) {
  const id = this.id;
  const emit = this.emit.bind(this);
  const listener = this.listener;

  debug(`<${id}> resume`);

  const execution = processExecution(this.context, listener, emit, (err, source, executionContext) => {
    if (err) return emit('error', err, source, executionContext);
    debug(`<${id}> completed`);
    return emit('end', this, executionContext);
  });

  execution.resume(state, (executionContext) => {
    emit('start', this, executionContext);
    if (onStart) onStart(executionContext);
  });
};

Process.prototype.getChildActivityById = function getChildActivityById(childId) {
  return this.context.getChildActivityById(childId);
};

module.exports = Process;
