/* Adapted from camunda-bpmn.js https://github.com/camunda/camunda-bpmn.js, Apache License, Version 2.0 */

var DOMParser = require('xmldom').DOMParser;
var Async = require('async');

var _init = function (executor, transformer) {
    if (typeof executor !== 'function') {
        executor = require('./activity-execution');
    }
    this.executor = executor;

    if (typeof transformer !== 'object') {
        transformer = new(require('./transformer-bpmn2'))();
    }
    this.transformer = transformer;
};

module.exports = _init;

function getXmlObject(source, callback) {
    var xmlDoc;
    var error;
    var xmlDomParser = new DOMParser({
            errorHandler : function (level, msg) {
                error = new Error(msg);
                error.level = level;
            }
        });

    if (Buffer.isBuffer(source)) { // Add ability to load from buffer, e.g. from http-request
        xmlDoc = xmlDomParser.parseFromString(source.toString());
        return setImmediate(callback, error, xmlDoc);
    } else if (typeof source === 'string') {
        xmlDoc = xmlDomParser.parseFromString(source);
        return setImmediate(callback, error, xmlDoc);
    } else {
        return setImmediate(callback, new Error('Failed to parse source'));
    }
}

_init.prototype.startInstance = function (bpmnXml, variables, listeners, callback) {
    var _self = this;
    Async.waterfall([function (wcb) {
                getXmlObject(bpmnXml, wcb);
            }, function (xmlDom, wcb) {
                _self.transformer.transform(xmlDom, true, wcb);
            }, function (activityDefinition, wcb) {
                var execution = new _self.executor(activityDefinition[0]);
                execution.variables = variables ? variables : {};
                wcb(null, execution);
            }
        ], function (err, execution) {
        if (err) {
            return callback(err);
        }
        callback(null, execution);
        execution.start();
    });
};
