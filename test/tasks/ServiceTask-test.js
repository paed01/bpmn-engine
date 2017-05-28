'use strict';

const BpmnModdle = require('bpmn-moddle');
const Code = require('code');
const factory = require('../helpers/factory');
const Lab = require('lab');
const mapper = require('../../lib/mapper');
const nock = require('nock');
const request = require('request');
const testHelpers = require('../helpers/testHelpers');

const lab = exports.lab = Lab.script();
const expect = Code.expect;

const Bpmn = require('../..');
const bpmnModdle = new BpmnModdle({
  camunda: require('camunda-bpmn-moddle/resources/camunda')
});
const ServiceTask = mapper('bpmn:ServiceTask');

const bupServiceFn = testHelpers.serviceFn;

lab.experiment('ServiceTask', () => {
  lab.after((done) => {
    testHelpers.serviceFn = bupServiceFn;
    done();
  });

  lab.describe('ctor', () => {
    lab.test('stores service if extension name', (done) => {
      const processXml = factory.resource('service-task.bpmn').toString();
      testHelpers.getContext(processXml, {
        camunda: require('camunda-bpmn-moddle/resources/camunda')
      }, (cerr, context) => {
        if (cerr) return done(cerr);
        const task = context.getChildActivityById('serviceTask');
        expect(task).to.include(['service']);
        done();
      });
    });

    lab.test('stores expression service', (done) => {
      const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
  <process id="theProcess" isExecutable="true">
    <serviceTask id="serviceTask" name="Get" camunda:expression="\${services.get}" />
  </process>
</definitions>`;

      testHelpers.getContext(processXml, {
        camunda: require('camunda-bpmn-moddle/resources/camunda')
      }, (cerr, context) => {
        if (cerr) return done(cerr);
        const task = context.getChildActivityById('serviceTask');
        expect(task).to.include(['service']);
        expect(task.service).to.include({
          value: '${services.get}'
        });
        expect(task.service.execute).to.be.a.function();
        done();
      });
    });

    lab.test.skip('throws if service definition is not found', (done) => {
      const processXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <serviceTask id="serviceTask" name="Get" />
  </process>
</definitions>`;

      bpmnModdle.fromXML(processXml, (err, def, moddleContext) => {
        if (err) return done(err);

        const Context = require('../../lib/Context');

        function test() {
          new Context('theProcess', moddleContext); // eslint-disable-line no-new
        }

        expect(test).to.throw(Error, /No service defined/i);
        done();
      });

    });
  });

  lab.describe('execute()', () => {
    let context;
    lab.beforeEach((done) => {
      const processXml = factory.resource('service-task.bpmn').toString();
      testHelpers.getContext(processXml, {
        camunda: require('camunda-bpmn-moddle/resources/camunda')
      }, (err, result) => {
        if (err) return done(err);
        context = result;
        context.variablesAndServices.services = {
          postMessage: {
            module: './test/helpers/testHelpers',
            fnName: 'serviceFn'
          }
        };
        done();
      });
    });

    lab.test('executes service on taken inbound', (done) => {
      let taken;
      testHelpers.serviceFn = (message, callback) => {
        taken = true;
        callback();
      };

      const task = context.getChildActivityById('serviceTask');
      task.activate();

      task.once('end', () => {
        expect(taken).to.be.true();
        done();
      });

      task.inbound[0].take();
    });

    lab.test('can access variables', (done) => {
      testHelpers.serviceFn = (message, callback) => {
        message.variables.input = 'wuiiii';
        callback();
      };

      const task = context.getChildActivityById('serviceTask');
      task.activate();

      task.once('end', () => {
        expect(context.variablesAndServices.variables.input).to.equal('wuiiii');
        done();
      });

      task.inbound[0].take();
    });

    lab.test('error in callback takes bound error event', (done) => {
      testHelpers.serviceFn = (message, callback) => {
        callback(new Error('Failed'));
      };

      const task = context.getChildActivityById('serviceTask');
      const boundEvent = context.getChildActivityById('errorEvent');
      boundEvent.activate();
      task.activate();

      boundEvent.once('end', (event) => {
        expect(event.taken).to.be.true();
        done();
      });

      task.inbound[0].take();
    });

    lab.test('times out if bound timeout event if callback is not called within timeout duration', (done) => {
      testHelpers.serviceFn = () => {};

      const task = context.getChildActivityById('serviceTask');
      const timeoutEvent = context.getChildActivityById('timerEvent');
      const errEvent = context.getChildActivityById('errorEvent');
      timeoutEvent.activate();
      errEvent.activate();
      task.activate();

      timeoutEvent.once('end', (event) => {
        expect(event.taken).to.be.true();
        done();
      });

      task.inbound[0].take();
    });
  });

  lab.describe('IO', () => {
    let context;
    lab.beforeEach((done) => {
      const processXml = factory.resource('service-task-io.bpmn').toString();
      testHelpers.getContext(processXml, {
        camunda: require('camunda-bpmn-moddle/resources/camunda')
      }, (err, result) => {
        if (err) return done(err);
        context = result;
        context.variablesAndServices = {
          services: {
            getRequest: {
              module: 'request',
              fnName: 'get'
            }
          },
          variables: {
            apiPath: 'http://example.com/test'
          }
        };
        done();
      });
    });

    lab.test('uses input parameters', (done) => {
      nock('http://example.com')
        .defaultReplyHeaders({
          'Content-Type': 'application/json'
        })
        .get('/test')
        .reply(200, {
          data: 4
        });

      const task = context.getChildActivityById('serviceTask');
      task.activate();

      task.once('start', (activity) => {
        expect(activity.getInput()).to.equal({ uri: 'http://example.com/test', json: true });
      });

      task.once('end', (t, output) => {
        expect(output).to.include(['statusCode', 'body']);
        expect(output.statusCode).to.equal(200);
        expect(output.body).to.equal({ data: 4});
        done();
      });

      task.inbound[0].take();
    });
  });

  lab.describe('service expression', () => {
    lab.test('executes function call expression with context as argument', (done) => {
      const processXml = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
        <process id="theProcess" isExecutable="true">
          <serviceTask id="serviceTask" name="Get" camunda:expression="\${services.getService()}" camunda:resultVariable="taskOutput" />
        </process>
      </definitions>`;

      testHelpers.getContext(processXml, {
        camunda: require('camunda-bpmn-moddle/resources/camunda')
      }, (err, context) => {
        if (err) return done(err);
        context.variablesAndServices = {
          services: {
            getService: () => {
              return (executionContext, callback) => {
                callback(null, executionContext.variables.input, 'success');
              };
            }
          },
          variables: {
            input: 1
          }
        };

        const task = context.getChildActivityById('serviceTask');
        task.activate();

        task.once('end', (t, output) => {
          expect(output).to.include(['taskOutput']);
          expect(output.taskOutput).to.equal([1, 'success']);
          done();
        });

        task.run();
      });
    });

    lab.test('executes expression function call with variable reference argument with context as argument', (done) => {
      const processXml = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
        <process id="theProcess" isExecutable="true">
          <serviceTask id="serviceTask" name="Get" camunda:expression="\${services.getService(variables.input)}" camunda:resultVariable="taskOutput" />
        </process>
      </definitions>`;

      testHelpers.getContext(processXml, {
        camunda: require('camunda-bpmn-moddle/resources/camunda')
      }, (err, context) => {
        if (err) return done(err);
        context.variablesAndServices = {
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
        };

        const task = context.getChildActivityById('serviceTask');
        task.activate();

        task.once('end', (t, output) => {
          expect(output).to.include(['taskOutput']);
          expect(output.taskOutput).to.equal([1]);
          done();
        });

        task.run();
      });
    });

    lab.test('executes expression function call with static value argument with context as argument', (done) => {
      const processXml = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
        <process id="theProcess" isExecutable="true">
          <serviceTask id="serviceTask" name="Get" camunda:expression="\${services.getService(whatever value)}" camunda:resultVariable="taskOutput" />
        </process>
      </definitions>`;

      testHelpers.getContext(processXml, {
        camunda: require('camunda-bpmn-moddle/resources/camunda')
      }, (err, context) => {
        if (err) return done(err);
        context.variablesAndServices = {
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
        };

        const task = context.getChildActivityById('serviceTask');
        task.activate();

        task.once('end', (t, output) => {
          expect(output).to.include(['taskOutput']);
          expect(output.taskOutput).to.equal(['whatever value']);
          done();
        });

        task.run();
      });
    });
  });

  lab.describe('io', () => {
    let context;
    lab.beforeEach((done) => {
      const processXml = factory.resource('service-task-io-types.bpmn').toString();
      testHelpers.getContext(processXml, {
        camunda: require('camunda-bpmn-moddle/resources/camunda')
      }, (err, result) => {
        if (err) return done(err);
        context = result;
        done();
      });
    });

    lab.test('returns mapped output', (done) => {
      context.variablesAndServices.variables = {
        apiPath: 'http://example-2.com',
        input: 2,
      };
      context.variablesAndServices.services = {
        get: (arg, next) => {
          next(null, {
            statusCode: 200,
            pathname: '/ignore'
          }, {
            data: arg.input
          });
        }
      };

      const task = context.getChildActivityById('serviceTask');
      task.once('end', (activity, output) => {
        expect(output).to.equal({
          statusCode: 200,
          body: {
            data: 2
          }
        });
        done();
      });

      task.run();
    });

  });

  lab.describe('Camunda connector is defined with input/output', () => {
    let context;
    lab.before((done) => {
      testHelpers.getContext(factory.resource('issue-4.bpmn').toString(), {
        camunda: require('camunda-bpmn-moddle/resources/camunda')
      }, (err, result) => {
        if (err) return done(err);
        context = result;
        context.variablesAndServices = {
          services: {
            'send-email': (emailAddress, callback) => {
              callback(null, 'success');
            }
          },
          variables: {
            emailAddress: 'lisa@example.com'
          }
        };
        done();
      });
    });

    lab.test('service task has io', (done) => {
      const task = context.getChildActivityById('sendEmail_1');
      expect(task.io, 'task IO').to.exist();
      expect(task.io.input).to.exist();
      expect(task.io.output).to.exist();
      done();
    });

    lab.test('executes connector-id service', (done) => {
      const task = context.getChildActivityById('sendEmail_1');
      task.once('end', (activity, output) => {
        expect(output).to.equal({
          messageId: 'success',
        });
        done();
      });

      task.run();
    });

    lab.test('executes service using defined input', (done) => {
      const task = context.getChildActivityById('sendEmail_1');
      let input, inputArg;

      context.variablesAndServices.services['send-email'] = (emailAddress, callback) => {
        inputArg = emailAddress;
        callback(null, 'success');
      };

      task.once('start', (activity) => {
        input = activity.getInput();
      });

      task.once('end', (activity, output) => {
        expect(input).to.equal({
          emailAddress: 'lisa@example.com'
        });
        expect(inputArg).to.equal('lisa@example.com');
        expect(output).to.equal({
          messageId: 'success',
        });
        done();
      });

      task.run();
    });

    lab.test('returns defined output', (done) => {
      const task = context.getChildActivityById('sendEmail_1');

      context.variablesAndServices.services['send-email'] = (emailAddress, callback) => {
        callback(null, 10);
      };

      task.once('end', (activity, output) => {
        expect(output).to.equal({
          messageId: 10,
        });
        done();
      });

      task.run();
    });

    lab.test('service expects input options', (done) => {
      const processXml = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
        <process id="theProcess" isExecutable="true">
          <serviceTask id="serviceTask" name="Call api">
            <extensionElements>
              <camunda:connector>
                <camunda:connectorId>get</camunda:connectorId>
              </camunda:connector>
              <camunda:inputOutput>
                <camunda:inputParameter name="uri">\${variables.api}/v1/data</camunda:inputParameter>
                <camunda:inputParameter name="json">\${true}</camunda:inputParameter>
                <camunda:inputParameter name="headers">
                  <camunda:map>
                    <camunda:entry key="User-Agent">curl</camunda:entry>
                    <camunda:entry key="Accept">application/json</camunda:entry>
                  </camunda:map>
                </camunda:inputParameter>
                <camunda:outputParameter name="statusCode">\${result[0].statusCode}</camunda:outputParameter>
                <camunda:outputParameter name="body">\${result[1]}</camunda:outputParameter>
              </camunda:inputOutput>
            </extensionElements>
          </serviceTask>
        </process>
      </definitions>`;

      nock('http://example.com', {
        reqheaders: {
          'User-Agent': 'curl',
          Accept: 'application/json'
        }
      })
      .defaultReplyHeaders({
        'Content-Type': 'application/json'
      })
      .get('/v1/data')
      .reply(200, {
        data: 4
      });

      testHelpers.getContext(processXml, {
        camunda: require('camunda-bpmn-moddle/resources/camunda')
      }, (err, processContext) => {
        if (err) return done(err);
        processContext.variablesAndServices = {
          services: {
            get: {
              module: 'request',
              fnName: 'get'
            }
          },
          variables: {
            api: 'http://example.com'
          }
        };

        const task = processContext.getChildActivityById('serviceTask');

        task.once('end', (activity, output) => {
          expect(output).to.equal({
            statusCode: 200,
            body: {data: 4}
          });
          done();
        });

        task.run();
      });
    });

    lab.test('service function address other service function', (done) => {
      const processXml = `
      <?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
        <process id="theProcess" isExecutable="true">
          <serviceTask id="serviceTask" name="Call api">
            <extensionElements>
              <camunda:connector>
                <camunda:connectorId>myFunc</camunda:connectorId>
              </camunda:connector>
              <camunda:inputOutput>
                <camunda:inputParameter name="variables">\${variables}</camunda:inputParameter>
                <camunda:inputParameter name="services">\${services}</camunda:inputParameter>
                <camunda:outputParameter name="message">\${result[0]}</camunda:outputParameter>
              </camunda:inputOutput>
            </extensionElements>
          </serviceTask>
        </process>
      </definitions>`;

      testHelpers.getContext(processXml, {
        camunda: require('camunda-bpmn-moddle/resources/camunda')
      }, (err, processContext) => {
        if (err) return done(err);
        processContext.variablesAndServices = {
          services: {
            appendPath: (uri) => {
              return `${uri}/v3/data`;
            },
            myFunc: (message, callback) => {
              const apiWithPath = message.services.appendPath(message.variables.api);
              callback(null, `successfully executed with ${apiWithPath}`);
            }
          },
          variables: {
            api: 'http://example.com'
          }
        };

        const task = processContext.getChildActivityById('serviceTask');

        task.once('end', (activity, output) => {
          expect(output).to.equal({
            message: 'successfully executed with http://example.com/v3/data'
          });
          done();
        });

        task.run();
      });
    });
  });

  lab.describe('loop', () => {
    lab.describe('sequential', () => {
      let context;
      lab.beforeEach((done) => {
        getLoopContext(true, (err, result) => {
          if (err) return done(err);
          context = result;
          done();
        });
      });

      lab.test('emits start with task id', (done) => {
        const task = context.getChildActivityById('task');
        task.activate();

        nock('http://example.com')
          .get('/api/pal?version=0')
          .delay(50)
          .reply(200, {})
          .get('/api/franz?version=1')
          .delay(30)
          .reply(200, {})
          .get('/api/immanuel?version=2')
          .reply(409, {});

        const starts = [];
        task.on('start', (activity) => {
          starts.push(activity.id);
        });

        task.once('end', () => {
          expect(starts).to.equal(['task', 'task', 'task']);
          done();
        });

        task.run();
      });

      lab.test('emits end with output', (done) => {
        const task = context.getChildActivityById('task');
        task.activate();

        task.on('start', (activity) => {
          const input = activity.getInput();
          nock('http://example.com')
            .get(`/api${input.path}?version=${input.version}`)
            .reply(input.version < 2 ? 200 : 409, {});
        });
        task.once('end', (t, output) => {
          expect(output).to.equal([{
            statusCode: 200,
            body: {}
          }, {
            statusCode: 200,
            body: {}
          }, {
            statusCode: 409,
            body: {}
          }]);
          done();
        });

        task.run();
      });

      lab.test('getOutput() returns result from loop', (done) => {
        const task = context.getChildActivityById('task');
        task.activate();

        task.on('start', (activity) => {
          const input = activity.getInput();
          nock('http://example.com')
            .get(`/api${input.path}?version=${input.version}`)
            .delay(50 - input.version * 10)
            .reply(input.version < 2 ? 200 : 409, {
              idx: input.version
            });
        });

        task.once('end', () => {
          expect(task.getOutput()).to.equal([{
            statusCode: 200,
            body: {
              idx: 0
            }
          }, {
            statusCode: 200,
            body: {
              idx: 1
            }
          }, {
            statusCode: 409,
            body: {
              idx: 2
            }
          }]);
          done();
        });

        task.run();
      });

    });

    lab.describe('parallell', () => {
      let context;
      lab.beforeEach((done) => {
        getLoopContext(false, (err, result) => {
          if (err) return done(err);
          context = result;
          done();
        });
      });

      lab.test('emits start with different ids', (done) => {
        const task = context.getChildActivityById('task');
        task.activate();

        nock('http://example.com')
          .get('/api/pal?version=0')
          .delay(50)
          .reply(200, {})
          .get('/api/franz?version=1')
          .delay(30)
          .reply(200, {})
          .get('/api/immanuel?version=2')
          .reply(409, {});

        const starts = [];
        task.on('start', (activity) => {
          starts.push(activity.id);
        });

        task.once('end', () => {
          expect(starts.includes(task.id), 'unique task id').to.be.false();
          done();
        });

        task.run();
      });

      lab.test('returns output in sequence', (done) => {
        const task = context.getChildActivityById('task');
        task.activate();

        task.on('start', (activity) => {
          const input = activity.getInput();
          nock('http://example.com')
            .get(`/api${input.path}?version=${input.version}`)
            .delay(50 - input.version * 10)
            .reply(input.version < 2 ? 200 : 409, {
              idx: input.version
            });
        });

        task.once('end', (t, output) => {
          expect(output).to.equal([{
            statusCode: 200,
            body: {
              idx: 0
            }
          }, {
            statusCode: 200,
            body: {
              idx: 1
            }
          }, {
            statusCode: 409,
            body: {
              idx: 2
            }
          }]);
          done();
        });

        task.run();
      });

      lab.test('getOutput() returns result from loop', (done) => {
        const task = context.getChildActivityById('task');
        task.activate();

        task.on('start', (activity) => {
          const input = activity.getInput();
          nock('http://example.com')
            .get(`/api${input.path}?version=${input.version}`)
            .delay(50 - input.version * 10)
            .reply(input.version < 2 ? 200 : 409, {
              idx: input.version
            });
        });

        task.once('end', () => {
          expect(task.getOutput()).to.equal([{
            statusCode: 200,
            body: {
              idx: 0
            }
          }, {
            statusCode: 200,
            body: {
              idx: 1
            }
          }, {
            statusCode: 409,
            body: {
              idx: 2
            }
          }]);
          done();
        });

        task.run();
      });
    });
  });

});

