'use strict';

const Lab = require('lab');
const scriptHelper = require('../lib/script-helper');

const lab = exports.lab = Lab.script();
const {describe, it} = lab;
const {expect} = Lab.assertions;

describe('script-helper', () => {
  describe('isJavascript()', () => {
    it('returns true if JavaScript', (done) => {
      expect(scriptHelper.isJavascript('JavaScript')).to.be.true();
      done();
    });

    it('returns false if not JavaScript', (done) => {
      expect(scriptHelper.isJavascript('c#')).to.be.false();
      done();
    });

    it('is case insensitive', (done) => {
      expect(scriptHelper.isJavascript('javascript')).to.be.true();
      done();
    });

    it('returns false if undefined', (done) => {
      expect(scriptHelper.isJavascript()).to.be.false();
      done();
    });
  });

  describe('parse()', () => {
    it('takes filename and script string and returns contextified script', (done) => {
      expect(scriptHelper.parse.bind(null, 'unit-test.js', 'i = 1')).to.not.throw();
      done();
    });

    it('unless it has a syntax error', (done) => {
      expect(scriptHelper.parse.bind(null, 'unit-test.js', 'function (')).to.throw(SyntaxError, /unexpected token/i);
      done();
    });
  });

  describe('execute()', () => {
    it('takes parsed script and returns result', (done) => {
      const script = scriptHelper.parse('unit-test.js', 'true');
      expect(scriptHelper.execute(script)).to.equal(true);
      done();
    });

    it('takes parsed script and variables and returns result', (done) => {
      const script = scriptHelper.parse('unit-test.js', 'variables.i;');
      expect(scriptHelper.execute(script, {
        variables: {
          i: true
        }
      })).to.equal(true);
      done();
    });

    it('throws if execution fails', (done) => {
      const script = scriptHelper.parse('unit-test.js', 'variables.i.j;');

      try {
        scriptHelper.execute(script, {
          variables: undefined
        });
      } catch (e) {
        var err = e; // eslint-disable-line no-var
      }

      expect(err.message).to.equal('Cannot read property \'i\' of undefined');
      done();
    });

    it('passes variables as context object', (done) => {
      const script = scriptHelper.parse('unit-test.js', 'variables.i = 1; variables.i;');
      const context = {
        variables: {
          i: true
        }
      };
      expect(scriptHelper.execute(script, context)).to.equal(1);

      expect(context.variables.i).to.equal(1);

      done();
    });

    it('third argument can be used as callback', (done) => {
      const script = scriptHelper.parse('unit-test.js', 'next()');
      scriptHelper.execute(script, null, done);
    });
  });
});
