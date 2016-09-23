'use strict';

const Code = require('code');
const Lab = require('lab');

const lab = exports.lab = Lab.script();
const expect = Code.expect;

const mapper = require('../../lib/mapper');

lab.experiment('Activity InputOutput', () => {

  lab.describe('ctor', () => {
    lab.test('script parameter throws if type is not JavaScript', (done) => {
      function test() {
        new mapper.ActivityIO({ // eslint-disable-line no-new
          $type: 'camunda:inputOutput',
          $children: [{
            $type: 'camunda:inputParameter',
            name: 'message',
            $children: [{
              $type: 'camunda:script',
              scriptFormat: 'CoffeeScript',
              $body: 'i in loop'
            }]
          }]
        });
      }

      expect(test).to.throw(Error, /CoffeeScript is unsupported/i);
      done();
    });

    lab.test('no children is ignored', (done) => {
      const io = new mapper.ActivityIO({ // eslint-disable-line no-new
        $type: 'camunda:inputOutput',
        $children: []
      });

      expect(io.input).to.be.empty();
      expect(io.output).to.be.empty();

      done();
    });
  });

  lab.describe('#getOutput', () => {

    lab.test('returns static values', (done) => {
      const io = new mapper.ActivityIO({
        $type: 'camunda:inputOutput',
        $children: [{
          $type: 'camunda:inputParameter',
          name: 'taskinput',
          $body: 'Empty'
        }, {
          $type: 'camunda:outputParameter',
          name: 'message',
          $body: 'I\'m done'
        }, {
          $type: 'camunda:outputParameter',
          name: 'arbval',
          $body: '1'
        }]
      });

      expect(io.getOutput()).to.only.include({
        message: 'I\'m done',
        arbval: '1'
      });
      done();
    });

    lab.test('returns script values', (done) => {
      const io = new mapper.ActivityIO({
        $type: 'camunda:inputOutput',
        $children: [{
          $type: 'camunda:outputParameter',
          name: 'message',
          $children: [{
            $type: 'camunda:script',
            scriptFormat: 'JavaScript',
            $body: '"Me too"'
          }],
        }, {
          $type: 'camunda:outputParameter',
          name: 'arbval',
          $body: '1'
        }]
      });
      expect(io.getOutput()).to.only.include({
        message: 'Me too',
        arbval: '1'
      });
      done();
    });

    lab.test('returns script values that address variable', (done) => {
      const io = new mapper.ActivityIO({
        $type: 'camunda:inputOutput',
        $children: [{
          $type: 'camunda:outputParameter',
          name: 'message',
          $children: [{
            $type: 'camunda:script',
            scriptFormat: 'JavaScript',
            $body: '`Me too ${context.arbval}`;'
          }],
        }, {
          $type: 'camunda:outputParameter',
          name: 'arbval',
          $body: '1'
        }]
      });
      expect(io.getOutput({arbval: 10})).to.only.include({
        message: 'Me too 10',
        arbval: '1'
      });
      done();
    });


    lab.test('empty parameter children return undefined', (done) => {
      const io = new mapper.ActivityIO({ // eslint-disable-line no-new
        $type: 'camunda:inputOutput',
        $children: [{
          $type: 'camunda:outputParameter',
          name: 'message',
          $children: []
        }]
      });

      expect(io.getOutput({arbval: 10})).to.only.include({
        message: undefined
      });

      done();
    });

    lab.test('no parameter children return undefined', (done) => {
      const io = new mapper.ActivityIO({ // eslint-disable-line no-new
        $type: 'camunda:inputOutput',
        $children: [{
          $type: 'camunda:outputParameter',
          name: 'message'
        }]
      });

      expect(io.getOutput({arbval: 10})).to.only.include({
        message: undefined
      });

      done();
    });

    lab.test('unknown parameter child return undefined', (done) => {
      const io = new mapper.ActivityIO({ // eslint-disable-line no-new
        $type: 'camunda:inputOutput',
        $children: [{
          $type: 'camunda:outputParameter',
          name: 'message',
          $children: [{
            $type: 'madeup:script',
            scriptFormat: 'JavaScript',
            $body: '`Me too ${context.arbval}`;'
          }]
        }]
      });

      expect(io.getOutput({arbval: 10})).to.only.include({
        message: undefined
      });

      done();
    });
  });

  lab.describe('#getInput', () => {

    lab.test('returns static values', (done) => {
      const io = new mapper.ActivityIO({
        $type: 'camunda:inputOutput',
        $children: [{
          $type: 'camunda:inputParameter',
          name: 'taskinput',
          $body: 'Empty'
        }, {
          $type: 'camunda:outputParameter',
          name: 'message',
          $body: 'I\'m done'
        }, {
          $type: 'camunda:outputParameter',
          name: 'arbval',
          $body: '1'
        }]
      });

      expect(io.getInput()).to.only.include({
        taskinput: 'Empty'
      });
      done();
    });

    lab.test('returns script values', (done) => {
      const io = new mapper.ActivityIO({
        $type: 'camunda:inputOutput',
        $children: [{
          $type: 'camunda:inputParameter',
          name: 'message',
          $children: [{
            $type: 'camunda:script',
            scriptFormat: 'JavaScript',
            $body: '"Empty"'
          }],
        }, {
          $type: 'camunda:outputParameter',
          name: 'arbval',
          $body: '1'
        }]
      });
      expect(io.getInput()).to.only.include({
        message: 'Empty'
      });
      done();
    });

    lab.test('returns script values that address variable', (done) => {
      const io = new mapper.ActivityIO({
        $type: 'camunda:inputOutput',
        $children: [{
          $type: 'camunda:inputParameter',
          name: 'message',
          $children: [{
            $type: 'camunda:script',
            scriptFormat: 'JavaScript',
            $body: '`Me too ${context.arbval}`;'
          }],
        }, {
          $type: 'camunda:outputParameter',
          name: 'arbval',
          $body: '1'
        }]
      });
      expect(io.getInput({arbval: 10})).to.only.include({
        message: 'Me too 10'
      });
      done();
    });
  });
});
