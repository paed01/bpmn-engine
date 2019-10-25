'use strict';

module.exports = function ProcessOutputDataObject(dataObjectDef, _ref) {
  var environment = _ref.environment;
  var id = dataObjectDef.id,
      type = dataObjectDef.type,
      name = dataObjectDef.name,
      behaviour = dataObjectDef.behaviour,
      parent = dataObjectDef.parent;
  var source = {
    id: id,
    name: name,
    type: type,
    behaviour: behaviour,
    parent: parent,
    read: function read(broker, exchange, routingKeyPrefix, messageProperties) {
      var value = environment.variables.data && environment.variables.data[id];
      return broker.publish(exchange, "".concat(routingKeyPrefix, "response"), {
        id: id,
        name: name,
        type: type,
        value: value
      }, messageProperties);
    },
    write: function write(broker, exchange, routingKeyPrefix, value, messageProperties) {
      environment.variables.data = environment.variables.data || {};
      environment.variables.data[id] = value;
      environment.output.data = environment.output.data || {};
      environment.output.data[id] = value;
      return broker.publish(exchange, "".concat(routingKeyPrefix, "response"), {
        id: id,
        name: name,
        type: type,
        value: value
      }, messageProperties);
    }
  };
  return source;
};