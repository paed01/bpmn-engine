'use strict';

const Activity = require('../activities/Activity');

function ExclusiveGateway() {
  Activity.apply(this, arguments);
}

ExclusiveGateway.prototype = Object.create(Activity.prototype);

ExclusiveGateway.prototype.run = function () {
  Activity.prototype.run.call(this);

  const input = this.getInput();

  this.emit('start', this);
  
  if (this.outbound != null && this.outbound.length == 1) {
    this.emit('end', this, this.getOutput(input));
    this.taken = true;

    takeAll.call(this, this.outbound, input);
  } else {
    this.waiting = true;
    this.emit('wait', this);
  }
};

ExclusiveGateway.prototype.signal = function (input) {
  if (!this.waiting) {
    return this.emit('error', new Error(`<${this.id}> is not waiting`), this);
  }

  this.waiting = false;

  this.dataOutput = input;
  this.emit('end', this, this.getOutput(input));
  this.taken = true;

  this._debug(`<${this.id}>`, 'signaled', input);
  takeAll.call(this, this.outbound, input);
};

/*ExclusiveGateway.prototype.wait = function (input) {
  // wenn condition bereits gesetzt ist
  const defaultFlow = this.outbound.find((flow) => flow.isDefault);
  const conditionalFlows = this.outbound.filter((flow) => !flow.isDefault);

  // wenn es default flow gibts, dann direkt überspringen das wait
  this._debug(`<${this.id}>`, 'wait hallo');
  this._debug(`<${this.id}>`, defaultFlow);
  if (!defaultFlow) {
	  this._debug(`<${this.id}>`, 'wait hallo2');
    let takenFlow;

    for (let i = 0; i < conditionalFlows.length; i++) {
      const sequenceFlow = conditionalFlows[i];
      if (!takenFlow && sequenceFlow.evaluateCondition(input)) {
        this._debug(`<${this.id}>`, 'conditional flow successfull checked');
        takenFlow = sequenceFlow;
      }
    }
      this._debug(`<${this.id}>`, 'conditional flows checked');

    // wenn im store bereits eine auswertung oder ausprägung für eine condition steht, dann wähle diese und warte nicht
    if (!takenFlow) {
      this.waiting = true;
      this.emit('wait', this);
    } else {
      this.emit('end', this, this.getOutput(input));
      this.taken = true;
      takeAll.call(this, this.outbound, input);
    }

  } else {
    this.emit('end', this, this.getOutput(input));
    this.taken = true;
    takeAll.call(this, this.outbound, input);
  }

};*/

function takeAll(outbound, input) {
  this._debug(`<${this.id}>`, `take ${outbound.length} sequence flows`);

  const defaultFlow = outbound.find((flow) => flow.isDefault);
  const conditionalFlows = outbound.filter((flow) => !flow.isDefault);

  let takenFlow;
  const discardFlows = [];

  for (let i = 0; i < conditionalFlows.length; i++) {
    const sequenceFlow = conditionalFlows[i];
    if (!takenFlow && sequenceFlow.evaluateCondition(input)) {
      takenFlow = sequenceFlow;
    } else {
      discardFlows.push(sequenceFlow);
    }
  }

  if (!takenFlow && defaultFlow) {
    this._debug(`<${this.id}> take default flow <${defaultFlow.id}>`);
    defaultFlow.take();
    conditionalFlows.forEach((flow) => flow.discard());
  } else if (takenFlow) {
    if (defaultFlow) discardFlows.push(defaultFlow);
    this._debug(`<${this.id}> take conditional flow <${takenFlow.id}>`);
    takenFlow.take();
    discardFlows.forEach((flow) => flow.discard());
  } else {
    return this.emit('error', new Error(`No conditional flow was taken from <${this.id}>`), this);
  }

  this.leave();
}

module.exports = ExclusiveGateway;
