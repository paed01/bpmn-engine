'use strict';
/* Adapted from camunda-bpmn.js https://github.com/camunda/camunda-bpmn.js, Apache License, Version 2.0 */

const debug = require('debug')('bpmn-engine:activity-execution');
const Util = require('util');
const Hoek = require('hoek');
const Uuid = require('node-uuid');
const Async = require('async');

const Activity = require('./activity');
const ActivityTypes = require('./activity-types');
const ActivityHelper = require('./activity-helper');

// var activityTypes = Activity.ActivityTypes;

const internals = {};

module.exports = internals.ActivityExecution = function(activityDefinition, parentExecutionOrCallback, callback) {

  Hoek.assert(this.constructor === internals.ActivityExecution, 'ActivityExecution must be instantiated using new');

  const self = this;
  Activity.call(self);

  let parent;
  if (typeof parentExecutionOrCallback === 'function') {
    callback = parentExecutionOrCallback;
    parentExecutionOrCallback = null;
  } else {
    parent = parentExecutionOrCallback;
  }

  function innerCallback(err, activityDef) {
    if (typeof callback === 'function') {
      return setImmediate(callback, err, activityDef);
    } else if (err) {
      throw err;
    }
  }

  if (!activityDefinition) {
    // throw new ExecutionException("Activity definition cannot be null", this);
    return innerCallback(new Error('Activity definition cannot be null'));
  }

  debug(`new activity ${activityDefinition.$type} ${activityDefinition.id || 'unknown'}`);

  // set unique process id
  let uuid;
  if (!parent) {
    uuid = Uuid.v4();
    debug(`creating new task with unique id ${uuid}`);
    this.uuid = uuid;
    this.taskid = uuid;
  } else { // child execution
    uuid = parent.uuid;
    debug(`continuing id ${uuid}`);

    this.uuid = uuid;
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

  // // Validate activityDefinition schema
  // self.validateDefinition(null, activityDefinition, (err) => {
  //   if (err) {
  //     return innerCallback(err);
  //   }
  //   return innerCallback(null, self);
  // });

};

Util.inherits(internals.ActivityExecution, Activity);

internals.ActivityExecution.prototype.bindVariableScope = function(scope) {
  if (this.parentExecution) {
    this.parentExecution.bindVariableScope(scope);
  }
  const variables = this.variables;
  for (const varName in variables) {
    scope[varName] = variables[varName];
  }
};

internals.ActivityExecution.prototype.executeActivity = function(activity, sequenceFlow, callback) {
  const self = this;
  debug(`execute activity ${activity.$type} ${activity.id}`);

  if (typeof callback !== 'function') {
    return self.emit(ActivityHelper.LISTENER_ERROR, {
      error: new Error('callback is not a function'),
      activity: self
    });
  }

  return new internals.ActivityExecution(activity, self, (newErr, childExecutor) => {
    if (newErr) {
      return callback(newErr);
    }

    self.activityExecutions.push(childExecutor);
    if (sequenceFlow) {
      childExecutor.incomingSequenceFlowId = sequenceFlow.id;
    }

    const listeners = ActivityHelper.eventNames;

    function applyListers(name, cb) {
      Async.each(self.listeners(name), (fn, next) => {
        childExecutor.on(name, fn);
        next();
      }, cb);
    }

    // propagate listeners
    Async.each(listeners, (name, cb) => {
      applyListers(name, cb);
    }, (err) => {
      callback(err, childExecutor);
    });
  });
};

internals.ActivityExecution.prototype.invokeListeners = function(type, sequenceFlow) {
  const eventData = sequenceFlow || this.activityDefinition;
  this.emit(type, eventData);
};

internals.ActivityExecution.prototype.start = function(callback) {
  this.startDate = new Date();

  this.invokeListeners(ActivityHelper.LISTENER_START);

  if (typeof callback === 'function') {
    setImmediate(callback, null, this);
  }
  this.continue();
};

internals.ActivityExecution.prototype.startAll = function(activities, callback) {
  const self = this;

  debug('start all');

  function innerCallback(err) {
    debug(`start all completed: ${err || 'without error'}`);

    if (typeof callback === 'function') {
      callback(err);
    } else if (err) {
      self.emit(ActivityHelper.LISTENER_ERROR, {
        error: err,
        activity: self
      });
    }
  }

  const children = [];
  Async.each(activities, (activity, cb) => {
    self.executeActivity(activity, null, (err, child) => {
      if (err) {
        return cb(err);
      }

      children.push(child);
      cb(null);
    });
  }, (err) => {
    if (err) {
      return innerCallback(err);
    }
    // start all
    Async.each(children, (child, cb) => {
      child.start(cb);
    }, innerCallback);
  });
};

internals.ActivityExecution.prototype.continue = function(callback) {
  // execute activity type
  const activityType = ActivityTypes.getActivityType(this.activityDefinition);

  debug(`continue with ${this.activityDefinition.$type}`);

  activityType.execute(this, callback);
};

internals.ActivityExecution.prototype.end = function(notifyParent, callback) {
  this.isEnded = true;
  this.endDate = new Date();

  debug(`ended with ${this.activityDefinition.id}`);

  // invoke listeners on activity end
  this.invokeListeners(ActivityHelper.LISTENER_END);
  if (callback) {
    setImmediate(callback);
  }

  if (this.parentExecution) {
    // remove from parent
    const parent = this.parentExecution;
    // notify parent
    if (notifyParent) {
      parent.hasEnded(this);
    }
  }
};

internals.ActivityExecution.prototype.takeAll = function(sequenceFlows, callback) {
  const self = this;

  function innerCallback(err) {
    debug(`take all sequence flows completed: ${err || 'success'}`);

    if (typeof callback === 'function') {
      callback(err);
    } else if (err) {
      self.emit(ActivityHelper.LISTENER_ERROR, {
        error: err,
        activity: self
      });
    }
  }

  if (!sequenceFlows || !sequenceFlows.length || sequenceFlows.length < 1) {
    return innerCallback(new Error(`No sequence flows to take from '${self.activityDefinition.id}'`));
  }

  // have the parent execute the next activity
  self.end(false, (endErr) => {
    if (endErr) return innerCallback(endErr);

    const children = [];
    Async.each(sequenceFlows, (sf, cb) => {
      const targetRef = sf.targetRef;
      const toActivity = ActivityHelper.getActivityById(self.parentExecution.activityDefinition, targetRef.id);
      if (!toActivity) {
        return cb(new Error(`cannot find activity with id '${targetRef.id}'`));
      }

      self.invokeListeners(ActivityHelper.LISTENER_TAKE, sf);

      self.parentExecution.executeActivity(toActivity, sf, (err, child) => {
        if (err) {
          return cb(err);
        }
        children.push(child);
        cb();
      });
    }, (err) => {
      if (err) {
        return innerCallback(err);
      }
      Async.each(children, (child, cb) => {
        child.start(cb);
      }, innerCallback);
    });
  });
};

internals.ActivityExecution.prototype.take = function(sequenceFlow, callback) {
  this.takeAll([sequenceFlow], callback);
};

internals.ActivityExecution.prototype.signal = function(definitionIdOrCallback, callback) {
  const self = this;
  let definitionId;
  if (typeof definitionIdOrCallback === 'function') {
    callback = definitionIdOrCallback;
  } else {
    definitionId = definitionIdOrCallback;
  }

  debug(`signal ${definitionId}`);

  function innerCallback(err, execution) {
    if (typeof callback === 'function') {
      return callback(err);
    }

    if (err) {
      execution.emit(ActivityHelper.LISTENER_ERROR, {
        error: err,
        activity: execution
      });
    }
  }

  function signalFn(execution) {
    if (execution.isEnded) {
      innerCallback(new Error('cannot signal an ended activity instance'), execution);
      // throw new ExecutionException("cannot signal an ended activity instance", execution);
    }
    const type = ActivityTypes.getActivityType(execution.activityDefinition);
    if (type.signal) {
      return type.signal(execution);
    } else {
      return execution.end();
    }
  }

  if (definitionId) {
    self.getActivityExecutionById(definitionId, (err, execution) => {
      if (err) return signalFn(err);
      signalFn(execution);
    });
  } else {
    signalFn(self);
  }
};

internals.ActivityExecution.prototype.getActivityExecutionById = function(definitionId, callback) {
  Async.detect(this.activityExecutions, (ae, next) => {
    next(null, ae.activityDefinition.id === definitionId);
  }, callback);
};

/**
 * called by the child activity executors when they are ended
 */
internals.ActivityExecution.prototype.hasEnded = function() {
  const self = this;
  let allEnded = true;

  Async.each(self.activityExecutions, (ae, cb) => {
    allEnded &= ae.isEnded;
    cb();
  }, (err) => {
    if (!err && allEnded) {
      const activityType = ActivityTypes.getActivityType(self.activityDefinition);
      if (activityType.allActivitiesEnded) {
        activityType.allActivitiesEnded(self);
      } else {
        self.end();
      }
    }
  });
};

/**
 * an activity instance is a java script object that holds the state of an
 * ActivityExecution. It can be regarded as the serialized representation
 * of an execution tree.
 */
internals.ActivityExecution.prototype.getActivityInstance = function() {
  const activityInstance = {
    activityId: this.activityDefinition.id,
    taskid: this.taskid,
    isEnded: this.isEnded,
    startDate: this.startDate,
    endDate: this.endDate
  };

  if (this.activityExecutions.length > 0) {
    activityInstance.activities = [];
    for (let i = 0; i < this.activityExecutions.length; i++) {
      activityInstance.activities.push(this.activityExecutions[i].getActivityInstance());
    }
  }
  return activityInstance;
};
