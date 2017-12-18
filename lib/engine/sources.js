'use strict';

const Definition = require('../definition');
const getOptionsAndCallback = require('../getOptionsAndCallback');
const getPropertyValue = require('../getPropertyValue');
const transformer = require('../transformer');

module.exports = {
  Source,
  transformSources
};

function Source(source, extensions) {
  let definition, moddleContext;

  return {
    extensions,
    get,
    getDefinition,
    getId,
    getTransformedDefinition,
    set,
    transform
  };

  function transform(callback) {
    if (moddleContext) {
      callback(null, null, moddleContext);
      return moddleContext;
    }

    transformer.transform(source, getModdleOptions(), (err, transformedDefinitions, transformed) => {
      if (err) return callback(err);
      set(transformed);
      callback(err, transformedDefinitions, transformed);
    });
  }

  function set(transformed) {
    moddleContext = transformed;
  }

  function get() {
    return moddleContext;
  }

  function getId() {
    if (!moddleContext) return;
    return getPropertyValue(moddleContext, 'rootHandler.element.id') || 'anonymous';
  }

  function getTransformedDefinition(executeOptions) {
    if (!moddleContext) return;
    return Definition(moddleContext, executeOptions);
  }

  function getDefinition(executeGetOptions, getCallback) {
    const [executeOptions, callback] = getOptionsAndCallback(executeGetOptions, getCallback, {extensions});
    transform((err) => {
      if (err) return callback(err);
      definition = Definition(moddleContext, executeOptions);
      return callback(null, definition);
    });
  }

  function getModdleOptions() {
    if (!extensions) return;

    const moddleOptions = {};
    for (const key in extensions) {
      const extension = extensions[key];
      if (extension.moddleOptions) {
        moddleOptions[key] = extension.moddleOptions;
      }
    }

    return moddleOptions;
  }
}

function transformSources(sources, callback) {
  if (!sources.length) callback(null, []);

  let completedTransform = false;
  const transformed = new Array(sources.length);
  const transformers = sources.map((source, idx) => {
    const cb = transformCallback(source, idx);
    return () => source.transform(cb);
  });

  return transformers.forEach((fn) => {
    if (!completedTransform) fn();
  });

  function completeTransformCallback(err) {
    if (completedTransform) return;
    callback(err, transformed);
    completedTransform = true;
  }

  function transformCallback(source, idx) {
    return function transformCb(err, def, moddleContext) {
      if (err) return completeTransformCallback(err);
      transformers.pop();
      transformed[idx] = moddleContext;
      if (!transformers.length) completeTransformCallback();
    };
  }
}
