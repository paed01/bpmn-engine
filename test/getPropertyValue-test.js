'use strict';

const Code = require('code');
const Lab = require('lab');

const lab = exports.lab = Lab.script();
const expect = Code.expect;

const getPropertyValue = require('../lib/getPropertyValue');

lab.experiment('getPropertyValue', () => {
  lab.describe('property path', () => {
    lab.test('returns object value', (done) => {
      expect(getPropertyValue({
        a: {
          b: [1]
        }
      }, 'a.b[0]')).to.equal(1);
      done();
    });

    lab.test('returns undefined if value is not found', (done) => {
      expect(getPropertyValue({
        a: {
          b: [1]
        }
      }, 'a.b[1]')).to.be.undefined();
      done();
    });

    lab.test('returns undefined if source is null', (done) => {
      expect(getPropertyValue(null, 'a.b[1]')).to.be.undefined();
      done();
    });

    lab.test('returns length of array', (done) => {
      expect(getPropertyValue({
        a: {
          b: [1]
        }
      }, 'a.b.length')).to.equal(1);
      done();
    });

    lab.test('returns named property value', (done) => {
      expect(getPropertyValue({
        a: {
          'b-c': 1
        }
      }, 'a[b-c]')).to.equal(1);
      done();
    });

    lab.test('path beginning with named property returns value', (done) => {
      expect(getPropertyValue({
        'a-c': {
          b: 1
        }
      }, '[a-c].b')).to.equal(1);
      done();
    });
  });

  lab.describe('default value', () => {
    lab.test('undefined returns default value', (done) => {
      expect(getPropertyValue(undefined, 'input', 1)).to.equal(1);
      done();
    });
  });
});
