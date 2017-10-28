'use strict';

const Environment = require('../../../lib/Environment');
const Lab = require('lab');
const Parameter = require('../../../lib/extensions/camunda/Parameter');

const lab = exports.lab = Lab.script();
const {describe, it} = lab;
const {expect} = Lab.assertions;

describe('Parameter', () => {
  describe('list', () => {
    it('input returns array', (done) => {
      const parm = Parameter({
        $type: 'camunda:inputParameter',
        name: 'list',
        definition: {
          $type: 'camunda:list',
          items: [{
            value: '${listing}'
          }]
        }
      }, {
        resolveExpression: function(expr) {
          if (expr === '${listing}') return 1;
        }
      });

      expect(parm.activate({
        listing: 1
      }).get()).to.equal([1]);

      done();
    });

    it('input returns named value if no items are supplied', (done) => {
      const parm = Parameter({
        $type: 'camunda:inputParameter',
        name: 'listing',
        definition: {
          $type: 'camunda:list'
        }
      }, Environment());

      expect(parm.activate({listing: 1}).get()).to.equal(1);

      done();
    });
  });

  describe('map', () => {
    it('returns object', (done) => {
      const parm = Parameter({
        $type: 'camunda:inputParameter',
        name: 'map',
        definition: {
          $type: 'camunda:map',
          entries: [{
            key: 'value',
            value: '${listing}'
          }]
        }
      }, {
        resolveExpression: function(expr) {
          if (expr === '${listing}') return 1;
        }
      });

      expect(parm.activate({listing: 1}).get()).to.equal({value: 1});

      done();
    });

    it('returns named value if no entries are supplied', (done) => {
      const parm = Parameter({
        $type: 'camunda:inputParameter',
        name: 'listing',
        definition: {
          $type: 'camunda:map'
        }
      }, {});

      expect(parm.activate({listing: 1}).get()).to.equal(1);

      done();
    });
  });
});
