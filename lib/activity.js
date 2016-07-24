'use strict';

const debug = require('debug')('bpmn-engine:activity');
const EventEmitter = require('events').EventEmitter;
const Joi = require('joi');
const Util = require('util');

const internals = {};

const activitySchema = Joi.object({
  id: Joi.string().required().description('ID'),
  '$type': Joi.string().required().description('Activity type'),
  targetRef: Joi.alternatives().when('$type', {
    is: 'bpmn:SequenceFlow',
    then: Joi.any().required()
  }),
  sourceRef: Joi.alternatives().when('$type', {
    is: 'bpmn:SequenceFlow',
    then: Joi.any().required()
  }),
  baseElements: Joi.alternatives().when('$type', {
    is: 'bpmn:Process',
    then: Joi.array().required()
  })
});

module.exports = internals.Activity = function() {
  this.activitySchema = Joi.compile(activitySchema);
};

Util.inherits(internals.Activity, EventEmitter);

internals.Activity.prototype.validateDefinition = function(activityDefinition, callback) {
  debug(`validate ${activityDefinition.$type} ${activityDefinition.id}`);
  Joi.validate(activityDefinition, this.activitySchema, {
    allowUnknown: true,
    convert: false
  }, callback);
};
