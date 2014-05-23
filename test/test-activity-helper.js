/*jshint expr:true */

var Lab = require('lab');
var DOMParser = require('xmldom').DOMParser;
var Util = require('util');

var Bpmn = require('..');

var expect = Lab.expect;
var before = Lab.before;
// var beforeEach = Lab.beforeEach;
// var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;

describe('activity-helper', function () {
    describe('static', function () {
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

        describe('#getActivitiesByType', function () {
            it('with activityDefinition with empty baseElements returns nothing', function (done) {
                var bpmnDom = new DOMParser().parseFromString(processXml);

                transformer.transform(bpmnDom, true, function (err, defs) {
                    expect(err).to.not.exist;

                    var def = defs[0];
                    def.baseElements = [];
                    var elms = Bpmn.ActivityHelper.getActivitiesByType(def, 'endEvent');
                    expect(elms).to.be.empty;
                    done();
                });
            });

            it('with activityDefinition without baseElements returns nothing', function (done) {
                var bpmnDom = new DOMParser().parseFromString(processXml);

                transformer.transform(bpmnDom, true, function (err, defs) {
                    expect(err).to.not.exist;

                    var def = defs[0];
                    delete def.baseElements;
                    var elms = Bpmn.ActivityHelper.getActivitiesByType(def, 'endEvent');
                    expect(elms).to.be.empty;
                    done();
                });
            });

            it('without activityDefinition returns nothing', function (done) {
                var elms = Bpmn.ActivityHelper.getActivitiesByType(null, 'endEvent');
                expect(elms).to.be.empty;
                done();
            });

            it('with baseElement without type returns ok', function (done) {
                var bpmnDom = new DOMParser().parseFromString(processXml);

                transformer.transform(bpmnDom, true, function (err, defs) {
                    expect(err).to.not.exist;

                    var def = defs[0];
                    delete def.baseElements[0].type;
                    var elms = Bpmn.ActivityHelper.getActivitiesByType(def, 'endEvent');
                    expect(elms).not.to.be.empty;
                    done();
                });
            });

            it('with recursive returns ok', function (done) {
                var bpmnDom = new DOMParser().parseFromString(processXml);

                transformer.transform(bpmnDom, true, function (err, defs) {
                    expect(err).to.not.exist;

                    var def = defs[0];
                    delete def.baseElements[0].type;
                    var elms = Bpmn.ActivityHelper.getActivitiesByType(def, 'endEvent', true);
                    expect(elms).not.to.be.empty;
                    done();
                });
            });

        });

        describe('#getActivityById', function () {
            it('with activityDefinition with empty baseElements returns nothing', function (done) {
                var bpmnDom = new DOMParser().parseFromString(processXml);

                transformer.transform(bpmnDom, true, function (err, defs) {
                    expect(err).to.not.exist;

                    var def = defs[0];
                    def.baseElements = [];
                    var elms = Bpmn.ActivityHelper.getActivityById(def, 'theStart');
                    expect(elms).to.eql(null);
                    done();
                });
            });

            it('with activityDefinition without baseElements returns nothing', function (done) {
                var bpmnDom = new DOMParser().parseFromString(processXml);

                transformer.transform(bpmnDom, true, function (err, defs) {
                    expect(err).to.not.exist;

                    var def = defs[0];
                    delete def.baseElements;
                    var elms = Bpmn.ActivityHelper.getActivityById(def, 'theStart');
                    expect(elms).to.eql(null);
                    done();
                });
            });

            it('without activityDefinition returns nothing', function (done) {
                var elms = Bpmn.ActivityHelper.getActivityById(null, 'theStart');
                expect(elms).to.eql(null);
                done();
            });

            it('with baseElement without id returns ok', function (done) {
                var bpmnDom = new DOMParser().parseFromString(processXml);

                transformer.transform(bpmnDom, true, function (err, defs) {
                    expect(err).to.not.exist;

                    var def = defs[0];
                    delete def.baseElements[0].id;
                    var elms = Bpmn.ActivityHelper.getActivityById(def, 'end1');
                    expect(elms).to.exist;
                    done();
                });
            });
        });

        describe('#getSequenceFlows', function () {
            it('without scopeActivity returns nothing', function (done) {
                var elms = Bpmn.ActivityHelper.getSequenceFlows(null);
                expect(elms).to.be.empty;
                done();
            });

            it('with activityDefinition and scopeActivity returns ok', function (done) {
                var bpmnDom = new DOMParser().parseFromString(processXml);

                transformer.transform(bpmnDom, true, function (err, defs) {
                    expect(err).to.not.exist;

                    var scope = defs[0];
                    var def = Bpmn.ActivityHelper.getActivityById(scope, 'theStart');
                    
                    var elms = Bpmn.ActivityHelper.getSequenceFlows(def, scope);
                    expect(elms).not.to.be.empty;
                    done();
                });
            });

            it('with activityDefinition and without scope returns empty', function (done) {
                var bpmnDom = new DOMParser().parseFromString(processXml);

                transformer.transform(bpmnDom, true, function (err, defs) {
                    expect(err).to.not.exist;

                    var scope = defs[0];
                    var def = Bpmn.ActivityHelper.getActivityById(scope, 'theStart');

                    var elms = Bpmn.ActivityHelper.getSequenceFlows(def);
                    expect(elms).to.be.empty;
                    done();
                });
            });

            it('with activityDefinition without outgoing returns nothing', function (done) {
                var bpmnDom = new DOMParser().parseFromString(processXml);

                transformer.transform(bpmnDom, true, function (err, defs) {
                    expect(err).to.not.exist;

                    var scope = defs[0];
                    var def = Bpmn.ActivityHelper.getActivityById(scope, 'theStart');

                    delete def.outgoing;
                    var elms = Bpmn.ActivityHelper.getSequenceFlows(def, scope);
                    expect(elms).to.be.empty;
                    done();
                });
            });
        });
    });
});
