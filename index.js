'use strict';

const BpmnModdle = require('./dist/bpmn-moddle');
const DebugLogger = require('./lib/Logger');
const JavaScripts = require('./lib/JavaScripts');
const elements = require('bpmn-elements');
const {default: serializer, deserialize, TypeResolver} = require('moddle-context-serializer');
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
  }, options.typeResolver);

  const pendingSources = [];
  if (options.source) pendingSources.push(loadDefinitionSource(options.source));
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

    console.log('ÖLKJHG', environment.options, executeOptions)

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

    if (savedState.sources) definitions = savedState.sources.map(recoverDefinitionSource);
    if (!savedState.definitions) return engine;

    savedState.definitions.forEach((dState) => {
      const definition = definitions.find(({id}) => id === dState.id);
      definition.recover(dState);
    });

    return engine;
  }

  function resume(resumeOptions) {
    if (!definitions) return;
    state = 'running';
    setup(resumeOptions);
    definitions.forEach((definition) => definition.resume());
  }

  function getDefinitions() {
    return Promise.all(pendingSources).then((srcs) => srcs.map((src) => loadDefinition(src)));
  }

  async function getDefinitionById(id) {
    return (await getDefinitions()).find((d) => d.id === id);
  }

  function getState() {
    if (!definitions) return;
    return {
      name,
      state,
      sources: sources.map((s) => s.serialize()),
      definitions: definitions.map((d) => d.getState()),
    };
  }

  function setup({listener}) {
    if (listener && typeof listener.emit !== 'function') throw new Error('listener.emit is not a function');

    definitions.forEach(setupDefinition);

    function setupDefinition(definition) {
      definition.broker.subscribeTmp('event', 'definition.#', onDefinitionMessage, {noAck: true, consumerTag: '_engine_definition'});
      definition.broker.subscribeTmp('event', 'process.end', onDefinitionMessage, {noAck: true, consumerTag: '_engine_process_leave'});

      definition.broker.subscribeTmp('event', 'activity.wait', (_, msg) => {
        if (listener) listener.emit('wait', definition.getApi(msg));
      }, {noAck: true, consumerTag: '_engine_activity_wait'});
    }
  }

  function onDefinitionMessage(routingKey, message, owner) {
    // console.log(owner.type, owner.getApi(message))

    switch (routingKey) {
      case 'activity.wait':

      case 'process.end':

        break;
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
      ...executeOptions
    }));

    return elements.Definition(context);
  }

  async function loadDefinitionSource(source) {
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
