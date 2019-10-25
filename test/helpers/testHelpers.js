const BpmnModdle = require('bpmn-moddle');

module.exports = {
  moddleContext,
  serializeModdleContext,
};

function moddleContext(source, options) {
  const bpmnModdle = new BpmnModdle(options);

  return new Promise((resolve, reject) => {
    bpmnModdle.fromXML(Buffer.isBuffer(source) ? source.toString() : source, (err, definitions, moddleCtx) => {
      if (err) return reject(err);
      resolve(moddleCtx);
    });
  });
}

function serializeModdleContext({ rootHandler, elementsById, references, warnings }) {
  const clonedContext = {
    rootHandler: {
      element: JSON.parse(JSON.stringify(rootHandler.element))
    },
    elementsById: JSON.parse(JSON.stringify(elementsById)),
    references: JSON.parse(JSON.stringify(references)),
    warnings: warnings.slice()
  };
  return clonedContext;
}
