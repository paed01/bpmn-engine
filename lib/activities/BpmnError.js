'use strict';

module.exports = function ErrorActivity(activity) {
  const id = activity.id;
  const name = activity.name;
  const errorCode = activity.errorCode;

  return {
    id,
    name,
    create
  };

  function create(sourceErr, source) {
    const message = sourceErr.message;
    const errorName = sourceErr.name;

    const sourceErrData = Object.assign({}, {
      message,
      name: errorName,
      error: sourceErr
    });

    const errCode = activity.resolveExpression(errorCode, sourceErrData);
    const errName = activity.resolveExpression(name, sourceErrData);

    return new BpmnError(id, errName, errCode, source, sourceErr);
  }
};

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

module.exports.BpmnError = BpmnError;
