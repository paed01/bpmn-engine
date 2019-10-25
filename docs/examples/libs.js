import { Engine } from '../../index';
import JsExtension from '../../test/resources/JsExtension';

export function ServiceExpression(activity) {
  const { type: atype, behaviour, environment } = activity;
  const expression = behaviour.expression;
  const type = `${atype}:expression`;
  return {
    type,
    expression,
    execute,
  };
  function execute(executionMessage, callback) {
    const serviceFn = environment.resolveExpression(expression, executionMessage);
    serviceFn.call(activity, executionMessage, (err, result) => {
      callback(err, result);
    });
  }
}



export async function runEngine(source, listener, options, state = null) {

  const configEngine = {
    name: 'execution example',
    // enableDummyService
    moddleOptions: {
      camunda: require('camunda-bpmn-moddle/resources/camunda.json'),
      // js: JsExtension.moddleOptions
    },
    source,
    services: {
      serviceFn(scope, callback) {
        // const result = executionContext['dummy'] || ['dummy'];
        console.log('------------ serviceFn');
        callback(null, { data: 1 });
      }
    },
    extensions: {
      js: JsExtension.extension,
      camundaServiceTask(activity) {
        if (activity.behaviour.expression) {
          activity.behaviour.Service = ServiceExpression;
        }
        if (activity.behaviour.resultVariable) {
          activity.on('end', (api) => {
            activity.environment.output[activity.behaviour.resultVariable] = api.content.output;
          });
        }
      },
    },
    ...options
  };
  let engine = Engine(configEngine);
  let api;
  if (state) {
    engine = engine.recover(state);
    api = await engine.resume({
      listener
    });
  } else {
    engine.execute({ listener }, (err, execution) => {
      console.log('Execution completed with id', execution ? execution.environment.variables.id : null);
    });
  }

  return { engine, api };
}


// export function Extension(activity) {
//   if (!activity.behaviour.extensionElements) return;

//   const { broker, environment } = activity;
//   const myExtensions = [];

//   for (const extension of activity.behaviour.extensionElements.values) {
//     switch (extension.$type) {
//       case 'camunda:ExecutionListener': {
//         myExtensions.push(ExecutionListener(extension));
//         break;
//       }
//     }
//   }

//   return {
//     extensions: myExtensions,
//     activate(...args) {
//       myExtensions.forEach((e) => e.activate(...args));
//     },
//     deactivate() {
//       myExtensions.forEach((e) => e.deactivate());
//     },
//   };

//   function ExecutionListener(extension) {
//     return {
//       activate() {
//         const script = environment.scripts.getScript(extension.script.scriptFormat, { id: extension.script.resource });
//         broker.subscribeTmp('event', `activity.${extension.event}`, (routingKey, message) => {
//           script.execute(message);
//         }, { noAck: true, consumerTag: '_my-extension' });
//       },
//       deactivate() {
//         broker.cancel('_my-extension');
//       }
//     };
//   }

// }
