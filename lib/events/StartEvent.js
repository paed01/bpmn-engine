'use strict';

const ActivityExecution = require('../activities/activity-execution');
const Debug = require('debug');
const {EventEmitter} = require('events');

function StartEvent(activity) {
  Object.assign(this, activity);
  this.isStart = true;
  this.isStartEvent = true;
}

StartEvent.prototype = Object.create(EventEmitter.prototype);

module.exports = StartEvent;

StartEvent.prototype.run = function(message) {
  this.activate().run(message);
};

StartEvent.prototype.execute = function(executionContext, callback) {
  if (this.form || this.hasInboundMessage) {
    const activityApi = executionContext.getActivityApi({
      waiting: true
    });
    this.emit('start', activityApi, executionContext);

    return this.emit('wait', executionContext.postpone(callback));
  }

  this.emit('start', executionContext.getActivityApi(), executionContext);
  return callback();
};

StartEvent.prototype.activate = function(state) {
  const scope = this;
  const id = scope.id;
  const type = scope.type;
  const debug = Debug(`bpmn-engine:${type.toLowerCase()}`);
  const emit = scope.emit.bind(this);
  const outbound = scope.outbound;

  let activityExecution;

  state = state || {
    id,
    type
  };

  const activityApi = {
    id,
    type,
    outbound,
    deactivate,
    discard,
    getState,
    resume,
    run,
    stop
  };

  activate();

  return activityApi;

  function run(message) {
    activityExecution = ActivityExecution(scope, message, scope.getVariablesAndServices());
    enter(activityExecution);

    emit('start', activityApi, activityExecution);
    scope.execute(activityExecution, completeCallback);
  }

  function resume() {
    if (!state.entered) return;
    run();
  }

  function stop() {
    deactivate();
  }

  function getState() {
    return Object.assign({}, state);
  }

  function activate() {
  }

  function deactivate() {
  }

  function enter(executionContext) {
    delete state.taken;
    state.entered = true;
    debug(`<${id}> enter`);
    emit('enter', activityApi, executionContext);
  }

  function discard() {
    return completeCallback(null, true);
  }

  function completeCallback(err) {
    delete state.entered;

    if (err) return emit('error', err, scope);

    state.taken = true;

    debug(`<${id}> completed`);
    takeAllOutbound();
  }

  function takeAllOutbound() {
    emit('end', activityApi, activityExecution);
    debug(`<${id}> take all outbound (${outbound.length})`);
    if (outbound) outbound.forEach((flow) => flow.take());
    asyncEmit('leave', activityApi, activityExecution);
  }

  function discardAllOutbound(rootFlow) {
    if (outbound) outbound.forEach((flow) => flow.discard(rootFlow));
    emit('leave', activityApi, activityExecution);
  }

  function asyncEmit(eventName, ...args) {
    debug(`<${id}> async ${eventName}`);
    setImmediate(emit, eventName, ...args);
  }
};

// 'use strict';

// const Activity = require('../activities/Activity');

// function StartEvent(activity, parent) {
//   Activity.call(this, activity, parent);
//   this.isStart = true;
//   this.isStartEvent = true;
//   this.form = activity.form;
// }

// module.exports = StartEvent;

// StartEvent.prototype = Object.create(Activity.prototype);

// StartEvent.prototype.execute = function(executionContext, callback) {
//   this._debug(`<${executionContext.id}>`, 'execute');

//   if (this.form || this.hasInboundMessage) {
//     const activityApi = executionContext.getActivityApi({
//       waiting: true
//     });
//     this.emit('start', activityApi, executionContext);

//     return this.emit('wait', executionContext.postpone(callback));
//   }

//   this.emit('start', executionContext.getActivityApi(), executionContext);
//   return callback();
// };
