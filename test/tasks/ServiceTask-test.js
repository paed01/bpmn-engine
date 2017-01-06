'use strict';

const Code = require('code');
const factory = require('../helpers/factory');
const Lab = require('lab');
const nock = require('nock');
const testHelpers = require('../helpers/testHelpers');

const lab = exports.lab = Lab.script();
const expect = Code.expect;

const Bpmn = require('../..');
const BaseProcess = require('../../lib/mapper').Process;

const bupServiceFn = testHelpers.serviceFn;

lab.experiment('ServiceTask', () => {
  lab.after((done) => {
    testHelpers.serviceFn = bupServiceFn;
    done();
  });

  lab.describe('ctor', () => {
    lab.test('stores service if extension name', (done) => {
      const processXml = factory.resource('service-task.bpmn');
      testHelpers.getModdleContext(processXml, (cerr, moddleContext) => {
        if (cerr) return done(cerr);
        const process = new BaseProcess(moddleContext.elementsById.serviceTaskProcess, moddleContext, {});
        const task = process.getChildActivityById('serviceTask');
        expect(task).to.include(['service']);
        done();
      });
    });

    lab.test('stores expression', (done) => {
      const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
  <process id="theProcess" isExecutable="true">
    <serviceTask id="serviceTask" name="Get" camunda:expression="\${services.get}" />
  </process>
</definitions>`;

      testHelpers.getModdleContext(processXml, {
        camunda: require('camunda-bpmn-moddle/resources/camunda')
      }, (cerr, moddleContext) => {
        if (cerr) return done(cerr);
        const process = new BaseProcess(moddleContext.elementsById.theProcess, moddleContext, {});
        const task = process.getChildActivityById('serviceTask');
        expect(task).to.include(['service']);
        done();
      });
    });
  });

  lab.describe('execute', () => {
    lab.test('executes service', (done) => {
      testHelpers.serviceFn = (message, callback) => {
        callback();
      };

      const processXml = factory.resource('service-task.bpmn');

      const engine = new Bpmn.Engine({
        source: processXml
      });

      engine.execute({
        services: {
          postMessage: {
            module: './test/helpers/testHelpers',
            fnName: 'serviceFn'
          }
        }
      }, (err, instance) => {
        if (err) return done(err);
        instance.once('end', () => {
          done();
        });
      });
    });

    lab.test('can access variables', (done) => {
      testHelpers.serviceFn = (message, callback) => {
        message.variables.input = 'wuiiii';
        callback();
      };

      const processXml = factory.resource('service-task.bpmn');

      const engine = new Bpmn.Engine({
        source: processXml
      });

      engine.execute({
        services: {
          postMessage: {
            module: './test/helpers/testHelpers',
            fnName: 'serviceFn'
          }
        }
      }, (err, instance) => {
        if (err) return done(err);
        instance.once('end', () => {
          expect(instance.variables.input).to.equal('wuiiii');
          expect(instance.getChildActivityById('serviceTask').taken).to.be.true();
          done();
        });
      });
    });

    lab.test('error in callback takes bound error event', (done) => {
      testHelpers.serviceFn = (message, callback) => {
        callback(new Error('Failed'));
      };

      const processXml = factory.resource('service-task.bpmn');

      const engine = new Bpmn.Engine({
        source: processXml
      });

      engine.execute({
        services: {
          postMessage: {
            module: './test/helpers/testHelpers',
            fnName: 'serviceFn'
          }
        }
      }, (err, instance) => {
        if (err) return done(err);
        instance.once('end', () => {
          expect(instance.getChildActivityById('end').taken).to.be.false();
          expect(instance.getChildActivityById('errorEvent').taken).to.be.true();
          done();
        });
      });
    });

    lab.test('times out if bound timeout event if callback is not called within timeout duration', (done) => {
      testHelpers.serviceFn = () => {};

      const processXml = factory.resource('service-task.bpmn');

      const engine = new Bpmn.Engine({
        source: processXml
      });

      engine.execute({
        services: {
          postMessage: {
            module: './test/helpers/testHelpers',
            fnName: 'serviceFn'
          }
        }
      }, (err, instance) => {
        if (err) return done(err);
        instance.once('end', () => {
          expect(instance.getChildActivityById('end').taken).to.be.false();
          expect(instance.getChildActivityById('timerEvent').taken).to.be.true();
          done();
        });
      });
    });

    lab.test('uses message arguments', (done) => {
      nock('http://example.com')
        .defaultReplyHeaders({
          'Content-Type': 'application/json'
        })
        .get('/test')
        .reply(200, {
          data: 4
        });

      const processXml = factory.resource('service-task-io.bpmn');

      const engine = new Bpmn.Engine({
        source: processXml
      });

      engine.execute({
        services: {
          getRequest: {
            module: 'request',
            fnName: 'get'
          }
        },
        variables: {
          apiPath: 'http://example.com/test'
        }
      }, (err, instance) => {
        if (err) return done(err);
        instance.once('end', () => {
          expect(instance.variables.taskInput.serviceTask.result).to.include(['statusCode', 'body']);
          done();
        });
      });
    });

    lab.test('executes function call expression with context as argument', (done) => {
      const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
  <process id="theProcess" isExecutable="true">
    <serviceTask id="serviceTask" name="Get" camunda:expression="\${services.getService()}" camunda:resultVariable="output" />
  </process>
</definitions>`;

      const engine = new Bpmn.Engine({
        source: processXml,
        moddleOptions: {
          camunda: require('camunda-bpmn-moddle/resources/camunda')
        }
      });

      engine.execute({
        services: {
          getService: () => {
            return (executionContext, callback) => {
              callback(null, executionContext.variables.input);
            };
          }
        },
        variables: {
          input: 1
        }
      }, (err, instance) => {
        if (err) return done(err);
        instance.once('end', () => {
          expect(instance.variables.taskInput.serviceTask).to.include(['output']);
          expect(instance.variables.taskInput.serviceTask.output[0]).to.equal(1);
          done();
        });
      });
    });

    lab.test('executes expression function call with variable reference argument with context as argument', (done) => {
      const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
  <process id="theProcess" isExecutable="true">
    <serviceTask id="serviceTask" name="Get" camunda:expression="\${services.getService(variables.input)}" camunda:resultVariable="output" />
  </process>
</definitions>`;

      const engine = new Bpmn.Engine({
        source: processXml,
        moddleOptions: {
          camunda: require('camunda-bpmn-moddle/resources/camunda')
        }
      });

      engine.execute({
        services: {
          getService: (input) => {
            return (executionContext, callback) => {
              callback(null, input);
            };
          }
        },
        variables: {
          input: 1
        }
      }, (err, instance) => {
        if (err) return done(err);
        instance.once('end', () => {
          expect(instance.variables.taskInput.serviceTask).to.include(['output']);
          expect(instance.variables.taskInput.serviceTask.output[0]).to.equal(1);
          done();
        });
      });
    });

    lab.test('executes expression function call with static value argument with context as argument', (done) => {
      const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
  <process id="theProcess" isExecutable="true">
    <serviceTask id="serviceTask" name="Get" camunda:expression="\${services.getService(whatever value)}" camunda:resultVariable="output" />
  </process>
</definitions>`;

      const engine = new Bpmn.Engine({
        source: processXml,
        moddleOptions: {
          camunda: require('camunda-bpmn-moddle/resources/camunda')
        }
      });

      engine.execute({
        services: {
          getService: (input) => {
            return (executionContext, callback) => {
              callback(null, input);
            };
          }
        },
        variables: {
          input: 1
        }
      }, (err, instance) => {
        if (err) return done(err);
        instance.once('end', () => {
          expect(instance.variables.taskInput.serviceTask).to.include(['output']);
          expect(instance.variables.taskInput.serviceTask.output[0]).to.equal('whatever value');
          done();
        });
      });
    });

    lab.test('executes function reference expression with context as argument', (done) => {
      const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
  <process id="theProcess" isExecutable="true">
    <serviceTask id="serviceTask" name="Get" camunda:expression="\${services.getService}" camunda:resultVariable="output" />
  </process>
</definitions>`;

      const engine = new Bpmn.Engine({
        source: processXml,
        moddleOptions: {
          camunda: require('camunda-bpmn-moddle/resources/camunda')
        }
      });

      engine.execute({
        services: {
          getService: (executionContext, callback) => {
            callback(null, executionContext.variables.input);
          }
        },
        variables: {
          input: 1
        }
      }, (err, instance) => {
        if (err) return done(err);
        instance.once('end', () => {
          expect(instance.variables.taskInput.serviceTask).to.include(['output']);
          done();
        });
      });
    });
  });
});
