'use strict';

const contextHelper = require('./context-helper');
const debug = require('debug')('bpmn-engine:validation');

const pub = {};

pub.validate = function(context, callback) {
  if (!context) {
    return callback(new Error('Nothing to validate'));
  }
  debug('validate start');
  if (context.warnings && context.warnings.length) {
    return callback(new Error(context.warnings[0].message));
  }

  const warnings = context.warnings || [];
  return validateContext(context, warnings, callback);
};

pub.validateOptions = function(options) {
  if (!options) return true;
  if (options.listener && options.listener.emit !== 'function') {
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

function validateContext(context, warnings, callback) {
  Object.keys(context.elementsById).forEach((id) => {
    const element = context.elementsById[id];
    if (element.$type === 'bpmn:SequenceFlow') {
      validateFlow(context, warnings, id, element);
    } else if (element.$type === 'bpmn:ExclusiveGateway') {
      const flows = contextHelper.getOutboundSequenceFlows(context, element.id);
      if (!flows.length) {
        addWarning(context, warnings, `${element.$type} <${element.id}> has no outgoing flow`);
      } else if (flows.length === 1) {
        const flowElement = flows[0].element;
        if (flowElement.conditionExpression) {
          addWarning(context, warnings, `${element.$type} <${element.id}> has a single diverging flow (${flowElement.$type} <${flowElement.id}>) with a condition`);
        }
      } else {
        flows.forEach((flow) => {
          const flowElement = flow.element;

          if (!contextHelper.isDefaultSequenceFlow(context, flowElement.id) && !flowElement.conditionExpression) {
            addWarning(context, warnings, `${element.$type} <${element.id}> diverging flow (${flowElement.$type} <${flowElement.id}>) has no condition`);
          }
        });
      }
    }
  });

  if (warnings.length) {
    debug(warnings[0]);
    return callback(new Error(warnings[0].message || warnings[0]));
  }

  debug('validate context end');
  callback();
}

function validateFlow(context, warnings, id, element) {
  const refs = context.references.filter((r) => r.element.id === id);

  ['sourceRef', 'targetRef'].forEach((prop) => {
    if (!refs.find((r) => r.property === `bpmn:${prop}`)) {
      addWarning(context, warnings, `${element.$type} <${element.id}> property "${prop}" is required`);
    }
  });
}

function addWarning(context, warnings, message) {
  if (context.addWarning) {
    return context.addWarning(message);
  }
  warnings.push({
    message: message
  });
}

function validateServices(services) {
  if (!services) return;
  Object.keys(services).forEach((name) => {
    const service = services[name];
    if (!service) return;

    const serviceType = typeof service;
    if (['function', 'object'].indexOf(serviceType) === -1) throw new Error(`Service "${name}" is not a function or an object`);
    if (serviceType === 'function') return;
    if (service.type && ['require', 'global'].indexOf(service.type) === -1) throw new Error(`Service "${name}" type <${service.type}> must be global or require`);
  });
}

module.exports = pub;
