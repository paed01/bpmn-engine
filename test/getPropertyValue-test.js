'use strict';

const getPropertyValue = require('../lib/getPropertyValue');
const Lab = require('lab');

const lab = exports.lab = Lab.script();
const {describe, it} = lab;
const {expect} = Lab.assertions;

describe('getPropertyValue', () => {
  describe('property path', () => {
    it('returns object value', (done) => {
      expect(getPropertyValue({
        a: 1
      }, 'a')).to.equal(1);
      done();
    });

    it('returns object value', (done) => {
      expect(getPropertyValue({
        a: {
          b: [1]
        }
      }, 'a.b[0]')).to.equal(1);
      done();
    });

    it('returns undefined if value is not found', (done) => {
      expect(getPropertyValue({
        a: {
          b: [1]
        }
      }, 'a.b[1]')).to.be.undefined();
      done();
    });

    it('returns 0 value', (done) => {
      expect(getPropertyValue({
        a: 0
      }, 'a')).to.equal(0);
      done();
    });

    it('returns expected value if nested property is 0', (done) => {
      expect(getPropertyValue({
        a: {
          b: [0]
        }
      }, 'a.b[0]')).to.equal(0);
      done();
    });

    it('returns undefined if source is null', (done) => {
      expect(getPropertyValue(null, 'a.b[1]')).to.be.undefined();
      done();
    });

    it('returns length of array', (done) => {
      expect(getPropertyValue({
        a: {
          b: [1]
        }
      }, 'a.b.length')).to.equal(1);
      done();
    });

    it('returns named property value', (done) => {
      expect(getPropertyValue({
        a: {
          'b-c': 1
        }
      }, 'a[b-c]')).to.equal(1);
      done();
    });

    it('path beginning with named property returns value', (done) => {
      expect(getPropertyValue({
        'a-c': {
          b: 1
        }
      }, '[a-c].b')).to.equal(1);
      done();
    });
  });

  describe('array', () => {
    it('returns value at index', (done) => {
      expect(getPropertyValue({
        a: {
          b: [1, 2, 3]
        }
      }, 'a.b[2]')).to.equal(3);
      expect(getPropertyValue([1, 2, 3], '[2]')).to.equal(3);
      done();
    });

    it('returns length', (done) => {
      expect(getPropertyValue({
        a: {
          b: [1, 2, 3]
        }
      }, 'a.b.length')).to.be.equal(3);
      done();
    });

    it('returns named value', (done) => {
      const list = [1, 2, 3];
      list.arb = 10;
      expect(getPropertyValue({
        a: {
          b: list
        }
      }, 'a.b.arb')).to.be.equal(10);
      done();
    });

    it('returns list item property', (done) => {
      const list = [{c: 1}, {c: 2}, {c: 3}];
      expect(getPropertyValue({
        a: {
          b: list
        }
      }, 'a.b[0].c')).to.be.equal(1);
      expect(getPropertyValue({
        a: {
          b: list
        }
      }, 'a.b[-1].c')).to.be.equal(3);
      expect(getPropertyValue({
        a: {
          b: list
        }
      }, 'a.b[42].c')).to.be.undefined();
      done();
    });

    it('returns undefined if out of bounds', (done) => {
      expect(getPropertyValue({
        a: {
          b: [1, 2, 3]
        }
      }, 'a.b[4]')).to.be.undefined();
      done();
    });

    it('returns from last if negative index', (done) => {
      expect(getPropertyValue({
        a: {
          b: [1, 2, 3]
        }
      }, 'a.b[-1]')).to.equal(3);
      expect(getPropertyValue({
        a: {
          b: [1, 2, 3]
        }
      }, 'a.b[-2]')).to.equal(2);
      expect(getPropertyValue({
        a: {
          b: [1, 2, 3]
        }
      }, 'a.b[-3]')).to.equal(1);
      done();
    });

    it('-0 returns first item', (done) => {
      expect(getPropertyValue({
        a: {
          b: [1, 2, 3]
        }
      }, 'a.b[-0]')).to.equal(1);
      done();
    });

    it('returns undefined value if negative index is out of bounds', (done) => {
      expect(getPropertyValue({
        a: {
          b: [1, 2, 3]
        }
      }, 'a.b[-4]')).to.be.undefined();
      done();
    });

    it('returns undefined value if negative index has trailing spaces', (done) => {
      expect(getPropertyValue({
        a: {
          b: [1, 2, 3]
        }
      }, 'a.b[-1 ]')).to.be.undefined();
      done();
    });

    it('returns undefined value if negative index has preceding spaces', (done) => {
      expect(getPropertyValue({
        a: {
          b: [1, 2, 3]
        }
      }, 'a.b[ -1]')).to.be.undefined();
      done();
    });

    it('returns undefined value if negative index has any spaces', (done) => {
      expect(getPropertyValue({
        a: {
          b: [1, 2, 3]
        }
      }, 'a.b[- 1]')).to.be.undefined();
      done();
    });

    it('returns chained index', (done) => {
      expect(getPropertyValue({
        a: [[1], [2], [3, 4]]
      }, 'a[-1][0]')).to.equal(3);
      done();
    });
  });

  describe('function', () => {
    it('returns function result', (done) => {
      expect(getPropertyValue({
        f: () => {
          return 3;
        }
      }, 'f()')).to.equal(3);
      done();
    });

    it('returns result with arguments addressing other property', (done) => {
      expect(getPropertyValue({
        a: 4,
        f: (input) => {
          return input;
        }
      }, 'f(a)')).to.equal(4);
      done();
    });

    it('returns result with arguments addressing chained property', (done) => {
      expect(getPropertyValue({
        a: {
          b: 5
        },
        f: (input) => {
          return input;
        }
      }, 'f(a.b)')).to.equal(5);
      done();
    });

    it('returns result with multiple arguments', (done) => {
      expect(getPropertyValue({
        a: {
          b: 5
        },
        f: (input, n) => {
          return input + Number(n);
        }
      }, 'f(a.b, 3)')).to.equal(8);
      done();
    });

    it('result with quoted argument', (done) => {
      expect(getPropertyValue({
        a: {
          b: 5
        },
        f: (input, n) => {
          return input + n;
        }
      }, 'f("a.b",3)')).to.equal('a.b3');
      done();
    });

    it('result returns boolean result', (done) => {
      expect(getPropertyValue({
        a: {
          b: 5
        },
        f: (input) => {
          return input === 5;
        }
      }, 'f(a.b,3)')).to.equal(true);
      done();
    });

    it('result returns boolean false', (done) => {
      expect(getPropertyValue({
        a: {
          b: 5
        },
        f: (input) => {
          return input === 4;
        }
      }, 'f(a.b,3)')).to.equal(false);
      done();
    });

    it('returns undefined function not found', (done) => {
      expect(getPropertyValue({
        f: () => {
          return 3;
        }
      }, 'fn()')).to.be.undefined();
      done();
    });

    it('without arguments get entire context as argument', (done) => {
      expect(getPropertyValue({
        a: {
          b: 3
        },
        f: (context) => {
          return context.a.b;
        }
      }, 'f()')).to.equal(3);
      done();
    });

    it('integer constant', (done) => {
      expect(getPropertyValue({
        a: {
          b: 5
        },
        f: (input) => {
          return input;
        }
      }, 'f(3)')).to.equal(3);
      done();
    });

    it('float constant', (done) => {
      expect(getPropertyValue({
        a: {
          b: 5
        },
        f: (input) => {
          return input;
        }
      }, 'f(3.1)')).to.equal(3.1);
      done();
    });

    it('function with argument resolved to 0 returns expected result', (done) => {
      expect(getPropertyValue({
        a: 0,
        f: function scopedFn(a) {
          return a;
        }
      }, 'f(a)')).to.equal(0);
      done();
    });
  });

  describe('function scope', () => {
    it('function scope can address this', (done) => {
      expect(getPropertyValue({
        a: 1,
        f: function scopedFn() {
          return this.b;
        }
      }, 'f()', {
        b: 2
      })).to.equal(2);
      done();
    });
  });

  describe('bad context object', () => {
    it('string', (done) => {
      expect(getPropertyValue('string', 'input')).to.be.undefined();
      done();
    });
    it('null', (done) => {
      expect(getPropertyValue(null, 'input')).to.be.undefined();
      done();
    });

    it('boolean true', (done) => {
      expect(getPropertyValue(true, 'input')).to.be.undefined();
      done();
    });
  });
});
