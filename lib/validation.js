'use strict';

const contextHelper = require('./context-helper');
const debug = require('debug')('bpmn-engine:validation');

const validExecuteOptions = ['listener', 'services', 'variables'];

const pub = {};

pub.validateModdleContext = function(moddleContext) {
  if (!moddleContext) {
    return [new Error('Nothing to validate')];
  }
  debug('validate start');
  if (moddleContext.warnings && moddleContext.warnings.length) {
    return moddleContext.warnings.map(makeErrors);
  }

  let warnings = moddleContext.warnings || [];
  warnings = validateContext(moddleContext, warnings);

  return warnings;
};

pub.validateOptions = function(options) {
  if (!options) return true;

  Object.keys(options).forEach((key) => {
    if (validExecuteOptions.indexOf(key) === -1) throw new Error(`Execute option ${key} is unsupported`);
  });

  if (options.listener && typeof options.listener.emit !== 'function') {
    throw new Error('listener "emit" function is required');
  }
  if (options.services) {
    if (typeof options.services !== 'object') throw new Error('services must be an object');
    validateServices(options.services);
  }
  if (options.variables) {
    if (typeof options.variables !== 'object') throw new Error('variables must be an object');
  }
  return true;
};

function validateContext(context, warnings) {
  Object.keys(context.elementsById).forEach((id) => {
    const element = context.elementsById[id];
    if (element.$type === 'bpmn:SequenceFlow') {
      validateFlow(context, warnings, id, element);
    } else if (element.$type === 'bpmn:ExclusiveGateway') {
      const flows = contextHelper.getOutboundSequenceFlows(context, element.id);
      if (!flows.length) {
        warnings.push(new Error(`${element.$type} <${element.id}> has no outgoing flow`));
      } else if (flows.length === 1) {
        const flowElement = flows[0].element;
        if (flowElement.conditionExpression) {
          warnings.push(new Error(`${element.$type} <${element.id}> has a single diverging flow (${flowElement.$type} <${flowElement.id}>) with a condition`));
        }
      } else {
        flows.forEach((flow) => {
          const flowElement = flow.element;

          if (!contextHelper.isDefaultSequenceFlow(context, flowElement.id) && !flowElement.conditionExpression) {
            warnings.push(new Error(`${element.$type} <${element.id}> diverging flow (${flowElement.$type} <${flowElement.id}>) has no condition`));
          }
        });
      }
    }
  });

  if (warnings.length) {
    debug(warnings[0].message);
  }

  debug('validate context end');

  return warnings;
}

function validateFlow(context, warnings, id, element) {
  const refs = context.references.filter((r) => r.element.id === id);

  ['sourceRef', 'targetRef'].forEach((prop) => {
    if (!refs.find((r) => r.property === `bpmn:${prop}`)) {
      warnings.push(new Error(`${element.$type} <${element.id}> property "${prop}" is required`));
    }
  });
}

function validateServices(services) {
  Object.keys(services).forEach((name) => {
    const service = services[name];
    if (!service) throw new Error(`Service "${name}" is undefined`);

    const serviceType = typeof service;
    if (['function', 'object'].indexOf(serviceType) === -1) throw new Error(`Service "${name}" is not a function or an object`);
    if (serviceType === 'function') return;

    if (!service.module || typeof service.module !== 'string') throw new Error(`Service "${name}" module must be a string`);
    if (service.type && ['require', 'global'].indexOf(service.type) === -1) throw new Error(`Service "${name}" type <${service.type}> must be global or require`);
  });
}

function makeErrors(eObj) {
  const clone = Object.assign({}, eObj);
  const err = new Error(clone.message);
  delete clone.message;
  return Object.assign(err, clone);
}

module.exports = pub;
