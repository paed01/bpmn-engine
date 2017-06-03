'use strict';

const Activity = require('../activities/Activity');
const internals = {};

module.exports = internals.Event = function(activity) {
  Activity.apply(this, arguments);
  this.isEnd = true;
  this.taken = false;
  this.terminate = activity.terminate;
};

internals.Event.prototype = Object.create(Activity.prototype);

// internals.Event.prototype.execute = function(executionContext, callback) {
//   callback();
// };
