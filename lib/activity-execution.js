/* Adapted from camunda-bpmn.js https://github.com/camunda/camunda-bpmn.js, Apache License, Version 2.0 */

var Util = require('util');
var Hoek = require('hoek');
var Uuid = require('node-uuid');
var Async = require('async');

var Activity = require('./activity');
var ActivityTypes = require('./activity-types');
var ActivityHelper = require('./activity-helper');

// var activityTypes = Activity.ActivityTypes;

var internals = {};

exports = module.exports = internals.ActivityExecution = function (activityDefinition, parentExecutionOrCallback, callback) {

    Hoek.assert(this.constructor === internals.ActivityExecution, 'ActivityExecution must be instantiated using new');

    var _self = this;
    Activity.call(_self);

    var parent;
    if (typeof parentExecutionOrCallback == 'function') {
        callback = parentExecutionOrCallback;
        parentExecutionOrCallback = null;
    } else {
        parent = parentExecutionOrCallback;
    }

    var innerCallback = function (err, activityDef) {
        if (typeof callback == 'function') {
            return setImmediate(callback, err, activityDef);
        } else if (err) {
            throw err;
        }
    };

    if (!activityDefinition) {
        // throw new ExecutionException("Activity definition cannot be null", this);
        return innerCallback(new Error("Activity definition cannot be null"));
    }

    // set unique process id
    if (!parent) {
        this.uuid = Uuid.v4();
        this.taskid = this.uuid;
    } else { // child execution
        this.uuid = parent.uuid;
        // set unique task id
        this.taskid = Uuid.v4();
    }

    this.activityDefinition = activityDefinition;
    // a list of child activity executions
    this.activityExecutions = [];
    // indicates whether the execution has been ended
    this.isEnded = false;
    // the parent execution
    this.parentExecution = parent;
    // the variables of this execution
    this.variables = {};

    this.startDate = null;
    this.endDate = null;

    // Validate activityDefinition schema
    _self.validateDefinition(activityDefinition, function (err) {
        if (err) {
            return innerCallback(err);
        }
        return innerCallback(null, _self);
    });

};

Util.inherits(internals.ActivityExecution, Activity);

internals.ActivityExecution.prototype.bindVariableScope = function (scope) {
    if (!!this.parentExecution) {
        this.parentExecution.bindVariableScope(scope);
    }
    var variables = this.variables;
    for (var varName in variables) {
        scope[varName] = variables[varName];
    }
};

// internals.ActivityExecution.prototype.executeActivities = function (activities) {
// for (var i = 0; i < activities.length; i++) {
// this.executeActivity(activities[i]);
// }
// };

internals.ActivityExecution.prototype.executeActivity = function (activity, sequenceFlow, callback) {
    var _self = this;

    if (typeof callback !== 'function') {
        return _self.emit(ActivityHelper.LISTENER_ERROR, {
            error : new Error('callback is not a function'),
            activity : _self
        });
    }

    new internals.ActivityExecution(activity, _self, function (err, childExecutor) {
        if (err) {
            return callback(err);
        }

        _self.activityExecutions.push(childExecutor);
        if (!!sequenceFlow) {
            childExecutor.incomingSequenceFlowId = sequenceFlow.id;
        }

        var listeners = ActivityHelper.eventNames;

        var applyListers = function (name, cb) {
            Async.each(_self.listeners(name), function (fn, ecb) {
                childExecutor.on(name, fn);
                ecb();
            }, cb);
        };

        // propagate listeners
        Async.each(listeners, function (name, cb) {
            applyListers(name, cb);
        }, function (err) {
            callback(err, childExecutor);
        });
    });
};

internals.ActivityExecution.prototype.invokeListeners = function (type, sequenceFlow) {
    var eventData = sequenceFlow || this.activityDefinition;
    this.emit(type, eventData);
};

internals.ActivityExecution.prototype.start = function (callback) {
    this.startDate = new Date();

    this.invokeListeners(ActivityHelper.LISTENER_START);

    if (typeof callback === 'function') {
        setImmediate(callback, null, this);
    }
    this["continue"]();
};

internals.ActivityExecution.prototype.startAll = function (activities, callback) {
    var _self = this;
    var innerCallback = function (err) {
        if (typeof callback === 'function') {
            callback(err);
        } else if (err) {
            _self.emit(ActivityHelper.LISTENER_ERROR, {
                error : err,
                activity : _self
            });
        }
    };

    var children = [];
    Async.each(activities, function (activity, cb) {
        _self.executeActivity(activity, null, function (err, child) {
            if (err) {
                return cb(err);
            }

            children.push(child);
            cb(null);
        });
    }, function (err) {
        if (err) {
            return innerCallback(err);
        }
        // start all
        Async.each(children, function (child, cb) {
            child.start(cb);
        }, innerCallback);
    });
};

