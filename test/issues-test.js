'use strict';

const {Engine} = require('../');
const {EventEmitter} = require('events');
const Lab = require('lab');
const testHelpers = require('./helpers/testHelpers');
const factory = require('./helpers/factory');

const lab = exports.lab = Lab.script();
const {describe, it} = lab;
const {expect} = Lab.assertions;

describe('issues', () => {
  describe('issue 19 - save state', () => {
    it('make sure there is something to save on listener start events', (done) => {
      const messages = [];
      testHelpers.serviceLog = (message) => {
        messages.push(message);
      };
      testHelpers.serviceTimeout = (cb, time) => {
        setTimeout(cb, time);
      };

      let state;
      const engine = new Engine({
        source: factory.resource('issue-19.bpmn')
      });
      const listener = new EventEmitter();

      listener.on('start', () => {
        state = engine.getState();
      });

      listener.once('start-Task_B', () => {
        setImmediate(() => {
          engine.stop();
          state = engine.getState();
        });
      });

      engine.once('end', () => {
        const listener2 = new EventEmitter();
        const engine2 = Engine.resume(state, {
          listener: listener2
        });
        engine2.once('end', () => {
          expect(messages).to.equal([
            'Waiting Task B for 5 seconds...',
            'Waiting Task B for 5 seconds...',
            'Resume Task B!',
            'Resume Task B!'
          ]);
          done();
        });
      });

      engine.execute({
        listener,
        variables: {
          timeout: 100
        },
        services: {
          timeout: {
            module: require.resolve('./helpers/testHelpers'),
            fnName: 'serviceTimeout'
          },
          log: {
            module: require.resolve('./helpers/testHelpers'),
            fnName: 'serviceLog'
          }
        }
      });
    });
  });
});
