'use strict';

const BpmnModdle = require('bpmn-moddle');
const elements = require('bpmn-elements');
const Logger = require('../../lib/Logger');
const {default: serializer, TypeResolver} = require('moddle-context-serializer');

module.exports = {
  context,
  moddleContext,
  serializeModdleContext,
};

async function context(source, options = {}) {
  const logger = Logger('test-helpers:context');
  const moddleCtx = await moddleContext(source, options);

  if (moddleCtx.warnings) {
    moddleCtx.warnings.forEach(({error, message, element, property}) => {
      if (error) return logger.error(message);
      logger.error(`<${element.id}> ${property}:`, message);
    });
  }

  const types = TypeResolver({
    ...elements,
    ...options.elements,
  });

  return serializer(moddleCtx, types, options.extendFn);
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
    warnings: warnings.slice(),
  };
  return clonedContext;
}
