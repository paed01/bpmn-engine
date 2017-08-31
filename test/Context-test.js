'use strict';

const Context = require('../lib/Context');
const factory = require('./helpers/factory');
const Lab = require('lab');
const testHelpers = require('./helpers/testHelpers');

const lab = exports.lab = Lab.script();
const {before, beforeEach, describe, it} = lab;
const {expect} = Lab.assertions;

describe('Context', () => {
  describe('getChildActivityById()', () => {
    let moddleContext;
    before((done) => {
      testHelpers.getModdleContext(factory.resource('lanes.bpmn').toString(), (err, result) => {
        if (err) return done(err);
        moddleContext = result;
        done();
      });
    });

    it('returns activity instance', (done) => {
      expect(Context('mainProcess', moddleContext).getChildActivityById('mainStartEvent')).to.include(['id', 'type', 'io']);
      done();
    });

    it('returns child instance in process scope', (done) => {
      const context = Context('mainProcess', moddleContext);
      const actitivy = context.getChildActivityById('task1');
      expect(context.children).to.contain([actitivy.id]);
      done();
    });

    it('but not if out of process scope', (done) => {
      const context = new Context('mainProcess', moddleContext);
      const actitivy = context.getChildActivityById('meTooTask');
      expect(actitivy).to.not.exist();
      expect(context.children).to.not.contain(['meTooTask']);
      done();
    });
  });

  describe('getAttachedToActivity()', () => {
    let moddleContext;
    beforeEach((done) => {
      const source = `
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="mainProcess" isExecutable="true">
          <task id="task" />
          <boundaryEvent id="boundEvent" attachedToRef="task">
            <errorEventDefinition />
          </boundaryEvent>
        </process>
      </definitions>`;

      testHelpers.getModdleContext(source, (err, result) => {
        if (err) return done(err);
        moddleContext = result;
        done();
      });
    });

    it('returns attachedTo actitivy', (done) => {
      const context = new Context('mainProcess', moddleContext);
      const actitivy = context.getAttachedToActivity('boundEvent');
      expect(actitivy.id).to.equal('task');
      done();
    });

    it('returns undefined if attachedToRef is not found', (done) => {
      moddleContext.references.find(({id}) => id === 'task').id = 'task2';

      const context = new Context('mainProcess', moddleContext);
      const actitivy = context.getAttachedToActivity('boundEvent');
      expect(actitivy).to.not.exist();
      done();
    });

    it('returns undefined if eventId is not found', (done) => {
      const context = new Context('mainProcess', moddleContext);
      const actitivy = context.getAttachedToActivity('boundEvent2');
      expect(actitivy).to.not.exist();
      done();
    });
  });

  describe('getActivityExtensions()', () => {
    let moddleContext;
    beforeEach((done) => {
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

      testHelpers.getModdleContext(source, {
        moddleOptions: {
          js: require('./resources/js-bpmn-moddle')
        }
      }, (err, result) => {
        if (err) return done(err);
        moddleContext = result;
        done();
      });
    });

    it('returns default if IO type not mapped', (done) => {
      const context = new Context('mainProcess', moddleContext);
      expect(context.getActivityExtensions('task').io.isDefault).to.be.true();
      done();
    });
  });
});

