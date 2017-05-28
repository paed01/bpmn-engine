'use strict';

const SignalTask = require('../activities/SignalTask');

function UserTask(activity) {
  SignalTask.apply(this, arguments);
  this.form = activity.form;
}

UserTask.prototype = Object.create(SignalTask.prototype);

UserTask.prototype.getState = function() {
  const state = SignalTask.prototype.getState.call(this);
  if (this.form) {
    state.form = this.form.getState();
  }
  return state;
};

module.exports = UserTask;
