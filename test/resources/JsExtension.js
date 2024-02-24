import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const safePattern = /[./\\#*:\s]/g;

const nodeRequire = createRequire(fileURLToPath(import.meta.url));
export const moddleOptions = nodeRequire('./js-bpmn-moddle.json');

export function extension(activity, context) {
  const resultVariable = ResultVariableIo(activity, context);
  const formKey = FormKey(activity, context);

  return {
    type: 'js:extension',
    extensions: { resultVariable, formKey },
    activate(msg) {
      if (resultVariable) resultVariable.activate(msg);
      if (formKey) formKey.activate(msg);
    },
    deactivate() {
      if (resultVariable) resultVariable.deactivate();
      if (formKey) formKey.deactivate();
    },
  };
}

function ResultVariableIo(activity, context) {
  const { id, logger, behaviour } = activity;
  const { result } = behaviour;
  if (!result) return;

  const { broker } = activity;
  const { environment } = context;

  const type = 'js:resultvariable';
  let activityConsumer;

  return {
    type,
    activate,
    deactivate,
  };

  function deactivate() {
    if (activityConsumer) activityConsumer = activityConsumer.cancel();
  }

  function activate() {
    if (activityConsumer) return;
    activityConsumer = broker.subscribeTmp('event', 'activity.end', onActivityEnd, { noAck: true });
  }

  function onActivityEnd(_, message) {
    const resultName = environment.resolveExpression(result, message.content);
    logger.debug(`<${id}>`, 'js:extension save to', `"${resultName}"`);

    environment.output[resultName] = message.content.output;
  }
}

function FormKey(activity, context) {
  const { id, logger, behaviour } = activity;
  const { formKey } = behaviour;
  if (!formKey) return;

  const { broker } = activity;
  const { environment } = context;

  const type = 'js:formkey';
  const safeType = brokerSafeId(type).toLowerCase();
  let activityConsumer;

  return {
    type,
    activate,
    deactivate,
  };

  function deactivate() {
    if (activityConsumer) activityConsumer = activityConsumer.cancel();
  }

  function activate() {
    if (activityConsumer) return;
    activityConsumer = broker.subscribeTmp('event', 'activity.start', onActivityStart, { noAck: true });
  }

  function onActivityStart(_, message) {
    const formKeyValue = environment.resolveExpression(formKey, message);
    logger.debug(`<${id}> apply form`);

    broker.publish('format', `run.${safeType}.start`, {
      form: {
        type,
        key: formKeyValue,
      },
    });
  }
}

function brokerSafeId(id) {
  return id.replace(safePattern, '_');
}
