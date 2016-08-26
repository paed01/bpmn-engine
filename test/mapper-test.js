'use strict';

const Code = require('code');
const Lab = require('lab');

const lab = exports.lab = Lab.script();
const expect = Code.expect;

const mapper = require('../lib/mapper');

lab.experiment('mapper', () => {
  lab.test('returns Bpmn instance type from context', (done) => {
    const event = mapper({
      $type: 'bpmn:StartEvent'
    });
    expect(event).to.be.a.function();
    done();
  });

  lab.test('throws if Bpmn instance type is not mapped', (done) => {
    expect(() => {
      mapper({
        $type: 'bpmn:NonExisting'
      });
    }).to.throw();
    done();
  });

  lab.test('if $type is missing from input', (done) => {
    expect(() => {
      mapper({});
    }).to.throw(Error, 'KAS');
    done();
  });
});
