'use strict';

const BpmnModdle = require('bpmn-moddle');

// XML namespaces
// const NS_BPMN_SEMANTIC = "http://www.omg.org/spec/BPMN/20100524/MODEL";
// const NS_BPMN_DIAGRAM_INTERCHANGE = "http://www.omg.org/spec/BPMN/20100524/DI";
// const NS_OMG_DC = "http://www.omg.org/spec/DD/20100524/DC";
// const NS_OMG_DI = "http://www.omg.org/spec/DD/20100524/DI";

function Transformer() {
  this.parseListeners = [];
  this.moddle = new BpmnModdle();
}

module.exports = Transformer;

Transformer.prototype.transform = function(sourceDOM, executable, callback) {
  return this.moddle.fromXML(sourceDOM, (err, definition) => {
    callback(err, definition);
  });
};
