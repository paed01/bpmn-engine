'use strict';

const Code = require('code');
const Lab = require('lab');
const lab = exports.lab = Lab.script();
const expect = Code.expect;

const Bpmn = require('..');

lab.describe('activity-helper', () => {
  lab.describe('static', () => {
    const transformer = new Bpmn.Transformer();

    const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess2" isExecutable="true">
    <startEvent id="theStart" />
    <exclusiveGateway id="decision" default="flow2">
      <outgoing>flow2</outgoing>
      <outgoing>flow3</outgoing>
    </exclusiveGateway>
    <endEvent id="end1" />
    <endEvent id="end2" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="decision" />
    <sequenceFlow id="flow2" sourceRef="decision" targetRef="end1" />
    <sequenceFlow id="flow3" sourceRef="decision" targetRef="end2">
      <conditionExpression>true</conditionExpression>
    </sequenceFlow>
  </process>
</definitions>
    `;

    lab.describe('#getActivitiesByType', () => {
      lab.test('returns list if activities', (done) => {
        transformer.transform(processXml, true, (err, defs) => {
          expect(err).to.not.exist();

          const def = defs.rootElements[0];
          const elms = Bpmn.ActivityHelper.getActivitiesByType(def, 'StartEvent');
          expect(elms).not.to.be.empty();
          done();
        });
      });

      lab.test('with activityDefinition with empty flowElements returns nothing', (done) => {
        transformer.transform(processXml, true, (err, defs) => {
          expect(err).to.not.exist();

          const def = defs.rootElements[0];
          def.flowElements = [];
          const elms = Bpmn.ActivityHelper.getActivitiesByType(def, 'EndEvent');
          expect(elms).to.be.empty();
          done();
        });
      });

      lab.test('with activityDefinition without flowElements returns nothing', (done) => {
        transformer.transform(processXml, true, (err, defs) => {
          expect(err).to.not.exist();

          const def = defs.rootElements[0];
          delete def.flowElements;
          const elms = Bpmn.ActivityHelper.getActivitiesByType(def, 'endEvent');
          expect(elms).to.be.empty();
          done();
        });
      });

      lab.test('without activityDefinition returns nothing', (done) => {
        const elms = Bpmn.ActivityHelper.getActivitiesByType(null, 'endEvent');
        expect(elms).to.be.empty();
        done();
      });
    });

    lab.describe('#getActivityById', () => {
      lab.test('with activityDefinition with empty flowElements returns nothing', (done) => {
        transformer.transform(processXml, true, (err, defs) => {
          expect(err).to.not.exist();

          const def = defs.rootElements[0];
          def.flowElements = [];
          const elms = Bpmn.ActivityHelper.getActivityById(def, 'theStart');
          expect(elms).to.equal(null);
          done();
        });
      });

      lab.test('without activityDefinition returns nothing', (done) => {
        const elms = Bpmn.ActivityHelper.getActivityById(null, 'theStart');
        expect(elms).to.equal(null);
        done();
      });

      lab.test('with flowElement with id returns flowElement', (done) => {
        transformer.transform(processXml, true, (err, defs) => {
          expect(err).to.not.exist();

          const def = defs.rootElements[0];
          const elms = Bpmn.ActivityHelper.getActivityById(def, 'end1');
          expect(elms).to.exist();
          done();
        });
      });
    });

    lab.describe('#getSequenceFlows', () => {
      lab.test('without scopeActivity returns nothing', (done) => {
        const elms = Bpmn.ActivityHelper.getSequenceFlows(null);
        expect(elms).to.be.empty();
        done();
      });

      lab.test('with activityDefinition and scopeActivity returns ok', (done) => {
        transformer.transform(processXml, true, (err, defs) => {
          expect(err).to.not.exist();

          const scope = defs.rootElements[0];
          const def = Bpmn.ActivityHelper.getActivityById(scope, 'theStart');
          const elms = Bpmn.ActivityHelper.getSequenceFlows(def);
          expect(elms).not.to.be.empty();
          done();
        });
      });

      lab.test('with activityDefinition and without scope returns empty', (done) => {
        transformer.transform(processXml, true, (err, defs) => {
          expect(err).to.not.exist();

          const scope = defs.rootElements[0];
          const def = Bpmn.ActivityHelper.getActivityById(scope, 'theEnd');
          const elms = Bpmn.ActivityHelper.getSequenceFlows(def);
          expect(elms).to.be.empty();
          done();
        });
      });

      lab.test('with activityDefinition with outgoing returns sequenceFlows', (done) => {
        transformer.transform(processXml, true, (err, defs) => {
          expect(err).to.not.exist();

          const scope = defs.rootElements[0];
          const def = Bpmn.ActivityHelper.getActivityById(scope, 'decision');
          const elms = Bpmn.ActivityHelper.getSequenceFlows(def);
          expect(elms).not.to.be.empty();
          done();
        });
      });
    });
  });
});
