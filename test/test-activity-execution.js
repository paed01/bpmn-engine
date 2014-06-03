/*jshint expr:true es5:true */

var Lab = require('lab');
var Xmldom = require('xmldom').DOMParser;
var DOMParser = new Xmldom();
var Util = require('util');
var Hoek = require('hoek');

var Bpmn = require('..');
var ActivityExecution = Bpmn.ActivityExecution;
var ActivityHelper = Bpmn.ActivityHelper;

var expect = Lab.expect;
var before = Lab.before;
// var after = Lab.after;
var beforeEach = Lab.beforeEach;
var describe = Lab.experiment;
var it = Lab.test;

describe('activity-execution', function () {
    it('Bpmn exposes executor module', function (done) {
        expect(Bpmn).to.have.property('ActivityExecution');
        done();
    });

    it('throws an error if not created with new', function (done) {
        var fn = function () {
            var client = Bpmn.ActivityExecution();
        };

        expect(fn).to.throw(Error);
        done();
    });

    var transformer = new Bpmn.Transformer();
    var processXml = '<?xml version="1.0" encoding="UTF-8"?>' +
        '<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" ' +
        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
        '<process id="theProcess2" isExecutable="true">' +
        '<startEvent id="theStart" />' +
        '<exclusiveGateway id="decision" default="flow2" />' +
        '<endEvent id="end1" />' +
        '<endEvent id="end2" />' +
        '<sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />' +
        '<sequenceFlow id="flow2" sourceRef="decision" targetRef="end1" />' +
        '<sequenceFlow id="flow3" sourceRef="decision" targetRef="end2">' +
        '<conditionExpression>true</conditionExpression>' +
        '</sequenceFlow>' +
        '</process>' +
        '</definitions>';

    var activityDefinition;
    var oActivityDefinition;
    before(function (done) {
        var bpmnDom;
        try {
            bpmnDom = DOMParser.parseFromString(processXml);
        } catch (err) {
            expect(err).to.not.exist;
        }

        transformer.transform(bpmnDom, true, function (err, bpmnObject) {
            oActivityDefinition = bpmnObject;
            done();
        });
    });
    beforeEach(function (done) {
        activityDefinition = Hoek.clone(oActivityDefinition);
        done();
    });

    describe('#ctor', function () {
        it('returns error in callback if no activity definition', function (done) {
            new Bpmn.ActivityExecution(null, function (err) {
                expect(err).to.exist;
                done();
            });
        });

        it('throws an error if no activityDefinition is passed', function (done) {
            var fn = function () {
                var client = new Bpmn.ActivityExecution(null);
            };

            expect(fn).to.throw(Error);
            done();
        });

        it('returns error in callback if sequenceFlow without targetRef is passed', function (done) {
            var def = activityDefinition[0];
            var sequenceFlows = ActivityHelper.getActivitiesByType(def, 'sequenceFlow');
            delete sequenceFlows[0].targetRef;

            new Bpmn.ActivityExecution(sequenceFlows[0], function (err) {
                expect(err).to.exist;
                done();
            });
        });

        it('returns error in callback if sequenceFlow without sourceRef is passed', function (done) {
            var def = activityDefinition[0];
            var sequenceFlows = ActivityHelper.getActivitiesByType(def, 'sequenceFlow');
            delete sequenceFlows[0].sourceRef;

            new Bpmn.ActivityExecution(sequenceFlows[0], function (err) {
                expect(err).to.exist;
                done();
            });
        });
    });

    describe('#start', function () {

        it('returns activity definition', function (done) {
            var exec = new Bpmn.ActivityExecution(activityDefinition[0]);
            expect(exec.start).to.be.a('function');
            done();
        });

        it('without callback is ok', function (done) {
            var exec = new Bpmn.ActivityExecution(activityDefinition[0]);
            exec.once('start', function (e) {
                expect(e).to.exist;
                expect(e.id).to.eql('theProcess2');
                expect(e.type).to.eql('process');
                done();
            });

            exec.start();
        });

        it('emits start event when started', function (done) {
            var exec = new Bpmn.ActivityExecution(activityDefinition[0]);
            exec.once('start', function (e) {
                expect(e).to.exist;
                expect(e.id).to.eql('theProcess2');
                expect(e.type).to.eql('process');
                done();
            });

            exec.start(function (err) {
                expect(err).to.not.exist;
            });
        });

        it('emits end event when ended', function (done) {
            var exec = new Bpmn.ActivityExecution(activityDefinition[0]);
            exec.on('end', function (e) {
                expect(e).to.exist;
                if (e.type == 'process') {
                    expect(e.id).to.eql('theProcess2');
                    done();
                }
            });

            exec.start(function (err) {
                expect(err).to.not.exist;
            });
        });

        it('emits take event when following sequenceFlow', function (done) {
            var exec = new Bpmn.ActivityExecution(activityDefinition[0]);
            exec.once('take', function (e) {
                expect(e).to.exist;
                done();
            });

            exec.start(function (err) {
                expect(err).to.not.exist;
            });
        });
    });

    describe('#startAll', function () {
        it('takes an array with activities', function (done) {
            var def = activityDefinition[0];
            var exec = new Bpmn.ActivityExecution(def);
            var activities = ActivityHelper.getActivitiesByType(def, 'startEvent');

            exec.startAll(activities, function (err) {
                expect(err).to.not.exist;
                done();
            });
        });

        it('returns error in callback if passed activities without type', function (done) {
            var def = activityDefinition[0];
            var exec = new Bpmn.ActivityExecution(def);
            var activities = ActivityHelper.getActivitiesByType(def, 'startEvent');

            delete activities[0].type;

            exec.startAll(activities, function (err) {
                expect(err).to.exist;
                done();
            });
        });

        it('takes an array with activities without callback', function (done) {
            var def = activityDefinition[0];
            var exec = new Bpmn.ActivityExecution(def);
            var activities = ActivityHelper.getActivitiesByType(def, 'startEvent');

            exec.once('start', function (e) {
                done();
            });

            exec.startAll(activities);
        });

        it('emits error event if passed activities without type, no callback', function (done) {
            var def = activityDefinition[0];
            var exec = new Bpmn.ActivityExecution(def);
            var activities = ActivityHelper.getActivitiesByType(def, 'startEvent');

            delete activities[0].type;

            exec.once('error', function (e) {
                done();
            });

            exec.startAll(activities);
        });
    });

    describe('#executeActivity', function () {
        it('takes an activityDefinition and creates an ActivityExecution', function (done) {
            var def = activityDefinition[0];
            var exec = new Bpmn.ActivityExecution(def);
            var activity = ActivityHelper.getActivityById(def, 'theStart');

            exec.executeActivity(activity, null, function (err, activityExecution) {
                expect(err).to.not.exist;
                expect(activityExecution).to.exist;
                expect(activityExecution).to.be.instanceof(Bpmn.ActivityExecution);
                done();
            });
        });

        it('creates an ActivityExecution that is not started', function (done) {
            var def = activityDefinition[0];
            var exec = new Bpmn.ActivityExecution(def);
            var activity = ActivityHelper.getActivityById(def, 'theStart');

            exec.executeActivity(activity, null, function (err, activityExecution) {
                expect(err).to.not.exist;
                expect(activityExecution.startDate).to.not.exist;
                done();
            });
        });

        it('creates an ActivityExecution with current as parent', function (done) {
            var def = activityDefinition[0];
            var exec = new Bpmn.ActivityExecution(def);
            var activity = ActivityHelper.getActivityById(def, 'theStart');

            exec.executeActivity(activity, null, function (err, activityExecution) {
                expect(err).to.not.exist;
                expect(activityExecution.parent).to.not.eql(exec);
                done();
            });
        });

        it('throws an error if not passed callback', function (done) {
            var fn = function () {
                var def = activityDefinition[0];
                var exec = new Bpmn.ActivityExecution(def);
                var activity = ActivityHelper.getActivityById(def, 'theStart');
                exec.executeActivity(activity);
            };

            expect(fn).to.throw(Error);
            done();
        });
    });

    describe('#takeAll', function () {
        it('with null sequenceFlows return error in callback', function (done) {
            var def = activityDefinition[0];
            var exec = new Bpmn.ActivityExecution(def);
            var activity = ActivityHelper.getActivityById(def, 'theStart');

            exec.takeAll(null, function (err) {
                expect(err).to.exist;
                done();
            });
        });

        it('with [] sequenceFlows return error in callback', function (done) {
            var def = activityDefinition[0];
            var exec = new Bpmn.ActivityExecution(def);

            exec.takeAll([], function (err) {
                expect(err).to.exist;
                done();
            });
        });

        it('with [] sequenceFlows return emits error if no callback', function (done) {
            var def = activityDefinition[0];
            var exec = new Bpmn.ActivityExecution(def);

            exec.once('error', function () {
                done();
            });

            exec.takeAll([]);
        });

        it('on activity with bad sequenceFlow emits error', function (done) {
            var def = activityDefinition[0];
            var exec = new Bpmn.ActivityExecution(def);

            var activity = ActivityHelper.getActivityById(def, 'theStart');
            var sequenceFlows = ActivityHelper.getSequenceFlows(activity, def);
            sequenceFlows[0].targetRef = 'wrongTurn';

            exec.once('error', function (e) {
                done();
            });

            exec.start();
        });

        it('on activity with sequenceFlow pointing at bad activity emits error', function (done) {
            var def = activityDefinition[0];
            var exec = new Bpmn.ActivityExecution(def);

            var toActivity = ActivityHelper.getActivityById(def, 'decision');
            delete toActivity.type;

            exec.once('error', function (e) {
                done();
            });

            exec.start();
        });

    });
    describe('#signal', function () {
        var signalActivityDefinition;
        var osignalActivityDefinition;
        var userTaskXml = '<?xml version="1.0" encoding="UTF-8"?>' +
            '<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" ' +
            'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
            '<process id="theProcess" isExecutable="true">' +
            '<startEvent id="theStart" />' +
            '<userTask id="userTask" />' +
            '<endEvent id="theEnd" />' +
            '<sequenceFlow id="flow1" sourceRef="theStart" targetRef="userTask" />' +
            '<sequenceFlow id="flow2" sourceRef="userTask" targetRef="theEnd" />' +
            '</process>' +
            '</definitions>';

        before(function (done) {
            var bpmnDom;
            try {
                bpmnDom = DOMParser.parseFromString(userTaskXml);
            } catch (err) {
                expect(err).to.not.exist;
            }

            transformer.transform(bpmnDom, true, function (err, bpmnObject) {
                osignalActivityDefinition = bpmnObject;
                done();
            });
        });
        beforeEach(function (done) {
            signalActivityDefinition = Hoek.clone(osignalActivityDefinition);
            done();
        });

        it('parent execution with activity that has ended emits error', function (done) {
            var def = activityDefinition[0];
            var exec = new Bpmn.ActivityExecution(def);

            exec.once('error', function (e) {
                if (e.activity.activityDefinition.id === 'decision') {
                    done();
                }
            });

            exec.on('end', function (e) {
                if (e.id === 'end2') {
                    exec.signal('decision');
                }
            });

            exec.start();
        });

        it('parent execution with activity that has ended returns error in callback', function (done) {
            var def = activityDefinition[0];
            var exec = new Bpmn.ActivityExecution(def);

            exec.on('end', function (e) {
                if (e.id === 'end2') {
                    exec.signal('decision', function (err) {
                        expect(err).to.exist;
                        done();
                    });
                }
            });

            exec.start();
        });

        it('can be called with activity id on parent execution', function (done) {
            var def = signalActivityDefinition[0];
            var exec = new Bpmn.ActivityExecution(def);

            exec.on('end', function (e) {
                if (e.id === 'userTask') {
                    done();
                }
            });
            exec.on('start', function (e) {
                if (e.id === 'userTask') {
                    exec.signal('userTask');
                }
            });

            exec.start();
        });

        it('can be called with activity id and callback on parent execution', function (done) {
            var def = signalActivityDefinition[0];
            var exec = new Bpmn.ActivityExecution(def);

            exec.on('end', function (e) {
                if (e.id === 'userTask') {
                    done();
                }
            });
            exec.on('start', function (e) {
                if (e.id === 'userTask') {
                    exec.signal('userTask', function (err) {
                        expect(err).to.not.exist;
                    });
                }
            });

            exec.start();
        });

        it('can be called on activityDefinition with callback', function (done) {
            var def = signalActivityDefinition[0];
            var exec = new Bpmn.ActivityExecution(def);

            exec.on('end', function (e) {
                if (e.id === 'userTask') {
                    done();
                }
            });
            exec.on('start', function (e) {
                if (e.id === 'userTask') {
                    exec.getActivityExecutionById('userTask', function (err, execution) {
                        execution.signal(function (err) {
                            expect(err).to.not.exist;
                        });
                    });
                }
            });

            exec.start();
        });

        it('returns error in callback if called on ended activity', function (done) {
            var def = signalActivityDefinition[0];
            var exec = new Bpmn.ActivityExecution(def);

            exec.on('start', function (e) {
                if (e.id === 'userTask') {
                    exec.getActivityExecutionById('userTask', function (err, execution) {
                        execution.once('end', function () {
                            execution.signal(function (err) {
                                expect(err).to.exist;
                                done();
                            });
                        });

                        execution.signal(function (err) {
                            expect(err).to.not.exist;
                        });
                    });
                }
            });

            exec.start();
        });

        it('emits error if called on ended activity', function (done) {
            var def = signalActivityDefinition[0];
            var exec = new Bpmn.ActivityExecution(def);

            exec.once('error', function (e) {
                if (e.activity.activityDefinition.id === 'userTask') {
                    done();
                }
            });
            
            exec.on('start', function (e) {
                if (e.id === 'userTask') {
                    exec.getActivityExecutionById('userTask', function (err, execution) {
                        execution.once('end', function () {
                            execution.signal();
                        });

                        execution.signal(function (err) {
                            expect(err).to.not.exist;
                        });
                    });
                }
            });

            exec.start();
        });

        it('can be called on activityDefinition without callback', function (done) {
            var def = signalActivityDefinition[0];
            var exec = new Bpmn.ActivityExecution(def);

            exec.on('end', function (e) {
                if (e.id === 'userTask') {
                    done();
                }
            });
            exec.on('start', function (e) {
                if (e.id === 'userTask') {
                    exec.getActivityExecutionById('userTask', function (err, execution) {
                        execution.signal();
                    });
                }
            });

            exec.start();
        });
    });
});
