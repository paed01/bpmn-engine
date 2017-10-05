'use strict';

const Code = require('code');
const Lab = require('lab');

const lab = exports.lab = Lab.script();
const expect = Code.expect;

const parameter = require('../lib/parameter');

lab.experiment('parameter', () => {
  lab.describe('list', () => {
    lab.test('returns array', (done) => {
      const parm = parameter({
        $type: 'camunda:inputParameter',
        name: 'listing',
        definition: {
          $type: 'camunda:list',
          items: [{
            value: '${listing}'
          }]
        }
      });

      expect(parm.getInputValue({listing: 1})).to.equal([1]);

      done();
    });

    lab.test('returns named value if no items are supplied', (done) => {
      const parm = parameter({
        $type: 'camunda:inputParameter',
        name: 'listing',
        definition: {
          $type: 'camunda:list'
        }
      });

      expect(parm.getInputValue({listing: 1})).to.equal(1);

      done();
    });
  });

  lab.describe('map', () => {
    lab.test('returns object', (done) => {
      const parm = parameter({
        $type: 'camunda:inputParameter',
        name: 'listing',
        definition: {
          $type: 'camunda:map',
          entries: [{
            key: 'value',
            value: '${listing}'
          }]
        }
      });

      expect(parm.getInputValue({listing: 1})).to.equal({value: 1});

      done();
    });

    lab.test('returns named value if no entries are supplied', (done) => {
      const parm = parameter({
        $type: 'camunda:inputParameter',
        name: 'listing',
        definition: {
          $type: 'camunda:map'
        }
      });

      expect(parm.getInputValue({listing: 1})).to.equal(1);

      done();
    });
  });
});
