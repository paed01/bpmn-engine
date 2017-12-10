'use strict';

const {Engine} = require('../../lib');
const {EventEmitter} = require('events').EventEmitter;

describe('ReceiveTask', () => {
  const source = `
  <?xml version="1.0" encoding="UTF-8"?>
  <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <process id="theProcess" isExecutable="true">
      <receiveTask id="receive" />
    </process>
  </definitions>`;

  it('process emits wait when entering receive task', (done) => {
    const engine = Engine({
      source
    });
    const listener = new EventEmitter();
    engine.execute({
      listener,
      variables: {
        input: null
      }
    });

    listener.on('wait-receive', (activityApi, processExecution) => {
      processExecution.signal(activityApi.id, {
        sirname: 'von Rosen'
      });
    });

    engine.once('end', (definition) => {
      expect(definition.getOutput().taskInput.receive).to.eql({
        sirname: 'von Rosen'
      });
      done();
    });
  });

  it('completes if canceled', (done) => {
    const engine = Engine({
      source
    });
    const listener = new EventEmitter();

    listener.once('wait-receive', (activityApi) => {
      activityApi.cancel();
    });

    engine.execute({
      listener
    });

    engine.once('end', (execution, definition) => {
      expect(definition.getChildState('receive').canceled).to.be.true;
      done();
    });
  });
});
