'use strict';

const Lab = require('lab');
const testHelpers = require('../helpers/testHelpers');

const lab = exports.lab = Lab.script();
const {beforeEach, describe, it} = lab;
const {expect} = Lab.assertions;

describe('ServiceConnector', () => {
  let context;
  beforeEach((done) => {
    const source = `
    <?xml version="1.0" encoding="UTF-8"?>
    <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
      <process id="theProcess" isExecutable="true">
        <serviceTask id="sendEmail_1" name="send mail">
          <extensionElements>
            <camunda:connector>
              <camunda:inputOutput>
                <camunda:inputParameter name="to" />
                <camunda:inputParameter name="subject">Resolved \${ticketId}</camunda:inputParameter>
                <camunda:inputParameter name="message">
                  <camunda:list>
                    <camunda:value>Your ticket \${ticketId} was resolved.</camunda:value>
                    <camunda:value>Best regards,</camunda:value>
                    <camunda:value>\${supportEmail}</camunda:value>
                  </camunda:list>
                </camunda:inputParameter>
              </camunda:inputOutput>
              <camunda:connectorId>sendEmail</camunda:connectorId>
            </camunda:connector>
            <camunda:inputOutput>
              <camunda:inputParameter name="to" value="\${variables.emailAddress}" />
              <camunda:inputParameter name="ticketId" value="987654" />
              <camunda:inputParameter name="supportEmail" value="support@example.com" />
            </camunda:inputOutput>
          </extensionElements>
        </serviceTask>
        <serviceTask id="sendEmail_2" name="send mail">
          <extensionElements>
            <camunda:connector>
              <camunda:inputOutput>
                <camunda:inputParameter name="to" />
                <camunda:inputParameter name="subject">Resolved \${variables.ticketId}</camunda:inputParameter>
                <camunda:inputParameter name="message">
                  <camunda:list>
                    <camunda:value>Your ticket \${variables.ticketId} was resolved.</camunda:value>
                    <camunda:value>Best regards,</camunda:value>
                    <camunda:value>\${variables.assignedToAgentEmail}</camunda:value>
                  </camunda:list>
                </camunda:inputParameter>
              </camunda:inputOutput>
              <camunda:connectorId>sendEmail</camunda:connectorId>
            </camunda:connector>
          </extensionElements>
        </serviceTask>
        <serviceTask id="ping" name="ping">
          <extensionElements>
            <camunda:connector>
              <camunda:inputOutput>
                <camunda:outputParameter name="pinged" value="\${true}" />
              </camunda:inputOutput>
              <camunda:connectorId>ping</camunda:connectorId>
            </camunda:connector>
            <camunda:inputOutput>
              <camunda:outputParameter name="pinged" value="\${pinged}" />
            </camunda:inputOutput>
          </extensionElements>
        </serviceTask>
      </process>
    </definitions>`;

    testHelpers.getContext(source, {
      camunda: require('camunda-bpmn-moddle/resources/camunda')
    }, (err, result) => {
      if (err) return done(err);
      context = result;
      context.environment.addService('sendEmail', (to, subject, message, next) => {
        next();
      });
      done();
    });
  });

  describe('input', () => {
    it('resolves service input', (done) => {
      context.environment.addService('sendEmail', (to, subject, message) => {
        expect(to).to.equal('to@example.com');
        expect(subject).to.equal('Resolved 987654');
        expect(message).to.equal(['Your ticket 987654 was resolved.', 'Best regards,', 'support@example.com']);
        done();
      });
      context.environment.assignVariables({emailAddress: 'to@example.com'});
      const task = context.getChildActivityById('sendEmail_1');
      task.run();
    });

    it('resolves context variables if no service input is defined', (done) => {
      context.environment.addService('sendEmail', (to, subject) => {
        expect(subject).to.equal('Resolved 987654');
        done();
      });
      context.environment.assignVariables({ticketId: '987654'});
      const task = context.getChildActivityById('sendEmail_2');
      task.run();
    });
  });

  describe('output', () => {
    it('resolves connector output to service output', (done) => {
      context.environment.addService('ping', (c, next) => {
        next(null, true);
      });
      const task = context.getChildActivityById('ping');
      task.once('end', (activityApi, executionContext) => {
        expect(executionContext.getOutput()).to.equal({
          pinged: true
        });
        done();
      });

      task.run();
    });
  });
});
