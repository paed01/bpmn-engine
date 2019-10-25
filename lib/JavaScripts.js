const { Script } = require('vm');

module.exports = function Scripts() {
  const scripts = {};

  return {
    getScript,
    register,
  };

  function register({ id, type, behaviour }) {
    let scriptBody, language = 'javascript';

    switch (type) {
      case 'bpmn:SequenceFlow': {
        if (!behaviour.conditionExpression) return;
        language = behaviour.conditionExpression.language;
        scriptBody = behaviour.conditionExpression.body;
        break;
      }
      default: {
        language = behaviour.scriptFormat;
        scriptBody = behaviour.script;
      }
    }

    if (!/^javascript$/i.test(language)) return;
    scripts[id] = new Script(scriptBody, { filename: `${type}/${id}` });
  }

  function getScript(scriptType, { id }) {
    if (!/^javascript$/i.test(scriptType)) return;
    const script = scripts[id];
    if (!script) return;

    return {
      execute,
    };

    function execute(executionContext, callback) {
      return script.runInNewContext({ ...executionContext, next: callback });
    }
  }
};
