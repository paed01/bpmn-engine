'use strict';

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
/* part of https://github.com/camunda/camunda-bpmn.js/blob/master/src/bpmn/Executor.js */

const debug = require('debug')('bpmn-engine:activity-types');
const ActivityHelper = require('./activity-helper');

const process = {
  execute: function(activityExecution, callback) {
    function innerCallback(err, activity) {
      if (typeof callback === 'function') {
        return setImmediate(callback, err, activity);
      }
      if (err) {
        throw err;
      }
    }

    debug(`start executing process '${activityExecution.activityDefinition.id || 'anonymous'}'`);
    // find start events
    console.log(activityExecution.activityDefinition)

    const startEvents = ActivityHelper.getActivitiesByType(activityExecution.activityDefinition, 'bpmn:StartEvent');

    if (startEvents.length === 0) {
      const error = new Error('process must have at least one start event');
      return innerCallback(error);
    }
    innerCallback(null, activityExecution);

    // activate all start events
    // activityExecution.executeActivities(startEvents);
    activityExecution.startAll(startEvents);
  }
};

const startEvent = {
  'execute': function(activityExecution, callback) {
    ActivityHelper.leave(activityExecution, callback);
  }
};

const intermediateThrowEvent = {
  'execute': function(activityExecution, callback) {
    ActivityHelper.leave(activityExecution, callback);
  }
};

const endEvent = {
  execute: function(activityExecution, callback) {
    activityExecution.end(true, callback);
  }
};

const task = {
  execute: function(activityExecution, callback) {
    ActivityHelper.leave(activityExecution, callback);
  }
};

const userTask = {
  execute: function() {
    // wait state
  },
  signal: function(activityExecution, callback) {
    ActivityHelper.leave(activityExecution, callback);
  }
};

const serviceTask = {
  execute: function(activityExecution, callback) {
    ActivityHelper.leave(activityExecution, callback);
  }
};

/**
 * implementation of the exclusive gateway
 */
const exclusiveGateway = {
  execute: function(activityExecution) {
    const outgoingSequenceFlows = activityExecution.activityDefinition.sequenceFlows;

    let sequenceFlowToTake, defaultFlow;

    for (let i = 0; i < outgoingSequenceFlows.length; i++) {
      const sequenceFlow = outgoingSequenceFlows[i];
      if (!sequenceFlow.condition) {
        // we make sure at deploy time that there is only a single sequence flow without a condition
        defaultFlow = sequenceFlow;
      } else if (ActivityHelper.evaluateCondition(sequenceFlow.condition, activityExecution)) {
        sequenceFlowToTake = sequenceFlow;
        break;
      }
    }

    if (!sequenceFlowToTake) {
      if (!defaultFlow) {
        throw new Error(`Cannot determine outgoing sequence flow for exclusive gateway '${activityExecution.activityDefinition}': All conditions evaluate to false and a default sequence flow has not been specified.`);
      } else {
        sequenceFlowToTake = defaultFlow;
      }
    }

    activityExecution.take(sequenceFlowToTake);
  }
};

/**
 * implementation of the parallel gateway
 */
