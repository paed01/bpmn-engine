'use strict';

const debug = require('debug')('bpmn-engine:activity');
const Util = require('util');
const EventEmitter = require('events').EventEmitter;
const T = require('joi');

const internals = {};

module.exports = internals.Activity = function() {
  this.activitySchema = T.object({
    id: T.string().required().description('ID'),
    '$type': T.string().required().description('Activity type'),
    targetRef: T.string().when('type', {
      is: 'sequenceFlow',
      then: T.required()
    }),
    sourceRef: T.when('type', {
      is: 'sequenceFlow',
      then: T.required()
    }),
    baseElements: T.array().when('type', {
      is: 'process',
      then: T.required()
    })
  }).unknown(true);
};

Util.inherits(internals.Activity, EventEmitter);

internals.Activity.prototype.validateDefinition = function(activityDefinition, callback) {
  debug(`validate ${activityDefinition.id}`);
  T.validate(activityDefinition, this.activitySchema, callback);
};
