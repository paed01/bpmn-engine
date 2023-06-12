'use strict';

const {Engine} = require('../../../index.js');

Feature('issue 172', () => {
  Scenario('Postpone intermediate throw event by formatting', () => {
    let engine;
    const agiCalls = [];
    Given('start event, intermediate throw event, and end event', () => {
      const source = `<?xml version="1.0" encoding="UTF-8"?>
        <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
          <startEvent id="start" />
          <sequenceFlow id="to-event" sourceRef="start" targetRef="event" />
          <intermediateThrowEvent id="event" />
          <sequenceFlow id="to-end" sourceRef="event" targetRef="end" />
          <endEvent id="end" />
        </process>
      </definitions>`;

      engine = Engine({
        name: 'issue-172',
        source,
        services: {
          agi(...args) {
            return new Promise((resolve) => process.nextTick(() => {
              agiCalls.push(args);
              resolve({called: true});
            }));
          },
        },
        extensions: {
          dingdong(activity) {
            if (activity.type === 'bpmn:Process') return;
            return {
              activate() {
                activity.on('enter', async (elementApi) => {
                  activity.broker.publish('format', 'run.format.start', {endRoutingKey: 'run.format.complete'});
                  const formatting = await elementApi.environment.services.agi(elementApi.content);
                  activity.broker.publish('format', 'run.format.complete', formatting);
                }, {consumerTag: 'format-on-enter'});
              },
              deactivate() {
                activity.broker.cancel('format-on-enter');
              },
            };
          },
        },
      });
    });

    let end;
    const activityEnded = [];
    When('executed', () => {
      end = engine.waitFor('end');
      engine.broker.subscribeTmp('event', 'activity.end', (_, message) => activityEnded.push(message.content), {noAck: true});
      return engine.execute();
    });

    Then('execution completed', () => {
      return end;
    });

    And('start event is formatted', () => {
      expect(agiCalls).to.have.length(3);
      expect(agiCalls[0][0].type).to.equal('bpmn:StartEvent');
      expect(activityEnded).to.have.length(3);
      expect(activityEnded[0].type).to.equal('bpmn:StartEvent');
      expect(activityEnded[0].called).to.be.true;
    });

    And('intermediate throw event is formatted', () => {
      expect(agiCalls[1][0].type).to.equal('bpmn:IntermediateThrowEvent');
      expect(activityEnded[1].type).to.equal('bpmn:IntermediateThrowEvent');
      expect(activityEnded[1].called).to.be.true;
    });

    And('end event is formatted', () => {
      expect(agiCalls[2][0].type).to.equal('bpmn:EndEvent');
      expect(activityEnded[2].type).to.equal('bpmn:EndEvent');
      expect(activityEnded[2].called).to.be.true;
    });
  });
});
