'use strict';

const Code = require('code');
const EventEmitter = require('events').EventEmitter;
const factory = require('../helpers/factory');
const Lab = require('lab');
const testHelpers = require('../helpers/testHelpers');

const lab = exports.lab = Lab.script();
const expect = Code.expect;

const Bpmn = require('../..');

lab.experiment('message tasks', () => {
  lab.test('Sends message between lanes', (done) => {
    const engine = new Bpmn.Engine({
      source: factory.resource('messaging.bpmn'),
      moddleOptions: {
        camunda: require('camunda-bpmn-moddle/resources/camunda')
      }
    });

    const listener = new EventEmitter();
    listener.once('wait-prepareMessage', (task) => {
      task.signal({
        to: 'c@d.e'
      });
    });

    engine.once('end', (def) => {
      expect(def.variables).to.include({
        user: 'a@b.c',
        to: 'c@d.e',
        receivedFrom: 'a@b.c',
        me: 'c@d.e',
      });
      testHelpers.expectNoLingeringListenersOnEngine(engine);
      done();
    });

    engine.execute({
      listener: listener,
      variables: {
        user: 'a@b.c'
      }
    });
  });
});
