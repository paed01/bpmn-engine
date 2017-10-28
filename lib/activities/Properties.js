// 'use strict';

// const debug = require('debug');
// const expressions = require('../expressions');

// function Properties(activity) {
//   this.type = activity.$type;
//   this._debug = debug(`bpmn-engine:properties:${this.type.toLowerCase()}`);
//   this.activity = activity;
//   initProperties.call(this);
// }

// Properties.prototype.getValues = function(context) {
//   const result = {};

//   this.propertyValues.forEach((prop) => {
//     this._debug('get property value', prop.name);
//     result[prop.name] = expressions.hasExpression(prop.value) ? expressions(prop.value, context) : prop.value;
//   });
//   return result;
// };

// function initProperties() {
//   this.propertyValues = this.activity.values.filter((prop) => prop.name);
// }

// module.exports = Properties;
