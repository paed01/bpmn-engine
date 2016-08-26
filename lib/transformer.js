'use strict';

const BpmnModdle = require('bpmn-moddle');
const moddle = new BpmnModdle();

const pub = {};

pub.transform = function(sourceXml, callback) {
  if (!sourceXml || typeof sourceXml !== 'string') return callback(new Error('Nothing to transform'));

  return moddle.fromXML(sourceXml, callback);
};

module.exports = pub;
