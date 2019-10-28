import {
  serviceTask, startResume, userTask, human, serviceBehaviour, extendBehaviour,
  loop, sequence, expressionCall, scriptTask, gateway, listen, simpleExecute
} from './examples';
import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { makeEngine, getEndFlowIds } from './libs';

console.log('Running Examples');
const main = async () => {
  const command = process.argv[2];
  let listener, options, state, engine,
    endFlows, source, api;
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

      /**
       * MAKE ENGINE
       *
       */
      console.log('test running');
      options = {};
      source = fs.readFileSync(path.join(__dirname, 'bpmn/testservice.bpmn'));
      engine = makeEngine(source, options);

      // Find the end
      endFlows = await getEndFlowIds(engine);
      console.log('End flows found: ', endFlows);

      /**
       * LISTENERS
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
        // Without this signal the process will idle waiting for a response
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
        console.log('\n \n activity.start', task.id);
        if (task.id === 'EnviaSuporte') {
          console.log(task.id); // task
          // debugger
        }
        if (task.owner.behaviour.extensionElements) {
          console.log('task behaviour (extensionElements):', JSON.stringify(task.owner.behaviour.extensionElements, null, 4));
        }
      });

      listener.on('flow.take', (flow) => {
        if (endFlows && endFlows.find(id => id === flow.id)) {
          console.log('reached a end flow, process terminated', flow.id);
        }
        console.log(`flow <${flow.id}> was taken`);
      });


      /**
       * RUN ENGINE
       */
      api = await engine.execute({ listener });
      //api.owner.behaviour.extensionElements
      state = await engine.getState();
      console.log(state.name, api.id);
      break;

    default:
      console.log(`Choose a valide function:  test, startResume, serviceTask, userTask,scriptTask, human, serviceBehaviour, extendBehaviour,
      loop, sequence, expressionCall, gateway, listen, simpleExecute`);
  }

};

main();
