'use strict';

const Code = require('code');
const expect = Code.expect;
const Lab = require('lab');
const testHelpers = require('../helpers/testHelpers');

const lab = exports.lab = Lab.script();

lab.experiment('ErrorEvent', () => {
  lab.describe('as BoundaryEvent', () => {
    const processXml = `
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
  <process id="theProcess" isExecutable="true">
    <serviceTask id="service" camunda:expression="\${services.test}" />
    <boundaryEvent id="errorEvent" attachedToRef="service">
      <errorEventDefinition errorRef="Error_0w1hljb" camunda:errorCodeVariable="code" camunda:errorMessageVariable="message" />
    </boundaryEvent>
    <endEvent id="end" />
    <sequenceFlow id="flow1" sourceRef="service" targetRef="end" />
    <sequenceFlow id="flow2" sourceRef="errorEvent" targetRef="end" />
  </process>
  <error id="Error_0w1hljb" name="requestError" errorCode="404" />
</definitions>
    `;

    let context;
    lab.beforeEach((done) => {
      testHelpers.getContext(processXml, {
        camunda: require('camunda-bpmn-moddle/resources/camunda')
      }, (err, c) => {
        if (err) return done(err);
        context = c;
        context.services = {
          test: () => {}
        };
        done();
      });
    });

    lab.describe('ctor', () => {
      lab.test('has property cancelActivity true', (done) => {
        const event = context.getChildActivityById('errorEvent');
        expect(event).to.include({
          cancelActivity: true
        });
        done();
      });
    });

    lab.describe('output', () => {
      lab.test('sets error code and message on end', (done) => {
        const event = context.getChildActivityById('errorEvent');
        event.activate();
        event.enter();

        event.once('end', (e, output) => {
          expect(e.saveToVariables).to.be.true();
          expect(output).to.equal({
            code: 404,
            message: 'failed'
          });
          done();
        });

        const error = new Error('failed');
        error.code = 404;
        event.attachedTo.emit('error', error, event.attachedTo);
      });

      lab.test('sets nothing if missing error code and message', (done) => {
        const event = context.getChildActivityById('errorEvent');
        event.activate();
        event.enter();

        event.once('end', (e, output) => {
          expect(e.saveToVariables).to.be.false();
          expect(output).to.not.exist();
          done();
        });

        const error = new Error();
        event.attachedTo.emit('error', error, event.attachedTo);
      });

      lab.test('sets nothing message if missing error code', (done) => {
        const event = context.getChildActivityById('errorEvent');
        event.activate();
        event.enter();

        event.once('end', (e, output) => {
          expect(e.saveToVariables).to.be.true();
          expect(output).to.equal({
            message: 'failed'
          });
          done();
        });

        const error = new Error('failed');
        event.attachedTo.emit('error', error, event.attachedTo);
      });
    });

    lab.describe('interrupting', () => {
      lab.test('cancels task if error is emitted', (done) => {
        const event = context.getChildActivityById('errorEvent');
        event.activate();
        event.enter();

        event.attachedTo.outbound[0].once('discarded', () => {
          done();
        });

        event.attachedTo.activate();
        event.attachedTo.enter();
        event.attachedTo.emit('error', new Error('failed'));
      });

      lab.test('discards error event outbound if task completes', (done) => {
        const event = context.getChildActivityById('errorEvent');
        event.activate();
        event.enter();

        event.outbound[0].once('discarded', () => {
          done();
        });

        event.attachedTo.emit('end', event.attachedTo);
      });

      lab.test('is discarded if task is canceled', (done) => {
        const event = context.getChildActivityById('errorEvent');
        event.activate();
        event.enter();

        event.outbound[0].once('discarded', () => {
          done();
        });

        event.attachedTo.enter();
        event.attachedTo.cancel();
      });
    });
  });
});
