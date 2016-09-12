'use strict';

const debug = require('debug')('bpmn-engine:activity:boundaryEvent');
const Activity = require('../activities/Activity');
const mapper = require('../mapper');
const util = require('util');

const internals = {};

module.exports = internals.Activity = function(activity, parent) {
  Activity.call(this, activity, parent);
  debug(`<${this.id}>`, 'init');
  this.isStart = false;
  this.eventDefinitions = loadEventDefinitions.call(this, activity.eventDefinitions);
};

util.inherits(internals.Activity, Activity);

internals.Activity.prototype.run = function(variables) {
  Activity.prototype.run.call(this, variables);

  debug(`<${this.id}>`, 'run');
  this.emit('start', this);
  runAll.call(this, this.eventDefinitions, variables);
};

internals.Activity.prototype.completed = function() {
  debug(`<${this.id}>`, 'completed');
  this.emit('end', this);
  this.takeAllOutbound();
};

internals.Activity.prototype.cancel = function() {
  this.canceled = true;
  this.eventDefinitions.forEach((eventDefinition) => {
    if (eventDefinition._parentEndListener) {
      eventDefinition.removeListener('end', eventDefinition._parentEndListener);
      delete eventDefinition._parentEndListener;
    }
  });
  this.discardAllOutbound();
};

function runAll(eventDefinitions, variables) {
  const self = this;
  eventDefinitions.forEach((eventDefinition) => {
    eventDefinition._parentEndListener = () => {
      self.completed();
    };
    eventDefinition.once('end', eventDefinition._parentEndListener);

    eventDefinition.run(variables);
  });
}

function loadEventDefinitions(eventDefinitions) {
  return eventDefinitions.map((ed) => new (mapper(ed))(ed, this));
}
