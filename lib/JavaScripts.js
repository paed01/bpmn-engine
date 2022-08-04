'use strict';

const {Script} = require('vm');

module.exports = Scripts;

function Scripts(disableDummy) {
  if (!(this instanceof Scripts)) return new Scripts(disableDummy);
  this.scripts = {};
  this.disableDummy = disableDummy;
}

Scripts.prototype.register = function register({id, type, behaviour, logger, environment}) {
  let scriptBody, language;

  switch (type) {
    case 'bpmn:SequenceFlow': {
      if (!behaviour.conditionExpression) return;
      language = behaviour.conditionExpression.language;
      if (!language) return;
      scriptBody = behaviour.conditionExpression.body;
      break;
    }
    default: {
      language = behaviour.scriptFormat;
      scriptBody = behaviour.script;
    }
  }

  const filename = `${type}/${id}`;
  if (!language || !scriptBody) {
    if (this.disableDummy) return;
    const script = new DummyScript(language, filename, logger);
    this.scripts[id] = script;
    return script;
  }

  if (!/^javascript$/i.test(language)) return;

  const script = new JavaScript(language, filename, scriptBody, environment);
  this.scripts[id] = script;

  return script;
};

Scripts.prototype.getScript = function getScript(language, {id}) {
  return this.scripts[id];
};

function JavaScript(language, filename, scriptBody, environment) {
  this.id = filename;
  this.script = new Script(scriptBody, {filename});
  this.language = language;
  this.environment = environment;
}

JavaScript.prototype.execute = function execute(executionContext, callback) {
  const timers = this.environment.timers.register(executionContext);
  return this.script.runInNewContext({...executionContext, ...timers, next: callback});
};

function DummyScript(language, filename, logger) {
  this.id = filename;
  this.isDummy = true;
  this.language = language;
  this.logger = logger;
}

DummyScript.prototype.execute = function execute(executionContext, callback) {
  const {id, executionId} = executionContext.content;
  this.logger.debug(`<${executionId} (${id})> passthrough dummy script ${this.language || 'esperanto'}`);
  callback();
};
