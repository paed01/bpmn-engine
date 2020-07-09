'use strict';

const BpmnModdle = require('bpmn-moddle');
const elements = require('bpmn-elements');
const {default: serializer, TypeResolver} = require('moddle-context-serializer');

module.exports = {
  context,
  moddleContext,
  serializeModdleContext,
};

async function context(source, options = {}) {
  const mdlContext = await moddleContext(source, options);

  const types = TypeResolver({
    ...elements,
    ...options.elements,
  });

  return serializer(mdlContext, types, options.extendFn);
}

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

