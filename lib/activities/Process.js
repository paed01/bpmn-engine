'use strict';

const debug = require('debug')('bpmn-engine:bpmn:process');
const EventEmitter = require('events').EventEmitter;
const processExecution = require('./process-execution');

function Process(activity, moddleContext, variablesAndServices, listener) {
  this.id = activity.id;
  this.type = activity.$type;
  this.name = activity.name;
  this.activity = activity;
  this.listener = listener;
  this.isMainProcess = true;

  const Context = require('../Context');
  this.context = new Context(this.id, moddleContext, variablesAndServices);
}

Process.prototype = Object.create(EventEmitter.prototype);

Process.prototype.run = function runProcess(onStart) {
  const id = this.id;
  const emit = this.emit.bind(this);
  const listener = this.listener;

  debug(`<${id}> run`);

  const execution = processExecution(this.context, onChildEvent, (err, source, executionContext) => {
    if (err) return emit('error', err, source, executionContext);
    debug(`<${id}> completed`);
    return emit('end', this, executionContext);
  });

  execution.execute((executionContext) => {
    emit('start', this, executionContext);
    if (onStart) onStart(executionContext);
  });

  function onChildEvent(eventName) {
    const eventArgs = {
      eventName: eventName
    };
    switch (eventName) {
      case 'message':
        eventArgs.source = arguments[2];
        eventArgs.message = arguments[1];
        break;
      default:
        eventArgs.source = arguments[1];
        break;
    }

    if (eventName === 'message') {
      debug(`<${id}> message sent via <${eventArgs.source.id}> (${eventArgs.source.type})`);
      emit('message', execution, eventArgs.message, eventArgs.source);
    }

    if (listener) emitListenerEvent(eventArgs);
  }

  function emitListenerEvent(eventArgs) {
    listener.emit(`${eventArgs.eventName}-${eventArgs.source.id}`, eventArgs.source, execution);
    listener.emit(eventArgs.eventName, eventArgs.source, execution);
  }
};

Process.prototype.getChildActivityById = function getChildActivityById(childId) {
  return this.context.getChildActivityById(childId);
};

module.exports = Process;
