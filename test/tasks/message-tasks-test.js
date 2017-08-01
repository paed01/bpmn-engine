'use strict';

const {Engine} = require('../../lib');
const {EventEmitter} = require('events');
const factory = require('../helpers/factory');
const Lab = require('lab');
const testHelpers = require('../helpers/testHelpers');

const lab = exports.lab = Lab.script();
const {describe, it} = lab;
const {expect} = Lab.assertions;

describe('message tasks', () => {
  it('Sends message between lanes', (done) => {
    const engine = new Engine({
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

    engine.once('end', (execution, definition) => {
      expect(definition.environment.variables).to.include({
        user: 'a@b.c',
        receivedFrom: 'a@b.c',
        me: 'c@d.e',
      });

      testHelpers.expectNoLingeringListenersOnEngine(engine);
      done();
    });

    engine.execute({
      listener,
      variables: {
        user: 'a@b.c'
      }
    });
  });
});
