/*jshint expr:true */

var Lab = require('lab');
var fs = require('fs');
var DOMParser = require('xmldom').DOMParser;
var Util = require('util');

var Bpmn = require('..');

var expect = Lab.expect;
var before = Lab.before;
// var beforeEach = Lab.beforeEach;
// var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;

describe('transformer', function () {
    it('Bpmn exposes transformer module', function (done) {
        expect(Bpmn).to.have.property('Transformer');
        done();
    });

    describe('#ctor', function () {
        it('returns new transformer', function (done) {
            var transformer = new Bpmn.Transformer();
            done();
        });
    });

    describe('#transform', function () {
        var transformer = new Bpmn.Transformer();

        var bpmnSchema = '<?xml version="1.0" encoding="UTF-8"?>' +
            '<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
            '<process id="theProcess" isExecutable="true">' +
            '<startEvent id="theStart" />' +
            '<exclusiveGateway id="decision" />' +
            '<endEvent id="end" />' +
            '<sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />' +
            '<sequenceFlow id="flow2" sourceRef="decision" targetRef="end" />' +
            '</process>' +
            '</definitions>';

        var bpmnDefinition = {
            type : 'process',
            id : 'theProcess',
            isExecutable : 'true',
            marker : {},
            outgoing : [],
            listeners : [],
            properties : {},
            baseElements :
            [{
                    type : 'sequenceFlow',
                    id : 'flow1',
                    sourceRef : 'theStart',
                    targetRef : 'decision',
                    marker : {},
                    properties : {}

                }, {
                    type : 'sequenceFlow',
                    id : 'flow2',
                    sourceRef : 'decision',
                    targetRef : 'end',
                    marker : {},
                    properties : {}

                }, {
                    type : 'startEvent',
                    id : 'theStart',
                    marker : {},
                    outgoing : ['flow1'],
                    listeners : [],
                    properties : {},
                    eventDefinitions : []
                }, {
                    type : 'exclusiveGateway',
                    id : 'decision',
                    marker : {},
                    outgoing : [],
                    listeners : [],
                    properties : {},
                    sequenceFlows :
                    [{
                            type : 'sequenceFlow',
                            id : 'flow2',
                            sourceRef : 'decision',
                            targetRef : 'end',
                            marker : {},
                            properties : {}

                        }
                    ]
                }, {
                    type : 'endEvent',
                    id : 'end',
                    marker : {},
                    outgoing : [],
                    listeners : [],
                    properties : {},
                    eventDefinitions : []
                }
            ]
        };

        it('returns transformed BPMN-schema', function (done) {
            var bpmnDom = new DOMParser().parseFromString(bpmnSchema);

            transformer.transform(bpmnDom, true, function (err, bpmnObject) {
                expect(err).to.not.exist;
                expect(bpmnObject).to.exist;
                expect(bpmnObject.length).to.exist;
                expect(bpmnObject.length).to.eql(1);

                var bpmnDef = bpmnObject[0];
                expect(bpmnDef).to.eql(bpmnDefinition);
                done();
            });
        });

        it('works without callback', function (done) {
            var bpmnDom = new DOMParser().parseFromString(bpmnSchema);
            transformer.transform(bpmnDom, true);
            done();
        });

        it('without definitions schema returns error in callback', function (done) {
            var bpmnDom = new DOMParser().parseFromString('<?xml version="1.0" encoding="UTF-8"?>');
            transformer.transform(bpmnDom, true, function (err) {
                expect(err).to.exist;
                expect(err.message).to.eql('A BPMN 2.0 XML file must contain at least one definitions element');
                done();
            });
        });

        it('with string sourceDOM returns error in callback', function (done) {
            var bpmnDom = '';

            transformer.transform(bpmnDom, true, function (err) {
                expect(err).to.exist;
                expect(err.message).to.eql('Source DOM is missing');
                done();
            });
        });

        it('with empty object sourceDOM returns error in callback', function (done) {
            var bpmnDom = {};

            transformer.transform(bpmnDom, true, function (err) {
                expect(err).to.exist;
                expect(err.message).to.eql("Object #<Object> has no method 'getElementsByTagNameNS'");
                done();
            });
        });

        it('without attributes on processelement returns no name for process', function (done) {
            var xml = '<?xml version="1.0" encoding="UTF-8"?>' +
                '<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
                '<process></process>' +
                '</definitions>';

            var bpmnDom = new DOMParser().parseFromString(xml);
            transformer.transform(bpmnDom, true, function (err, bpmnDef) {
                expect(err).to.not.exist;
                expect(bpmnDef[0].name).to.not.exist;
                done();
            });
        });

        it('with outgoing sequence flows without conditions returns error in callback', function (done) {
            var xml = fs.readFileSync('./test/resources/defaultFlow.bpmn').toString();
            
            var bpmnDom = new DOMParser().parseFromString(xml);

            transformer.transform(bpmnDom, true, function (err) {
                expect(err).to.exist;
                done();
            });
            
        });
    });
});
