'use strict';

const Code = require('code');
const Lab = require('lab');

const lab = exports.lab = Lab.script();
const expect = Code.expect;

const mapper = require('../lib/mapper');

lab.experiment('mapper', () => {
  lab.test('returns Bpmn instance type from context', (done) => {
    const event = mapper.fromType('bpmn:StartEvent');
    expect(event).to.be.a.function();
    done();
  });

  lab.test('throws if Bpmn instance type is not mapped', (done) => {
    expect(() => {
      mapper.fromType('bpmn:NonExisting');
    }).to.throw();
    done();
  });

  lab.test('if $type is missing from input', (done) => {
    expect(() => {
      mapper.fromType({});
    }).to.throw(Error);
    done();
  });

  lab.describe('isTask', () => {
    lab.test('bpmn:UserTask is true', (done) => {
      expect(mapper.isTask('bpmn:UserTask')).to.be.true();
      done();
    });

    lab.test('bpmn:StartEvent is false', (done) => {
      expect(mapper.isTask('bpmn:StartEvent')).to.be.false();
      done();
    });

    lab.test('empty is false', (done) => {
      expect(mapper.isTask(null)).to.be.false();
      expect(mapper.isTask()).to.be.false();
      expect(mapper.isTask('')).to.be.false();
      done();
    });
  });
});
