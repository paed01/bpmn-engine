import {
  serviceTask, userTask, human, serviceBehaviour, extendBehaviour,
  loop, sequence, expressionCall, scriptTask, gateway, listen, simpleExecute
} from './examples';

console.log('Running Examples');

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

  default:
    console.log(`Choose a valide function:   serviceTask, userTask,scriptTask, human, serviceBehaviour, extendBehaviour,
      loop, sequence, expressionCall, gateway, listen, simpleExecute`);
}
