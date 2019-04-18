'use strict';

const BpmnModdle = require('../dist/bpmn-moddle');

module.exports = {
  transform
};

function transform(sourceXml, options, callback) {
  if (!sourceXml || typeof sourceXml !== 'string') return callback(new Error('Nothing to transform'));
  const moddle = new BpmnModdle(options);
  return moddle.fromXML(sourceXml, callback);
}
