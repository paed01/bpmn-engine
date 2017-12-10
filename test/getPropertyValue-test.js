'use strict';

const getPropertyValue = require('../lib/getPropertyValue');

describe('getPropertyValue', () => {
  describe('property path', () => {
    it('returns object value', () => {
      expect(getPropertyValue({
        a: 1
      }, 'a')).to.equal(1);
    });

    it('returns object value', () => {
      expect(getPropertyValue({
        a: {
          b: [1]
        }
      }, 'a.b[0]')).to.equal(1);
    });

    it('returns undefined if value is not found', () => {
      expect(getPropertyValue({
        a: {
          b: [1]
        }
      }, 'a.b[1]')).to.be.undefined;
    });

    it('returns 0 value', () => {
      expect(getPropertyValue({
        a: 0
      }, 'a')).to.equal(0);
    });

    it('returns expected value if nested property is 0', () => {
      expect(getPropertyValue({
        a: {
          b: [0]
        }
      }, 'a.b[0]')).to.equal(0);
    });

    it('returns undefined if source is null', () => {
      expect(getPropertyValue(null, 'a.b[1]')).to.be.undefined;
    });

    it('returns length of array', () => {
      expect(getPropertyValue({
        a: {
          b: [1]
        }
      }, 'a.b.length')).to.equal(1);
    });

    it('returns named property value', () => {
      expect(getPropertyValue({
        a: {
          'b-c': 1
        }
      }, 'a[b-c]')).to.equal(1);
    });

    it('path beginning with named property returns value', () => {
      expect(getPropertyValue({
        'a-c': {
          b: 1
        }
      }, '[a-c].b')).to.equal(1);
    });
  });

  describe('array', () => {
    it('returns value at index', () => {
      expect(getPropertyValue({
        a: {
          b: [1, 2, 3]
        }
      }, 'a.b[2]')).to.equal(3);
      expect(getPropertyValue([1, 2, 3], '[2]')).to.equal(3);
    });

    it('returns length', () => {
      expect(getPropertyValue({
        a: {
          b: [1, 2, 3]
        }
      }, 'a.b.length')).to.be.equal(3);
    });

    it('returns named value', () => {
      const list = [1, 2, 3];
      list.arb = 10;
      expect(getPropertyValue({
        a: {
          b: list
        }
      }, 'a.b.arb')).to.be.equal(10);
    });

    it('returns list item property', () => {
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
      }, 'a.b[42].c')).to.be.undefined;
    });

    it('returns undefined if out of bounds', () => {
      expect(getPropertyValue({
        a: {
          b: [1, 2, 3]
        }
      }, 'a.b[4]')).to.be.undefined;
    });

    it('returns from last if negative index', () => {
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
    });

    it('-0 returns first item', () => {
      expect(getPropertyValue({
        a: {
          b: [1, 2, 3]
        }
      }, 'a.b[-0]')).to.equal(1);
    });

    it('returns undefined value if negative index is out of bounds', () => {
      expect(getPropertyValue({
        a: {
          b: [1, 2, 3]
        }
      }, 'a.b[-4]')).to.be.undefined;
    });

    it('returns undefined value if negative index has trailing spaces', () => {
      expect(getPropertyValue({
        a: {
          b: [1, 2, 3]
        }
      }, 'a.b[-1 ]')).to.be.undefined;
    });

    it('returns undefined value if negative index has preceding spaces', () => {
      expect(getPropertyValue({
        a: {
          b: [1, 2, 3]
        }
      }, 'a.b[ -1]')).to.be.undefined;
    });

    it('returns undefined value if negative index has any spaces', () => {
      expect(getPropertyValue({
        a: {
          b: [1, 2, 3]
        }
      }, 'a.b[- 1]')).to.be.undefined;
    });

    it('returns chained index', () => {
      expect(getPropertyValue({
        a: [[1], [2], [3, 4]]
      }, 'a[-1][0]')).to.equal(3);
    });
  });

  describe('function', () => {
    it('returns function result', () => {
      expect(getPropertyValue({
        f: () => {
          return 3;
        }
      }, 'f()')).to.equal(3);
    });

    it('returns result with arguments addressing other property', () => {
      expect(getPropertyValue({
        a: 4,
        f: (input) => {
          return input;
        }
      }, 'f(a)')).to.equal(4);
    });

    it('returns result with arguments addressing chained property', () => {
      expect(getPropertyValue({
        a: {
          b: 5
        },
        f: (input) => {
          return input;
        }
      }, 'f(a.b)')).to.equal(5);
    });

    it('returns result with multiple arguments', () => {
      expect(getPropertyValue({
        a: {
          b: 5
        },
        f: (input, n) => {
          return input + Number(n);
        }
      }, 'f(a.b, 3)')).to.equal(8);
    });

    it('result with quoted argument', () => {
      expect(getPropertyValue({
        a: {
          b: 5
        },
        f: (input, n) => {
          return input + n;
        }
      }, 'f("a.b",3)')).to.equal('a.b3');
    });

    it('result returns boolean result', () => {
      expect(getPropertyValue({
        a: {
          b: 5
        },
        f: (input) => {
          return input === 5;
        }
      }, 'f(a.b,3)')).to.equal(true);
    });

    it('result returns boolean false', () => {
      expect(getPropertyValue({
        a: {
          b: 5
        },
        f: (input) => {
          return input === 4;
        }
      }, 'f(a.b,3)')).to.equal(false);
    });

    it('returns undefined function not found', () => {
      expect(getPropertyValue({
        f: () => {
          return 3;
        }
      }, 'fn()')).to.be.undefined;
    });

    it('without arguments get entire context as argument', () => {
      expect(getPropertyValue({
        a: {
          b: 3
        },
        f: (context) => {
          return context.a.b;
        }
      }, 'f()')).to.equal(3);
    });

    it('integer constant', () => {
      expect(getPropertyValue({
        a: {
          b: 5
        },
        f: (input) => {
          return input;
        }
      }, 'f(3)')).to.equal(3);
    });

    it('float constant', () => {
      expect(getPropertyValue({
        a: {
          b: 5
        },
        f: (input) => {
          return input;
        }
      }, 'f(3.1)')).to.equal(3.1);
    });

    it('function with argument resolved to 0 returns expected result', () => {
      expect(getPropertyValue({
        a: 0,
        f: function scopedFn(a) {
          return a;
        }
      }, 'f(a)')).to.equal(0);
    });
  });

  describe('function scope', () => {
    it('function scope can address this', () => {
      expect(getPropertyValue({
        a: 1,
        f: function scopedFn() {
          return this.b;
        }
      }, 'f()', {
        b: 2
      })).to.equal(2);
    });
  });

  describe('bad context object', () => {
    it('string', () => {
      expect(getPropertyValue('string', 'input')).to.be.undefined;
    });
    it('null', () => {
      expect(getPropertyValue(null, 'input')).to.be.undefined;
    });

    it('boolean true', () => {
      expect(getPropertyValue(true, 'input')).to.be.undefined;
    });
  });
});
