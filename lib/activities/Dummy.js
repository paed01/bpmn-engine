'use strict';

const internals = {};

module.exports = internals.Dummy = function(activity) {
  this.id = activity.id;
  this.type = activity.$type;
  this.activity = activity;
  this.placeholder = true;
};
