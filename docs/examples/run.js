import {
  serviceTask, startResume, userTask, human, serviceBehaviour, extendBehaviour,
  loop, sequence, expressionCall, scriptTask, gateway, listen, simpleExecute, test
} from './examples';
import fs from 'fs';
import path from 'path';
const { EventEmitter } = require('events');

console.log('Running Examples');
const main = async () => {
  const command = process.argv[2];
  let listener, options, state, engine, source;
  switch (command) {

    case 'startResume':
      startResume();
      break;

    case 'serviceTask':
      serviceTask();
      break;

    case 'userTask':
      userTask();
      break;

    case 'human':
      human();
      break;

    case 'serviceBehaviour':
      serviceBehaviour();
      break;

    case 'extendBehaviour':
      extendBehaviour();
      break;

    case 'loop':
      loop();
      break;

    case 'sequence':
      sequence();
      break;

    case 'expressionCall':
      expressionCall();
      break;

    case 'scriptTask':
      scriptTask();
      break;

    case 'gateway':
      gateway();
      break;

    case 'listen':
      listen();
      break;

    case 'simpleExecute':
      simpleExecute();
      break;

    case 'test':

      console.log('test running');
      /**
      activity.enter: An activity is entered
      activity.start: An activity is started
      activity.wait: The activity is postponed for some reason, e.g. a user task is waiting to be signaled or a message is expected
      activity.end: An activity has ended successfully
      activity.leave: The execution left the activity
      activity.stop: Activity run was stopped
      activity.throw: An recoverable error was thrown
      activity.error: An non-recoverable error has occurred
       */
      listener = new EventEmitter();
      listener.once('wait', (task) => {
        console.log('wait', task.id);
        task.signal({
          ioSpecification: {
            dataOutputs: [{
              id: 'userInput',
              value: 'von Rosen',
            }]
          }
        });
      });

      listener.on('activity.start', (task) => {
        console.log('activity.start', task.id);
        if (task.id === 'EnviaSuporte') {
          console.log(task);
          // debugger
        }
      });

      listener.on('flow.take', (flow) => {
        console.log(`flow <${flow.id}> was taken`);
      });

      options = {
        // extension: Extension,
        services: {
          dummy: (executionContext, serviceCallback) => {
            console.log('dummy');
            const result = executionContext['dummy'] || ['dummy'];

            serviceCallback(null, result);
          },
          runAction: (executionContext, serviceCallback) => {
            console.log('------------ un Action');
            const result = executionContext['dummy'] || ['dummy'];

            serviceCallback(null, result);
          },
        },
      };

      source = fs.readFileSync(path.join(__dirname, 'bpmn/testservice.bpmn'));

      engine = test(source, listener, options);
      state = await engine.getState();
      console.log(state.name);
      break;

    default:
      console.log(`Choose a valide function:  startResume, serviceTask, userTask,scriptTask, human, serviceBehaviour, extendBehaviour,
      loop, sequence, expressionCall, gateway, listen, simpleExecute`);
  }

};

export function Extension(activity) {
  if (!activity.behaviour.extensionElements) return;

  const { broker, environment } = activity;
  const myExtensions = [];

  for (const extension of activity.behaviour.extensionElements.values) {
    switch (extension.$type) {
      case 'camunda:ExecutionListener': {
        myExtensions.push(ExecutionListener(extension));
        break;
      }
    }
  }

  return {
    extensions: myExtensions,
    activate(...args) {
      myExtensions.forEach((e) => e.activate(...args));
    },
    deactivate() {
      myExtensions.forEach((e) => e.deactivate());
    },
  };

  function ExecutionListener(extension) {
    return {
      activate() {
        const script = environment.scripts.getScript(extension.script.scriptFormat, { id: extension.script.resource });
        broker.subscribeTmp('event', `activity.${extension.event}`, (routingKey, message) => {
          script.execute(message);
        }, { noAck: true, consumerTag: '_my-extension' });
      },
      deactivate() {
        broker.cancel('_my-extension');
      }
    };
  }

}


main();
