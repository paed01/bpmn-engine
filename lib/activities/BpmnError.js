'use strict';

const {BpmnError} = require('../errors');

module.exports = function BpmnErrorActivity(activity, {environment}) {
  const {id, name, errorCode} = activity;

  return {
    id,
    name,
    create
  };

  function create(sourceErr, source) {
    const message = sourceErr.message;
    const errorName = sourceErr.name;

    const sourceErrData = Object.assign({}, {
      id,
      message,
      name: errorName,
      error: sourceErr
    });

    const errCode = environment.resolveExpression(errorCode, sourceErrData);
    const errName = environment.resolveExpression(name, sourceErrData);

    return new BpmnError(id, errName, errCode, source, sourceErr);
  }
};
