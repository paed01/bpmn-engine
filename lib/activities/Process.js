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

Process.prototype.run = function runProcess() {
  debug(`<${this.id}> run`);

  const listener = this.listener;

  const execution = processExecution(this.context, onChildEvent, (err) => {
    if (err) return this.emit('error', err, this);
    debug(`<${this.id}> completed`);
    return this.emit('end', this);
  });

  this.emit('start', this);

  execution.execute();

  function onChildEvent(eventName, activity) {
    if (!listener) return;

    listener.emit(`${eventName}-${activity.id}`, activity, execution);
    listener.emit(eventName, activity, execution);
  }
};

module.exports = Process;
