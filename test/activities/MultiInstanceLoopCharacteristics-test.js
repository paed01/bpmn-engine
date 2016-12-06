'use strict';

const Code = require('code');
const Lab = require('lab');

const lab = exports.lab = Lab.script();
const expect = Code.expect;

const MultiInstanceLoopCharacteristics = require('../../lib/mapper')('bpmn:MultiInstanceLoopCharacteristics');

lab.experiment('MultiInstanceLoopCharacteristics', () => {

  lab.describe('ctor', () => {
    lab.test('sets loop type to collection if collection is defined', (done) => {
      const loop = new MultiInstanceLoopCharacteristics({ // eslint-disable-line no-new
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
      const loop = new MultiInstanceLoopCharacteristics({ // eslint-disable-line no-new
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

    lab.test('throws if loop type is not resolved', (done) => {
      function test() {
        new MultiInstanceLoopCharacteristics({ // eslint-disable-line no-new
          $type: 'bpmn:MultiInstanceLoopCharacteristics',
        });
      }

      expect(test).to.throw(Error, /must be defined/i);
      done();
    });
  });

});
