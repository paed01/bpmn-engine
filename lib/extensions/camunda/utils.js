'use strict';

const expressionPattern = /\${(.+?)}/;
const supportedJsTypePattern = /^(javascript|js)$/i;

module.exports = {
  hasExpression,
  isSupportedScriptType,
};

function hasExpression(str) {
  return testPattern(expressionPattern, str);
}

function isSupportedScriptType(type) {
  return testPattern(supportedJsTypePattern, type);
}

function testPattern(pattern, str) {
  if (!str) return false;
  return pattern.test(str);
}
