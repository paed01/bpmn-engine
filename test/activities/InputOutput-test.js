'use strict';

const Code = require('code');
const Lab = require('lab');

const lab = exports.lab = Lab.script();
const expect = Code.expect;

const mapper = require('../../lib/mapper');

lab.experiment('Activity InputOutput', () => {

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
