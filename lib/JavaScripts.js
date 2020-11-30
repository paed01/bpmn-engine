'use strict';

const {Script} = require('vm');

module.exports = function Scripts(disableDummy) {
  const scripts = {};

  return {
    getScript,
    register,
  };

  function register({id, type, behaviour, logger}) {
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


    if (!language || !scriptBody) {
      if (disableDummy) return;
      const script = dummyScript(language, `${type}/${id}`, logger);
      scripts[id] = script;
      return script;
    }

    if (!/^javascript$/i.test(language)) return;

    const script = javaScript(language, `${type}/${id}`, scriptBody);
    scripts[id] = script;

    return script;
  }

  function getScript(language, {id}) {
    return scripts[id];
  }

  function javaScript(language, filename, scriptBody) {
    const script = new Script(scriptBody, {filename});
    return {
      script,
      language,
      execute(executionContext, callback) {
        return script.runInNewContext({...executionContext, next: callback});
      }
    };
  }

  function dummyScript(language) {
    return {
      isDummy: true,
      language,
      execute(executionContext, callback) {
        const {id, executionId} = executionContext.content;
        executionContext.environment.Logger('dummy:script').debug(`<${executionId} (${id})> passthrough dummy script ${language || 'esperanto'}`);
        callback();
      },
    };
  }
};
