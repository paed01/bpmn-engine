import {
  serviceTask, startResume, userTask, human, serviceBehaviour, extendBehaviour,
  loop, sequence, expressionCall, scriptTask, gateway, listen, simpleExecute, test
} from './examples';
const { EventEmitter } = require('events');

console.log('Running Examples');
const main = async () => {
  const command = process.argv[2];
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
      const listener = new EventEmitter();
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

      const options = {
        // extension: Extension
      };


      const engine = test(source, listener, options);
      const state = await engine.getState();
      // console.log(state)
      break;

    default:
      console.log(`Choose a valide function:  startResume, serviceTask, userTask,scriptTask, human, serviceBehaviour, extendBehaviour,
      loop, sequence, expressionCall, gateway, listen, simpleExecute`);
  }

};

function Extension(activity) {
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


const source = `
    
<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:camunda="http://camunda.org/schema/1.0/bpmn" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Definitions_0gz2txs" targetNamespace="http://bpmn.io/schema/bpmn" exporter="Camunda Modeler" exporterVersion="3.4.1">
  <bpmn:process id="Process_1okzu9n" isExecutable="true">
    <bpmn:startEvent id="StartEvent_1">
      <bpmn:outgoing>SequenceFlow_inicio</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:sequenceFlow id="SequenceFlow_inicio" sourceRef="StartEvent_1" targetRef="EnviaSuporte" />
    <bpmn:exclusiveGateway id="resolvidoSuporte" default="SequenceFlow_dev">
      <bpmn:extensionElements>
        <camunda:properties>
          <camunda:property />
        </camunda:properties>
      </bpmn:extensionElements>
      <bpmn:incoming>SequenceFlow_possuporte</bpmn:incoming>
      <bpmn:outgoing>SequenceFlow_dev</bpmn:outgoing>
      <bpmn:outgoing>SequenceFlow_responde</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    <bpmn:sequenceFlow id="SequenceFlow_possuporte" sourceRef="EnviaSuporte" targetRef="resolvidoSuporte" />
    <bpmn:sequenceFlow id="SequenceFlow_dev" sourceRef="resolvidoSuporte" targetRef="enviaDev" />
    <bpmn:endEvent id="EndEvent_1ef0fl6">
      <bpmn:incoming>SequenceFlow_end</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="SequenceFlow_posdev" sourceRef="enviaDev" targetRef="respondeUsuario" />
    <bpmn:sequenceFlow id="SequenceFlow_end" sourceRef="respondeUsuario" targetRef="EndEvent_1ef0fl6" />
    <bpmn:sequenceFlow id="SequenceFlow_responde" sourceRef="resolvidoSuporte" targetRef="respondeUsuario">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">enviaDev === true</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sendTask id="respondeUsuario" name="Responde Usuario" camunda:type="external" camunda:topic="">
      <bpmn:incoming>SequenceFlow_posdev</bpmn:incoming>
      <bpmn:incoming>SequenceFlow_responde</bpmn:incoming>
      <bpmn:outgoing>SequenceFlow_end</bpmn:outgoing>
    </bpmn:sendTask>
    <bpmn:userTask id="EnviaSuporte" name="Envia Suporte">
      <bpmn:documentation>{action: 123}</bpmn:documentation>
      <bpmn:extensionElements>
        <camunda:properties>
          <camunda:property />
        </camunda:properties>
        <camunda:formData>
          <camunda:formField id="resposta" />
        </camunda:formData>
      </bpmn:extensionElements>
      <bpmn:incoming>SequenceFlow_inicio</bpmn:incoming>
      <bpmn:outgoing>SequenceFlow_possuporte</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:userTask id="enviaDev" name="Envia Dev">
      <bpmn:documentation>{action: 123321}</bpmn:documentation>
      <bpmn:extensionElements>
        <camunda:formData>
          <camunda:formField id="resposatdev" />
        </camunda:formData>
      </bpmn:extensionElements>
      <bpmn:incoming>SequenceFlow_dev</bpmn:incoming>
      <bpmn:outgoing>SequenceFlow_posdev</bpmn:outgoing>
    </bpmn:userTask>
  </bpmn:process>
  <bpmn:message id="Message_1usd7an" name="Message_11job5j" />
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1okzu9n">
      <bpmndi:BPMNShape id="_BPMNShape_StartEvent_2" bpmnElement="StartEvent_1">
        <dc:Bounds x="179" y="89" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="SequenceFlow_1ihzt8e_di" bpmnElement="SequenceFlow_inicio">
        <di:waypoint x="215" y="107" />
        <di:waypoint x="260" y="107" />
        <di:waypoint x="260" y="120" />
        <di:waypoint x="310" y="120" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNShape id="ExclusiveGateway_0r37z99_di" bpmnElement="resolvidoSuporte" isMarkerVisible="true">
        <dc:Bounds x="335" y="205" width="50" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="SequenceFlow_06z23gu_di" bpmnElement="SequenceFlow_possuporte">
        <di:waypoint x="360" y="160" />
        <di:waypoint x="360" y="205" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="SequenceFlow_14r7g0e_di" bpmnElement="SequenceFlow_dev">
        <di:waypoint x="360" y="255" />
        <di:waypoint x="360" y="320" />
        <di:waypoint x="270" y="320" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNShape id="EndEvent_1ef0fl6_di" bpmnElement="EndEvent_1ef0fl6">
        <dc:Bounds x="552" y="642" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="SequenceFlow_12fp660_di" bpmnElement="SequenceFlow_posdev">
        <di:waypoint x="270" y="350" />
        <di:waypoint x="400" y="350" />
        <di:waypoint x="400" y="540" />
        <di:waypoint x="520" y="540" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="SequenceFlow_1f16j7c_di" bpmnElement="SequenceFlow_end">
        <di:waypoint x="570" y="580" />
        <di:waypoint x="570" y="642" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="SequenceFlow_1wyptcb_di" bpmnElement="SequenceFlow_responde">
        <di:waypoint x="385" y="230" />
        <di:waypoint x="570" y="230" />
        <di:waypoint x="570" y="500" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNShape id="SendTask_159g77w_di" bpmnElement="respondeUsuario">
        <dc:Bounds x="520" y="500" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="UserTask_1u54z8n_di" bpmnElement="EnviaSuporte">
        <dc:Bounds x="310" y="80" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="UserTask_1ioaxmd_di" bpmnElement="enviaDev">
        <dc:Bounds x="170" y="310" width="100" height="80" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>




  `;

main();
