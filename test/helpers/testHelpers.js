'use strict';

const BpmnModdle = require('bpmn-moddle');

module.exports = {
  moddleContext,
  serializeModdleContext,
};

function moddleContext(source, options) {
  const bpmnModdle = new BpmnModdle(options);
  return bpmnModdle.fromXML(Buffer.isBuffer(source) ? source.toString() : source);
}

function serializeModdleContext({rootElement, rootHandler, elementsById, references, warnings}) {
  const serializedRoot = JSON.parse(JSON.stringify(rootElement || rootHandler.element));

  const clonedContext = {
    rootElement: serializedRoot,
    elementsById: JSON.parse(JSON.stringify(elementsById)),
    references: JSON.parse(JSON.stringify(references)),
    warnings: warnings.slice()
  };
  return clonedContext;
}
