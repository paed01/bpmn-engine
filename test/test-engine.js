/*jshint expr:true es5:true */

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

describe('engine', function () {
    it('Bpmn exposes executor module', function (done) {
        expect(Bpmn).to.have.property('Engine');
        done();
    });
    
    describe('#ctor', function () {
        it('takes activityExecution as module and transformer as instance', function(done) {
            var transformer = new Bpmn.Transformer();
            var engine = new Bpmn.Engine(Bpmn.ActivityExecution, transformer);
            
            expect(engine.executor).to.exist;
            expect(engine.transformer).to.exist;
            
            expect(engine.executor).to.be.a('function');
            expect(engine.transformer).to.be.an('object');
            expect(engine.transformer).to.be.instanceof(Bpmn.Transformer);
            
            done();
        });
        
        it('takes only activityExecution and instanciates own transformer', function(done) {
            var transformer = new Bpmn.Transformer();
            var engine = new Bpmn.Engine(Bpmn.ActivityExecution);
            
            expect(engine.executor).to.exist;
            expect(engine.transformer).to.exist;
            
            expect(engine.executor).to.be.a('function');
            expect(engine.transformer).to.be.an('object');
            expect(engine.transformer).to.be.instanceof(Bpmn.Transformer);
            
            done();
        })

        it('takes no arguments and returns object with executor and transformer', function(done) {
            var transformer = new Bpmn.Transformer();
            var engine = new Bpmn.Engine();
            
            expect(engine.executor).to.exist;
            expect(engine.transformer).to.exist;
            
            expect(engine.executor).to.be.a('function');
            expect(engine.transformer).to.be.an('object');
            expect(engine.transformer).to.be.instanceof(Bpmn.Transformer);
            
            done();
        })
    });
    
    describe('#startInstance', function () {
        // var transformer = new Bpmn.Transformer();
        // var engine = new Bpmn.Engine(Bpmn.ActivityExecution, transformer);
        var engine = new Bpmn.Engine();
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

        it('returns error in callback if no activity definition', function (done) {
            engine.startInstance(null, null, null, function (err) {
                expect(err).to.exist;
                done();
            });
        });

        it('returns error in callback if passed array as source', function (done) {
            engine.startInstance([], null, null, function (err) {
                expect(err).to.exist;
                done();
            });
        });

        it('returns error in callback if activity definition is empty string', function (done) {
            engine.startInstance('', null, null, function (err) {
                expect(err).to.exist;
                done();
            });
        });

        it('returns activity execution if definition is string', function (done) {
            engine.startInstance(processXml, null, null, function (err, execution) {
                expect(err).to.not.exist;
                expect(execution).to.exist;
                expect(execution.start).to.be.a('function');
                done();
            });
        });

        it('returns activity execution if definition is Buffer', function (done) {
            var buff = new Buffer(processXml);
            engine.startInstance(buff, null, null, function (err, execution) {
                expect(err).to.not.exist;
                expect(execution).to.exist;
                expect(execution.start).to.be.a('function');
                done();
            });
        });

        it('returns error in callback if activity definition source is function', function (done) {
            engine.startInstance(function() {}, null, null, function (err) {
                expect(err).to.exist;
                done();
            });
        });

        it('returns error in callback if activity definition source is undefined', function (done) {
            engine.startInstance(undefined, null, null, function (err) {
                expect(err).to.exist;
                done();
            });
        });

        it('returns error in callback if not well formatted xml', function (done) {
            engine.startInstance(new Buffer('jdalsk'), null, null, function (err) {
                expect(err).to.exist;
                done();
            });
        });

        it('returns error in callback if file not found', function (done) {
            engine.startInstance('jdalsk', null, null, function (err) {
                expect(err).to.exist;
                done();
            });
        });
    });

    describe('original tests', function () {
        var transformer = new Bpmn.Transformer();
        var engine = new Bpmn.Engine(Bpmn.ActivityExecution, transformer);

        describe('exclusivegateway', function () {

            it('should support one diverging flow without a condition', function (done) {

                var processXml = '<?xml version="1.0" encoding="UTF-8"?>' +
                        '<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" ' +
                        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
                        '<process id="theProcess" isExecutable="true">' +
                        '  <startEvent id="theStart" />' +
                        '  <exclusiveGateway id="decision" />' +
                        '  <endEvent id="end" />' +
                        '  <sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />' +
                        '  <sequenceFlow id="flow2" sourceRef="decision" targetRef="end" />' +
                        '</process>' +
                        '</definitions>';

                engine.startInstance(processXml, null, null, function (err, execution) {
                    execution.on('end', function (e) {
                        if (e.id === 'theProcess') {
                            expect(execution.isEnded).to.eql(true);

                            var processInstance = execution.getActivityInstance();

                            expect(processInstance.activities.length).to.eql(3);
                            expect(processInstance.activities[0].activityId).to.eql("theStart");
                            expect(processInstance.activities[1].activityId).to.eql("decision");
                            expect(processInstance.activities[2].activityId).to.eql("end");
                            done();
                        }
                    });

                    expect(err).to.not.exist;
                    expect(execution).to.exist;
                });
            });

            it('should not support a single diverging flow with a condition', function (done) {

                var processXml = '<?xml version="1.0" encoding="UTF-8"?>' +
                        '<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" ' +
                        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
                        '<process id="theProcess" isExecutable="true">' +
                        '<startEvent id="theStart" />' +
                        '<exclusiveGateway id="decision" />' +
                        '<endEvent id="end" />' +
                        '<sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />' +
                        '<sequenceFlow id="flow2" sourceRef="decision" targetRef="end">' +
                        '<conditionExpression xsi:type="tFormalExpression"><![CDATA[' +
                        'this.input <= 50 ' +
                        ']]></conditionExpression>' +
                        '</sequenceFlow>' +
                        '</process>' +
                        '</definitions>';

                engine.startInstance(processXml, null, null, function (err) {
                    expect(err).to.exist;
                    done();
                });
            });

            it('should not support multiple diverging flows without conditions', function (done) {

                // if there multiple outgoing sequence flows without conditions, an exception is thrown at deploy time,
                // even if one of them is the default flow

                var processXml = '<?xml version="1.0" encoding="UTF-8"?>' +
                        '<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" ' +
                        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +

                        '<process id="theProcess" isExecutable="true">' +

                        '<startEvent id="theStart" />' +
                        '<exclusiveGateway id="decision" />' +
                        '<endEvent id="end1" />' +
                        '<endEvent id="end2" />' +

                        '<sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />' +
                        '<sequenceFlow id="flow2" sourceRef="decision" targetRef="end1" />' +
                        '<sequenceFlow id="flow3" sourceRef="decision" targetRef="end2" />' +

                        '</process>' +

                        '</definitions>';

                engine.startInstance(processXml, null, null, function (err) {
                    expect(err).to.exist;
                    done();
                });

            });

            it('should support two diverging flows with conditions, case 10', function (done) {

                // case 1: input  = 10 -> the upper sequenceflow is taken

                var processXml = '<?xml version="1.0" encoding="UTF-8"?>' +
                        '<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" ' +
                        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +

                        '<process id="theProcess" isExecutable="true">' +

                        '<startEvent id="theStart" />' +
                        '<exclusiveGateway id="decision" />' +
                        '<endEvent id="end1" />' +
                        '<endEvent id="end2" />' +

                        '<sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />' +
                        '<sequenceFlow id="flow2" sourceRef="decision" targetRef="end1">' +
                        '<conditionExpression xsi:type="tFormalExpression"><![CDATA[' +
                        'this.input <= 50 ' +
                        ']]></conditionExpression>' +
                        '</sequenceFlow>' +
                        '<sequenceFlow id="flow3" sourceRef="decision" targetRef="end2">' +
                        '<conditionExpression xsi:type="tFormalExpression"><![CDATA[' +
                        'this.input > 50 ' +
                        ']]></conditionExpression>' +
                        '</sequenceFlow>' +

                        '</process>' +

                        '</definitions>';

                engine.startInstance(processXml, {
                    input : 10
                }, null, function (err, execution) {
                    execution.on('end', function (e) {
                        if (e.id === 'theProcess') {
                            expect(execution.isEnded).to.eql(true);

                            var processInstance = execution.getActivityInstance();

                            expect(processInstance.activities.length).to.eql(3);
                            expect(processInstance.activities[0].activityId).to.eql("theStart");
                            expect(processInstance.activities[1].activityId).to.eql("decision");
                            expect(processInstance.activities[2].activityId).to.eql("end1");
                            done();
                        }
                    });

                    expect(err).to.not.exist;
                    expect(execution).to.exist;
                });
            });

            it('should support two diverging flows with conditions, case 100', function (done) {

                // case 2: input  = 100 -> the lower sequenceflow is taken

                var processXml = new Buffer('<?xml version="1.0" encoding="UTF-8"?>' +
                        '<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" ' +
                        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +

                        '<process id="theProcess" isExecutable="true">' +

                        '<startEvent id="theStart" />' +
                        '<exclusiveGateway id="decision" />' +
                        '<endEvent id="end1" />' +
                        '<endEvent id="end2" />' +

                        '<sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />' +
                        '<sequenceFlow id="flow2" sourceRef="decision" targetRef="end1">' +
                        '<conditionExpression xsi:type="tFormalExpression"><![CDATA[' +
                        'this.input <= 50 ' +
                        ']]></conditionExpression>' +
                        '</sequenceFlow>' +
                        '<sequenceFlow id="flow3" sourceRef="decision" targetRef="end2">' +
                        '<conditionExpression xsi:type="tFormalExpression"><![CDATA[' +
                        'this.input > 50 ' +
                        ']]></conditionExpression>' +
                        '</sequenceFlow>' +

                        '</process>' +

                        '</definitions>');

                engine.startInstance(processXml, {
                    input : 100
                }, null, function (err, execution) {
                    execution.on('end', function (e) {
                        if (e.id === 'theProcess') {
                            expect(execution.isEnded).to.eql(true);

                            var processInstance = execution.getActivityInstance();

                            expect(processInstance.activities.length).to.eql(3);
                            expect(processInstance.activities[0].activityId).to.eql("theStart");
                            expect(processInstance.activities[1].activityId).to.eql("decision");
                            expect(processInstance.activities[2].activityId).to.eql("end2");
                            done();
                        }
                    });

                    expect(err).to.not.exist;
                    expect(execution).to.exist;
                });
            });

        });

        describe('parallelgateway', function () {
            it('should fork multiple diverging flows', function (done) {
                var processXml = new Buffer('<?xml version="1.0" encoding="UTF-8"?>' +
                        '<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" ' +
                        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
                        '<process id="theProcess" isExecutable="true">' +
                        '<startEvent id="theStart" />' +
                        '<parallelGateway id="fork" />' +
                        '<endEvent id="end1" />' +
                        '<endEvent id="end2" />' +
                        '<sequenceFlow id="flow1" sourceRef="theStart" targetRef="fork" />' +
                        '<sequenceFlow id="flow2" sourceRef="fork" targetRef="end1" />' +
                        '<sequenceFlow id="flow3" sourceRef="fork" targetRef="end2" />' +
                        '</process>' +
                        '</definitions>');

                engine.startInstance(processXml, {
                    input : 10
                }, null, function (err, execution) {
                    execution.on('end', function (e) {
                        if (e.id === 'theProcess') {
                            expect(execution.isEnded).to.eql(true);

                            var processInstance = execution.getActivityInstance();

                            expect(processInstance.activities.length).to.eql(4);
                            expect(processInstance.activities[0].activityId).to.eql("theStart");
                            expect(processInstance.activities[1].activityId).to.eql("fork");
                            expect(processInstance.activities[2].activityId).to.eql("end1");
                            expect(processInstance.activities[3].activityId).to.eql("end2");

                            done();
                        }
                    });

                    expect(err).to.not.exist;
                    expect(execution).to.exist;
                });

            });

            it('should join multiple converging flows', function (done) {
                var processXml = new Buffer('<?xml version="1.0" encoding="UTF-8"?>' +
                        '<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" ' +
                        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
                        '<process id="theProcess" isExecutable="true">' +
                        '<startEvent id="theStart" />' +
                        '<parallelGateway id="fork" />' +
                        '<parallelGateway id="join" />' +
                        '<endEvent id="end" />' +
                        '<sequenceFlow id="flow1" sourceRef="theStart" targetRef="fork" />' +
                        '<sequenceFlow id="flow2" sourceRef="fork" targetRef="join" />' +
                        '<sequenceFlow id="flow3" sourceRef="fork" targetRef="join" />' +
                        '<sequenceFlow id="flow4" sourceRef="join" targetRef="end" />' +
                        '</process>' +
                        '</definitions>');

                engine.startInstance(processXml, {
                    input : 10
                }, null, function (err, execution) {
                    execution.on('end', function (e) {
                        if (e.id === 'theProcess') {
                            expect(execution.isEnded).to.eql(true);

                            var processInstance = execution.getActivityInstance();

                            expect(processInstance.activities.length).to.eql(5);
                            expect(processInstance.activities[0].activityId).to.eql("theStart");
                            expect(processInstance.activities[1].activityId).to.eql("fork");
                            expect(processInstance.activities[2].activityId).to.eql("join");
                            expect(processInstance.activities[3].activityId).to.eql("join");
                            expect(processInstance.activities[4].activityId).to.eql("end");

                            done();
                        }
                    });

                    expect(err).to.not.exist;
                    expect(execution).to.exist;
                });
            });
        });

        describe('sequenceFlow', function () {

            it('should not support the default flow if there are no conditional flows', function (done) {
                var processXml = new Buffer('<?xml version="1.0" encoding="UTF-8"?>' +
                        '<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" ' +
                        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
                        '<process id="theProcess" isExecutable="true">' +
                        '<startEvent id="theStart" default="flow1" />' +
                        '<endEvent id="theEnd" />' +
                        '<sequenceFlow id="flow1" sourceRef="theStart" targetRef="theEnd" />' +
                        '</process>' +
                        '</definitions>');

                engine.startInstance(processXml, null, null, function (err) {
                    expect(err).to.exist;
                    expect(err.message).to.eql("Activity with id 'theStart' declares default flow with id 'flow1' but has no conditional flows.");
                    done();
                });

                // expect(t).toThrow();

            });

            it('should support the default flow in combination with multiple conditional flows, case 1', function (done) {

                var processXml = new Buffer('<?xml version="1.0" encoding="UTF-8"?>' +
                        '<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" ' +
                        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +

                        '<process id="theProcess" isExecutable="true">' +

                        '<startEvent id="theStart" default="flow1" />' +
                        '<endEvent id="theEnd1" />' +
                        '<endEvent id="theEnd2" />' +
                        '<endEvent id="theEnd3" />' +

                        '<sequenceFlow id="flow1" sourceRef="theStart" targetRef="theEnd1" />' +
                        '<sequenceFlow id="flow2" sourceRef="theStart" targetRef="theEnd2">' +
                        '<conditionExpression xsi:type="tFormalExpression"><![CDATA[' +
                        'this.input <= 50 ' +
                        ']]></conditionExpression>' +
                        '</sequenceFlow>' +
                        '<sequenceFlow id="flow3" sourceRef="theStart" targetRef="theEnd3">' +
                        '<conditionExpression xsi:type="tFormalExpression"><![CDATA[' +
                        'this.input <= 20 ' +
                        ']]></conditionExpression>' +
                        '</sequenceFlow>' +

                        '</process>' +

                        '</definitions>');

                engine.startInstance(processXml, {
                    input : 10
                }, null, function (err, execution) {
                    execution.on('end', function (e) {
                        if (e.id === 'theProcess') {
                            expect(execution.isEnded).to.eql(true);

                            var processInstance = execution.getActivityInstance();

                            expect(processInstance.activities.length).to.eql(3);
                            expect(processInstance.activities[0].activityId).to.eql("theStart");
                            expect(processInstance.activities[1].activityId).to.eql("theEnd2");
                            expect(processInstance.activities[2].activityId).to.eql("theEnd3");
                            done();
                        }
                    });

                    expect(err).to.not.exist;
                    expect(execution).to.exist;
                });

            });

            it('should support the default flow in combination with multiple conditional flows, case 2', function (done) {

                var processXml = new Buffer('<?xml version="1.0" encoding="UTF-8"?>' +
                        '<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" ' +
                        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +

                        '<process id="theProcess" isExecutable="true">' +

                        '<startEvent id="theStart" default="flow1" />' +
                        '<endEvent id="theEnd1" />' +
                        '<endEvent id="theEnd2" />' +
                        '<endEvent id="theEnd3" />' +

                        '<sequenceFlow id="flow1" sourceRef="theStart" targetRef="theEnd1" />' +
                        '<sequenceFlow id="flow2" sourceRef="theStart" targetRef="theEnd2">' +
                        '<conditionExpression xsi:type="tFormalExpression"><![CDATA[' +
                        'this.input <= 50 ' +
                        ']]></conditionExpression>' +
                        '</sequenceFlow>' +
                        '<sequenceFlow id="flow3" sourceRef="theStart" targetRef="theEnd3">' +
                        '<conditionExpression xsi:type="tFormalExpression"><![CDATA[' +
                        'this.input <= 20 ' +
                        ']]></conditionExpression>' +
                        '</sequenceFlow>' +

                        '</process>' +

                        '</definitions>');

                engine.startInstance(processXml, {
                    input : 40
                }, null, function (err, execution) {
                    execution.on('end', function (e) {
                        if (e.id === 'theProcess') {
                            expect(execution.isEnded).to.eql(true);

                            var processInstance = execution.getActivityInstance();

                            expect(processInstance.activities.length).to.eql(2);
                            expect(processInstance.activities[0].activityId).to.eql("theStart");
                            expect(processInstance.activities[1].activityId).to.eql("theEnd2");
                            done();
                        }
                    });

                    expect(err).to.not.exist;
                    expect(execution).to.exist;
                });
            });

            it('should support the default flow in combination with multiple conditional flows, case 3', function (done) {

                var processXml = new Buffer('<?xml version="1.0" encoding="UTF-8"?>' +
                        '<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" ' +
                        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +

                        '<process id="theProcess" isExecutable="true">' +

                        '<startEvent id="theStart" default="flow1" />' +
                        '<endEvent id="theEnd1" />' +
                        '<endEvent id="theEnd2" />' +
                        '<endEvent id="theEnd3" />' +

                        '<sequenceFlow id="flow1" sourceRef="theStart" targetRef="theEnd1" />' +
                        '<sequenceFlow id="flow2" sourceRef="theStart" targetRef="theEnd2">' +
                        '<conditionExpression xsi:type="tFormalExpression"><![CDATA[' +
                        'this.input <= 50 ' +
                        ']]></conditionExpression>' +
                        '</sequenceFlow>' +
                        '<sequenceFlow id="flow3" sourceRef="theStart" targetRef="theEnd3">' +
                        '<conditionExpression xsi:type="tFormalExpression"><![CDATA[' +
                        'this.input <= 20 ' +
                        ']]></conditionExpression>' +
                        '</sequenceFlow>' +

                        '</process>' +

                        '</definitions>');

                engine.startInstance(processXml, {
                    input : 100
                }, null, function (err, execution) {
                    execution.on('end', function (e) {
                        if (e.id === 'theProcess') {
                            expect(execution.isEnded).to.eql(true);

                            var processInstance = execution.getActivityInstance();

                            expect(processInstance.activities.length).to.eql(2);
                            expect(processInstance.activities[0].activityId).to.eql("theStart");
                            expect(processInstance.activities[1].activityId).to.eql("theEnd1");
                            done();
                        }
                    });

                    expect(err).to.not.exist;
                    expect(execution).to.exist;
                });
            });

            it('should support the default flow in combination with multiple conditional and unconditional flows, case 1', function (done) {

                var processXml = new Buffer('<?xml version="1.0" encoding="UTF-8"?>' +
                        '<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" ' +
                        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +

                        '<process id="theProcess" isExecutable="true">' +

                        '<startEvent id="theStart" default="flow1" />' +
                        '<endEvent id="theEnd1" />' +
                        '<endEvent id="theEnd2" />' +
                        '<endEvent id="theEnd3" />' +
                        '<endEvent id="theEnd4" />' +

                        '<sequenceFlow id="flow1" sourceRef="theStart" targetRef="theEnd1" />' +
                        '<sequenceFlow id="flow2" sourceRef="theStart" targetRef="theEnd2">' +
                        '<conditionExpression xsi:type="tFormalExpression"><![CDATA[' +
                        'this.input <= 50 ' +
                        ']]></conditionExpression>' +
                        '</sequenceFlow>' +
                        '<sequenceFlow id="flow3" sourceRef="theStart" targetRef="theEnd3">' +
                        '<conditionExpression xsi:type="tFormalExpression"><![CDATA[' +
                        'this.input <= 20 ' +
                        ']]></conditionExpression>' +
                        '</sequenceFlow>' +
                        '<sequenceFlow id="flow4" sourceRef="theStart" targetRef="theEnd4" />' +

                        '</process>' +

                        '</definitions>');

                engine.startInstance(processXml, {
                    input : 10
                }, null, function (err, execution) {
                    execution.on('end', function (e) {
                        if (e.id === 'theProcess') {
                            expect(execution.isEnded).to.eql(true);

                            var processInstance = execution.getActivityInstance();

                            expect(processInstance.activities.length).to.eql(4);
                            expect(processInstance.activities[0].activityId).to.eql("theStart");
                            expect(processInstance.activities[1].activityId).to.eql("theEnd2");
                            expect(processInstance.activities[2].activityId).to.eql("theEnd3");
                            expect(processInstance.activities[3].activityId).to.eql("theEnd4");
                            done();
                        }
                    });

                    expect(err).to.not.exist;
                    expect(execution).to.exist;
                });
            });

            it('should support the default flow in combination with multiple conditional and unconditional flows, case 2', function (done) {

                var processXml = new Buffer('<?xml version="1.0" encoding="UTF-8"?>' +
                        '<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" ' +
                        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +

                        '<process id="theProcess" isExecutable="true">' +

                        '<startEvent id="theStart" default="flow1" />' +
                        '<endEvent id="theEnd1" />' +
                        '<endEvent id="theEnd2" />' +
                        '<endEvent id="theEnd3" />' +
                        '<endEvent id="theEnd4" />' +

                        '<sequenceFlow id="flow1" sourceRef="theStart" targetRef="theEnd1" />' +
                        '<sequenceFlow id="flow2" sourceRef="theStart" targetRef="theEnd2">' +
                        '<conditionExpression xsi:type="tFormalExpression"><![CDATA[' +
                        'this.input <= 50 ' +
                        ']]></conditionExpression>' +
                        '</sequenceFlow>' +
                        '<sequenceFlow id="flow3" sourceRef="theStart" targetRef="theEnd3">' +
                        '<conditionExpression xsi:type="tFormalExpression"><![CDATA[' +
                        'this.input <= 20 ' +
                        ']]></conditionExpression>' +
                        '</sequenceFlow>' +
                        '<sequenceFlow id="flow4" sourceRef="theStart" targetRef="theEnd4" />' +

                        '</process>' +

                        '</definitions>');

                engine.startInstance(processXml, {
                    input : 40
                }, null, function (err, execution) {
                    execution.on('end', function (e) {
                        if (e.id === 'theProcess') {
                            expect(execution.isEnded).to.eql(true);

                            var processInstance = execution.getActivityInstance();

                            expect(processInstance.activities.length).to.eql(3);
                            expect(processInstance.activities[0].activityId).to.eql("theStart");
                            expect(processInstance.activities[1].activityId).to.eql("theEnd2");
                            expect(processInstance.activities[2].activityId).to.eql("theEnd4");
                            done();
                        }
                    });

                    expect(err).to.not.exist;
                    expect(execution).to.exist;
                });
            });

            it('should support the default flow in combination with multiple conditional and unconditional flows, case 3', function (done) {

                var processXml = new Buffer('<?xml version="1.0" encoding="UTF-8"?>' +
                        '<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" ' +
                        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +

                        '<process id="theProcess" isExecutable="true">' +

                        '<startEvent id="theStart" default="flow1" />' +
                        '<endEvent id="theEnd1" />' +
                        '<endEvent id="theEnd2" />' +
                        '<endEvent id="theEnd3" />' +
                        '<endEvent id="theEnd4" />' +

                        '<sequenceFlow id="flow1" sourceRef="theStart" targetRef="theEnd1" />' +
                        '<sequenceFlow id="flow2" sourceRef="theStart" targetRef="theEnd2">' +
                        '<conditionExpression xsi:type="tFormalExpression"><![CDATA[' +
                        'this.input <= 50 ' +
                        ']]></conditionExpression>' +
                        '</sequenceFlow>' +
                        '<sequenceFlow id="flow3" sourceRef="theStart" targetRef="theEnd3">' +
                        '<conditionExpression xsi:type="tFormalExpression"><![CDATA[' +
                        'this.input <= 20 ' +
                        ']]></conditionExpression>' +
                        '</sequenceFlow>' +
                        '<sequenceFlow id="flow4" sourceRef="theStart" targetRef="theEnd4" />' +

                        '</process>' +

                        '</definitions>');

                engine.startInstance(processXml, {
                    input : 100
                }, null, function (err, execution) {
                    execution.on('end', function (e) {
                        if (e.id === 'theProcess') {
                            expect(execution.isEnded).to.eql(true);

                            var processInstance = execution.getActivityInstance();

                            expect(processInstance.activities.length).to.eql(3);
                            expect(processInstance.activities[0].activityId).to.eql("theStart");
                            expect(processInstance.activities[1].activityId).to.eql("theEnd4");
                            expect(processInstance.activities[2].activityId).to.eql("theEnd1");
                            done();
                        }
                    });

                    expect(err).to.not.exist;
                    expect(execution).to.exist;
                });
            });

            it('should support multiple conditional flows, case 1', function (done) {
                var processXml = new Buffer('<?xml version="1.0" encoding="UTF-8"?>' +
                        '<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" ' +
                        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +

                        '<process id="theProcess" isExecutable="true">' +

                        '<startEvent id="theStart" />' +
                        '<endEvent id="theEnd1" />' +
                        '<endEvent id="theEnd2" />' +

                        '<sequenceFlow id="flow1" sourceRef="theStart" targetRef="theEnd1">' +
                        '<conditionExpression xsi:type="tFormalExpression"><![CDATA[' +
                        'this.input <= 50 ' +
                        ']]></conditionExpression>' +
                        '</sequenceFlow>' +
                        '<sequenceFlow id="flow2" sourceRef="theStart" targetRef="theEnd2">' +
                        '<conditionExpression xsi:type="tFormalExpression"><![CDATA[' +
                        'this.input <= 20 ' +
                        ']]></conditionExpression>' +
                        '</sequenceFlow>' +

                        '</process>' +

                        '</definitions>');

                engine.startInstance(processXml, {
                    input : 10
                }, null, function (err, execution) {
                    execution.on('end', function (e) {
                        if (e.id === 'theProcess') {
                            expect(execution.isEnded).to.eql(true);

                            var processInstance = execution.getActivityInstance();

                            expect(processInstance.activities.length).to.eql(3);
                            expect(processInstance.activities[0].activityId).to.eql("theStart");
                            expect(processInstance.activities[1].activityId).to.eql("theEnd1");
                            expect(processInstance.activities[2].activityId).to.eql("theEnd2");
                            done();
                        }
                    });

                    expect(err).to.not.exist;
                    expect(execution).to.exist;
                });
            });

            it('should support multiple conditional flows, case 2', function (done) {
                var processXml = new Buffer('<?xml version="1.0" encoding="UTF-8"?>' +
                        '<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" ' +
                        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +

                        '<process id="theProcess" isExecutable="true">' +

                        '<startEvent id="theStart" />' +
                        '<endEvent id="theEnd1" />' +
                        '<endEvent id="theEnd2" />' +

                        '<sequenceFlow id="flow1" sourceRef="theStart" targetRef="theEnd1">' +
                        '<conditionExpression xsi:type="tFormalExpression"><![CDATA[' +
                        'this.input <= 50 ' +
                        ']]></conditionExpression>' +
                        '</sequenceFlow>' +
                        '<sequenceFlow id="flow2" sourceRef="theStart" targetRef="theEnd2">' +
                        '<conditionExpression xsi:type="tFormalExpression"><![CDATA[' +
                        'this.input <= 20 ' +
                        ']]></conditionExpression>' +
                        '</sequenceFlow>' +

                        '</process>' +

                        '</definitions>');

                engine.startInstance(processXml, {
                    input : 40
                }, null, function (err, execution) {
                    execution.on('end', function (e) {
                        if (e.id === 'theProcess') {
                            expect(execution.isEnded).to.eql(true);

                            var processInstance = execution.getActivityInstance();

                            expect(processInstance.activities.length).to.eql(2);
                            expect(processInstance.activities[0].activityId).to.eql("theStart");
                            expect(processInstance.activities[1].activityId).to.eql("theEnd1");
                            done();
                        }
                    });

                    expect(err).to.not.exist;
                    expect(execution).to.exist;
                });

                // // case 2: input  = 100 -> no sequenceflow is taken.
                // // TODO: should this trigger an exception??

                // execution = new CAM.ActivityExecution(processDefinition);
                // execution.variables.input = 100;
                // execution.start();

                // expect(execution.isEnded).toBe(false);

                // processInstance = execution.getActivityInstance();
                // expect(processInstance.activities.length).toBe(1);
                // expect(processInstance.activities[0].activityId).toBe("theStart");

            });

            it('should support multiple conditional flows, case 3, emits error when no conditional flow is taken', function (done) {
                var processXml = new Buffer('<?xml version="1.0" encoding="UTF-8"?>' +
                        '<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" ' +
                        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +

                        '<process id="theProcess" isExecutable="true">' +

                        '<startEvent id="theStart" />' +
                        '<endEvent id="theEnd1" />' +
                        '<endEvent id="theEnd2" />' +

                        '<sequenceFlow id="flow1" sourceRef="theStart" targetRef="theEnd1">' +
                        '<conditionExpression xsi:type="tFormalExpression"><![CDATA[' +
                        'this.input <= 50 ' +
                        ']]></conditionExpression>' +
                        '</sequenceFlow>' +
                        '<sequenceFlow id="flow2" sourceRef="theStart" targetRef="theEnd2">' +
                        '<conditionExpression xsi:type="tFormalExpression"><![CDATA[' +
                        'this.input <= 20 ' +
                        ']]></conditionExpression>' +
                        '</sequenceFlow>' +

                        '</process>' +

                        '</definitions>');

                engine.startInstance(processXml, {
                    input : 100
                }, null, function (err, execution) {
                    execution.on('error', function (e) {
                        expect(execution.isEnded).to.eql(false);
                        var processInstance = execution.getActivityInstance();

                        expect(processInstance.activities.length).to.eql(1);
                        expect(processInstance.activities[0].activityId).to.eql("theStart");
                        done();
                    });

                    expect(err).to.not.exist;
                    expect(execution).to.exist;
                });
            });
        });

        describe('usertask', function () {
            var processXml = new Buffer('<?xml version="1.0" encoding="UTF-8"?>' +
                    '<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" ' +
                    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
                    '<process id="theProcess" isExecutable="true">' +
                    '<startEvent id="theStart" />' +
                    '<userTask id="userTask" />' +
                    '<endEvent id="theEnd" />' +
                    '<sequenceFlow id="flow1" sourceRef="theStart" targetRef="userTask" />' +
                    '<sequenceFlow id="flow2" sourceRef="userTask" targetRef="theEnd" />' +
                    '</process>' +
                    '</definitions>');

            it('should handle user tasks as wait states', function (done) {
                engine.startInstance(processXml, null, null, function (err, execution) {
                    execution.on('start', function (e) {
                        if (e.id === 'userTask') {
                            expect(execution.isEnded).to.eql(false);

                            var processInstance = execution.getActivityInstance();
                            expect(processInstance.activities.length).to.eql(2);
                            expect(processInstance.activities[0].activityId).to.eql("theStart");
                            expect(processInstance.activities[1].activityId).to.eql("userTask");

                            execution.activityExecutions[1].signal();
                        }
                    });

                    execution.on('end', function (e) {
                        if (e.id === 'theProcess') {
                            expect(execution.isEnded).to.eql(true);

                            var processInstance = execution.getActivityInstance();

                            expect(processInstance.activities.length).to.eql(3);
                            expect(processInstance.activities[0].activityId).to.eql("theStart");
                            expect(processInstance.activities[1].activityId).to.eql("userTask");
                            expect(processInstance.activities[2].activityId).to.eql("theEnd");
                            done();
                        }
                    });

                    expect(err).to.not.exist;
                    expect(execution).to.exist;
                });
            });

            it('should signal user task by id', function (done) {
                engine.startInstance(processXml, null, null, function (err, execution) {
                    execution.on('start', function (e) {
                        if (e.id === 'userTask') {
                            // send a signal to the usertask:
                            execution.signal("userTask");
                        }
                    });

                    execution.on('end', function (e) {
                        if (e.id === 'theProcess') {
                            expect(execution.isEnded).to.eql(true);
                            done();
                        }
                    });

                    expect(err).to.not.exist;
                    expect(execution).to.exist;
                });

                // var processDefinition = new Transformer().transform(processXml)[0];

                // var execution = new CAM.ActivityExecution(processDefinition);
                // execution.start();

                // // the activity is NOT ended
                // expect(execution.isEnded).toBe(false);

                // // send a signal to the usertask:
                // execution.signal("userTask");

                // // now the process is ended
                // expect(execution.isEnded).toBe(true);
            });
        });
    });
});
