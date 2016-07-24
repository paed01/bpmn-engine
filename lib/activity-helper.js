'use strict';

const debug = require('debug')('bpmn-engine:activity-helper');

/* Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/* Adapted from camunda-bpmn.js https://github.com/camunda/camunda-bpmn.js, Apache License, Version 2.0 */

const LISTENER_START = 'start';
const LISTENER_END = 'end';
const LISTENER_TAKE = 'take';
const LISTENER_ERROR = 'error';

function getActivitiesByType(activityDefinition, type, recursive) {
  let flowElements = [];
  if (!activityDefinition || !activityDefinition.flowElements) {
    return flowElements;
  }

  for (let i = 0; i < activityDefinition.flowElements.length; i++) {
    const childActivity = activityDefinition.flowElements[i];
    if (childActivity.$type === type || childActivity.$type === `bpmn:${type}`) {
      flowElements.push(childActivity);
      if (recursive) {
        flowElements = flowElements.concat(getActivitiesByType(childActivity, type, recursive));
      }
    }
  }
  return flowElements;
}

function getActivityById(activityDefinition, id) {
  if (!activityDefinition || !activityDefinition.flowElements) {
    return null;
  }

  for (let i = 0; i < activityDefinition.flowElements.length; i++) {
    const childActivity = activityDefinition.flowElements[i];
    if (!!childActivity.id && childActivity.id === id) {
      return childActivity;
    }
  }
  return null;
}

function getSequenceFlows(scopeActivity) {
  let result = [];
  if (!scopeActivity) {
    return result;
  }

  const scopeActivityId = scopeActivity.get('id');

  debug(`get sequence flows for ${scopeActivityId}`);

  if (scopeActivity.outgoing) {
    debug(`get sequence flows from outgoing flows ${scopeActivityId}`);

    const outgoingSequenceFlowIds = scopeActivity.outgoing;
    for (let i = 0; i < outgoingSequenceFlowIds.length; i++) {
      const sequenceFlowId = outgoingSequenceFlowIds[i];
      result.push(getActivityById(scopeActivity, sequenceFlowId));
    }
  } else {
    debug(`check targetRef of ${scopeActivityId} from sequence flows from ${scopeActivity.$parent.get('id')}`);

    const sequenceFlows = getActivitiesByType(scopeActivity.$parent, 'SequenceFlow');

    debug(`found ${sequenceFlows.length} sequence flows from ${scopeActivity.$parent.id}`);

    if (!sequenceFlows.length) {
      debug('no sequence flows defined');
    }

    result = sequenceFlows.filter((sf) => sf.get('sourceRef') === scopeActivity);
  }

  return result;
}

let VariableScope = (function() {

  function VariableScope(activityExecution) {
    activityExecution.bindVariableScope(this);
  }

  VariableScope.prototype.evaluateCondition = function(condition) {
    return eval(condition);
  };

  return VariableScope;
})();

function evaluateCondition(condition, activityExecution) {
  return new VariableScope(activityExecution).evaluateCondition(condition);
}

// the default outgoing behavior for BPMN 2.0 activities //////////

function leave(activityExecution) {

  // SEPC p.427 ??13.2.1
  // Multiple outgoing Sequence Flows behaves as a parallel split.
  // Multiple outgoing Sequence Flows with conditions behaves as an inclusive split.
  // A mix of multiple outgoing Sequence Flows with and without conditions is considered as a combination of a parallel and an inclusive split

  const sequenceFlowsToTake = [];
  const availableSequenceFlows = getSequenceFlows(activityExecution.activityDefinition, activityExecution.parentExecution.activityDefinition);
  const defaultFlowId = activityExecution.activityDefinition.default;

  let defaultFlow = null;
  let noConditionalFlowActivated = true;

  for (let i = 0; i < availableSequenceFlows.length; i++) {
    const sequenceFlow = availableSequenceFlows[i];

    debug('found sequenceFlow', !!sequenceFlow);

    if (!!defaultFlowId && defaultFlowId === sequenceFlow.id) {
      defaultFlow = sequenceFlow;
    } else if (!sequenceFlow.condition) {
      sequenceFlowsToTake.push(sequenceFlow);
    } else if (evaluateCondition(sequenceFlow.condition, activityExecution)) {
      sequenceFlowsToTake.push(sequenceFlow);
      noConditionalFlowActivated = false;
    }
  }

  // the default flow is only activated if all conditional flows are false
  if (noConditionalFlowActivated && !!defaultFlow) {
    sequenceFlowsToTake.push(defaultFlow);
  }

  activityExecution.takeAll(sequenceFlowsToTake);
}

exports.getActivitiesByType = getActivitiesByType;
exports.getActivityById = getActivityById;
// exports.getActivityType = getActivityType;
exports.getSequenceFlows = getSequenceFlows;
exports.leave = leave;
exports.evaluateCondition = evaluateCondition;

exports.LISTENER_START = LISTENER_START;
exports.LISTENER_END = LISTENER_END;
exports.LISTENER_TAKE = LISTENER_TAKE;
exports.LISTENER_ERROR = LISTENER_ERROR;

exports.eventNames = [LISTENER_END, LISTENER_START, LISTENER_TAKE, LISTENER_ERROR];
