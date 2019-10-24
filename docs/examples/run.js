import {
  serviceTask, userTask, human, serviceBehaviour, extendBehaviour,
  loop, sequence, expressionCall, task, gateway, listen, execute
} from './examples';

const command = process.argv[2];
switch (command) {
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

  case 'task':
    task();
    break;

  case 'gateway':
    gateway();
    break;

  case 'listen':
    listen();
    break;

  case 'execute':
    execute();
    break;

  default:
    console.log(`Choose a valide function:   serviceTask, userTask, human, serviceBehaviour, extendBehaviour,
      loop, sequence, expressionCall, task, gateway, listen, execute`);
}


