import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import BpmnModdle from 'bpmn-moddle';
import * as Elements from 'bpmn-elements';
import Logger from '../../src/Logger.js';
import serializer, { TypeResolver } from 'moddle-context-serializer';

const nodeRequire = createRequire(fileURLToPath(import.meta.url));
export const camundaBpmnModdle = nodeRequire('camunda-bpmn-moddle/resources/camunda.json');

export async function context(source, options) {
  const logger = Logger('test-helpers:context');
  const moddleCtx = await moddleContext(source, options);

  if (moddleCtx.warnings) {
    moddleCtx.warnings.forEach(({ error, message, element, property }) => {
      if (error) return logger.error(message);
      logger.error(`<${element.id}> ${property}:`, message);
    });
  }

  const types = TypeResolver({
    ...Elements,
    ...options?.elements,
  });

  return serializer(moddleCtx, types, options?.extendFn);
}

export function moddleContext(source, options) {
  const bpmnModdle = new BpmnModdle(options);
  return bpmnModdle.fromXML(Buffer.isBuffer(source) ? source.toString() : source);
}

export function serializeModdleContext({ rootElement, rootHandler, elementsById, references, warnings }) {
  const serializedRoot = JSON.parse(JSON.stringify(rootElement || rootHandler.element));

  const clonedContext = {
    rootElement: serializedRoot,
    elementsById: JSON.parse(JSON.stringify(elementsById)),
    references: JSON.parse(JSON.stringify(references)),
    warnings: warnings.slice(),
  };
  return clonedContext;
}
