'use strict';

const BpmnModdle = require('./dist/bpmn-moddle');
const DebugLogger = require('./lib/Logger');
const elements = require('bpmn-elements');
const JavaScripts = require('./lib/JavaScripts');
const ProcessOutputDataObject = require('./lib/extensions/bpmn/ProcessOutputDataObject');
const {default: serializer, deserialize, TypeResolver} = require('moddle-context-serializer');
const {version: engineVersion} = require('./package.json');
const {EventEmitter} = require('events');

module.exports = {Engine};

function Engine(options = {}) {
  options = {Logger: DebugLogger, scripts: JavaScripts(), ...options};

  let {name} = options;

  let definitions;
  let state = 'idle';

  const sources = [];
  const typeResolver = TypeResolver({
    ...elements,
    ...(options.elements || {})
  }, defaultTypeResolver);

  function defaultTypeResolver(elementTypes) {
    if (options.typeResolver) return options.typeResolver(elementTypes);
    elementTypes['bpmn:DataObject'] = ProcessOutputDataObject;
  }

  const pendingSources = [];
  if (options.source) pendingSources.push(serializeSource(options.source));
  if (options.moddleContext) pendingSources.push(serializeModdleContext(options.moddleContext));

  const environment = elements.Environment(options);
  const emitter = new EventEmitter();

  const engine = Object.assign(emitter, {
    environment,
    execute,
    getDefinitionById,
    getDefinitions,
    getState,
    recover,
    resume,
    stop,
  });

  Object.defineProperty(engine, 'name', {
    enumerable: true,
    get() {
      return name;
    },
  });

  Object.defineProperty(engine, 'definitions', {
    enumerable: true,
    get() {
      return definitions;
    },
  });

  Object.defineProperty(engine, 'state', {
    enumerable: true,
    get() {
      return state;
    },
  });

  return engine;

  async function execute(executeOptions = {}) {
    const runSources = await Promise.all(pendingSources);
    definitions = runSources.map((source) => loadDefinition(source, executeOptions));
    setup(executeOptions);

    definitions.forEach((definition) => definition.run());
  }

  function stop() {
    if (!definitions) return;
    definitions.forEach((d) => d.stop());
  }

  function recover(savedState) {
    if (name) name = savedState.name;
    if (!savedState.definitions) return engine;

    definitions = savedState.definitions.map((dState) => {
      const source = deserialize(JSON.parse(dState.source), typeResolver);

      console.log('KLKK', source.getActivities())

      const definition = loadDefinition(source);
      definition.recover(dState);


      return definition;
    });

    return engine;
  }

  function resume(resumeOptions = {}) {
    if (!definitions) return;
    setup(resumeOptions);
    definitions.forEach((definition) => definition.resume());
  }

  function getDefinitions(executeOptions) {
    return Promise.all(pendingSources).then((srcs) => srcs.map((src) => loadDefinition(src, executeOptions)));
  }

  async function getDefinitionById(id) {
    return (await getDefinitions()).find((d) => d.id === id);
  }

  function getState() {
    const result = {
      name,
      state,
      engineVersion,
    };
    if (!definitions) return result;
    return {
      ...result,
      definitions: definitions.map(getDefinitionState),
    };

    function getDefinitionState(definition) {
      return {
        ...definition.getState(),
        source: definition.environment.options.source.serialize(),
      };
    }
  }

  function setup({listener}) {
    if (listener && typeof listener.emit !== 'function') throw new Error('listener.emit is not a function');

    definitions.forEach(setupDefinition);

    function setupDefinition(definition) {
      if (listener) definition.environment.options.listener = listener;

      definition.broker.subscribeTmp('event', 'definition.#', onDefinitionMessage, {noAck: true, consumerTag: '_engine_definition'});
      definition.broker.subscribeTmp('event', 'process.end', onDefinitionMessage, {noAck: true, consumerTag: '_engine_process_leave'});
      definition.broker.subscribeTmp('event', 'activity.wait', onDefinitionMessage, {noAck: true, consumerTag: '_engine_activity_wait'});
    }
  }

  function onDefinitionMessage(routingKey, message, owner) {
    switch (routingKey) {
      case 'definition.enter':
        state = 'running';
        break;
      case 'definition.stop':
        state = 'idle';
        break;
      case 'activity.wait': {
        const {environment: ownerEnvironment} = owner;
        if (ownerEnvironment.options.listener) ownerEnvironment.options.listener.emit('wait', owner.getApi(message));
        break;
      }
      case 'process.end': {
        if (message.content.output && message.content.output.data) {
          environment.output.data = environment.output.data || {};
          environment.output.data = {...environment.output.data, ...message.content.output.data};
        }
        break;
      }
      case 'definition.error':
        emitter.emit('error', message.content.error);
        break;
      case 'definition.leave':
        state = 'idle';

        teardownDefinition(owner);
        emitter.emit('end');
        break;
    }
  }

  function teardownDefinition(definition) {
    definition.broker.cancel('_engine_definition');
    definition.broker.cancel('_engine_process_leave');
    definition.broker.cancel('_engine_activity_wait');
  }

  function loadDefinition(serializedContext, executeOptions) {
    const context = elements.Context(serializedContext, environment.clone({
      listener: environment.options.listener,
      ...executeOptions,
      source: serializedContext,
    }));

    return elements.Definition(context);
  }

  async function serializeSource(source) {
    const moddleContext = await getModdleContext(source);
    return serializeModdleContext(moddleContext);
  }

  function serializeModdleContext(moddleContext) {
    const serialized = serializer(moddleContext, typeResolver);
    sources.push(serialized);
    return serialized;
  }

  function recoverDefinitionSource(serializedSource) {
    const serialized = deserialize(JSON.parse(serializedSource), typeResolver);
    sources.push(serialized);
    const context = elements.Context(serialized);
    return elements.Definition(context, options);
  }

  function getModdleContext(source) {
    return new Promise((resolve, reject) => {
      const bpmnModdle = new BpmnModdle(options.moddleOptions);
      bpmnModdle.fromXML(Buffer.isBuffer(source) ? source.toString() : source.trim(), (err, _, moddleContext) => {
        if (err) return reject(err);
        resolve(moddleContext);
      });
    });
  }
}