const parallelGateway = {
  execute: function(activityExecution, callback) {
    const cardinality = activityExecution.activityDefinition.cardinality;
    const innerCallback = typeof callback === 'function' ? callback : function() {};

    // console.log('activity-types/parallelGateway#execute', activityExecution.activityDefinition.id, 'cardinality', cardinality);

    // Parallell gateway
    if (cardinality === 1) {
      const outgoingSequenceFlows = ActivityHelper.getSequenceFlows(activityExecution.activityDefinition, activityExecution.parentExecution.activityDefinition);
      activityExecution.takeAll(outgoingSequenceFlows, innerCallback);
    } else if (cardinality > 1) { // Joining gateway
      // Find siblings
      let open = 0;
      const executionsToJoin = [];
      const parent = activityExecution.parentExecution;
      for (let i = 0; i < parent.activityExecutions.length; i++) {
        const sibling = parent.activityExecutions[i];
        if (sibling.activityDefinition === activityExecution.activityDefinition && !sibling.isEnded) {
          executionsToJoin.push(sibling);
          open++;
        }
      }

      // console.log('activity-types/parallelGateway#execute (joined)', activityExecution.activityDefinition.id, 'open', open);

      // End current if more than one open - the last will be ended in take-step
      if (open > 1) {
        // console.log('activity-types/parallelGateway#execute (joined)', activityExecution.activityDefinition.id, activityExecution.taskid, 'end');
        activityExecution.end(false, innerCallback);

        // Async.each(executionsToJoin, function (je, cb) {
        // if (je.taskid !== activityExecution.taskid) {
        // return je.end(false, cb);
        // }
        // return cb();
        // }, innerCallback);
      } else {
        // Take outgoing sequenceFlow(s)
        const outgoingSequenceFlows = ActivityHelper.getSequenceFlows(activityExecution.activityDefinition, activityExecution.parentExecution.activityDefinition);
        return activityExecution.takeAll(outgoingSequenceFlows, innerCallback);
      }
    }

    // join
    // var executionsToJoin = [];
    // var parent = activityExecution.parentExecution;
    // for (var i = 0; i < parent.activityExecutions.length; i++) {
    // var sibling = parent.activityExecutions[i];
    // if (sibling.activityDefinition == activityExecution.activityDefinition && !sibling.isEnded) {
    // executionsToJoin.push(sibling);
    // }
    // }

    // console.log('activity-types/parallelGateway#execute', activityExecution.activityDefinition.id, outgoingSequenceFlows.length, executionsToJoin.length, activityExecution.activityDefinition.cardinality);

    // if (executionsToJoin.length == activityExecution.activityDefinition.cardinality) {
    // // end all joined executions but this one,
    // Async.each(executionsToJoin, function (je, cb) {
    // if (je != activityExecution) {
    // je.end(false);
    // }
    // console.log('activity-types/parallelGateway#execute', je.activityDefinition.id, je.isEnded);
    // return cb();
    // }, function (err) {
    // var allEnded = true;
    // for (var i = 0; i < executionsToJoin.length; i++) {
    // allEnded &= executionsToJoin[i].isEnded;
    // }
    // // if (allEnded) {
    // activityExecution.takeAll(outgoingSequenceFlows, callback);
    // // }
    // });

    // // for (var i = 0; i < executionsToJoin.length; i++) {
    // // var joinedExecution = executionsToJoin[i];
    // // if (joinedExecution != activityExecution) {
    // // joinedExecution.end(false);
    // // }
    // // }
    // // continue with this execution
    // // activityExecution.takeAll(outgoingSequenceFlows);
    // }
  }
};

// register activity types
const activityTypes = {};

function getActivityType(activityDefinition) {
  debug('getActivityType', activityDefinition.$type);

  const type = activityDefinition.$type;
  if (type) {
    return activityTypes[type];
  } else {
    return null;
  }
}

activityTypes['bpmn:StartEvent'] = startEvent;
activityTypes['bpmn:IntermediateThrowEvent'] = intermediateThrowEvent;
activityTypes['bpmn:EndEvent'] = endEvent;
activityTypes['bpmn:ExclusiveGateway'] = exclusiveGateway;
activityTypes['bpmn:Task'] = task;
activityTypes['bpmn:UserTask'] = userTask;
activityTypes['bpmn:ServiceTask'] = serviceTask;
activityTypes['bpmn:Process'] = process;
activityTypes['bpmn:ParallelGateway'] = parallelGateway;

exports.ActivityTypes = activityTypes;
exports.getActivityType = getActivityType;

// CAM.ActivityExecution = ActivityExecution;
// exports.ExecutionException = ExecutionException;
// exports.ActivityTypes = activityTypes;
// exports.getActivitiesByType = getActivitiesByType;
// exports.getActivityById = getActivityById;
// exports.getActivityType = getActivityType;
// exports.getSequenceFlows = getSequenceFlows;
