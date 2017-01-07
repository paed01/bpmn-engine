'use strict';

const Code = require('code');
const Lab = require('lab');

const lab = exports.lab = Lab.script();
const expect = Code.expect;

const scriptHelper = require('../lib/script-helper');

lab.experiment('script-helper', () => {
  lab.describe('isJavascript()', () => {
    lab.test('returns true if JavaScript', (done) => {
      expect(scriptHelper.isJavascript('JavaScript')).to.be.true();
      done();
    });

    lab.test('returns false if not JavaScript', (done) => {
      expect(scriptHelper.isJavascript('c#')).to.be.false();
      done();
    });

    lab.test('is case insensitive', (done) => {
      expect(scriptHelper.isJavascript('javascript')).to.be.true();
      done();
    });
  });

  lab.describe('#parse', () => {
    lab.test('takes filename and script string and returns contextified script', (done) => {
      expect(scriptHelper.parse.bind(null, 'unit-test.js', 'i = 1')).to.not.throw();
      done();
    });

    lab.test('unless it has a syntax error', (done) => {
      expect(scriptHelper.parse.bind(null, 'unit-test.js', 'function (')).to.throw(SyntaxError, /unexpected token/i);
      done();
    });
  });

  lab.describe('#execute', () => {
    lab.test('takes parsed script and returns result', (done) => {
      const script = scriptHelper.parse('unit-test.js', 'true');
      expect(scriptHelper.execute(script)).to.equal(true);
      done();
    });

    lab.test('takes parsed script and variables and returns result', (done) => {
      const script = scriptHelper.parse('unit-test.js', 'variables.i;');
      expect(scriptHelper.execute(script, {
        variables: {
          i: true
        }
      })).to.equal(true);
      done();
    });

    lab.test('throws if execution fails', (done) => {
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

    lab.test('passes variables as context object', (done) => {
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

    lab.test('takes message as third argument', (done) => {
      const script = scriptHelper.parse('unit-test.js', 'i');
      const message = {
        i: true
      };
      expect(scriptHelper.execute(script, null, message)).to.be.true();
      done();
    });

    lab.test('message is a shallow copy', (done) => {
      const script = scriptHelper.parse('unit-test.js', 'i = false; i;');
      const message = {
        i: true
      };
      expect(scriptHelper.execute(script, null, message)).to.be.false();
      expect(message.i).to.be.true();
      done();
    });


    lab.test('fourth argument is callback and is passed as next to script', (done) => {
      const script = scriptHelper.parse('unit-test.js', 'next()');
      const message = {
        i: true
      };
      scriptHelper.execute(script, null, message, done);
    });

    lab.test('next has to be called or the script will not finish', (done) => {
      const script = scriptHelper.parse('unit-test.js', 'i = false;');
      const message = {
        i: true
      };
      scriptHelper.execute(script, null, message, () => {
        Code.fail('next was not supposed to be called');
      });
      setTimeout(() => {
        done();
      }, 10);
    });

    lab.test('third argument can be used as callback', (done) => {
      const script = scriptHelper.parse('unit-test.js', 'next()');
      scriptHelper.execute(script, null, done);
    });
  });
});
