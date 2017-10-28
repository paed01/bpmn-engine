'use strict';

const ActivityExecution = require('../../lib/activities/activity-execution');
const Environment = require('../../lib/Environment');
const Lab = require('lab');
const MultiInstanceLoopCharacteristics = require('../../lib/extensions/MultiInstanceLoopCharacteristics');
const testHelpers = require('../helpers/testHelpers');

const lab = exports.lab = Lab.script();
const {before, describe, it} = lab;
const {expect, fail} = Lab.assertions;

describe('MultiInstanceLoopCharacteristics', () => {

  describe('behaviour', () => {
    it('sets loop type to collection if collection is defined', (done) => {
      const loop = MultiInstanceLoopCharacteristics({
        $type: 'bpmn:MultiInstanceLoopCharacteristics',
        collection: '${variables.list}'
      }, {});

      expect(loop).to.include({
        type: 'bpmn:MultiInstanceLoopCharacteristics',
        collection: '${variables.list}',
        loopType: 'collection'
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
      }, {});

      expect(loop).to.include({
        loopType: 'collection',
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
      }, {});

      expect(loop).to.include({
        loopType: 'condition'
      });
      done();
    });

    it('condition expression sets loop type to condition', (done) => {
      const loop = MultiInstanceLoopCharacteristics({
        $type: 'bpmn:MultiInstanceLoopCharacteristics',
        completionCondition: {
          body: '${services.loopCondition}'
        }
      }, {});

      expect(loop).to.include({
        loopType: 'condition'
      });
      done();
    });

    it('sets loop type to cardinality if cardinality integer', (done) => {
      const loop = MultiInstanceLoopCharacteristics({
        $type: 'bpmn:MultiInstanceLoopCharacteristics',
        loopCardinality: {
          body: '10'
        }
      }, {});

      expect(loop).to.include({
        loopType: 'cardinality'
      });
      done();
    });

    it.skip('throws if loop type is not resolved', (done) => {
      function test() {
        MultiInstanceLoopCharacteristics({
          $type: 'bpmn:MultiInstanceLoopCharacteristics',
        }, {});
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
        }, {});
      }

      expect(test).to.throw(Error, /must be defined/i);
      done();
    });
  });

  describe('activate()', () => {
    let task;
    before((done) => {
      const source = `
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="mainProcess" isExecutable="true">
          <task id="task" />
        </process>
      </definitions>`;
      testHelpers.getContext(source, (err, result) => {
        if (err) return done(err);

        task = result.getActivityById('task');
        done();
      });
    });

    it('cardinality expression returns NaN', (done) => {
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
      expect(loopContext.cardinality).to.be.NaN();

      done();
    });

    it('condition expression is supported', (done) => {
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
      expect(loopExecution.isComplete(0, executionContext)).to.be.false();

      done();
    });

    it('and have access to environment variables', (done) => {
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
      expect(loopExecution.isComplete(0, executionContext)).to.be.true();

      done();
    });

    it('condition expression input arguments are supported', (done) => {
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

      const loop = MultiInstanceLoopCharacteristics({
        $type: 'bpmn:MultiInstanceLoopCharacteristics',
        completionCondition: {
          body: '${services.loopCondition(variables.input)}'
        }
      }, {environment});

      const executionContext = ActivityExecution(task, null, environment);

      const loopExecution = loop.activate(executionContext);
      expect(loopExecution.isComplete(0, executionContext)).to.be.true();

      done();
    });

  });
});
