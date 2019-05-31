'use strict';

const factory = require('./helpers/factory');
const {Engine} = require('../');
const {EventEmitter} = require('events');

describe('issues', () => {
  describe('issue 19 - save state', () => {
    it('make sure there is something to save on activity start event', async () => {
      const messages = [];
      const services = {
        timeout: (cb, time) => {
          setTimeout(cb, time);
        },
        log: (message) => {
          messages.push(message);
        }
      };

      const listener = new EventEmitter();
      const engine = Engine({
        name: 'Engine',
        source: factory.resource('issue-19.bpmn'),
        listener,
      });

      const states = [];

      listener.on('activity.start', (activity, engineApi) => {
        states.push(engineApi.getState());
      });

      const end = engine.waitFor('end');

      await engine.execute({
        listener,
        variables: {
          timeout: 100
        },
        services,
      });

      await end;

      expect(states).to.have.length(7);

      for (const state of states) {
        expect(state).to.have.property('definitions').with.length(1);
        expect(state.definitions[0]).to.have.property('execution');
        expect(state.definitions[0].execution).to.have.property('processes').with.length(1);
        expect(state.definitions[0].execution.processes[0]).to.have.property('execution');
        expect(state.definitions[0].execution.processes[0].execution).to.have.property('children').with.length(7);

        const children = state.definitions[0].execution.processes[0].execution.children;

        expect(children.map(({id}) => id)).to.eql(['Start', 'Parallel1', 'Task_A', 'Task_B', 'Parallel2', 'Task_C', 'End']);
      }

      let [Start, Parallel1, Task_A, Task_B, Parallel2, Task_C, End] = states[0].definitions[0].execution.processes[0].execution.children;
      expect(Start, 'state 0 Start').to.have.property('status', 'started');
      expect(Parallel1, 'state 0 Parallel1').to.have.property('status').that.is.undefined;

      [Start, Parallel1, Task_A, Task_B, Parallel2, Task_C, End] = states[1].definitions[0].execution.processes[0].execution.children;
      expect(Start, 'state 1 Start').to.have.property('status').that.is.undefined;
      expect(Parallel1, 'state 1 Parallel1').to.have.property('status', 'started');
      expect(Task_A, 'state 1 Task_A').to.have.property('status').that.is.undefined;

      [Start, Parallel1, Task_A, Task_B, Parallel2, Task_C, End] = states[2].definitions[0].execution.processes[0].execution.children;
      expect(Parallel1, 'state 2 Parallel1').to.have.property('status').that.is.undefined;
      expect(Task_A, 'state 2 Task_A').to.have.property('status', 'started');
      expect(Task_B, 'state 2 Task_B').to.have.property('status').that.is.undefined;

      [Start, Parallel1, Task_A, Task_B, Parallel2, Task_C, End] = states[3].definitions[0].execution.processes[0].execution.children;
      expect(Parallel1, 'state 3 Parallel1').to.have.property('status').that.is.undefined;
      expect(Task_A, 'state 3 Task_A').to.have.property('status').that.is.undefined;
      expect(Task_B, 'state 3 Task_B').to.have.property('status', 'started');
      expect(Parallel2, 'state 3 Parallel2').to.have.property('status').that.is.undefined;

      [Start, Parallel1, Task_A, Task_B, Parallel2, Task_C, End] = states[4].definitions[0].execution.processes[0].execution.children;
      expect(Task_A, 'state 4 Task_A').to.have.property('status').that.is.undefined;
      expect(Task_B, 'state 4 Task_B').to.have.property('status').that.is.undefined;
      expect(Parallel2, 'state 4 Parallel2').to.have.property('status', 'started');

      [Start, Parallel1, Task_A, Task_B, Parallel2, Task_C, End] = states[5].definitions[0].execution.processes[0].execution.children;
      expect(Parallel2, 'state 5 Parallel2').to.have.property('status').that.is.undefined;
      expect(Task_C, 'state 5 Task_C').to.have.property('status', 'started');
      expect(End, 'state 5 End').to.have.property('status').that.is.undefined;

      [Start, Parallel1, Task_A, Task_B, Parallel2, Task_C, End] = states[6].definitions[0].execution.processes[0].execution.children;
      expect(Task_C, 'state 6 Task_C').to.have.property('status').that.is.undefined;
      expect(End, 'state 6 End').to.have.property('status', 'started');
    });
  });
});
