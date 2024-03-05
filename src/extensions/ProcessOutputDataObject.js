const kDataObjectDef = Symbol.for('data object definition');

export default function ProcessOutputDataObject(dataObjectDef, { environment }) {
  this[kDataObjectDef] = dataObjectDef;
  this.environment = environment;
  this.behaviour = dataObjectDef.behaviour;
  this.name = dataObjectDef.name;
  this.parent = dataObjectDef.parent;
}

Object.defineProperties(ProcessOutputDataObject.prototype, {
  id: {
    get() {
      return this[kDataObjectDef].id;
    },
  },
  type: {
    get() {
      return this[kDataObjectDef].type;
    },
  },
});

ProcessOutputDataObject.prototype.read = function readDataObject(broker, exchange, routingKeyPrefix, messageProperties) {
  const environment = this.environment;
  const { id, name, type } = this;
  const value = environment.variables.data && environment.variables.data[this.id];
  return broker.publish(exchange, `${routingKeyPrefix}response`, { id, name, type, value }, messageProperties);
};

ProcessOutputDataObject.prototype.write = function writeDataObject(broker, exchange, routingKeyPrefix, value, messageProperties) {
  const environment = this.environment;
  const { id, name, type } = this;

  environment.variables.data = environment.variables.data || {};
  environment.variables.data[id] = value;

  environment.output.data = environment.output.data || {};
  environment.output.data[id] = value;
  return broker.publish(exchange, `${routingKeyPrefix}response`, { id, name, type, value }, messageProperties);
};
