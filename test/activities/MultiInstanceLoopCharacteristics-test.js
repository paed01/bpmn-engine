'use strict';

const Code = require('code');
const Lab = require('lab');

const lab = exports.lab = Lab.script();
const expect = Code.expect;

const MultiInstanceLoopCharacteristics = require('../../lib/mapper')('bpmn:MultiInstanceLoopCharacteristics');

lab.experiment('MultiInstanceLoopCharacteristics', () => {

  lab.describe('ctor', () => {
    lab.test('sets loop type to collection if collection is defined', (done) => {
      const loop = new MultiInstanceLoopCharacteristics({
        $type: 'bpmn:MultiInstanceLoopCharacteristics',
        collection: '${variables.list}'
      });

      expect(loop.characteristics).to.include({
        type: 'collection',
        collection: '${variables.list}'
      });
      done();
    });

    lab.test('sets loop type to collection if collection, condition, and cardinality is defined', (done) => {
      const loop = new MultiInstanceLoopCharacteristics({
        $type: 'bpmn:MultiInstanceLoopCharacteristics',
        collection: '${variables.list}',
        completionCondition: {
          body: 'false'
        },
        loopCardinality: {
          body: '10'
        }
      });

      expect(loop.characteristics).to.include({
        type: 'collection',
        collection: '${variables.list}'
      });
      done();
    });

    lab.test('condition script sets loop type to condition', (done) => {
      const loop = new MultiInstanceLoopCharacteristics({
        $type: 'bpmn:MultiInstanceLoopCharacteristics',
        completionCondition: {
          body: 'false'
        },
      });

      expect(loop.characteristics).to.include({
        type: 'condition'
      });
      done();
    });

    lab.test('condition expression sets loop type to condition', (done) => {
      const loop = new MultiInstanceLoopCharacteristics({
        $type: 'bpmn:MultiInstanceLoopCharacteristics',
        completionCondition: {
          body: '${services.loopCondition}'
        },
      });

      expect(loop.characteristics).to.include({
        type: 'condition',
        conditionExpression: '${services.loopCondition}'
      });
      done();
    });

    lab.test('sets loop type to cardinality if cardinality integer', (done) => {
      const loop = new MultiInstanceLoopCharacteristics({
        $type: 'bpmn:MultiInstanceLoopCharacteristics',
        loopCardinality: {
          body: '10'
        }
      });

      expect(loop.characteristics).to.include({
        type: 'cardinality',
        cardinality: 10
      });
      done();
    });

    lab.test('sets cardinalityExpression if expression', (done) => {
      const loop = new MultiInstanceLoopCharacteristics({
        $type: 'bpmn:MultiInstanceLoopCharacteristics',
        loopCardinality: {
          body: '${variables.cardinality}'
        }
      });

      expect(loop.characteristics).to.include({
        type: 'cardinality',
        cardinalityExpression: '${variables.cardinality}'
      });
      done();
    });

    lab.test('throws if loop type is not resolved', (done) => {
      function test() {
        new MultiInstanceLoopCharacteristics({ // eslint-disable-line no-new
          $type: 'bpmn:MultiInstanceLoopCharacteristics',
        });
      }

      expect(test).to.throw(Error, /must be defined/i);
      done();
    });

    lab.test('throws if cardinality is NaN', (done) => {
      function test() {
        new MultiInstanceLoopCharacteristics({ // eslint-disable-line no-new
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

  lab.describe('run()', () => {
    lab.test('throws if cardinality expression returns NaN', (done) => {
      const loop = new MultiInstanceLoopCharacteristics({
        $type: 'bpmn:MultiInstanceLoopCharacteristics',
        loopCardinality: {
          body: '${variables.cardinality}'
        }
      });

      expect(() => {
        loop.run({
          variables: {
            cardinality: '8 pineapples'
          }
        });
      }).to.throw(/returned not a number/);

      done();
    });

    lab.test('condition expression is executed', (done) => {
      const loop = new MultiInstanceLoopCharacteristics({
        $type: 'bpmn:MultiInstanceLoopCharacteristics',
        completionCondition: {
          body: '${services.loopCondition()}'
        }
      });

      expect(loop.run({
        services: {
          loopCondition: () => {
            return false;
          }
        }
      })).to.equal(false);

      expect(loop.run({
        variables: {
          input: 2
        },
        services: {
          loopCondition: (executionContext) => {
            return executionContext.variables.input > 1;
          }
        }
      })).to.equal(true);

      done();
    });

    lab.test('condition expression with input argument is executed', (done) => {
      const loop = new MultiInstanceLoopCharacteristics({
        $type: 'bpmn:MultiInstanceLoopCharacteristics',
        completionCondition: {
          body: '${services.loopCondition(variables.input)}'
        }
      });

      expect(loop.run({
        variables: {
          input: 2
        },
        services: {
          loopCondition: (input) => {
            return input > 1;
          }
        }
      })).to.equal(true);

      done();
    });

  });
});
