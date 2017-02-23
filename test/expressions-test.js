'use strict';

const Code = require('code');
const Lab = require('lab');

const lab = exports.lab = Lab.script();
const expect = Code.expect;

const expressions = require('../lib/expressions');

lab.experiment('expressions', () => {
  lab.describe('addressing variables', () => {
    lab.test('extracts variable value', (done) => {
      expect(expressions('${variables.input}', {
        variables: {
          input: 1
        }
      })).to.equal(1);
      done();
    });

    lab.test('returns undefined if not found', (done) => {
      expect(expressions('${variables.input}', {
        variables: {
          output: 1
        }
      })).to.be.undefined();
      done();
    });

    lab.test('misspelled varailbes returns undefined', (done) => {
      expect(expressions('${varailbes.input}', {
        variables: {
          input: 1
        }
      })).to.be.undefined();
      done();
    });

    lab.test('addressing arrays returns value', (done) => {
      expect(expressions('${variables.input[1]}', {
        variables: {
          input: [0, 1]
        }
      })).to.equal(1);
      done();
    });

    lab.test('addressing array without index returns undefined', (done) => {
      expect(expressions('${variables.input[]}', {
        variables: {
          input: [0, 1]
        }
      })).to.be.undefined();
      done();
    });

    lab.test('addressing named property returns value', (done) => {
      expect(expressions('${variables.input[#complexName]}', {
        variables: {
          input: {
            '#complexName': 1
          }
        }
      })).to.equal(1);
      done();
    });

    lab.test('deep property path returns value', (done) => {
      expect(expressions('${variables.input[#complexName].list[0]}', {
        variables: {
          input: {
            '#complexName': {
              list: [1]
            }
          }
        }
      })).to.equal(1);
      done();
    });

    lab.describe('inline', () => {
      lab.test('variables in string', (done) => {
        expect(expressions('PT${variables.input}S', {
          variables: {
            input: 0.1
          }
        })).to.equal('PT0.1S');
        done();
      });

      lab.test('expression in expression is not supported and returns weird value', (done) => {
        expect(expressions('PT${variables[${variables.property}]}S', {
          variables: {
            input: 0.1,
            property: 'input'
          }
        })).to.equal('PTinput]}S');
        done();
      });

      lab.test('combined', (done) => {
        expect(expressions('http://${variables.host}${variables.pathname}', {
          variables: {
            host: 'example.com',
            pathname: '/api/v1'
          }
        })).to.equal('http://example.com/api/v1');
        done();
      });

      lab.test('inserts nothing if variable is found but undefined', (done) => {
        expect(expressions('http://${variables.host}${variables.pathname}', {
          variables: {
            host: 'example.com',
            pathname: undefined
          }
        })).to.equal('http://example.com');
        done();
      });
    });
  });

  lab.describe('services', () => {
    lab.test('returns service function', (done) => {
      expect(expressions('${services.get}', {
        services: {
          get: () => {
            return 'PT0.1S';
          }
        }
      })()).to.equal('PT0.1S');
      done();
    });

    lab.test('service accessing variables returns value', (done) => {
      expect(expressions('${services.get()}', {
        variables: {
          timeout: 'PT0.1S'
        },
        services: {
          get: (message) => {
            return message.variables.timeout;
          }
        }
      })).to.equal('PT0.1S');
      done();
    });

    lab.test('expression with argument returns value', (done) => {
      expect(expressions('${services.get(200)}', {
        services: {
          get: (statusCode) => {
            return statusCode;
          }
        }
      })).to.equal('200');
      done();
    });

    lab.test('expression with empty arguments returns value', (done) => {
      expect(expressions('${services.get()}', {
        services: {
          get: () => {
            return '200';
          }
        }
      })).to.equal('200');
      done();
    });

    lab.test('expression with argument adressing variables returns value', (done) => {
      expect(expressions('${services.get(variables.input[0])}', {
        variables: {
          input: [200]
        },
        services: {
          get: (input) => {
            return input;
          }
        }
      })).to.equal(200);
      done();
    });

    lab.test('expression with arguments adressing variables returns value', (done) => {
      expect(expressions('${services.get(variables.input[0],variables.add)}', {
        variables: {
          input: [200],
          add: 1
        },
        services: {
          get: (input, add) => {
            return input + add;
          }
        }
      })).to.equal(201);
      done();
    });

    lab.test('expression \${true} return true', (done) => {
      expect(expressions('${true}')).to.be.true();
      done();
    });

    lab.test('expression \${false} return false', (done) => {
      expect(expressions('${false}')).to.be.false();
      done();
    });

  });

  lab.describe('isExpression(text)', () => {
    lab.test('returns true if expression', (done) => {
      expect(expressions.isExpression('${input}')).to.be.true();
      expect(expressions.isExpression('${variables.input[#complexName].list[0]}')).to.be.true();
      expect(expressions.isExpression('${services.get()}')).to.be.true();
      done();
    });

    lab.test('returns false if the string is not an explicit expression', (done) => {
      expect(expressions.isExpression('return `${input}`;')).to.be.false();
      expect(expressions.isExpression('`${input}`;')).to.be.false();
      expect(expressions.isExpression('`${input}`')).to.be.false();
      done();
    });

    lab.test('returns false if not expression', (done) => {
      expect(expressions.isExpression('{input}')).to.be.false();
      done();
    });

    lab.test('returns false if empty expression', (done) => {
      expect(expressions.isExpression('${}')).to.be.false();
      done();
    });

    lab.test('returns false if no argument is passed', (done) => {
      expect(expressions.isExpression()).to.be.false();
      done();
    });
  });

  lab.describe('hasExpression(text)', () => {
    lab.test('returns true if expression', (done) => {
      expect(expressions.hasExpression('${input}')).to.be.true();
      expect(expressions.hasExpression('${variables.input[#complexName].list[0]}')).to.be.true();
      expect(expressions.hasExpression('${services.get()}')).to.be.true();
      done();
    });

    lab.test('returns true if the string is not an explicit expression', (done) => {
      expect(expressions.hasExpression('return `${input}`;')).to.be.true();
      expect(expressions.hasExpression('`${input}`;')).to.be.true();
      expect(expressions.hasExpression('`${input}`')).to.be.true();
      done();
    });

    lab.test('returns false if not expression', (done) => {
      expect(expressions.hasExpression('{input}')).to.be.false();
      done();
    });

    lab.test('returns false if empty expression', (done) => {
      expect(expressions.hasExpression('${}')).to.be.false();
      done();
    });

    lab.test('returns false if no argument is passed', (done) => {
      expect(expressions.hasExpression()).to.be.false();
      done();
    });
  });
});
