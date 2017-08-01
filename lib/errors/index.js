'use strict';

module.exports = {
  ActivityError,
  BpmnError
};

function ActivityError(message, source, name) {
  this.message = message;
  this.name = name;
  this.source = {
    id: source.id,
    type: source.type
  };
}
ActivityError.prototype = Object.create(Error.prototype);
ActivityError.prototype.constructor = ActivityError;

function BpmnError(id, name, errorCode, source, inner) {
  this.id = id;
  this.name = name;
  this.message = inner.message;
  this.errorCode = errorCode;
  this.source = {
    id: source.id,
    type: source.type
  };
  this.inner = inner;
}
BpmnError.prototype = Object.create(Error.prototype);
BpmnError.prototype.constructor = BpmnError;
