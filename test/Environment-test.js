'use strict';

const Environment = require('../lib/Environment');
const {EventEmitter} = require('events');

describe('Environment', () => {
  describe('getVariablesAndServices()', () => {
    it('returns resolved services', () => {
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

      expect(services.none).to.be.undefined;
      expect(services.whut).to.be.undefined;
      expect(services.fn, 'fat arrow fn').to.be.a('function');
      expect(services.get).to.be.a('function');
      expect(services.request).to.be.a('function');
      expect(services.console).to.be.an('object');
      expect(services.log).to.be.a('function');
      expect(services.require).to.be.a('function');
    });
  });

  describe('getFrozenVariablesAndServices()', () => {
    it('returns frozen variables and services', () => {
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

      expect(Object.isFrozen(result.services)).to.be.true;
      expect(Object.isFrozen(result.variables)).to.be.true;
    });
  });

  describe('getServiceByName()', () => {
    it('returns service function', () => {
      const environment = Environment({
        services: {
          get: {
            module: 'request',
            fnName: 'get'
          }
        }
      });

      const service = environment.getServiceByName('get');

      expect(service).to.be.a('function');
    });

    it('returns undefined if service is not found', () => {
      const environment = Environment();
      const service = environment.getServiceByName('put');
      expect(service).to.be.undefined;
    });
  });

  describe('getState()', () => {
    it('returns options, variables, services and output', () => {
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

      expect(Object.keys(state)).to.have.same.members(['arbOpt', 'variables', 'services', 'output']);

      expect(Object.keys(state.variables)).to.have.same.members(['init', 'loadedAt', 'myArray']);
      expect(Object.keys(state.services)).to.have.same.members(['request', 'myFuncs']);
      expect(state.services.myFuncs).to.include({
        type: 'require',
        module: './test/helpers/testHelpers'
      });
      expect(state.services.request).to.include({
        type: 'require',
        module: 'request'
      });
    });
  });

  describe('resume()', () => {
    it('sets options, variables, services and output', () => {
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
      expect(environment.getVariablesAndServices().services.request).to.be.a('function');
      expect(environment.getVariablesAndServices().variables.init).to.equal(1);
      expect(environment.getVariablesAndServices().variables.beforeState).to.be.undefined;
      expect(environment.getServiceByName('request')).to.be.a('function');
      expect(environment.resolveExpression('${variables.myArray[-1]}')).to.equal(5);
    });

    it('resumes without state', () => {
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
    });

    it('resumes with minimal state', () => {
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

      expect(environment.getVariablesAndServices().variables.resumed).to.be.true;
      expect(environment.getVariablesAndServices().variables.beforeState).to.be.undefined;
      expect(environment.getServiceByName('noFn')).to.be.undefined;
    });
  });

  describe('clone()', () => {
    it('clones variables', () => {
      const variables = {
        init: true
      };
      const environment = Environment({
        variables
      });

      const clone = environment.clone();
      expect(environment.variables.init).to.be.true;
      clone.variables.init = false;

      expect(environment.variables.init).to.be.true;
    });

    it('allows override of output', () => {
      const variables = {
        init: true
      };
      const output = {};
      const environment = Environment({
        variables,
        output
      });

      const clone = environment.clone();
      expect(environment.variables.init).to.be.true;
      clone.variables.init = false;

      expect(environment.variables.init).to.be.true;
    });

    it('listener can be overridden', () => {
      const listener = new EventEmitter();
      const environment = Environment({
        listener
      });

      const newListener = new EventEmitter();
      const clone = environment.clone({
        listener: newListener
      });

      expect(clone.getListener()).to.equal(newListener);
    });

    it('keeps listener if not overridden', () => {
      const listener = new EventEmitter();
      const environment = Environment({
        listener
      });

      const clone = environment.clone();

      expect(clone.getListener()).to.equal(listener);
    });
  });
});
