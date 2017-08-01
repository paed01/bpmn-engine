'use strict';

const {BpmnError} = require('../errors');

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
