'use strict';

const debug = require('debug')('bpmn-engine:validation');
const Joi = require('joi');

const pub = {};

const flowElementsSchema = {
  id: Joi.string().required().description('ID'),
  $type: Joi.string().required().description('Activity type')
};

const processSchema = {
  id: Joi.string().required().description('ID'),
  $type: Joi.string().only('bpmn:Process').required().description('Process type'),
  isExecutable: Joi.boolean(),
  flowElements: Joi.array().items(flowElementsSchema).min(1).required()
};

const definitionsSchema = {
  $type: Joi.string().only('bpmn:Definitions').required().description('Definition type'),
  rootElements: Joi.alternatives().when(Joi.ref('$type', {
    contextPrefix: '+'
  }), {
    is: 'bpmn:Definitions',
    then: Joi.array().items(processSchema).required()
  })
};

pub.validate = function(definitions, context, callback) {
  if (!definitions) {
    return callback(new Error('Nothing to validate'));
  }
  debug('validate start');

  if (context.warnings.length) {
    return callback(new Error(context.warnings[0].message));
  }

  Joi.validate(definitions, definitionsSchema, {
    allowUnknown: true,
    convert: false
  }, (verr) => {
    if (verr) return callback(verr);
    validateContext(context, callback);
  });
};

function getElementSourceSequenceFlows(context, id) {
  return context.references.filter((r) => r.property === 'bpmn:sourceRef' && r.id === id);
}

function validateContext(context, callback) {
  // Loop elements and check for sequenceFlows
  Object.keys(context.elementsById).forEach((id) => {
    const element = context.elementsById[id];
    const refs = context.references.filter((r) => r.element && r.element.id === id);

    if (element.$type === 'bpmn:SequenceFlow') {
      ['sourceRef', 'targetRef'].forEach((prop) => {
        if (!refs.find((r) => r.property === `bpmn:${prop}`)) {
          context.addWarning(`${element.$type} >>${element.id}<< property "${prop}" is required`);
        }
      });
    } else if (element.$type === 'bpmn:ExclusiveGateway') {
      const flows = getElementSourceSequenceFlows(context, element.id);
      if (flows.length === 1) {
        const flowElement = flows[0].element;
        if (flowElement.conditionExpression) {
          context.addWarning(`${element.$type} >>${element.id}<< has a single diverging flow (${flowElement.$type} >>${flowElement.id}<<) with a condition`);
        }
      } else if (flows.length > 1) {
        flows.forEach((flow) => {
          const flowElement = flow.element;

          if (!isDefaultSequenceFlow(context.references, flowElement.id) && !flowElement.conditionExpression) {
            context.addWarning(`${element.$type} >>${element.id}<< diverging flow (${flowElement.$type} >>${flowElement.id}<<) has no condition`);
          }
        });
      }
    }
  });

  if (context.warnings.length) {
    debug(context.warnings[0]);
    return callback(new Error(context.warnings[0]));
  }

  debug('validate context end');
  callback();
}

function isDefaultSequenceFlow(references, flowId) {
  return references.find((r) => r.property === 'bpmn:default' && r.id === flowId);
}

module.exports = pub;
