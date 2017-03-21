'use strict';

const debug = require('debug')('bpmn-engine:bpmn:multiinstanceloopcharacteristics');
const expressions = require('../expressions');
const scriptHelper = require('../script-helper');
const PrematureStopError = require('../PrematureStopError');

function MultiInstanceLoopCharacteristics(activity, parentContext) {
  this.type = activity.$type;

  this.isSequential = activity.isSequential;
  this.parentContext = parentContext;

  this.characteristics = getLoopCharacteristics(activity);
  if (!this.characteristics.type) throw new Error('Cardinality, condition expression, or collection must be defined');

  debug(`${this.characteristics.type} loop type`);

  this.iteration = 0;
  this.completed = false;
}

MultiInstanceLoopCharacteristics.prototype.run = function(variables, message, result, callback) {
  if (this.stop) {
    this.completed = true;
    return callback && callback(new PrematureStopError('Stopped'), true);
  }

  debug('run', variables, message);

  this.iteration++;
  this.completed = false;

  if (this.characteristics.collection) {
    const collection = this.getCollection(variables);
    if (this.iteration > collection.length) {
      this.completed = true;
      debug('completed collection', this.completed);
    } else {
      this.item = collection[this.iteration];
    }
  }

  if (!this.completed && (this.characteristics.condition || this.characteristics.conditionExpression)) {
    this.completed = executeCondition(this.characteristics, variables, message);
    debug('completed condition', this.completed);
  }

  if (!this.completed) {
    const cardinality = getCardinality(this.characteristics, variables);
    if (cardinality !== undefined) {
      this.completed = this.iteration >= cardinality;
      debug('cardinality check', this.completed);
    }
  }

  if (callback) {
    callback(null, this.completed);
  }

  return this.completed;
};

MultiInstanceLoopCharacteristics.prototype.getCollection = function() {
  let collection = expressions(this.characteristics.collection, this.parentContext.getVariablesAndServices());
  if (this.iteration > 0) {
    collection = collection.slice(this.iteration);
  }
  return collection;
};

MultiInstanceLoopCharacteristics.prototype.deactivate = function() {
  debug('stopped');
  this.stop = true;
};

MultiInstanceLoopCharacteristics.prototype.getState = function() {
  const state = {
    isSequential: this.isSequential,
    iteration: this.iteration,
    characteristics: {
      type: this.characteristics.type
    }
  };
  if (this.characteristics.hasOwnProperty('cardinality')) {
    state.characteristics.cardinality = this.characteristics.cardinality;
  }
  return state;
};

MultiInstanceLoopCharacteristics.prototype.reset = function() {
  this.iteration = 0;
};

MultiInstanceLoopCharacteristics.prototype.resume = function(state) {
  this.iteration = state.iteration + 1;
  debug(`resume at iteration ${state.iteration}`);
};

function getLoopCharacteristics(activity) {
  const characteristics = {};

  if (activity.collection) {
    characteristics.type = 'collection';
    characteristics.collection = activity.collection;
  }

  if (activity.completionCondition && activity.completionCondition.body) {
    if (expressions.isExpression(activity.completionCondition.body)) {
      characteristics.conditionExpression = activity.completionCondition.body;
    } else {
      characteristics.condition = scriptHelper.parse('characteristics.condition', activity.completionCondition.body);
    }
    characteristics.type = characteristics.type || 'condition';
  }

  if (activity.loopCardinality && activity.loopCardinality.body) {
    if (expressions.isExpression(activity.loopCardinality.body)) {
      characteristics.cardinalityExpression = activity.loopCardinality.body;
    } else {
      const cardinality = Number(activity.loopCardinality.body);
      if (!isNaN(cardinality)) {
        characteristics.cardinality = cardinality;
      }
    }
    if (!characteristics.type && (characteristics.cardinalityExpression || !isNaN(characteristics.cardinality))) {
      characteristics.type = 'cardinality';
    }
  }

  return characteristics;
}

function executeCondition(characteristics, variables, message) {
  if (characteristics.condition) {
    return scriptHelper.execute(characteristics.condition, variables, message);
  }

  return expressions(characteristics.conditionExpression, variables);
}

function getCardinality(characteristics, variables) {
  let cardinality;
  if (characteristics.cardinality > -1) {
    cardinality = characteristics.cardinality;
  } else if (characteristics.cardinalityExpression) {
    cardinality = Number(expressions(characteristics.cardinalityExpression, variables));
    if (isNaN(cardinality)) throw new Error(`Cardinality expression ${characteristics.cardinalityExpression} returned not a number`);
  }
  return cardinality;
}

module.exports = MultiInstanceLoopCharacteristics;
