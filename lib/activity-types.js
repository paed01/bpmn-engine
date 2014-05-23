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
 
var Async = require('async');
var ActivityHelper = require('./activity-helper');

var ExecutionException = (function () {

    function ExecutionException(message, activityExecution) {
        this.message = message;
        this.activityExecution = activityExecution;
        throw message;
    }

    return ExecutionException;
})();

var process = {
    "execute" : function (activityExecution, callback) {
        var innerCallback = function (err, activity) {
            if (typeof callback == 'function') {
                return setImmediate(callback, err, activity);
            }
            if (err) {
                throw err;
            }
        };

        // find start events
        var startEvents = ActivityHelper.getActivitiesByType(activityExecution.activityDefinition, "startEvent");

        if (startEvents.length === 0) {
            var error = new Error("process must have at least one start event");
            return innerCallback(error);
        }
        innerCallback(null, activityExecution);

        // activate all start events
        // activityExecution.executeActivities(startEvents);
        activityExecution.startAll(startEvents);
    }
};

var startEvent = {
    "execute" : function (activityExecution, callback) {
        ActivityHelper.leave(activityExecution, callback);
    }
};

var intermediateThrowEvent = {
    "execute" : function (activityExecution, callback) {
        ActivityHelper.leave(activityExecution, callback);
    }
};

var endEvent = {
    "execute" : function (activityExecution, callback) {
        activityExecution.end(true, callback);
    }
};

var task = {
    "execute" : function (activityExecution, callback) {
        ActivityHelper.leave(activityExecution, callback);
    }
};

var userTask = {
    "execute" : function (activityExecution, callback) {
        // wait state
    },
    "signal" : function (activityExecution, callback) {
        ActivityHelper.leave(activityExecution, callback);
    }
};

var serviceTask = {
    "execute" : function (activityExecution, callback) {
        ActivityHelper.leave(activityExecution, callback);
    }
};

/**
 * implementation of the exclusive gateway
 */
var exclusiveGateway = {
    "execute" : function (activityExecution, callback) {
        var outgoingSequenceFlows = activityExecution.activityDefinition.sequenceFlows;

        var sequenceFlowToTake,
        defaultFlow;

        for (var i = 0; i < outgoingSequenceFlows.length; i++) {
            var sequenceFlow = outgoingSequenceFlows[i];
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
                throw "Cannot determine outgoing sequence flow for exclusive gateway '" + activityExecution.activityDefinition + "': " +
                "All conditions evaluate to false and a default sequence flow has not been specified.";
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
var parallelGateway = {
    "execute" : function (activityExecution, callback) {
        var cardinality = activityExecution.activityDefinition.cardinality;
        var innerCallback = typeof callback === 'function' ? callback : function () {};

        // console.log('activity-types/parallelGateway#execute', activityExecution.activityDefinition.id, 'cardinality', cardinality);

        // Parallell gateway
        if (cardinality === 1) {
            var outgoingSequenceFlows = ActivityHelper.getSequenceFlows(activityExecution.activityDefinition, activityExecution.parentExecution.activityDefinition);
            activityExecution.takeAll(outgoingSequenceFlows, innerCallback);
        } else if (cardinality > 1) { // Joining gateway
            // Find siblings
            var open = 0;
            var executionsToJoin = [];
            var parent = activityExecution.parentExecution;
            for (var i = 0; i < parent.activityExecutions.length; i++) {
                var sibling = parent.activityExecutions[i];
                if (sibling.activityDefinition == activityExecution.activityDefinition && !sibling.isEnded) {
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
                var outgoingSequenceFlows = ActivityHelper.getSequenceFlows(activityExecution.activityDefinition, activityExecution.parentExecution.activityDefinition);
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
var activityTypes = {};

var getActivityType = function (activityDefinition) {
    var type = activityDefinition.type;
    if (!!type) {
        return activityTypes[type];
    } else {
        return null;
    }
};

activityTypes["startEvent"] = startEvent;
activityTypes["intermediateThrowEvent"] = intermediateThrowEvent;
activityTypes["endEvent"] = endEvent;
activityTypes["exclusiveGateway"] = exclusiveGateway;
activityTypes["task"] = task;
activityTypes["userTask"] = userTask;
activityTypes["serviceTask"] = serviceTask;
activityTypes["process"] = process;
activityTypes["parallelGateway"] = parallelGateway;

exports.ActivityTypes = activityTypes;
exports.getActivityType = getActivityType;

// CAM.ActivityExecution = ActivityExecution;
// exports.ExecutionException = ExecutionException;
// exports.ActivityTypes = activityTypes;
// exports.getActivitiesByType = getActivitiesByType;
// exports.getActivityById = getActivityById;
// exports.getActivityType = getActivityType;
// exports.getSequenceFlows = getSequenceFlows;
