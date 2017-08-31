'use strict';

const getPropertyValue = require('../../lib/getPropertyValue');
const Lab = require('lab');
const testHelpers = require('../helpers/testHelpers');
const factory = require('../helpers/factory');
const {Engine} = require('../..');
const {EventEmitter} = require('events');

const lab = exports.lab = Lab.script();
const {beforeEach, describe, it} = lab;
const {expect, fail} = Lab.assertions;

const moddleOptions = {
  camunda: require('camunda-bpmn-moddle/resources/camunda')
};

describe.skip('BoundaryEvent', () => {

  describe('behaviour', () => {
    it('emits error if attachedTo is not found', (done) => {
      const source = `
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
        <process id="theProcess" isExecutable="true">
          <serviceTask id="service" camunda:expression="\${services.test}" />
          <boundaryEvent id="boundEvent" attachedToRef="service1">
            <errorEventDefinition camunda:errorCodeVariable="serviceError" camunda:errorMessageVariable="message" />
          </boundaryEvent>
        </process>
      </definitions>`;

      testHelpers.getContext(source, moddleOptions, (err, context) => {
        if (err) return done(err);
        const event = context.getChildActivityById('boundEvent');
        event.on('error', (err) => {
          expect(err).to.be.an.error();
          done();
        });

        event.run();
      });
    });
  });
});
