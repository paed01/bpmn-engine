import { BpmnModdle } from 'bpmn-moddle';
import * as Elements from 'bpmn-elements';
import camundaBpmnModdle from 'camunda-bpmn-moddle/resources/camunda.json' with { type: 'json' };
import Logger from '../../src/Logger.js';
import { Serializer, TypeResolver } from 'moddle-context-serializer';

export { camundaBpmnModdle };

export async function context(source, options) {
  const logger = Logger('test-helpers:context');
  const moddleCtx = await moddleContext(source, options);

  if (moddleCtx.warnings) {
    /** @type {any[]} */ (moddleCtx.warnings).forEach(({ error, message, element, property }) => {
      if (error) return logger.error(message);
      logger.error(`<${element.id}> ${property}:`, message);
    });
  }

  const types = TypeResolver({
    ...Elements,
    ...options?.elements,
  });

  return Serializer(moddleCtx, types, options?.extendFn);
}

export function moddleContext(source, options) {
  const bpmnModdle = new BpmnModdle(options);
  return bpmnModdle.fromXML(Buffer.isBuffer(source) ? source.toString() : source);
}

export function serializeModdleContext({ rootElement, elementsById, references, warnings }) {
  const serializedRoot = JSON.parse(JSON.stringify(rootElement));

  const clonedContext = {
    rootElement: serializedRoot,
    elementsById: JSON.parse(JSON.stringify(elementsById)),
    references: JSON.parse(JSON.stringify(references)),
    warnings: warnings.slice(),
  };
  return clonedContext;
}