internals.ActivityExecution.prototype["continue"] = function (callback) {
    // execute activity type
    var activityType = ActivityTypes.getActivityType(this.activityDefinition);
    activityType.execute(this, callback);
};

internals.ActivityExecution.prototype.end = function (notifyParent, callback) {
    this.isEnded = true;
    this.endDate = new Date();

    // invoke listeners on activity end
    this.invokeListeners(ActivityHelper.LISTENER_END);
    setImmediate(callback);

    if (!!this.parentExecution) {
        // remove from parent
        var parent = this.parentExecution;
        // notify parent
        if (notifyParent) {
            parent.hasEnded(this);
        }
    }
};

internals.ActivityExecution.prototype.takeAll = function (sequenceFlows, callback) {
    var _self = this;
    var innerCallback = function (err) {
        if (typeof callback === 'function') {
            callback(err);
        } else if (err) {
            _self.emit(ActivityHelper.LISTENER_ERROR, {
                error : err,
                activity : _self
            });
        }
    };

    if (!sequenceFlows || !sequenceFlows.length || sequenceFlows.length < 1) {
        return innerCallback(new Error("No sequence flows to take from '" + _self.activityDefinition.id + "'"));
    }

    // have the parent execute the next activity
    _self.end(false, function (err) {
        if (err) {
            return innerCallback(err);
        }

        var children = [];
        Async.each(sequenceFlows, function (sf, cb) {
            var toId = sf.targetRef;
            var toActivity = ActivityHelper.getActivityById(_self.parentExecution.activityDefinition, toId);
            if (!toActivity) {
                return cb(new Error("cannot find activity with id '" + toId + "'"));
            }

            _self.invokeListeners(ActivityHelper.LISTENER_TAKE, sf);

            _self.parentExecution.executeActivity(toActivity, sf, function (err, child) {
                if (err) {
                    return cb(err);
                }
                children.push(child);
                cb();
            });
        }, function (err) {
            if (err) {
                return innerCallback(err);
            }
            Async.each(children, function (child, cb) {
                child.start(cb);
            }, innerCallback);
        });
    });
};

internals.ActivityExecution.prototype.take = function (sequenceFlow, callback) {
    this.takeAll([sequenceFlow], callback);
};

internals.ActivityExecution.prototype.signal = function (definitionIdOrCallback, callback) {
    var definitionId;
    if (typeof definitionIdOrCallback === 'function') {
        callback = definitionIdOrCallback;
    } else {
        definitionId = definitionIdOrCallback;
    }

    var signalFn = function (execution) {
        if (execution.isEnded) {
            throw new ExecutionException("cannot signal an ended activity instance", execution);
        }
        var type = ActivityTypes.getActivityType(execution.activityDefinition);
        if (!!type.signal) {
            type.signal(execution);
        } else {
            execution.end();
        }
    };

    if (definitionId) {
        for (var index in this.activityExecutions) {
            var execution = this.activityExecutions[index];
            if (execution.activityDefinition.id == definitionId) {
                signalFn(execution);
                break;
            }
        }
    } else {
        signalFn(this);
    }
};

/**
 * called by the child activity executors when they are ended
 */
internals.ActivityExecution.prototype.hasEnded = function (activityExecution) {
    var _self = this;
    var allEnded = true;

    Async.each(_self.activityExecutions, function (ae, cb) {
        allEnded &= ae.isEnded;
        cb();
    }, function (err) {
        if (!err && allEnded) {
            var activityType = ActivityTypes.getActivityType(_self.activityDefinition);
            if (!!activityType.allActivitiesEnded) {
                activityType.allActivitiesEnded(_self);
            } else {
                _self.end();
            }
        }
    });
};

/**
 * an activity instance is a java script object that holds the state of an
 * ActivityExecution. It can be regarded as the serialized representation
 * of an execution tree.
 */
internals.ActivityExecution.prototype.getActivityInstance = function () {
    var activityInstance = {
        activityId : this.activityDefinition.id,
        taskid : this.taskid,
        isEnded : this.isEnded,
        startDate : this.startDate,
        endDate : this.endDate
    };

    if (this.activityExecutions.length > 0) {
        activityInstance.activities = [];
        for (var i = 0; i < this.activityExecutions.length; i++) {
            activityInstance.activities.push(this.activityExecutions[i].getActivityInstance());
        }
    }
    return activityInstance;
};
