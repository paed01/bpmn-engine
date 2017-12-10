'use strict';

const scriptHelper = require('../lib/script-helper');

describe('script-helper', () => {
  describe('isJavascript()', () => {
    it('returns true if JavaScript', () => {
      expect(scriptHelper.isJavascript('JavaScript')).to.be.true;
    });

    it('returns false if not JavaScript', () => {
      expect(scriptHelper.isJavascript('c#')).to.be.false;
    });

    it('is case insensitive', () => {
      expect(scriptHelper.isJavascript('javascript')).to.be.true;
    });

    it('returns false if undefined', () => {
      expect(scriptHelper.isJavascript()).to.be.false;
    });
  });

  describe('parse()', () => {
    it('takes filename and script string and returns contextified script', () => {
      expect(scriptHelper.parse.bind(null, 'unit-test.js', 'i = 1')).to.not.throw();
    });

    it('unless it has a syntax error', () => {
      expect(scriptHelper.parse.bind(null, 'unit-test.js', 'function (')).to.throw(SyntaxError, /unexpected token/i);
    });
  });

  describe('execute()', () => {
    it('takes parsed script and returns result', () => {
      const script = scriptHelper.parse('unit-test.js', 'true');
      expect(scriptHelper.execute(script)).to.equal(true);
    });

    it('takes parsed script and variables and returns result', () => {
      const script = scriptHelper.parse('unit-test.js', 'variables.i;');
      expect(scriptHelper.execute(script, {
        variables: {
          i: true
        }
      })).to.equal(true);
    });

    it('throws if execution fails', () => {
      const script = scriptHelper.parse('unit-test.js', 'variables.i.j;');

      try {
        scriptHelper.execute(script, {
          variables: undefined
        });
      } catch (e) {
        var err = e; // eslint-disable-line no-var
      }

      expect(err.message).to.equal('Cannot read property \'i\' of undefined');
    });

    it('passes variables as context object', () => {
      const script = scriptHelper.parse('unit-test.js', 'variables.i = 1; variables.i;');
      const context = {
        variables: {
          i: true
        }
      };
      expect(scriptHelper.execute(script, context)).to.equal(1);

      expect(context.variables.i).to.equal(1);
    });

    it('third argument can be used as callback', (done) => {
      const script = scriptHelper.parse('unit-test.js', 'next()');
      scriptHelper.execute(script, null, done);
    });
  });
});
