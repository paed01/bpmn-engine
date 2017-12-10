'use strict';

const ActivityExecution = require('../../lib/activities/activity-execution');
const Environment = require('../../lib/Environment');
const MultiInstanceLoopCharacteristics = require('../../lib/extensions/MultiInstanceLoopCharacteristics');
const testHelpers = require('../helpers/testHelpers');

describe('MultiInstanceLoopCharacteristics', () => {
  describe('behaviour', () => {
    it('sets loop type to collection if collection is defined', () => {
      const loop = MultiInstanceLoopCharacteristics({
        $type: 'bpmn:MultiInstanceLoopCharacteristics',
        collection: '${variables.list}'
      }, {});

      expect(loop).to.include({
        type: 'bpmn:MultiInstanceLoopCharacteristics',
        collection: '${variables.list}',
        loopType: 'collection'
      });
    });

    it('sets loop type to collection if collection, condition, and cardinality is defined', () => {
      const loop = MultiInstanceLoopCharacteristics({
        $type: 'bpmn:MultiInstanceLoopCharacteristics',
        collection: '${variables.list}',
        completionCondition: {
          body: 'false'
        },
        loopCardinality: {
          body: '10'
        }
      }, {});

      expect(loop).to.include({
        loopType: 'collection',
        collection: '${variables.list}'
      });
    });

    it('condition script sets loop type to condition', () => {
      const loop = MultiInstanceLoopCharacteristics({
        $type: 'bpmn:MultiInstanceLoopCharacteristics',
        completionCondition: {
          body: 'false'
        },
      }, {});

      expect(loop).to.include({
        loopType: 'condition'
      });
    });

    it('condition expression sets loop type to condition', () => {
      const loop = MultiInstanceLoopCharacteristics({
        $type: 'bpmn:MultiInstanceLoopCharacteristics',
        completionCondition: {
          body: '${services.loopCondition}'
        }
      }, {});

      expect(loop).to.include({
        loopType: 'condition'
      });
    });

    it('sets loop type to cardinality if cardinality integer', () => {
      const loop = MultiInstanceLoopCharacteristics({
        $type: 'bpmn:MultiInstanceLoopCharacteristics',
        loopCardinality: {
          body: '10'
        }
      }, {});

      expect(loop).to.include({
        loopType: 'cardinality'
      });
    });

    it.skip('throws if loop type is not resolved', () => {
      function test() {
        MultiInstanceLoopCharacteristics({
          $type: 'bpmn:MultiInstanceLoopCharacteristics',
        }, {});
      }

      expect(test).to.throw(Error, /must be defined/i);
    });

    it.skip('throws if cardinality is NaN', () => {
      function test() {
        MultiInstanceLoopCharacteristics({
          $type: 'bpmn:MultiInstanceLoopCharacteristics',
          loopCardinality: {
            body: '9 monkeys'
          }
        }, {});
      }

      expect(test).to.throw(Error, /must be defined/i);
    });
  });

  describe('activate()', () => {
    let task;
    before(async () => {
      const source = `
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="mainProcess" isExecutable="true">
          <task id="task" />
        </process>
      </definitions>`;

      const context = await testHelpers.context(source);
      task = context.getActivityById('task');
    });

    it('cardinality expression returns NaN', () => {
      const environment = Environment({
        variables: {
          cardinality: '8 pineapples'
        }
      });

      const loop = MultiInstanceLoopCharacteristics({
        $type: 'bpmn:MultiInstanceLoopCharacteristics',
        loopCardinality: {
          body: '${variables.cardinality}'
        }
      }, {environment});

      const ectivityExecution = ActivityExecution(task, null, environment);

      const loopExecution = loop.activate(task, ectivityExecution);

      const loopContext = loopExecution.next(ectivityExecution);
      expect(isNaN(loopContext.cardinality)).to.be.true;
    });

    it('condition expression is supported', () => {
      const environment = Environment({
        services: {
          loopCondition: () => {
            return false;
          }
        }
      });

      const loop = MultiInstanceLoopCharacteristics({
        $type: 'bpmn:MultiInstanceLoopCharacteristics',
        completionCondition: {
          body: '${services.loopCondition()}'
        }
      }, {environment});

      const executionContext = ActivityExecution(task, null, environment);

      const loopExecution = loop.activate(task, executionContext);
      expect(loopExecution.isComplete(0, executionContext)).to.be.false;
    });

    it('and have access to environment variables', () => {
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

      const loop = MultiInstanceLoopCharacteristics({
        $type: 'bpmn:MultiInstanceLoopCharacteristics',
        completionCondition: {
          body: '${services.loopCondition()}'
        }
      }, {environment});

      const executionContext = ActivityExecution(task, null, environment);

      const loopExecution = loop.activate(executionContext);
      expect(loopExecution.isComplete(0, executionContext)).to.be.true;
    });

    it('condition expression input arguments are supported', () => {
      const environment = Environment({
        variables: {
          input: 2
        },
        services: {
          loopCondition: (input) => {
            if (input === undefined) expect.fail('input is undefined');
            return input > 1;
          }
        }
      });

      const loop = MultiInstanceLoopCharacteristics({
        $type: 'bpmn:MultiInstanceLoopCharacteristics',
        completionCondition: {
          body: '${services.loopCondition(variables.input)}'
        }
      }, {environment});

      const executionContext = ActivityExecution(task, null, environment);

      const loopExecution = loop.activate(executionContext);
      expect(loopExecution.isComplete(0, executionContext)).to.be.true;
    });
  });
});
