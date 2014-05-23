var Util = require('util');
var EventEmitter = require('events').EventEmitter;
var T = require('joi');

var internals = {};

module.exports = internals.Activity = function () {
    this.activitySchema = T.object({
            id : T.string().required().description('ID'),
            type : T.string().required().description('Activity type'),
            targetRef : T.string().when('type', {
                is : 'sequenceFlow',
                then : T.required()
            }),
            sourceRef : T.when('type', {
                is : 'sequenceFlow',
                then : T.required()
            }),
            baseElements : T.array().when('type', {
                is : 'process',
                then : T.required()
            })
        }).unknown(true);
};

Util.inherits(internals.Activity, EventEmitter);

internals.Activity.prototype.validateDefinition = function (activityDefinition, callback) {
    var _self = this;
    T.validate(activityDefinition, _self.activitySchema, callback);
};
