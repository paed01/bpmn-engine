'use strict';

const Environment = require('../lib/Environment');
const Lab = require('lab');

const lab = exports.lab = Lab.script();
const {describe, it} = lab;
const {expect} = Lab.assertions;

describe('Environment', () => {
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
});
