'use strict';

const BpmnModdle = require('bpmn-moddle');

const pub = {};

pub.transform = function(sourceXml, options, callback) {
  if (!sourceXml || typeof sourceXml !== 'string') return callback(new Error('Nothing to transform'));
  const moddle = new BpmnModdle(options);
  return moddle.fromXML(sourceXml, callback);
};

module.exports = pub;
