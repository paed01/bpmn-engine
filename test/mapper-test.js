'use strict';

const mapper = require('../lib/mapper');

describe('mapper', () => {
  it('returns Bpmn instance type from context', () => {
    const event = mapper('bpmn:StartEvent');
    expect(event).to.be.a('function');
  });

  it('throws if Bpmn instance type is not mapped', () => {
    expect(() => {
      mapper('bpmn:NonExisting');
    }).to.throw();
  });

  it('if $type is missing from input', () => {
    expect(() => {
      mapper({});
    }).to.throw(Error);
  });

  describe('isTask', () => {
    it('bpmn:UserTask is true', () => {
      expect(mapper.isTask('bpmn:UserTask')).to.be.true;
    });

    it('bpmn:StartEvent is false', () => {
      expect(mapper.isTask('bpmn:StartEvent')).to.be.false;
    });

    it('empty is false', () => {
      expect(mapper.isTask(null)).to.be.false;
      expect(mapper.isTask()).to.be.false;
      expect(mapper.isTask('')).to.be.false;
    });
  });
});
