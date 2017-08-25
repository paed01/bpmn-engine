'use strict';

const ActivityExecution = require('../../lib/activities/activity-execution');
const Environment = require('../../lib/Environment');
const Lab = require('lab');
const MultiInstanceLoopCharacteristics = require('../../lib/extensions/MultiInstanceLoopCharacteristics');
const Task = require('../../lib/tasks/Task');

const lab = exports.lab = Lab.script();
const {describe, it} = lab;
const {expect, fail} = Lab.assertions;

describe('MultiInstanceLoopCharacteristics', () => {

  describe('behaviour', () => {
    it('sets loop type to collection if collection is defined', (done) => {
      const loop = MultiInstanceLoopCharacteristics({
        $type: 'bpmn:MultiInstanceLoopCharacteristics',
        collection: '${variables.list}'
      });

      expect(loop).to.include({
        type: 'collection',
        collection: '${variables.list}'
      });
      done();
    });

    it('sets loop type to collection if collection, condition, and cardinality is defined', (done) => {
      const loop = MultiInstanceLoopCharacteristics({
        $type: 'bpmn:MultiInstanceLoopCharacteristics',
        collection: '${variables.list}',
        completionCondition: {
          body: 'false'
        },
        loopCardinality: {
          body: '10'
        }
      });

      expect(loop).to.include({
        type: 'collection',
        collection: '${variables.list}'
      });
      done();
    });

    it('condition script sets loop type to condition', (done) => {
      const loop = MultiInstanceLoopCharacteristics({
        $type: 'bpmn:MultiInstanceLoopCharacteristics',
        completionCondition: {
          body: 'false'
        },
      });

      expect(loop).to.include({
        type: 'condition'
      });
      done();
    });

    it('condition expression sets loop type to condition', (done) => {
      const loop = MultiInstanceLoopCharacteristics({
        $type: 'bpmn:MultiInstanceLoopCharacteristics',
        completionCondition: {
          body: '${services.loopCondition}'
        },
      });

      expect(loop).to.include({
        type: 'condition',
        conditionExpression: '${services.loopCondition}'
      });
      done();
    });

    it('sets loop type to cardinality if cardinality integer', (done) => {
      const loop = MultiInstanceLoopCharacteristics({
        $type: 'bpmn:MultiInstanceLoopCharacteristics',
        loopCardinality: {
          body: '10'
        }
      });

      expect(loop).to.include({
        type: 'cardinality',
        cardinality: 10
      });
      done();
    });

    it('sets cardinalityExpression if expression', (done) => {
      const loop = MultiInstanceLoopCharacteristics({
        $type: 'bpmn:MultiInstanceLoopCharacteristics',
        loopCardinality: {
          body: '${variables.cardinality}'
        }
      });

      expect(loop).to.include({
        type: 'cardinality',
        cardinalityExpression: '${variables.cardinality}'
      });
      done();
    });

    it.skip('throws if loop type is not resolved', (done) => {
      function test() {
        MultiInstanceLoopCharacteristics({
          $type: 'bpmn:MultiInstanceLoopCharacteristics',
        });
      }

      expect(test).to.throw(Error, /must be defined/i);
      done();
    });

    it.skip('throws if cardinality is NaN', (done) => {
      function test() {
        MultiInstanceLoopCharacteristics({
          $type: 'bpmn:MultiInstanceLoopCharacteristics',
          loopCardinality: {
            body: '9 monkeys'
          }
        });
      }

      expect(test).to.throw(Error, /must be defined/i);
      done();
    });
  });

  describe('getLoop()', () => {
    it('cardinality expression returns NaN', (done) => {
      const loop = MultiInstanceLoopCharacteristics({
        $type: 'bpmn:MultiInstanceLoopCharacteristics',
        loopCardinality: {
          body: '${variables.cardinality}'
        }
      });

      const environment = Environment({
        variables: {
          cardinality: '8 pineapples'
        }
      });
      const task = new Task({id: 'task', type: 'bpmn:Task', environment});
      const executionContext = ActivityExecution(task, null, environment);

      const loopExecution = loop.getLoop(executionContext);

      const loopContext = loopExecution.next(executionContext);
      expect(loopContext.cardinality).to.be.NaN();

      done();
    });

    it('condition expression is supported', (done) => {
      const loop = MultiInstanceLoopCharacteristics({
        $type: 'bpmn:MultiInstanceLoopCharacteristics',
        completionCondition: {
          body: '${services.loopCondition()}'
        }
      });

      const environment = Environment({
        services: {
          loopCondition: () => {
            return false;
          }
        }
      });
      const task = new Task({id: 'task', type: 'bpmn:Task', environment});
      const executionContext = ActivityExecution(task, null, environment);

      const loopExecution = loop.getLoop(executionContext);
      expect(loopExecution.isComplete(0, executionContext)).to.be.false();

      done();
    });

    it('and have access to environment variables', (done) => {
      const loop = MultiInstanceLoopCharacteristics({
        $type: 'bpmn:MultiInstanceLoopCharacteristics',
        completionCondition: {
          body: '${services.loopCondition()}'
        }
      });

      const environment = Environment({
        variables: {
          input: 2
        },
        services: {
          loopCondition: (executionContext) => {
            return executionContext.variables.input > 1;
          }
        }
      });
      const task = new Task({id: 'task', type: 'bpmn:Task', environment});
      const executionContext = ActivityExecution(task, null, environment);

      const loopExecution = loop.getLoop(executionContext);
      expect(loopExecution.isComplete(0, executionContext)).to.be.true();

      done();
    });

    it('condition expression input arguments are supported', (done) => {
      const loop = MultiInstanceLoopCharacteristics({
        $type: 'bpmn:MultiInstanceLoopCharacteristics',
        completionCondition: {
          body: '${services.loopCondition(variables.input)}'
        }
      });

      const environment = Environment({
        variables: {
          input: 2
        },
        services: {
          loopCondition: (input) => {
            if (input === undefined) fail('input is undefined');
            return input > 1;
          }
        }
      });
      const task = new Task({id: 'task', type: 'bpmn:Task', environment});
      const executionContext = ActivityExecution(task, null, environment);

      const loopExecution = loop.getLoop(executionContext);
      expect(loopExecution.isComplete(0, executionContext)).to.be.true();

      done();
    });

  });
});
