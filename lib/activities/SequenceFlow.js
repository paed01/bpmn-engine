'use strict';

const Flow = require('./Flow');
const util = require('util');

const internals = {};

module.exports = internals.Flow = function() {
  Flow.apply(this, arguments);
  this.targetId = this.parentContext.getSequenceFlowTargetId(this.id);
  this.isDefault = this.parentContext.isDefaultSequenceFlow(this.id);
};

util.inherits(internals.Flow, Flow);

