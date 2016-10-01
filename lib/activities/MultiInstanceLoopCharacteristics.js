'use strict';

const debug = require('debug')('bpmn-engine:bpmn:multiinstanceloopcharacteristics');
const script = require('../script');

const instance = {};

module.exports = instance.Characteristics = function(activity) {
  this.type = activity.$type;
  this.isSequential = activity.isSequential;
  this.loopCardinality = activity.loopCardinality ? Number(activity.loopCardinality.body) : undefined;
  this.completionCondition = activity.completionCondition ? script.parse('characteristics.condition', activity.completionCondition.body) : null;
  if (this.loopCardinality === undefined && !this.completionCondition) throw new Error('Cardinality or condition expression must be used');

  this.iteration = 0;
  this.completed = false;
};

instance.Characteristics.prototype.run = function(variables) {
  this.iteration++;
  this.completed = false;

  debug('run');

  if (this.completionCondition) {
    this.completed = script.execute(this.completionCondition, variables);
  }

  if (this.loopCardinality && !this.completed) {
    this.completed = this.iteration >= this.loopCardinality;
    debug('cardinality check', this.completed);
  }

  debug('completed condition', this.completed);
  return this.completed;
};

instance.Characteristics.prototype.reset = function() {
  this.iteration = 0;
};
