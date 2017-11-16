'use strict';

const Environment = require('../lib/Environment');
const Lab = require('lab');
const {EventEmitter} = require('events');

const lab = exports.lab = Lab.script();
const {describe, it} = lab;
const {expect} = Lab.assertions;

describe('Environment', () => {
  describe('getVariablesAndServices()', () => {
    it('returns resolved services', (done) => {
      const environment = Environment({
        services: {
          none: {},
          whut: {
            type: 'misc'
          },
          fn: () => {},
          get: {
            module: 'request',
            fnName: 'get'
          },
          request: {
            module: 'request'
          },
          console: {
            module: 'console',
            type: 'global'
          },
          log: {
            module: 'console',
            type: 'global',
            fnName: 'log'
          },
          require: {
            module: 'require',
            type: 'global'
          }
        }
      });

      const services = environment.getVariablesAndServices().services;

      expect(services.none).to.be.undefined();
      expect(services.whut).to.be.undefined();
      expect(services.fn, 'fat arrow fn').to.be.a.function();
      expect(services.get).to.be.a.function();
      expect(services.request).to.be.a.function();
      expect(services.console).to.be.an.object();
      expect(services.log).to.be.a.function();
      expect(services.require).to.be.a.function();

      done();
    });
  });

  describe('getFrozenVariablesAndServices()', () => {
    it('returns frozen variables and services', (done) => {
      const environment = Environment({
        variables: {
          input: 1
        },
        services: {
          fn: () => {},
          get: {
            module: 'request',
            fnName: 'get'
          }
        }
      });

      const result = environment.getFrozenVariablesAndServices();

      expect(Object.isFrozen(result.services)).to.be.true();
      expect(Object.isFrozen(result.variables)).to.be.true();
      done();
    });
  });

  describe('getServiceByName()', () => {
    it('returns service function', (done) => {
      const environment = Environment({
        services: {
          get: {
            module: 'request',
            fnName: 'get'
          }
        }
      });

      const service = environment.getServiceByName('get');

      expect(service).to.be.a.function();
      done();
    });

    it('returns undefined if service is not found', (done) => {
      const environment = Environment();
      const service = environment.getServiceByName('put');
      expect(service).to.be.undefined();
      done();
    });
  });

  describe('getState()', () => {
    it('returns options, variables, services and output', (done) => {
      const environment = Environment({
        arbOpt: 0,
        variables: {
          init: 1,
          loadedAt: new Date(),
          myArray: [1, 2, 3, 5],
        },
        services: {
          request: {
            type: 'require',
            module: 'request'
          },
          myFuncs: {
            type: 'require',
            module: './test/helpers/testHelpers'
          }
        }
      });

      const state = environment.getState();

      expect(state).to.only.include(['arbOpt', 'variables', 'services', 'output']);

      expect(state.variables).to.only.include(['init', 'loadedAt', 'myArray']);
      expect(state.services).to.include(['request', 'myFuncs']);
      expect(state.services.myFuncs).to.include({
        type: 'require',
        module: './test/helpers/testHelpers'
      });
      expect(state.services.request).to.include({
        type: 'require',
        module: 'request'
      });

      done();
    });
  });

  describe('resume()', () => {
    it('sets options, variables, services and output', (done) => {
      const listener = new EventEmitter();
      const extensions = {};
      let environment = Environment({
        listener,
        extensions,
        variables: {
          beforeState: true
        }
      });

      environment = environment.resume({
        arbOpt: 0,
        variables: {
          init: 1,
          loadedAt: new Date(),
          myArray: [1, 2, 3, 5],
        },
        services: {
          request: {
            type: 'require',
            module: 'request'
          },
          myFuncs: {
            type: 'require',
            module: './test/helpers/testHelpers'
          }
        }
      });

      expect(environment.extensions).to.equal(extensions);
      expect(environment.getListener()).to.equal(listener);

      expect(environment.getVariablesAndServices().arbOpt).to.equal(0);
      expect(environment.getVariablesAndServices().services.request).to.be.a.function();
      expect(environment.getVariablesAndServices().variables.init).to.equal(1);
      expect(environment.getVariablesAndServices().variables.beforeState).to.be.undefined();
      expect(environment.getServiceByName('request')).to.be.a.function();
      expect(environment.resolveExpression('${variables.myArray[-1]}')).to.equal(5);

      done();
    });

    it('resumes without state', (done) => {
      const listener = new EventEmitter();
      const extensions = {};
      let environment = Environment({
        listener,
        extensions,
        variables: {
          beforeState: true
        }
      });

      environment = environment.resume();

      expect(environment.extensions).to.equal(extensions);
      expect(environment.getListener()).to.equal(listener);
      done();
    });

    it('resumes with minimal state', (done) => {
      const listener = new EventEmitter();
      const extensions = {};
      let environment = Environment({
        listener,
        extensions,
        variables: {
          beforeState: true
        }
      });

      environment = environment.resume({
        listener: new EventEmitter(),
        variables: {
          resumed: true
        }
      });

      expect(environment.extensions).to.equal(extensions);
      expect(environment.getListener()).to.equal(listener);

      expect(environment.getVariablesAndServices().variables.resumed).to.be.true();
      expect(environment.getVariablesAndServices().variables.beforeState).to.be.undefined();
      expect(environment.getServiceByName('noFn')).to.be.undefined();

      done();
    });
  });

  describe('clone()', () => {
    it('clones variables', (done) => {
      const variables = {
        init: true
      };
      const environment = Environment({
        variables
      });

      const clone = environment.clone();
      expect(environment.variables.init).to.be.true();
      clone.variables.init = false;

      expect(environment.variables.init).to.be.true();

      done();
    });

    it('listener can be overridden', (done) => {
      const listener = new EventEmitter();
      const environment = Environment({
        listener
      });

      const newListener = new EventEmitter();
      const clone = environment.clone({
        listener: newListener
      });

      expect(clone.getListener()).to.equal(newListener);

      done();
    });

    it('keeps listener if not overridden', (done) => {
      const listener = new EventEmitter();
      const environment = Environment({
        listener
      });

      const clone = environment.clone();

      expect(clone.getListener()).to.equal(listener);

      done();
    });
  });
});
