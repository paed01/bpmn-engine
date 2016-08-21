'use strict';

const debug = require('debug')('bpmn-engine:activity');
const EventEmitter = require('events').EventEmitter;
const Util = require('util');
const validation = require('./validation');

const internals = {};

module.exports = internals.Activity = function() {
};

Util.inherits(internals.Activity, EventEmitter);

internals.Activity.prototype.validateDefinition = function(activityDefinition, context, callback) {
  debug(`validate ${activityDefinition.$type} ${activityDefinition.id}`);

  validation.validate(activityDefinition, context, this.validationSchema, {
    allowUnknown: true,
    convert: false
  }, callback);
};

// function validateSequenceFlows(activityDefinition, callback) {
//   debug('validate sequenceFlows');

//   const sequenceFlows = activityHelper.getSequenceFlows(activityDefinition);



//   console.log(sequenceFlows)

//   callback();
// }
