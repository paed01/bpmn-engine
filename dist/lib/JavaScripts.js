'use strict';

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(source, true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(source).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var {
  Script
} = require('vm');

module.exports = function Scripts() {
  var scripts = {};
  return {
    getScript,
    register
  };

  function register(_ref) {
    var {
      id,
      type,
      behaviour
    } = _ref;
    var scriptBody,
        language = 'javascript';

    switch (type) {
      case 'bpmn:SequenceFlow':
        {
          if (!behaviour.conditionExpression) return;
          language = behaviour.conditionExpression.language;
          scriptBody = behaviour.conditionExpression.body;
          break;
        }

      default:
        {
          language = behaviour.scriptFormat;
          scriptBody = behaviour.script;
        }
    }

    if (!/^javascript$/i.test(language)) return;
    scripts[id] = new Script(scriptBody, {
      filename: "".concat(type, "/").concat(id)
    });
  }

  function getScript(scriptType, _ref2) {
    var {
      id
    } = _ref2;
    if (!/^javascript$/i.test(scriptType)) return;
    var script = scripts[id];
    if (!script) return;
    return {
      execute
    };

    function execute(executionContext, callback) {
      return script.runInNewContext(_objectSpread({}, executionContext, {
        next: callback
      }));
    }
  }
};