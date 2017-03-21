'use strict';

function Dummy(activity) {
  this.id = activity.id;
  this.type = activity.$type;
  this.activity = activity;
  this.placeholder = true;
}

module.exports = Dummy;