function getLoopContext(isSequential, callback) {
  const processXml = `
  <?xml version="1.0" encoding="UTF-8"?>
  <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:camunda="http://camunda.org/schema/1.0/bpmn">
    <process id="parallellLoopProcess" isExecutable="true">
      <serviceTask id="task">
        <multiInstanceLoopCharacteristics isSequential="${isSequential}" camunda:collection="\${variables.paths}">
          <loopCardinality>5</loopCardinality>
        </multiInstanceLoopCharacteristics>
        <extensionElements>
          <camunda:inputOutput>
            <camunda:inputParameter name="version">\${index}</camunda:inputParameter>
            <camunda:inputParameter name="path">\${item}</camunda:inputParameter>
          </camunda:inputOutput>
          <camunda:connector>
            <camunda:inputOutput>
              <camunda:inputParameter name="reqOptions">
                <camunda:map>
                  <camunda:entry key="uri">http://example.com/api\${path}?version=\${version}</camunda:entry>
                  <camunda:entry key="json">\${true}</camunda:entry>
                </camunda:map>
              </camunda:inputParameter>
              <camunda:outputParameter name="statusCode">\${result[0].statusCode}</camunda:outputParameter>
              <camunda:outputParameter name="body" />
            </camunda:inputOutput>
            <camunda:connectorId>get</camunda:connectorId>
          </camunda:connector>
        </extensionElements>
      </serviceTask>
    </process>
  </definitions>`;
  testHelpers.getContext(processXml, {
    camunda: require('camunda-bpmn-moddle/resources/camunda')
  }, (err, context) => {
    if (err) return callback(err);
    context.variablesAndServices = {
      variables: {
        paths: ['/pal', '/franz', '/immanuel']
      },
      services: {
        get: request.get
      }
    };
    callback(null, context);
  });
}
