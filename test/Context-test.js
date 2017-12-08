'use strict';

const Context = require('../lib/Context');
const factory = require('./helpers/factory');
const testHelpers = require('./helpers/testHelpers');

describe('Context', () => {
  describe('getChildActivityById()', () => {
    let moddleContext;
    before(async () => {
      moddleContext = await testHelpers.moddleContext(factory.resource('lanes.bpmn').toString());
    });

    it('returns activity instance', () => {
      const activity = Context('mainProcess', moddleContext).getChildActivityById('mainStartEvent');
      expect(Object.keys(activity)).to.contain.members(['id', 'type', 'io']);
    });

    it('returns child instance in process scope', () => {
      const context = Context('mainProcess', moddleContext);
      const actitivy = context.getChildActivityById('task1');
      expect(context.children).to.have.property(actitivy.id);
    });

    it('but not if out of process scope', () => {
      const context = new Context('mainProcess', moddleContext);
      const actitivy = context.getChildActivityById('outOfBTask');
      expect(actitivy).to.not.exist;
      expect(context.children).to.not.have.property('outOfBTask');
    });
  });

  describe('getAttachedToActivity()', () => {
    let moddleContext;
    beforeEach(async () => {
      const source = `
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="mainProcess" isExecutable="true">
          <task id="task" />
          <boundaryEvent id="boundEvent" attachedToRef="task">
            <errorEventDefinition />
          </boundaryEvent>
        </process>
      </definitions>`;

      moddleContext = await testHelpers.moddleContext(source);
    });

    it('returns attachedTo actitivy', () => {
      const context = new Context('mainProcess', moddleContext);
      const actitivy = context.getAttachedToActivity('boundEvent');
      expect(actitivy.id).to.equal('task');
    });

    it('returns undefined if attachedToRef is not found', () => {
      moddleContext.references.find(({id}) => id === 'task').id = 'task2';

      const context = new Context('mainProcess', moddleContext);
      const actitivy = context.getAttachedToActivity('boundEvent');
      expect(actitivy).to.not.exist;
    });

    it('returns undefined if eventId is not found', () => {
      const context = new Context('mainProcess', moddleContext);
      const actitivy = context.getAttachedToActivity('boundEvent2');
      expect(actitivy).to.not.exist;
    });
  });

  describe('getActivityExtensions()', () => {
    let moddleContext;
    beforeEach(async () => {
      const source = `
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xmlns:js="http://paed01.github.io/bpmn-engine/schema/2017/08/bpmn">
        <process id="mainProcess" isExecutable="true">
          <task id="task">
            <extensionElements>
              <js:output name="returnValue" value="\${result[0]}" />
            </extensionElements>
          </task>
        </process>
      </definitions>`;

      moddleContext = await testHelpers.moddleContext(source, {
        moddleOptions: {
          js: require('./resources/js-bpmn-moddle')
        }
      });
    });

    it('returns default if IO type not mapped', (done) => {
      const context = new Context('mainProcess', moddleContext);
      expect(context.getActivityExtensions('task').ios).to.have.length(0);
      done();
    });
  });
});

