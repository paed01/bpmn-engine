(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('tty'), require('util'), require('os'), require('vm'), require('events')) :
  typeof define === 'function' && define.amd ? define(['exports', 'tty', 'util', 'os', 'vm', 'events'], factory) :
  (global = global || self, factory(global.BpmnEngine = {}, global.tty, global.util, global.os, global.vm, global.events));
}(this, (function (exports, tty, util, os, vm, events) { 'use strict';

  tty = tty && tty.hasOwnProperty('default') ? tty['default'] : tty;
  util = util && util.hasOwnProperty('default') ? util['default'] : util;
  os = os && os.hasOwnProperty('default') ? os['default'] : os;
  vm = vm && vm.hasOwnProperty('default') ? vm['default'] : vm;
  events = events && events.hasOwnProperty('default') ? events['default'] : events;

  /**
   * Flatten array, one level deep.
   *
   * @param {Array<?>} arr
   *
   * @return {Array<?>}
   */

  var nativeToString = Object.prototype.toString;
  var nativeHasOwnProperty = Object.prototype.hasOwnProperty;
  function isUndefined(obj) {
    return obj === undefined;
  }
  function isArray(obj) {
    return nativeToString.call(obj) === '[object Array]';
  }
  function isObject(obj) {
    return nativeToString.call(obj) === '[object Object]';
  }
  function isFunction(obj) {
    var tag = nativeToString.call(obj);
    return tag === '[object Function]' || tag === '[object AsyncFunction]' || tag === '[object GeneratorFunction]' || tag === '[object AsyncGeneratorFunction]' || tag === '[object Proxy]';
  }
  function isString(obj) {
    return nativeToString.call(obj) === '[object String]';
  }
  /**
   * Return true, if target owns a property with the given key.
   *
   * @param {Object} target
   * @param {String} key
   *
   * @return {Boolean}
   */

  function has(target, key) {
    return nativeHasOwnProperty.call(target, key);
  }

  /**
   * Find element in collection.
   *
   * @param  {Array|Object} collection
   * @param  {Function|Object} matcher
   *
   * @return {Object}
   */

  function find(collection, matcher) {
    matcher = toMatcher(matcher);
    var match;
    forEach(collection, function (val, key) {
      if (matcher(val, key)) {
        match = val;
        return false;
      }
    });
    return match;
  }
  /**
   * Find element in collection.
   *
   * @param  {Array|Object} collection
   * @param  {Function} matcher
   *
   * @return {Array} result
   */

  function filter(collection, matcher) {
    var result = [];
    forEach(collection, function (val, key) {
      if (matcher(val, key)) {
        result.push(val);
      }
    });
    return result;
  }
  /**
   * Iterate over collection; returning something
   * (non-undefined) will stop iteration.
   *
   * @param  {Array|Object} collection
   * @param  {Function} iterator
   *
   * @return {Object} return result that stopped the iteration
   */

  function forEach(collection, iterator) {
    var val, result;

    if (isUndefined(collection)) {
      return;
    }

    var convertKey = isArray(collection) ? toNum : identity;

    for (var key in collection) {
      if (has(collection, key)) {
        val = collection[key];
        result = iterator(val, convertKey(key));

        if (result === false) {
          return val;
        }
      }
    }
  }
  /**
   * Transform a collection into another collection
   * by piping each member through the given fn.
   *
   * @param  {Object|Array}   collection
   * @param  {Function} fn
   *
   * @return {Array} transformed collection
   */

  function map(collection, fn) {
    var result = [];
    forEach(collection, function (val, key) {
      result.push(fn(val, key));
    });
    return result;
  }

  function toMatcher(matcher) {
    return isFunction(matcher) ? matcher : function (e) {
      return e === matcher;
    };
  }

  function identity(arg) {
    return arg;
  }

  function toNum(arg) {
    return Number(arg);
  }
  /**
   * Bind function against target <this>.
   *
   * @param  {Function} fn
   * @param  {Object}   target
   *
   * @return {Function} bound function
   */

  function bind(fn, target) {
    return fn.bind(target);
  }

  function _extends() {
    _extends = Object.assign || function (target) {
      for (var i = 1; i < arguments.length; i++) {
        var source = arguments[i];

        for (var key in source) {
          if (Object.prototype.hasOwnProperty.call(source, key)) {
            target[key] = source[key];
          }
        }
      }

      return target;
    };

    return _extends.apply(this, arguments);
  }

  /**
   * Convenience wrapper for `Object.assign`.
   *
   * @param {Object} target
   * @param {...Object} others
   *
   * @return {Object} the target
   */

  function assign(target) {
    for (var _len = arguments.length, others = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      others[_key - 1] = arguments[_key];
    }

    return _extends.apply(void 0, [target].concat(others));
  }
  /**
   * Pick given properties from the target object.
   *
   * @param {Object} target
   * @param {Array} properties
   *
   * @return {Object} target
   */

  function pick(target, properties) {
    var result = {};
    var obj = Object(target);
    forEach(properties, function (prop) {
      if (prop in obj) {
        result[prop] = target[prop];
      }
    });
    return result;
  }

  /**
   * Moddle base element.
   */
  function Base() { }

  Base.prototype.get = function(name) {
    return this.$model.properties.get(this, name);
  };

  Base.prototype.set = function(name, value) {
    this.$model.properties.set(this, name, value);
  };

  /**
   * A model element factory.
   *
   * @param {Moddle} model
   * @param {Properties} properties
   */
  function Factory(model, properties) {
    this.model = model;
    this.properties = properties;
  }


  Factory.prototype.createType = function(descriptor) {

    var model = this.model;

    var props = this.properties,
        prototype = Object.create(Base.prototype);

    // initialize default values
    forEach(descriptor.properties, function(p) {
      if (!p.isMany && p.default !== undefined) {
        prototype[p.name] = p.default;
      }
    });

    props.defineModel(prototype, model);
    props.defineDescriptor(prototype, descriptor);

    var name = descriptor.ns.name;

    /**
     * The new type constructor
     */
    function ModdleElement(attrs) {
      props.define(this, '$type', { value: name, enumerable: true });
      props.define(this, '$attrs', { value: {} });
      props.define(this, '$parent', { writable: true });

      forEach(attrs, bind(function(val, key) {
        this.set(key, val);
      }, this));
    }

    ModdleElement.prototype = prototype;

    ModdleElement.hasType = prototype.$instanceOf = this.model.hasType;

    // static links
    props.defineModel(ModdleElement, model);
    props.defineDescriptor(ModdleElement, descriptor);

    return ModdleElement;
  };

  /**
   * Built-in moddle types
   */
  var BUILTINS = {
    String: true,
    Boolean: true,
    Integer: true,
    Real: true,
    Element: true
  };

  /**
   * Converters for built in types from string representations
   */
  var TYPE_CONVERTERS = {
    String: function(s) { return s; },
    Boolean: function(s) { return s === 'true'; },
    Integer: function(s) { return parseInt(s, 10); },
    Real: function(s) { return parseFloat(s, 10); }
  };

  /**
   * Convert a type to its real representation
   */
  function coerceType(type, value) {

    var converter = TYPE_CONVERTERS[type];

    if (converter) {
      return converter(value);
    } else {
      return value;
    }
  }

  /**
   * Return whether the given type is built-in
   */
  function isBuiltIn(type) {
    return !!BUILTINS[type];
  }

  /**
   * Return whether the given type is simple
   */
  function isSimple(type) {
    return !!TYPE_CONVERTERS[type];
  }

  /**
   * Parses a namespaced attribute name of the form (ns:)localName to an object,
   * given a default prefix to assume in case no explicit namespace is given.
   *
   * @param {String} name
   * @param {String} [defaultPrefix] the default prefix to take, if none is present.
   *
   * @return {Object} the parsed name
   */
  function parseName(name, defaultPrefix) {
    var parts = name.split(/:/),
        localName, prefix;

    // no prefix (i.e. only local name)
    if (parts.length === 1) {
      localName = name;
      prefix = defaultPrefix;
    } else
    // prefix + local name
    if (parts.length === 2) {
      localName = parts[1];
      prefix = parts[0];
    } else {
      throw new Error('expected <prefix:localName> or <localName>, got ' + name);
    }

    name = (prefix ? prefix + ':' : '') + localName;

    return {
      name: name,
      prefix: prefix,
      localName: localName
    };
  }

  /**
   * A utility to build element descriptors.
   */
  function DescriptorBuilder(nameNs) {
    this.ns = nameNs;
    this.name = nameNs.name;
    this.allTypes = [];
    this.allTypesByName = {};
    this.properties = [];
    this.propertiesByName = {};
  }


  DescriptorBuilder.prototype.build = function() {
    return pick(this, [
      'ns',
      'name',
      'allTypes',
      'allTypesByName',
      'properties',
      'propertiesByName',
      'bodyProperty',
      'idProperty'
    ]);
  };

  /**
   * Add property at given index.
   *
   * @param {Object} p
   * @param {Number} [idx]
   * @param {Boolean} [validate=true]
   */
  DescriptorBuilder.prototype.addProperty = function(p, idx, validate) {

    if (typeof idx === 'boolean') {
      validate = idx;
      idx = undefined;
    }

    this.addNamedProperty(p, validate !== false);

    var properties = this.properties;

    if (idx !== undefined) {
      properties.splice(idx, 0, p);
    } else {
      properties.push(p);
    }
  };


  DescriptorBuilder.prototype.replaceProperty = function(oldProperty, newProperty, replace) {
    var oldNameNs = oldProperty.ns;

    var props = this.properties,
        propertiesByName = this.propertiesByName,
        rename = oldProperty.name !== newProperty.name;

    if (oldProperty.isId) {
      if (!newProperty.isId) {
        throw new Error(
          'property <' + newProperty.ns.name + '> must be id property ' +
          'to refine <' + oldProperty.ns.name + '>');
      }

      this.setIdProperty(newProperty, false);
    }

    if (oldProperty.isBody) {

      if (!newProperty.isBody) {
        throw new Error(
          'property <' + newProperty.ns.name + '> must be body property ' +
          'to refine <' + oldProperty.ns.name + '>');
      }

      // TODO: Check compatibility
      this.setBodyProperty(newProperty, false);
    }

    // validate existence and get location of old property
    var idx = props.indexOf(oldProperty);
    if (idx === -1) {
      throw new Error('property <' + oldNameNs.name + '> not found in property list');
    }

    // remove old property
    props.splice(idx, 1);

    // replacing the named property is intentional
    //
    //  * validate only if this is a "rename" operation
    //  * add at specific index unless we "replace"
    //
    this.addProperty(newProperty, replace ? undefined : idx, rename);

    // make new property available under old name
    propertiesByName[oldNameNs.name] = propertiesByName[oldNameNs.localName] = newProperty;
  };


  DescriptorBuilder.prototype.redefineProperty = function(p, targetPropertyName, replace) {

    var nsPrefix = p.ns.prefix;
    var parts = targetPropertyName.split('#');

    var name = parseName(parts[0], nsPrefix);
    var attrName = parseName(parts[1], name.prefix).name;

    var redefinedProperty = this.propertiesByName[attrName];
    if (!redefinedProperty) {
      throw new Error('refined property <' + attrName + '> not found');
    } else {
      this.replaceProperty(redefinedProperty, p, replace);
    }

    delete p.redefines;
  };

  DescriptorBuilder.prototype.addNamedProperty = function(p, validate) {
    var ns = p.ns,
        propsByName = this.propertiesByName;

    if (validate) {
      this.assertNotDefined(p, ns.name);
      this.assertNotDefined(p, ns.localName);
    }

    propsByName[ns.name] = propsByName[ns.localName] = p;
  };

  DescriptorBuilder.prototype.removeNamedProperty = function(p) {
    var ns = p.ns,
        propsByName = this.propertiesByName;

    delete propsByName[ns.name];
    delete propsByName[ns.localName];
  };

  DescriptorBuilder.prototype.setBodyProperty = function(p, validate) {

    if (validate && this.bodyProperty) {
      throw new Error(
        'body property defined multiple times ' +
        '(<' + this.bodyProperty.ns.name + '>, <' + p.ns.name + '>)');
    }

    this.bodyProperty = p;
  };

  DescriptorBuilder.prototype.setIdProperty = function(p, validate) {

    if (validate && this.idProperty) {
      throw new Error(
        'id property defined multiple times ' +
        '(<' + this.idProperty.ns.name + '>, <' + p.ns.name + '>)');
    }

    this.idProperty = p;
  };

  DescriptorBuilder.prototype.assertNotDefined = function(p, name) {
    var propertyName = p.name,
        definedProperty = this.propertiesByName[propertyName];

    if (definedProperty) {
      throw new Error(
        'property <' + propertyName + '> already defined; ' +
        'override of <' + definedProperty.definedBy.ns.name + '#' + definedProperty.ns.name + '> by ' +
        '<' + p.definedBy.ns.name + '#' + p.ns.name + '> not allowed without redefines');
    }
  };

  DescriptorBuilder.prototype.hasProperty = function(name) {
    return this.propertiesByName[name];
  };

  DescriptorBuilder.prototype.addTrait = function(t, inherited) {

    var typesByName = this.allTypesByName,
        types = this.allTypes;

    var typeName = t.name;

    if (typeName in typesByName) {
      return;
    }

    forEach(t.properties, bind(function(p) {

      // clone property to allow extensions
      p = assign({}, p, {
        name: p.ns.localName,
        inherited: inherited
      });

      Object.defineProperty(p, 'definedBy', {
        value: t
      });

      var replaces = p.replaces,
          redefines = p.redefines;

      // add replace/redefine support
      if (replaces || redefines) {
        this.redefineProperty(p, replaces || redefines, replaces);
      } else {
        if (p.isBody) {
          this.setBodyProperty(p);
        }
        if (p.isId) {
          this.setIdProperty(p);
        }
        this.addProperty(p);
      }
    }, this));

    types.push(t);
    typesByName[typeName] = t;
  };

  /**
   * A registry of Moddle packages.
   *
   * @param {Array<Package>} packages
   * @param {Properties} properties
   */
  function Registry(packages, properties) {
    this.packageMap = {};
    this.typeMap = {};

    this.packages = [];

    this.properties = properties;

    forEach(packages, bind(this.registerPackage, this));
  }


  Registry.prototype.getPackage = function(uriOrPrefix) {
    return this.packageMap[uriOrPrefix];
  };

  Registry.prototype.getPackages = function() {
    return this.packages;
  };


  Registry.prototype.registerPackage = function(pkg) {

    // copy package
    pkg = assign({}, pkg);

    var pkgMap = this.packageMap;

    ensureAvailable(pkgMap, pkg, 'prefix');
    ensureAvailable(pkgMap, pkg, 'uri');

    // register types
    forEach(pkg.types, bind(function(descriptor) {
      this.registerType(descriptor, pkg);
    }, this));

    pkgMap[pkg.uri] = pkgMap[pkg.prefix] = pkg;
    this.packages.push(pkg);
  };


  /**
   * Register a type from a specific package with us
   */
  Registry.prototype.registerType = function(type, pkg) {

    type = assign({}, type, {
      superClass: (type.superClass || []).slice(),
      extends: (type.extends || []).slice(),
      properties: (type.properties || []).slice(),
      meta: assign((type.meta || {}))
    });

    var ns = parseName(type.name, pkg.prefix),
        name = ns.name,
        propertiesByName = {};

    // parse properties
    forEach(type.properties, bind(function(p) {

      // namespace property names
      var propertyNs = parseName(p.name, ns.prefix),
          propertyName = propertyNs.name;

      // namespace property types
      if (!isBuiltIn(p.type)) {
        p.type = parseName(p.type, propertyNs.prefix).name;
      }

      assign(p, {
        ns: propertyNs,
        name: propertyName
      });

      propertiesByName[propertyName] = p;
    }, this));

    // update ns + name
    assign(type, {
      ns: ns,
      name: name,
      propertiesByName: propertiesByName
    });

    forEach(type.extends, bind(function(extendsName) {
      var extended = this.typeMap[extendsName];

      extended.traits = extended.traits || [];
      extended.traits.push(name);
    }, this));

    // link to package
    this.definePackage(type, pkg);

    // register
    this.typeMap[name] = type;
  };


  /**
   * Traverse the type hierarchy from bottom to top,
   * calling iterator with (type, inherited) for all elements in
   * the inheritance chain.
   *
   * @param {Object} nsName
   * @param {Function} iterator
   * @param {Boolean} [trait=false]
   */
  Registry.prototype.mapTypes = function(nsName, iterator, trait) {

    var type = isBuiltIn(nsName.name) ? { name: nsName.name } : this.typeMap[nsName.name];

    var self = this;

    /**
     * Traverse the selected trait.
     *
     * @param {String} cls
     */
    function traverseTrait(cls) {
      return traverseSuper(cls, true);
    }

    /**
     * Traverse the selected super type or trait
     *
     * @param {String} cls
     * @param {Boolean} [trait=false]
     */
    function traverseSuper(cls, trait) {
      var parentNs = parseName(cls, isBuiltIn(cls) ? '' : nsName.prefix);
      self.mapTypes(parentNs, iterator, trait);
    }

    if (!type) {
      throw new Error('unknown type <' + nsName.name + '>');
    }

    forEach(type.superClass, trait ? traverseTrait : traverseSuper);

    // call iterator with (type, inherited=!trait)
    iterator(type, !trait);

    forEach(type.traits, traverseTrait);
  };


  /**
   * Returns the effective descriptor for a type.
   *
   * @param  {String} type the namespaced name (ns:localName) of the type
   *
   * @return {Descriptor} the resulting effective descriptor
   */
  Registry.prototype.getEffectiveDescriptor = function(name) {

    var nsName = parseName(name);

    var builder = new DescriptorBuilder(nsName);

    this.mapTypes(nsName, function(type, inherited) {
      builder.addTrait(type, inherited);
    });

    var descriptor = builder.build();

    // define package link
    this.definePackage(descriptor, descriptor.allTypes[descriptor.allTypes.length - 1].$pkg);

    return descriptor;
  };


  Registry.prototype.definePackage = function(target, pkg) {
    this.properties.define(target, '$pkg', { value: pkg });
  };



  ///////// helpers ////////////////////////////

  function ensureAvailable(packageMap, pkg, identifierKey) {

    var value = pkg[identifierKey];

    if (value in packageMap) {
      throw new Error('package with ' + identifierKey + ' <' + value + '> already defined');
    }
  }

  /**
   * A utility that gets and sets properties of model elements.
   *
   * @param {Model} model
   */
  function Properties(model) {
    this.model = model;
  }


  /**
   * Sets a named property on the target element.
   * If the value is undefined, the property gets deleted.
   *
   * @param {Object} target
   * @param {String} name
   * @param {Object} value
   */
  Properties.prototype.set = function(target, name, value) {

    var property = this.model.getPropertyDescriptor(target, name);

    var propertyName = property && property.name;

    if (isUndefined$1(value)) {
      // unset the property, if the specified value is undefined;
      // delete from $attrs (for extensions) or the target itself
      if (property) {
        delete target[propertyName];
      } else {
        delete target.$attrs[name];
      }
    } else {
      // set the property, defining well defined properties on the fly
      // or simply updating them in target.$attrs (for extensions)
      if (property) {
        if (propertyName in target) {
          target[propertyName] = value;
        } else {
          defineProperty(target, property, value);
        }
      } else {
        target.$attrs[name] = value;
      }
    }
  };

  /**
   * Returns the named property of the given element
   *
   * @param  {Object} target
   * @param  {String} name
   *
   * @return {Object}
   */
  Properties.prototype.get = function(target, name) {

    var property = this.model.getPropertyDescriptor(target, name);

    if (!property) {
      return target.$attrs[name];
    }

    var propertyName = property.name;

    // check if access to collection property and lazily initialize it
    if (!target[propertyName] && property.isMany) {
      defineProperty(target, property, []);
    }

    return target[propertyName];
  };


  /**
   * Define a property on the target element
   *
   * @param  {Object} target
   * @param  {String} name
   * @param  {Object} options
   */
  Properties.prototype.define = function(target, name, options) {
    Object.defineProperty(target, name, options);
  };


  /**
   * Define the descriptor for an element
   */
  Properties.prototype.defineDescriptor = function(target, descriptor) {
    this.define(target, '$descriptor', { value: descriptor });
  };

  /**
   * Define the model for an element
   */
  Properties.prototype.defineModel = function(target, model) {
    this.define(target, '$model', { value: model });
  };


  function isUndefined$1(val) {
    return typeof val === 'undefined';
  }

  function defineProperty(target, property, value) {
    Object.defineProperty(target, property.name, {
      enumerable: !property.isReference,
      writable: true,
      value: value,
      configurable: true
    });
  }

  //// Moddle implementation /////////////////////////////////////////////////

  /**
   * @class Moddle
   *
   * A model that can be used to create elements of a specific type.
   *
   * @example
   *
   * var Moddle = require('moddle');
   *
   * var pkg = {
   *   name: 'mypackage',
   *   prefix: 'my',
   *   types: [
   *     { name: 'Root' }
   *   ]
   * };
   *
   * var moddle = new Moddle([pkg]);
   *
   * @param {Array<Package>} packages the packages to contain
   */
  function Moddle(packages) {

    this.properties = new Properties(this);

    this.factory = new Factory(this, this.properties);
    this.registry = new Registry(packages, this.properties);

    this.typeCache = {};
  }


  /**
   * Create an instance of the specified type.
   *
   * @method Moddle#create
   *
   * @example
   *
   * var foo = moddle.create('my:Foo');
   * var bar = moddle.create('my:Bar', { id: 'BAR_1' });
   *
   * @param  {String|Object} descriptor the type descriptor or name know to the model
   * @param  {Object} attrs   a number of attributes to initialize the model instance with
   * @return {Object}         model instance
   */
  Moddle.prototype.create = function(descriptor, attrs) {
    var Type = this.getType(descriptor);

    if (!Type) {
      throw new Error('unknown type <' + descriptor + '>');
    }

    return new Type(attrs);
  };


  /**
   * Returns the type representing a given descriptor
   *
   * @method Moddle#getType
   *
   * @example
   *
   * var Foo = moddle.getType('my:Foo');
   * var foo = new Foo({ 'id' : 'FOO_1' });
   *
   * @param  {String|Object} descriptor the type descriptor or name know to the model
   * @return {Object}         the type representing the descriptor
   */
  Moddle.prototype.getType = function(descriptor) {

    var cache = this.typeCache;

    var name = isString(descriptor) ? descriptor : descriptor.ns.name;

    var type = cache[name];

    if (!type) {
      descriptor = this.registry.getEffectiveDescriptor(name);
      type = cache[name] = this.factory.createType(descriptor);
    }

    return type;
  };


  /**
   * Creates an any-element type to be used within model instances.
   *
   * This can be used to create custom elements that lie outside the meta-model.
   * The created element contains all the meta-data required to serialize it
   * as part of meta-model elements.
   *
   * @method Moddle#createAny
   *
   * @example
   *
   * var foo = moddle.createAny('vendor:Foo', 'http://vendor', {
   *   value: 'bar'
   * });
   *
   * var container = moddle.create('my:Container', 'http://my', {
   *   any: [ foo ]
   * });
   *
   * // go ahead and serialize the stuff
   *
   *
   * @param  {String} name  the name of the element
   * @param  {String} nsUri the namespace uri of the element
   * @param  {Object} [properties] a map of properties to initialize the instance with
   * @return {Object} the any type instance
   */
  Moddle.prototype.createAny = function(name, nsUri, properties) {

    var nameNs = parseName(name);

    var element = {
      $type: name,
      $instanceOf: function(type) {
        return type === this.$type;
      }
    };

    var descriptor = {
      name: name,
      isGeneric: true,
      ns: {
        prefix: nameNs.prefix,
        localName: nameNs.localName,
        uri: nsUri
      }
    };

    this.properties.defineDescriptor(element, descriptor);
    this.properties.defineModel(element, this);
    this.properties.define(element, '$parent', { enumerable: false, writable: true });

    forEach(properties, function(a, key) {
      if (isObject(a) && a.value !== undefined) {
        element[a.name] = a.value;
      } else {
        element[key] = a;
      }
    });

    return element;
  };

  /**
   * Returns a registered package by uri or prefix
   *
   * @return {Object} the package
   */
  Moddle.prototype.getPackage = function(uriOrPrefix) {
    return this.registry.getPackage(uriOrPrefix);
  };

  /**
   * Returns a snapshot of all known packages
   *
   * @return {Object} the package
   */
  Moddle.prototype.getPackages = function() {
    return this.registry.getPackages();
  };

  /**
   * Returns the descriptor for an element
   */
  Moddle.prototype.getElementDescriptor = function(element) {
    return element.$descriptor;
  };

  /**
   * Returns true if the given descriptor or instance
   * represents the given type.
   *
   * May be applied to this, if element is omitted.
   */
  Moddle.prototype.hasType = function(element, type) {
    if (type === undefined) {
      type = element;
      element = this;
    }

    var descriptor = element.$model.getElementDescriptor(element);

    return (type in descriptor.allTypesByName);
  };

  /**
   * Returns the descriptor of an elements named property
   */
  Moddle.prototype.getPropertyDescriptor = function(element, property) {
    return this.getElementDescriptor(element).propertiesByName[property];
  };

  /**
   * Returns a mapped type's descriptor
   */
  Moddle.prototype.getTypeDescriptor = function(type) {
    return this.registry.typeMap[type];
  };

  var fromCharCode = String.fromCharCode;

  var hasOwnProperty = Object.prototype.hasOwnProperty;

  var ENTITY_PATTERN = /&#(\d+);|&#x([0-9a-f]+);|&(\w+);/ig;

  var ENTITY_MAPPING = {
    'amp': '&',
    'apos': '\'',
    'gt': '>',
    'lt': '<',
    'quot': '"'
  };

  // map UPPERCASE variants of supported special chars
  Object.keys(ENTITY_MAPPING).forEach(function(k) {
    ENTITY_MAPPING[k.toUpperCase()] = ENTITY_MAPPING[k];
  });


  function replaceEntities(_, d, x, z) {

    // reserved names, i.e. &nbsp;
    if (z) {
      if (hasOwnProperty.call(ENTITY_MAPPING, z)) {
        return ENTITY_MAPPING[z];
      } else {
        // fall back to original value
        return '&' + z + ';';
      }
    }

    // decimal encoded char
    if (d) {
      return fromCharCode(d);
    }

    // hex encoded char
    return fromCharCode(parseInt(x, 16));
  }


  /**
   * A basic entity decoder that can decode a minimal
   * sub-set of reserved names (&amp;) as well as
   * hex (&#xaaf;) and decimal (&#1231;) encoded characters.
   *
   * @param {string} str
   *
   * @return {string} decoded string
   */
  function decodeEntities(s) {
    if (s.length > 3 && s.indexOf('&') !== -1) {
      return s.replace(ENTITY_PATTERN, replaceEntities);
    }

    return s;
  }

  var XSI_URI = 'http://www.w3.org/2001/XMLSchema-instance';
  var XSI_PREFIX = 'xsi';
  var XSI_TYPE = 'xsi:type';

  var NON_WHITESPACE_OUTSIDE_ROOT_NODE = 'non-whitespace outside of root node';

  function error(msg) {
    return new Error(msg);
  }

  function missingNamespaceForPrefix(prefix) {
    return 'missing namespace for prefix <' + prefix + '>';
  }

  function getter(getFn) {
    return {
      'get': getFn,
      'enumerable': true
    };
  }

  function cloneNsMatrix(nsMatrix) {
    var clone = {}, key;
    for (key in nsMatrix) {
      clone[key] = nsMatrix[key];
    }
    return clone;
  }

  function uriPrefix(prefix) {
    return prefix + '$uri';
  }

  function buildNsMatrix(nsUriToPrefix) {
    var nsMatrix = {},
        uri,
        prefix;

    for (uri in nsUriToPrefix) {
      prefix = nsUriToPrefix[uri];
      nsMatrix[prefix] = prefix;
      nsMatrix[uriPrefix(prefix)] = uri;
    }

    return nsMatrix;
  }

  function noopGetContext() {
    return { 'line': 0, 'column': 0 };
  }

  function throwFunc(err) {
    throw err;
  }

  /**
   * Creates a new parser with the given options.
   *
   * @constructor
   *
   * @param  {!Object<string, ?>=} options
   */
  function Parser(options) {

    if (!this) {
      return new Parser(options);
    }

    var proxy = options && options['proxy'];

    var onText,
        onOpenTag,
        onCloseTag,
        onCDATA,
        onError = throwFunc,
        onWarning,
        onComment,
        onQuestion,
        onAttention;

    var getContext = noopGetContext;

    /**
     * Do we need to parse the current elements attributes for namespaces?
     *
     * @type {boolean}
     */
    var maybeNS = false;

    /**
     * Do we process namespaces at all?
     *
     * @type {boolean}
     */
    var isNamespace = false;

    /**
     * The caught error returned on parse end
     *
     * @type {Error}
     */
    var returnError = null;

    /**
     * Should we stop parsing?
     *
     * @type {boolean}
     */
    var parseStop = false;

    /**
     * A map of { uri: prefix } used by the parser.
     *
     * This map will ensure we can normalize prefixes during processing;
     * for each uri, only one prefix will be exposed to the handlers.
     *
     * @type {!Object<string, string>}}
     */
    var nsUriToPrefix;

    /**
     * Handle parse error.
     *
     * @param  {string|Error} err
     */
    function handleError(err) {
      if (!(err instanceof Error)) {
        err = error(err);
      }

      returnError = err;

      onError(err, getContext);
    }

    /**
     * Handle parse error.
     *
     * @param  {string|Error} err
     */
    function handleWarning(err) {

      if (!onWarning) {
        return;
      }

      if (!(err instanceof Error)) {
        err = error(err);
      }

      onWarning(err, getContext);
    }

    /**
     * Register parse listener.
     *
     * @param  {string}   name
     * @param  {Function} cb
     *
     * @return {Parser}
     */
    this['on'] = function(name, cb) {

      if (typeof cb !== 'function') {
        throw error('required args <name, cb>');
      }

      switch (name) {
      case 'openTag': onOpenTag = cb; break;
      case 'text': onText = cb; break;
      case 'closeTag': onCloseTag = cb; break;
      case 'error': onError = cb; break;
      case 'warn': onWarning = cb; break;
      case 'cdata': onCDATA = cb; break;
      case 'attention': onAttention = cb; break; // <!XXXXX zzzz="eeee">
      case 'question': onQuestion = cb; break; // <? ....  ?>
      case 'comment': onComment = cb; break;
      default:
        throw error('unsupported event: ' + name);
      }

      return this;
    };

    /**
     * Set the namespace to prefix mapping.
     *
     * @example
     *
     * parser.ns({
     *   'http://foo': 'foo',
     *   'http://bar': 'bar'
     * });
     *
     * @param  {!Object<string, string>} nsMap
     *
     * @return {Parser}
     */
    this['ns'] = function(nsMap) {

      if (typeof nsMap === 'undefined') {
        nsMap = {};
      }

      if (typeof nsMap !== 'object') {
        throw error('required args <nsMap={}>');
      }

      var _nsUriToPrefix = {}, k;

      for (k in nsMap) {
        _nsUriToPrefix[k] = nsMap[k];
      }

      // FORCE default mapping for schema instance
      _nsUriToPrefix[XSI_URI] = XSI_PREFIX;

      isNamespace = true;
      nsUriToPrefix = _nsUriToPrefix;

      return this;
    };

    /**
     * Parse xml string.
     *
     * @param  {string} xml
     *
     * @return {Error} returnError, if not thrown
     */
    this['parse'] = function(xml) {
      if (typeof xml !== 'string') {
        throw error('required args <xml=string>');
      }

      returnError = null;

      parse(xml);

      getContext = noopGetContext;
      parseStop = false;

      return returnError;
    };

    /**
     * Stop parsing.
     */
    this['stop'] = function() {
      parseStop = true;
    };

    /**
     * Parse string, invoking configured listeners on element.
     *
     * @param  {string} xml
     */
    function parse(xml) {
      var nsMatrixStack = isNamespace ? [] : null,
          nsMatrix = isNamespace ? buildNsMatrix(nsUriToPrefix) : null,
          _nsMatrix,
          nodeStack = [],
          anonymousNsCount = 0,
          tagStart = false,
          tagEnd = false,
          i = 0, j = 0,
          x, y, q, w,
          xmlns,
          elementName,
          _elementName,
          elementProxy
          ;

      var attrsString = '',
          attrsStart = 0,
          cachedAttrs // false = parsed with errors, null = needs parsing
          ;

      /**
       * Parse attributes on demand and returns the parsed attributes.
       *
       * Return semantics: (1) `false` on attribute parse error,
       * (2) object hash on extracted attrs.
       *
       * @return {boolean|Object}
       */
      function getAttrs() {
        if (cachedAttrs !== null) {
          return cachedAttrs;
        }

        var nsUri,
            nsUriPrefix,
            nsName,
            defaultAlias = isNamespace && nsMatrix['xmlns'],
            attrList = isNamespace && maybeNS ? [] : null,
            i = attrsStart,
            s = attrsString,
            l = s.length,
            hasNewMatrix,
            newalias,
            value,
            alias,
            name,
            attrs = {},
            seenAttrs = {},
            skipAttr,
            w,
            j;

        parseAttr:
        for (; i < l; i++) {
          skipAttr = false;
          w = s.charCodeAt(i);

          if (w === 32 || (w < 14 && w > 8)) { // WHITESPACE={ \f\n\r\t\v}
            continue;
          }

          // wait for non whitespace character
          if (w < 65 || w > 122 || (w > 90 && w < 97)) {
            if (w !== 95 && w !== 58) { // char 95"_" 58":"
              handleWarning('illegal first char attribute name');
              skipAttr = true;
            }
          }

          // parse attribute name
          for (j = i + 1; j < l; j++) {
            w = s.charCodeAt(j);

            if (
              w > 96 && w < 123 ||
              w > 64 && w < 91 ||
              w > 47 && w < 59 ||
              w === 46 || // '.'
              w === 45 || // '-'
              w === 95 // '_'
            ) {
              continue;
            }

            // unexpected whitespace
            if (w === 32 || (w < 14 && w > 8)) { // WHITESPACE
              handleWarning('missing attribute value');
              i = j;

              continue parseAttr;
            }

            // expected "="
            if (w === 61) { // "=" == 61
              break;
            }

            handleWarning('illegal attribute name char');
            skipAttr = true;
          }

          name = s.substring(i, j);

          if (name === 'xmlns:xmlns') {
            handleWarning('illegal declaration of xmlns');
            skipAttr = true;
          }

          w = s.charCodeAt(j + 1);

          if (w === 34) { // '"'
            j = s.indexOf('"', i = j + 2);

            if (j === -1) {
              j = s.indexOf('\'', i);

              if (j !== -1) {
                handleWarning('attribute value quote missmatch');
                skipAttr = true;
              }
            }

          } else if (w === 39) { // "'"
            j = s.indexOf('\'', i = j + 2);

            if (j === -1) {
              j = s.indexOf('"', i);

              if (j !== -1) {
                handleWarning('attribute value quote missmatch');
                skipAttr = true;
              }
            }

          } else {
            handleWarning('missing attribute value quotes');
            skipAttr = true;

            // skip to next space
            for (j = j + 1; j < l; j++) {
              w = s.charCodeAt(j + 1);

              if (w === 32 || (w < 14 && w > 8)) { // WHITESPACE
                break;
              }
            }

          }

          if (j === -1) {
            handleWarning('missing closing quotes');

            j = l;
            skipAttr = true;
          }

          if (!skipAttr) {
            value = s.substring(i, j);
          }

          i = j;

          // ensure SPACE follows attribute
          // skip illegal content otherwise
          // example a="b"c
          for (; j + 1 < l; j++) {
            w = s.charCodeAt(j + 1);

            if (w === 32 || (w < 14 && w > 8)) { // WHITESPACE
              break;
            }

            // FIRST ILLEGAL CHAR
            if (i === j) {
              handleWarning('illegal character after attribute end');
              skipAttr = true;
            }
          }

          // advance cursor to next attribute
          i = j + 1;

          if (skipAttr) {
            continue parseAttr;
          }

          // check attribute re-declaration
          if (name in seenAttrs) {
            handleWarning('attribute <' + name + '> already defined');
            continue;
          }

          seenAttrs[name] = true;

          if (!isNamespace) {
            attrs[name] = value;
            continue;
          }

          // try to extract namespace information
          if (maybeNS) {
            newalias = (
              name === 'xmlns'
                ? 'xmlns'
                : (name.charCodeAt(0) === 120 && name.substr(0, 6) === 'xmlns:')
                  ? name.substr(6)
                  : null
            );

            // handle xmlns(:alias) assignment
            if (newalias !== null) {
              nsUri = decodeEntities(value);
              nsUriPrefix = uriPrefix(newalias);

              alias = nsUriToPrefix[nsUri];

              if (!alias) {
                // no prefix defined or prefix collision
                if (
                  (newalias === 'xmlns') ||
                  (nsUriPrefix in nsMatrix && nsMatrix[nsUriPrefix] !== nsUri)
                ) {
                  // alocate free ns prefix
                  do {
                    alias = 'ns' + (anonymousNsCount++);
                  } while (typeof nsMatrix[alias] !== 'undefined');
                } else {
                  alias = newalias;
                }

                nsUriToPrefix[nsUri] = alias;
              }

              if (nsMatrix[newalias] !== alias) {
                if (!hasNewMatrix) {
                  nsMatrix = cloneNsMatrix(nsMatrix);
                  hasNewMatrix = true;
                }

                nsMatrix[newalias] = alias;
                if (newalias === 'xmlns') {
                  nsMatrix[uriPrefix(alias)] = nsUri;
                  defaultAlias = alias;
                }

                nsMatrix[nsUriPrefix] = nsUri;
              }

              // expose xmlns(:asd)="..." in attributes
              attrs[name] = value;
              continue;
            }

            // collect attributes until all namespace
            // declarations are processed
            attrList.push(name, value);
            continue;

          } /** end if (maybeNs) */

          // handle attributes on element without
          // namespace declarations
          w = name.indexOf(':');
          if (w === -1) {
            attrs[name] = value;
            continue;
          }

          // normalize ns attribute name
          if (!(nsName = nsMatrix[name.substring(0, w)])) {
            handleWarning(missingNamespaceForPrefix(name.substring(0, w)));
            continue;
          }

          name = defaultAlias === nsName
            ? name.substr(w + 1)
            : nsName + name.substr(w);
          // end: normalize ns attribute name

          // normalize xsi:type ns attribute value
          if (name === XSI_TYPE) {
            w = value.indexOf(':');

            if (w !== -1) {
              nsName = value.substring(0, w);
              // handle default prefixes, i.e. xs:String gracefully
              nsName = nsMatrix[nsName] || nsName;
              value = nsName + value.substring(w);
            } else {
              value = defaultAlias + ':' + value;
            }
          }
          // end: normalize xsi:type ns attribute value

          attrs[name] = value;
        }


        // handle deferred, possibly namespaced attributes
        if (maybeNS) {

          // normalize captured attributes
          for (i = 0, l = attrList.length; i < l; i++) {

            name = attrList[i++];
            value = attrList[i];

            w = name.indexOf(':');

            if (w !== -1) {
              // normalize ns attribute name
              if (!(nsName = nsMatrix[name.substring(0, w)])) {
                handleWarning(missingNamespaceForPrefix(name.substring(0, w)));
                continue;
              }

              name = defaultAlias === nsName
                ? name.substr(w + 1)
                : nsName + name.substr(w);
              // end: normalize ns attribute name

              // normalize xsi:type ns attribute value
              if (name === XSI_TYPE) {
                w = value.indexOf(':');

                if (w !== -1) {
                  nsName = value.substring(0, w);
                  // handle default prefixes, i.e. xs:String gracefully
                  nsName = nsMatrix[nsName] || nsName;
                  value = nsName + value.substring(w);
                } else {
                  value = defaultAlias + ':' + value;
                }
              }
              // end: normalize xsi:type ns attribute value
            }

            attrs[name] = value;
          }
          // end: normalize captured attributes
        }

        return cachedAttrs = attrs;
      }

      /**
       * Extract the parse context { line, column, part }
       * from the current parser position.
       *
       * @return {Object} parse context
       */
      function getParseContext() {
        var splitsRe = /(\r\n|\r|\n)/g;

        var line = 0;
        var column = 0;
        var startOfLine = 0;
        var endOfLine = j;
        var match;
        var data;

        while (i >= startOfLine) {

          match = splitsRe.exec(xml);

          if (!match) {
            break;
          }

          // end of line = (break idx + break chars)
          endOfLine = match[0].length + match.index;

          if (endOfLine > i) {
            break;
          }

          // advance to next line
          line += 1;

          startOfLine = endOfLine;
        }

        // EOF errors
        if (i == -1) {
          column = endOfLine;
          data = xml.substring(j);
        } else
        // start errors
        if (j === 0) {
          console.log(i - startOfLine);
          data = xml.substring(j, i);
        }
        // other errors
        else {
          column = i - startOfLine;
          data = (j == -1 ? xml.substring(i) : xml.substring(i, j + 1));
        }

        return {
          'data': data,
          'line': line,
          'column': column
        };
      }

      getContext = getParseContext;


      if (proxy) {
        elementProxy = Object.create({}, {
          'name': getter(function() {
            return elementName;
          }),
          'originalName': getter(function() {
            return _elementName;
          }),
          'attrs': getter(getAttrs),
          'ns': getter(function() {
            return nsMatrix;
          })
        });
      }

      // actual parse logic
      while (j !== -1) {

        if (xml.charCodeAt(j) === 60) { // "<"
          i = j;
        } else {
          i = xml.indexOf('<', j);
        }

        // parse end
        if (i === -1) {
          if (nodeStack.length) {
            return handleError('unexpected end of file');
          }

          if (j === 0) {
            return handleError('missing start tag');
          }

          if (j < xml.length) {
            if (xml.substring(j).trim()) {
              handleWarning(NON_WHITESPACE_OUTSIDE_ROOT_NODE);
            }
          }

          return;
        }

        // parse text
        if (j !== i) {

          if (nodeStack.length) {
            if (onText) {
              onText(xml.substring(j, i), decodeEntities, getContext);

              if (parseStop) {
                return;
              }
            }
          } else {
            if (xml.substring(j, i).trim()) {
              handleWarning(NON_WHITESPACE_OUTSIDE_ROOT_NODE);

              if (parseStop) {
                return;
              }
            }
          }
        }

        w = xml.charCodeAt(i+1);

        // parse comments + CDATA
        if (w === 33) { // "!"
          w = xml.charCodeAt(i+2);
          if (w === 91 && xml.substr(i + 3, 6) === 'CDATA[') { // 91 == "["
            j = xml.indexOf(']]>', i);
            if (j === -1) {
              return handleError('unclosed cdata');
            }

            if (onCDATA) {
              onCDATA(xml.substring(i + 9, j), getContext);
              if (parseStop) {
                return;
              }
            }

            j += 3;
            continue;
          }


          if (w === 45 && xml.charCodeAt(i + 3) === 45) { // 45 == "-"
            j = xml.indexOf('-->', i);
            if (j === -1) {
              return handleError('unclosed comment');
            }


            if (onComment) {
              onComment(xml.substring(i + 4, j), decodeEntities, getContext);
              if (parseStop) {
                return;
              }
            }

            j += 3;
            continue;
          }

          j = xml.indexOf('>', i + 1);
          if (j === -1) {
            return handleError('unclosed tag');
          }

          if (onAttention) {
            onAttention(xml.substring(i, j + 1), decodeEntities, getContext);
            if (parseStop) {
              return;
            }
          }

          j += 1;
          continue;
        }

        if (w === 63) { // "?"
          j = xml.indexOf('?>', i);
          if (j === -1) {
            return handleError('unclosed question');
          }

          if (onQuestion) {
            onQuestion(xml.substring(i, j + 2), getContext);
            if (parseStop) {
              return;
            }
          }

          j += 2;
          continue;
        }

        j = xml.indexOf('>', i + 1);

        if (j == -1) {
          return handleError('unclosed tag');
        }

        // don't process attributes;
        // there are none
        cachedAttrs = {};

        // if (xml.charCodeAt(i+1) === 47) { // </...
        if (w === 47) { // </...
          tagStart = false;
          tagEnd = true;

          if (!nodeStack.length) {
            return handleError('missing open tag');
          }

          // verify open <-> close tag match
          x = elementName = nodeStack.pop();
          q = i + 2 + x.length;

          if (xml.substring(i + 2, q) !== x) {
            return handleError('closing tag mismatch');
          }

          // verify chars in close tag
          for (; q < j; q++) {
            w = xml.charCodeAt(q);

            if (w === 32 || (w > 8 && w < 14)) { // \f\n\r\t\v space
              continue;
            }

            return handleError('close tag');
          }

        } else {
          if (xml.charCodeAt(j - 1) === 47) { // .../>
            x = elementName = xml.substring(i + 1, j - 1);

            tagStart = true;
            tagEnd = true;

          } else {
            x = elementName = xml.substring(i + 1, j);

            tagStart = true;
            tagEnd = false;
          }

          if (!(w > 96 && w < 123 || w > 64 && w < 91 || w === 95 || w === 58)) { // char 95"_" 58":"
            return handleError('illegal first char nodeName');
          }

          for (q = 1, y = x.length; q < y; q++) {
            w = x.charCodeAt(q);

            if (w > 96 && w < 123 || w > 64 && w < 91 || w > 47 && w < 59 || w === 45 || w === 95 || w == 46) {
              continue;
            }

            if (w === 32 || (w < 14 && w > 8)) { // \f\n\r\t\v space
              elementName = x.substring(0, q);
              // maybe there are attributes
              cachedAttrs = null;
              break;
            }

            return handleError('invalid nodeName');
          }

          if (!tagEnd) {
            nodeStack.push(elementName);
          }
        }

        if (isNamespace) {

          _nsMatrix = nsMatrix;

          if (tagStart) {
            // remember old namespace
            // unless we're self-closing
            if (!tagEnd) {
              nsMatrixStack.push(_nsMatrix);
            }

            if (cachedAttrs === null) {
              // quick check, whether there may be namespace
              // declarations on the node; if that is the case
              // we need to eagerly parse the node attributes
              if ((maybeNS = x.indexOf('xmlns', q) !== -1)) {
                attrsStart = q;
                attrsString = x;

                getAttrs();

                maybeNS = false;
              }
            }
          }

          _elementName = elementName;

          w = elementName.indexOf(':');
          if (w !== -1) {
            xmlns = nsMatrix[elementName.substring(0, w)];

            // prefix given; namespace must exist
            if (!xmlns) {
              return handleError('missing namespace on <' + _elementName + '>');
            }

            elementName = elementName.substr(w + 1);
          } else {
            xmlns = nsMatrix['xmlns'];

            // if no default namespace is defined,
            // we'll import the element as anonymous.
            //
            // it is up to users to correct that to the document defined
            // targetNamespace, or whatever their undersanding of the
            // XML spec mandates.
          }

          // adjust namespace prefixs as configured
          if (xmlns) {
            elementName = xmlns + ':' + elementName;
          }

        }

        if (tagStart) {
          attrsStart = q;
          attrsString = x;

          if (onOpenTag) {
            if (proxy) {
              onOpenTag(elementProxy, decodeEntities, tagEnd, getContext);
            } else {
              onOpenTag(elementName, getAttrs, decodeEntities, tagEnd, getContext);
            }

            if (parseStop) {
              return;
            }
          }

        }

        if (tagEnd) {

          if (onCloseTag) {
            onCloseTag(proxy ? elementProxy : elementName, decodeEntities, tagStart, getContext);

            if (parseStop) {
              return;
            }
          }

          // restore old namespace
          if (isNamespace) {
            if (!tagStart) {
              nsMatrix = nsMatrixStack.pop();
            } else {
              nsMatrix = _nsMatrix;
            }
          }
        }

        j += 1;
      }
    } /** end parse */

  }

  function hasLowerCaseAlias(pkg) {
    return pkg.xml && pkg.xml.tagAlias === 'lowerCase';
  }

  var DEFAULT_NS_MAP = {
    'xsi': 'http://www.w3.org/2001/XMLSchema-instance'
  };

  var XSI_TYPE$1 = 'xsi:type';

  function serializeFormat(element) {
    return element.xml && element.xml.serialize;
  }

  function serializeAsType(element) {
    return serializeFormat(element) === XSI_TYPE$1;
  }

  function serializeAsProperty(element) {
    return serializeFormat(element) === 'property';
  }

  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function aliasToName(aliasNs, pkg) {

    if (!hasLowerCaseAlias(pkg)) {
      return aliasNs.name;
    }

    return aliasNs.prefix + ':' + capitalize(aliasNs.localName);
  }

  function prefixedToName(nameNs, pkg) {

    var name = nameNs.name,
        localName = nameNs.localName;

    var typePrefix = pkg.xml && pkg.xml.typePrefix;

    if (typePrefix && localName.indexOf(typePrefix) === 0) {
      return nameNs.prefix + ':' + localName.slice(typePrefix.length);
    } else {
      return name;
    }
  }

  function normalizeXsiTypeName(name, model) {

    var nameNs = parseName(name);
    var pkg = model.getPackage(nameNs.prefix);

    return prefixedToName(nameNs, pkg);
  }

  function error$1(message) {
    return new Error(message);
  }

  /**
   * Get the moddle descriptor for a given instance or type.
   *
   * @param  {ModdleElement|Function} element
   *
   * @return {Object} the moddle descriptor
   */
  function getModdleDescriptor(element) {
    return element.$descriptor;
  }

  function defer(fn) {
    setTimeout(fn, 0);
  }

  /**
   * A parse context.
   *
   * @class
   *
   * @param {Object} options
   * @param {ElementHandler} options.rootHandler the root handler for parsing a document
   * @param {boolean} [options.lax=false] whether or not to ignore invalid elements
   */
  function Context(options) {

    /**
     * @property {ElementHandler} rootHandler
     */

    /**
     * @property {Boolean} lax
     */

    assign(this, options);

    this.elementsById = {};
    this.references = [];
    this.warnings = [];

    /**
     * Add an unresolved reference.
     *
     * @param {Object} reference
     */
    this.addReference = function(reference) {
      this.references.push(reference);
    };

    /**
     * Add a processed element.
     *
     * @param {ModdleElement} element
     */
    this.addElement = function(element) {

      if (!element) {
        throw error$1('expected element');
      }

      var elementsById = this.elementsById;

      var descriptor = getModdleDescriptor(element);

      var idProperty = descriptor.idProperty,
          id;

      if (idProperty) {
        id = element.get(idProperty.name);

        if (id) {
          // for QName validation as per http://www.w3.org/TR/REC-xml/#NT-NameChar
          if (!/^([a-z][\w-.]*:)?[a-z_][\w-.]*$/i.test(id)) {
            throw new Error('illegal ID <' + id + '>');
          }

          if (elementsById[id]) {
            throw error$1('duplicate ID <' + id + '>');
          }

          elementsById[id] = element;
        }
      }
    };

    /**
     * Add an import warning.
     *
     * @param {Object} warning
     * @param {String} warning.message
     * @param {Error} [warning.error]
     */
    this.addWarning = function(warning) {
      this.warnings.push(warning);
    };
  }

  function BaseHandler() {}

  BaseHandler.prototype.handleEnd = function() {};
  BaseHandler.prototype.handleText = function() {};
  BaseHandler.prototype.handleNode = function() {};


  /**
   * A simple pass through handler that does nothing except for
   * ignoring all input it receives.
   *
   * This is used to ignore unknown elements and
   * attributes.
   */
  function NoopHandler() { }

  NoopHandler.prototype = Object.create(BaseHandler.prototype);

  NoopHandler.prototype.handleNode = function() {
    return this;
  };

  function BodyHandler() {}

  BodyHandler.prototype = Object.create(BaseHandler.prototype);

  BodyHandler.prototype.handleText = function(text) {
    this.body = (this.body || '') + text;
  };

  function ReferenceHandler(property, context) {
    this.property = property;
    this.context = context;
  }

  ReferenceHandler.prototype = Object.create(BodyHandler.prototype);

  ReferenceHandler.prototype.handleNode = function(node) {

    if (this.element) {
      throw error$1('expected no sub nodes');
    } else {
      this.element = this.createReference(node);
    }

    return this;
  };

  ReferenceHandler.prototype.handleEnd = function() {
    this.element.id = this.body;
  };

  ReferenceHandler.prototype.createReference = function(node) {
    return {
      property: this.property.ns.name,
      id: ''
    };
  };

  function ValueHandler(propertyDesc, element) {
    this.element = element;
    this.propertyDesc = propertyDesc;
  }

  ValueHandler.prototype = Object.create(BodyHandler.prototype);

  ValueHandler.prototype.handleEnd = function() {

    var value = this.body || '',
        element = this.element,
        propertyDesc = this.propertyDesc;

    value = coerceType(propertyDesc.type, value);

    if (propertyDesc.isMany) {
      element.get(propertyDesc.name).push(value);
    } else {
      element.set(propertyDesc.name, value);
    }
  };


  function BaseElementHandler() {}

  BaseElementHandler.prototype = Object.create(BodyHandler.prototype);

  BaseElementHandler.prototype.handleNode = function(node) {
    var parser = this,
        element = this.element;

    if (!element) {
      element = this.element = this.createElement(node);

      this.context.addElement(element);
    } else {
      parser = this.handleChild(node);
    }

    return parser;
  };

  /**
   * @class Reader.ElementHandler
   *
   */
  function ElementHandler(model, typeName, context) {
    this.model = model;
    this.type = model.getType(typeName);
    this.context = context;
  }

  ElementHandler.prototype = Object.create(BaseElementHandler.prototype);

  ElementHandler.prototype.addReference = function(reference) {
    this.context.addReference(reference);
  };

  ElementHandler.prototype.handleText = function(text) {

    var element = this.element,
        descriptor = getModdleDescriptor(element),
        bodyProperty = descriptor.bodyProperty;

    if (!bodyProperty) {
      throw error$1('unexpected body text <' + text + '>');
    }

    BodyHandler.prototype.handleText.call(this, text);
  };

  ElementHandler.prototype.handleEnd = function() {

    var value = this.body,
        element = this.element,
        descriptor = getModdleDescriptor(element),
        bodyProperty = descriptor.bodyProperty;

    if (bodyProperty && value !== undefined) {
      value = coerceType(bodyProperty.type, value);
      element.set(bodyProperty.name, value);
    }
  };

  /**
   * Create an instance of the model from the given node.
   *
   * @param  {Element} node the xml node
   */
  ElementHandler.prototype.createElement = function(node) {
    var attributes = node.attributes,
        Type = this.type,
        descriptor = getModdleDescriptor(Type),
        context = this.context,
        instance = new Type({}),
        model = this.model,
        propNameNs;

    forEach(attributes, function(value, name) {

      var prop = descriptor.propertiesByName[name],
          values;

      if (prop && prop.isReference) {

        if (!prop.isMany) {
          context.addReference({
            element: instance,
            property: prop.ns.name,
            id: value
          });
        } else {
          // IDREFS: parse references as whitespace-separated list
          values = value.split(' ');

          forEach(values, function(v) {
            context.addReference({
              element: instance,
              property: prop.ns.name,
              id: v
            });
          });
        }

      } else {
        if (prop) {
          value = coerceType(prop.type, value);
        } else
        if (name !== 'xmlns') {
          propNameNs = parseName(name, descriptor.ns.prefix);

          // check whether attribute is defined in a well-known namespace
          // if that is the case we emit a warning to indicate potential misuse
          if (model.getPackage(propNameNs.prefix)) {

            context.addWarning({
              message: 'unknown attribute <' + name + '>',
              element: instance,
              property: name,
              value: value
            });
          }
        }

        instance.set(name, value);
      }
    });

    return instance;
  };

  ElementHandler.prototype.getPropertyForNode = function(node) {

    var name = node.name;
    var nameNs = parseName(name);

    var type = this.type,
        model = this.model,
        descriptor = getModdleDescriptor(type);

    var propertyName = nameNs.name,
        property = descriptor.propertiesByName[propertyName],
        elementTypeName,
        elementType;

    // search for properties by name first

    if (property) {

      if (serializeAsType(property)) {
        elementTypeName = node.attributes[XSI_TYPE$1];

        // xsi type is optional, if it does not exists the
        // default type is assumed
        if (elementTypeName) {

          // take possible type prefixes from XML
          // into account, i.e.: xsi:type="t{ActualType}"
          elementTypeName = normalizeXsiTypeName(elementTypeName, model);

          elementType = model.getType(elementTypeName);

          return assign({}, property, {
            effectiveType: getModdleDescriptor(elementType).name
          });
        }
      }

      // search for properties by name first
      return property;
    }

    var pkg = model.getPackage(nameNs.prefix);

    if (pkg) {
      elementTypeName = aliasToName(nameNs, pkg);
      elementType = model.getType(elementTypeName);

      // search for collection members later
      property = find(descriptor.properties, function(p) {
        return !p.isVirtual && !p.isReference && !p.isAttribute && elementType.hasType(p.type);
      });

      if (property) {
        return assign({}, property, {
          effectiveType: getModdleDescriptor(elementType).name
        });
      }
    } else {
      // parse unknown element (maybe extension)
      property = find(descriptor.properties, function(p) {
        return !p.isReference && !p.isAttribute && p.type === 'Element';
      });

      if (property) {
        return property;
      }
    }

    throw error$1('unrecognized element <' + nameNs.name + '>');
  };

  ElementHandler.prototype.toString = function() {
    return 'ElementDescriptor[' + getModdleDescriptor(this.type).name + ']';
  };

  ElementHandler.prototype.valueHandler = function(propertyDesc, element) {
    return new ValueHandler(propertyDesc, element);
  };

  ElementHandler.prototype.referenceHandler = function(propertyDesc) {
    return new ReferenceHandler(propertyDesc, this.context);
  };

  ElementHandler.prototype.handler = function(type) {
    if (type === 'Element') {
      return new GenericElementHandler(this.model, type, this.context);
    } else {
      return new ElementHandler(this.model, type, this.context);
    }
  };

  /**
   * Handle the child element parsing
   *
   * @param  {Element} node the xml node
   */
  ElementHandler.prototype.handleChild = function(node) {
    var propertyDesc, type, element, childHandler;

    propertyDesc = this.getPropertyForNode(node);
    element = this.element;

    type = propertyDesc.effectiveType || propertyDesc.type;

    if (isSimple(type)) {
      return this.valueHandler(propertyDesc, element);
    }

    if (propertyDesc.isReference) {
      childHandler = this.referenceHandler(propertyDesc).handleNode(node);
    } else {
      childHandler = this.handler(type).handleNode(node);
    }

    var newElement = childHandler.element;

    // child handles may decide to skip elements
    // by not returning anything
    if (newElement !== undefined) {

      if (propertyDesc.isMany) {
        element.get(propertyDesc.name).push(newElement);
      } else {
        element.set(propertyDesc.name, newElement);
      }

      if (propertyDesc.isReference) {
        assign(newElement, {
          element: element
        });

        this.context.addReference(newElement);
      } else {
        // establish child -> parent relationship
        newElement.$parent = element;
      }
    }

    return childHandler;
  };

  /**
   * An element handler that performs special validation
   * to ensure the node it gets initialized with matches
   * the handlers type (namespace wise).
   *
   * @param {Moddle} model
   * @param {String} typeName
   * @param {Context} context
   */
  function RootElementHandler(model, typeName, context) {
    ElementHandler.call(this, model, typeName, context);
  }

  RootElementHandler.prototype = Object.create(ElementHandler.prototype);

  RootElementHandler.prototype.createElement = function(node) {

    var name = node.name,
        nameNs = parseName(name),
        model = this.model,
        type = this.type,
        pkg = model.getPackage(nameNs.prefix),
        typeName = pkg && aliasToName(nameNs, pkg) || name;

    // verify the correct namespace if we parse
    // the first element in the handler tree
    //
    // this ensures we don't mistakenly import wrong namespace elements
    if (!type.hasType(typeName)) {
      throw error$1('unexpected element <' + node.originalName + '>');
    }

    return ElementHandler.prototype.createElement.call(this, node);
  };


  function GenericElementHandler(model, typeName, context) {
    this.model = model;
    this.context = context;
  }

  GenericElementHandler.prototype = Object.create(BaseElementHandler.prototype);

  GenericElementHandler.prototype.createElement = function(node) {

    var name = node.name,
        ns = parseName(name),
        prefix = ns.prefix,
        uri = node.ns[prefix + '$uri'],
        attributes = node.attributes;

    return this.model.createAny(name, uri, attributes);
  };

  GenericElementHandler.prototype.handleChild = function(node) {

    var handler = new GenericElementHandler(this.model, 'Element', this.context).handleNode(node),
        element = this.element;

    var newElement = handler.element,
        children;

    if (newElement !== undefined) {
      children = element.$children = element.$children || [];
      children.push(newElement);

      // establish child -> parent relationship
      newElement.$parent = element;
    }

    return handler;
  };

  GenericElementHandler.prototype.handleEnd = function() {
    if (this.body) {
      this.element.$body = this.body;
    }
  };

  /**
   * A reader for a meta-model
   *
   * @param {Object} options
   * @param {Model} options.model used to read xml files
   * @param {Boolean} options.lax whether to make parse errors warnings
   */
  function Reader(options) {

    if (options instanceof Moddle) {
      options = {
        model: options
      };
    }

    assign(this, { lax: false }, options);
  }


  /**
   * Parse the given XML into a moddle document tree.
   *
   * @param {String} xml
   * @param {ElementHandler|Object} options or rootHandler
   * @param  {Function} done
   */
  Reader.prototype.fromXML = function(xml, options, done) {

    var rootHandler = options.rootHandler;

    if (options instanceof ElementHandler) {
      // root handler passed via (xml, { rootHandler: ElementHandler }, ...)
      rootHandler = options;
      options = {};
    } else {
      if (typeof options === 'string') {
        // rootHandler passed via (xml, 'someString', ...)
        rootHandler = this.handler(options);
        options = {};
      } else if (typeof rootHandler === 'string') {
        // rootHandler passed via (xml, { rootHandler: 'someString' }, ...)
        rootHandler = this.handler(rootHandler);
      }
    }

    var model = this.model,
        lax = this.lax;

    var context = new Context(assign({}, options, { rootHandler: rootHandler })),
        parser = new Parser({ proxy: true }),
        stack = createStack();

    rootHandler.context = context;

    // push root handler
    stack.push(rootHandler);


    /**
     * Handle error.
     *
     * @param  {Error} err
     * @param  {Function} getContext
     * @param  {boolean} lax
     *
     * @return {boolean} true if handled
     */
    function handleError(err, getContext, lax) {

      var ctx = getContext();

      var line = ctx.line,
          column = ctx.column,
          data = ctx.data;

      // we receive the full context data here,
      // for elements trim down the information
      // to the tag name, only
      if (data.charAt(0) === '<' && data.indexOf(' ') !== -1) {
        data = data.slice(0, data.indexOf(' ')) + '>';
      }

      var message =
        'unparsable content ' + (data ? data + ' ' : '') + 'detected\n\t' +
          'line: ' + line + '\n\t' +
          'column: ' + column + '\n\t' +
          'nested error: ' + err.message;

      if (lax) {
        context.addWarning({
          message: message,
          error: err
        });

        return true;
      } else {
        throw error$1(message);
      }
    }

    function handleWarning(err, getContext) {
      // just like handling errors in <lax=true> mode
      return handleError(err, getContext, true);
    }

    /**
     * Resolve collected references on parse end.
     */
    function resolveReferences() {

      var elementsById = context.elementsById;
      var references = context.references;

      var i, r;

      for (i = 0; (r = references[i]); i++) {
        var element = r.element;
        var reference = elementsById[r.id];
        var property = getModdleDescriptor(element).propertiesByName[r.property];

        if (!reference) {
          context.addWarning({
            message: 'unresolved reference <' + r.id + '>',
            element: r.element,
            property: r.property,
            value: r.id
          });
        }

        if (property.isMany) {
          var collection = element.get(property.name),
              idx = collection.indexOf(r);

          // we replace an existing place holder (idx != -1) or
          // append to the collection instead
          if (idx === -1) {
            idx = collection.length;
          }

          if (!reference) {
            // remove unresolvable reference
            collection.splice(idx, 1);
          } else {
            // add or update reference in collection
            collection[idx] = reference;
          }
        } else {
          element.set(property.name, reference);
        }
      }
    }

    function handleClose() {
      stack.pop().handleEnd();
    }

    var PREAMBLE_START_PATTERN = /^<\?xml /i;

    var ENCODING_PATTERN = / encoding="([^"]+)"/i;

    var UTF_8_PATTERN = /^utf-8$/i;

    function handleQuestion(question) {

      if (!PREAMBLE_START_PATTERN.test(question)) {
        return;
      }

      var match = ENCODING_PATTERN.exec(question);
      var encoding = match && match[1];

      if (!encoding || UTF_8_PATTERN.test(encoding)) {
        return;
      }

      context.addWarning({
        message:
          'unsupported document encoding <' + encoding + '>, ' +
          'falling back to UTF-8'
      });
    }

    function handleOpen(node, getContext) {
      var handler = stack.peek();

      try {
        stack.push(handler.handleNode(node));
      } catch (err) {

        if (handleError(err, getContext, lax)) {
          stack.push(new NoopHandler());
        }
      }
    }

    function handleCData(text, getContext) {

      try {
        stack.peek().handleText(text);
      } catch (err) {
        handleWarning(err, getContext);
      }
    }

    function handleText(text, getContext) {
      // strip whitespace only nodes, i.e. before
      // <!CDATA[ ... ]> sections and in between tags
      text = text.trim();

      if (!text) {
        return;
      }

      handleCData(text, getContext);
    }

    var uriMap = model.getPackages().reduce(function(uriMap, p) {
      uriMap[p.uri] = p.prefix;

      return uriMap;
    }, {});

    parser
      .ns(uriMap)
      .on('openTag', function(obj, decodeStr, selfClosing, getContext) {

        // gracefully handle unparsable attributes (attrs=false)
        var attrs = obj.attrs || {};

        var decodedAttrs = Object.keys(attrs).reduce(function(d, key) {
          var value = decodeStr(attrs[key]);

          d[key] = value;

          return d;
        }, {});

        var node = {
          name: obj.name,
          originalName: obj.originalName,
          attributes: decodedAttrs,
          ns: obj.ns
        };

        handleOpen(node, getContext);
      })
      .on('question', handleQuestion)
      .on('closeTag', handleClose)
      .on('cdata', handleCData)
      .on('text', function(text, decodeEntities, getContext) {
        handleText(decodeEntities(text), getContext);
      })
      .on('error', handleError)
      .on('warn', handleWarning);

    // deferred parse XML to make loading really ascnchronous
    // this ensures the execution environment (node or browser)
    // is kept responsive and that certain optimization strategies
    // can kick in
    defer(function() {
      var err;

      try {
        parser.parse(xml);

        resolveReferences();
      } catch (e) {
        err = e;
      }

      var element = rootHandler.element;

      // handle the situation that we could not extract
      // the desired root element from the document
      if (!err && !element) {
        err = error$1('failed to parse document as <' + rootHandler.type.$descriptor.name + '>');
      }

      done(err, err ? undefined : element, context);
    });
  };

  Reader.prototype.handler = function(name) {
    return new RootElementHandler(this.model, name);
  };


  // helpers //////////////////////////

  function createStack() {
    var stack = [];

    Object.defineProperty(stack, 'peek', {
      value: function() {
        return this[this.length - 1];
      }
    });

    return stack;
  }

  var XML_PREAMBLE = '<?xml version="1.0" encoding="UTF-8"?>\n';

  var ESCAPE_ATTR_CHARS = /<|>|'|"|&|\n\r|\n/g;
  var ESCAPE_CHARS = /<|>|&/g;


  function Namespaces(parent) {

    var prefixMap = {};
    var uriMap = {};
    var used = {};

    var wellknown = [];
    var custom = [];

    // API

    this.byUri = function(uri) {
      return uriMap[uri] || (
        parent && parent.byUri(uri)
      );
    };

    this.add = function(ns, isWellknown) {

      uriMap[ns.uri] = ns;

      if (isWellknown) {
        wellknown.push(ns);
      } else {
        custom.push(ns);
      }

      this.mapPrefix(ns.prefix, ns.uri);
    };

    this.uriByPrefix = function(prefix) {
      return prefixMap[prefix || 'xmlns'];
    };

    this.mapPrefix = function(prefix, uri) {
      prefixMap[prefix || 'xmlns'] = uri;
    };

    this.logUsed = function(ns) {
      var uri = ns.uri;

      used[uri] = this.byUri(uri);
    };

    this.getUsed = function(ns) {

      function isUsed(ns) {
        return used[ns.uri];
      }

      var allNs = [].concat(wellknown, custom);

      return allNs.filter(isUsed);
    };

  }

  function lower(string) {
    return string.charAt(0).toLowerCase() + string.slice(1);
  }

  function nameToAlias(name, pkg) {
    if (hasLowerCaseAlias(pkg)) {
      return lower(name);
    } else {
      return name;
    }
  }

  function inherits(ctor, superCtor) {
    ctor.super_ = superCtor;
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  }

  function nsName(ns) {
    if (isString(ns)) {
      return ns;
    } else {
      return (ns.prefix ? ns.prefix + ':' : '') + ns.localName;
    }
  }

  function getNsAttrs(namespaces) {

    return map(namespaces.getUsed(), function(ns) {
      var name = 'xmlns' + (ns.prefix ? ':' + ns.prefix : '');
      return { name: name, value: ns.uri };
    });

  }

  function getElementNs(ns, descriptor) {
    if (descriptor.isGeneric) {
      return assign({ localName: descriptor.ns.localName }, ns);
    } else {
      return assign({ localName: nameToAlias(descriptor.ns.localName, descriptor.$pkg) }, ns);
    }
  }

  function getPropertyNs(ns, descriptor) {
    return assign({ localName: descriptor.ns.localName }, ns);
  }

  function getSerializableProperties(element) {
    var descriptor = element.$descriptor;

    return filter(descriptor.properties, function(p) {
      var name = p.name;

      if (p.isVirtual) {
        return false;
      }

      // do not serialize defaults
      if (!element.hasOwnProperty(name)) {
        return false;
      }

      var value = element[name];

      // do not serialize default equals
      if (value === p.default) {
        return false;
      }

      // do not serialize null properties
      if (value === null) {
        return false;
      }

      return p.isMany ? value.length : true;
    });
  }

  var ESCAPE_ATTR_MAP = {
    '\n': '#10',
    '\n\r': '#10',
    '"': '#34',
    '\'': '#39',
    '<': '#60',
    '>': '#62',
    '&': '#38'
  };

  var ESCAPE_MAP = {
    '<': 'lt',
    '>': 'gt',
    '&': 'amp'
  };

  function escape(str, charPattern, replaceMap) {

    // ensure we are handling strings here
    str = isString(str) ? str : '' + str;

    return str.replace(charPattern, function(s) {
      return '&' + replaceMap[s] + ';';
    });
  }

  /**
   * Escape a string attribute to not contain any bad values (line breaks, '"', ...)
   *
   * @param {String} str the string to escape
   * @return {String} the escaped string
   */
  function escapeAttr(str) {
    return escape(str, ESCAPE_ATTR_CHARS, ESCAPE_ATTR_MAP);
  }

  function escapeBody(str) {
    return escape(str, ESCAPE_CHARS, ESCAPE_MAP);
  }

  function filterAttributes(props) {
    return filter(props, function(p) { return p.isAttr; });
  }

  function filterContained(props) {
    return filter(props, function(p) { return !p.isAttr; });
  }


  function ReferenceSerializer(tagName) {
    this.tagName = tagName;
  }

  ReferenceSerializer.prototype.build = function(element) {
    this.element = element;
    return this;
  };

  ReferenceSerializer.prototype.serializeTo = function(writer) {
    writer
      .appendIndent()
      .append('<' + this.tagName + '>' + this.element.id + '</' + this.tagName + '>')
      .appendNewLine();
  };

  function BodySerializer() {}

  BodySerializer.prototype.serializeValue =
  BodySerializer.prototype.serializeTo = function(writer) {
    writer.append(
      this.escape
        ? escapeBody(this.value)
        : this.value
    );
  };

  BodySerializer.prototype.build = function(prop, value) {
    this.value = value;

    if (prop.type === 'String' && value.search(ESCAPE_CHARS) !== -1) {
      this.escape = true;
    }

    return this;
  };

  function ValueSerializer(tagName) {
    this.tagName = tagName;
  }

  inherits(ValueSerializer, BodySerializer);

  ValueSerializer.prototype.serializeTo = function(writer) {

    writer
      .appendIndent()
      .append('<' + this.tagName + '>');

    this.serializeValue(writer);

    writer
      .append('</' + this.tagName + '>')
      .appendNewLine();
  };

  function ElementSerializer(parent, propertyDescriptor) {
    this.body = [];
    this.attrs = [];

    this.parent = parent;
    this.propertyDescriptor = propertyDescriptor;
  }

  ElementSerializer.prototype.build = function(element) {
    this.element = element;

    var elementDescriptor = element.$descriptor,
        propertyDescriptor = this.propertyDescriptor;

    var otherAttrs,
        properties;

    var isGeneric = elementDescriptor.isGeneric;

    if (isGeneric) {
      otherAttrs = this.parseGeneric(element);
    } else {
      otherAttrs = this.parseNsAttributes(element);
    }

    if (propertyDescriptor) {
      this.ns = this.nsPropertyTagName(propertyDescriptor);
    } else {
      this.ns = this.nsTagName(elementDescriptor);
    }

    // compute tag name
    this.tagName = this.addTagName(this.ns);

    if (!isGeneric) {
      properties = getSerializableProperties(element);

      this.parseAttributes(filterAttributes(properties));
      this.parseContainments(filterContained(properties));
    }

    this.parseGenericAttributes(element, otherAttrs);

    return this;
  };

  ElementSerializer.prototype.nsTagName = function(descriptor) {
    var effectiveNs = this.logNamespaceUsed(descriptor.ns);
    return getElementNs(effectiveNs, descriptor);
  };

  ElementSerializer.prototype.nsPropertyTagName = function(descriptor) {
    var effectiveNs = this.logNamespaceUsed(descriptor.ns);
    return getPropertyNs(effectiveNs, descriptor);
  };

  ElementSerializer.prototype.isLocalNs = function(ns) {
    return ns.uri === this.ns.uri;
  };

  /**
   * Get the actual ns attribute name for the given element.
   *
   * @param {Object} element
   * @param {Boolean} [element.inherited=false]
   *
   * @return {Object} nsName
   */
  ElementSerializer.prototype.nsAttributeName = function(element) {

    var ns;

    if (isString(element)) {
      ns = parseName(element);
    } else {
      ns = element.ns;
    }

    // return just local name for inherited attributes
    if (element.inherited) {
      return { localName: ns.localName };
    }

    // parse + log effective ns
    var effectiveNs = this.logNamespaceUsed(ns);

    // LOG ACTUAL namespace use
    this.getNamespaces().logUsed(effectiveNs);

    // strip prefix if same namespace like parent
    if (this.isLocalNs(effectiveNs)) {
      return { localName: ns.localName };
    } else {
      return assign({ localName: ns.localName }, effectiveNs);
    }
  };

  ElementSerializer.prototype.parseGeneric = function(element) {

    var self = this,
        body = this.body;

    var attributes = [];

    forEach(element, function(val, key) {

      var nonNsAttr;

      if (key === '$body') {
        body.push(new BodySerializer().build({ type: 'String' }, val));
      } else
      if (key === '$children') {
        forEach(val, function(child) {
          body.push(new ElementSerializer(self).build(child));
        });
      } else
      if (key.indexOf('$') !== 0) {
        nonNsAttr = self.parseNsAttribute(element, key, val);

        if (nonNsAttr) {
          attributes.push({ name: key, value: val });
        }
      }
    });

    return attributes;
  };

  ElementSerializer.prototype.parseNsAttribute = function(element, name, value) {
    var model = element.$model;

    var nameNs = parseName(name);

    var ns;

    // parse xmlns:foo="http://foo.bar"
    if (nameNs.prefix === 'xmlns') {
      ns = { prefix: nameNs.localName, uri: value };
    }

    // parse xmlns="http://foo.bar"
    if (!nameNs.prefix && nameNs.localName === 'xmlns') {
      ns = { uri: value };
    }

    if (!ns) {
      return {
        name: name,
        value: value
      };
    }

    if (model && model.getPackage(value)) {
      // register well known namespace
      this.logNamespace(ns, true, true);
    } else {
      // log custom namespace directly as used
      var actualNs = this.logNamespaceUsed(ns, true);

      this.getNamespaces().logUsed(actualNs);
    }
  };


  /**
   * Parse namespaces and return a list of left over generic attributes
   *
   * @param  {Object} element
   * @return {Array<Object>}
   */
  ElementSerializer.prototype.parseNsAttributes = function(element, attrs) {
    var self = this;

    var genericAttrs = element.$attrs;

    var attributes = [];

    // parse namespace attributes first
    // and log them. push non namespace attributes to a list
    // and process them later
    forEach(genericAttrs, function(value, name) {

      var nonNsAttr = self.parseNsAttribute(element, name, value);

      if (nonNsAttr) {
        attributes.push(nonNsAttr);
      }
    });

    return attributes;
  };

  ElementSerializer.prototype.parseGenericAttributes = function(element, attributes) {

    var self = this;

    forEach(attributes, function(attr) {

      // do not serialize xsi:type attribute
      // it is set manually based on the actual implementation type
      if (attr.name === XSI_TYPE$1) {
        return;
      }

      try {
        self.addAttribute(self.nsAttributeName(attr.name), attr.value);
      } catch (e) {
        console.warn(
          'missing namespace information for ',
          attr.name, '=', attr.value, 'on', element,
          e);
      }
    });
  };

  ElementSerializer.prototype.parseContainments = function(properties) {

    var self = this,
        body = this.body,
        element = this.element;

    forEach(properties, function(p) {
      var value = element.get(p.name),
          isReference = p.isReference,
          isMany = p.isMany;

      if (!isMany) {
        value = [ value ];
      }

      if (p.isBody) {
        body.push(new BodySerializer().build(p, value[0]));
      } else
      if (isSimple(p.type)) {
        forEach(value, function(v) {
          body.push(new ValueSerializer(self.addTagName(self.nsPropertyTagName(p))).build(p, v));
        });
      } else
      if (isReference) {
        forEach(value, function(v) {
          body.push(new ReferenceSerializer(self.addTagName(self.nsPropertyTagName(p))).build(v));
        });
      } else {
        // allow serialization via type
        // rather than element name
        var asType = serializeAsType(p),
            asProperty = serializeAsProperty(p);

        forEach(value, function(v) {
          var serializer;

          if (asType) {
            serializer = new TypeSerializer(self, p);
          } else
          if (asProperty) {
            serializer = new ElementSerializer(self, p);
          } else {
            serializer = new ElementSerializer(self);
          }

          body.push(serializer.build(v));
        });
      }
    });
  };

  ElementSerializer.prototype.getNamespaces = function(local) {

    var namespaces = this.namespaces,
        parent = this.parent,
        parentNamespaces;

    if (!namespaces) {
      parentNamespaces = parent && parent.getNamespaces();

      if (local || !parentNamespaces) {
        this.namespaces = namespaces = new Namespaces(parentNamespaces);
      } else {
        namespaces = parentNamespaces;
      }
    }

    return namespaces;
  };

  ElementSerializer.prototype.logNamespace = function(ns, wellknown, local) {
    var namespaces = this.getNamespaces(local);

    var nsUri = ns.uri,
        nsPrefix = ns.prefix;

    var existing = namespaces.byUri(nsUri);

    if (!existing) {
      namespaces.add(ns, wellknown);
    }

    namespaces.mapPrefix(nsPrefix, nsUri);

    return ns;
  };

  ElementSerializer.prototype.logNamespaceUsed = function(ns, local) {
    var element = this.element,
        model = element.$model,
        namespaces = this.getNamespaces(local);

    // ns may be
    //
    //   * prefix only
    //   * prefix:uri
    //   * localName only

    var prefix = ns.prefix,
        uri = ns.uri,
        newPrefix, idx,
        wellknownUri;

    // handle anonymous namespaces (elementForm=unqualified), cf. #23
    if (!prefix && !uri) {
      return { localName: ns.localName };
    }

    wellknownUri = DEFAULT_NS_MAP[prefix] || model && (model.getPackage(prefix) || {}).uri;

    uri = uri || wellknownUri || namespaces.uriByPrefix(prefix);

    if (!uri) {
      throw new Error('no namespace uri given for prefix <' + prefix + '>');
    }

    ns = namespaces.byUri(uri);

    if (!ns) {
      newPrefix = prefix;
      idx = 1;

      // find a prefix that is not mapped yet
      while (namespaces.uriByPrefix(newPrefix)) {
        newPrefix = prefix + '_' + idx++;
      }

      ns = this.logNamespace({ prefix: newPrefix, uri: uri }, wellknownUri === uri);
    }

    if (prefix) {
      namespaces.mapPrefix(prefix, uri);
    }

    return ns;
  };

  ElementSerializer.prototype.parseAttributes = function(properties) {
    var self = this,
        element = this.element;

    forEach(properties, function(p) {

      var value = element.get(p.name);

      if (p.isReference) {

        if (!p.isMany) {
          value = value.id;
        }
        else {
          var values = [];
          forEach(value, function(v) {
            values.push(v.id);
          });
          // IDREFS is a whitespace-separated list of references.
          value = values.join(' ');
        }

      }

      self.addAttribute(self.nsAttributeName(p), value);
    });
  };

  ElementSerializer.prototype.addTagName = function(nsTagName) {
    var actualNs = this.logNamespaceUsed(nsTagName);

    this.getNamespaces().logUsed(actualNs);

    return nsName(nsTagName);
  };

  ElementSerializer.prototype.addAttribute = function(name, value) {
    var attrs = this.attrs;

    if (isString(value)) {
      value = escapeAttr(value);
    }

    attrs.push({ name: name, value: value });
  };

  ElementSerializer.prototype.serializeAttributes = function(writer) {
    var attrs = this.attrs,
        namespaces = this.namespaces;

    if (namespaces) {
      attrs = getNsAttrs(namespaces).concat(attrs);
    }

    forEach(attrs, function(a) {
      writer
        .append(' ')
        .append(nsName(a.name)).append('="').append(a.value).append('"');
    });
  };

  ElementSerializer.prototype.serializeTo = function(writer) {
    var firstBody = this.body[0],
        indent = firstBody && firstBody.constructor !== BodySerializer;

    writer
      .appendIndent()
      .append('<' + this.tagName);

    this.serializeAttributes(writer);

    writer.append(firstBody ? '>' : ' />');

    if (firstBody) {

      if (indent) {
        writer
          .appendNewLine()
          .indent();
      }

      forEach(this.body, function(b) {
        b.serializeTo(writer);
      });

      if (indent) {
        writer
          .unindent()
          .appendIndent();
      }

      writer.append('</' + this.tagName + '>');
    }

    writer.appendNewLine();
  };

  /**
   * A serializer for types that handles serialization of data types
   */
  function TypeSerializer(parent, propertyDescriptor) {
    ElementSerializer.call(this, parent, propertyDescriptor);
  }

  inherits(TypeSerializer, ElementSerializer);

  TypeSerializer.prototype.parseNsAttributes = function(element) {

    // extracted attributes
    var attributes = ElementSerializer.prototype.parseNsAttributes.call(this, element);

    var descriptor = element.$descriptor;

    // only serialize xsi:type if necessary
    if (descriptor.name === this.propertyDescriptor.type) {
      return attributes;
    }

    var typeNs = this.typeNs = this.nsTagName(descriptor);
    this.getNamespaces().logUsed(this.typeNs);

    // add xsi:type attribute to represent the elements
    // actual type

    var pkg = element.$model.getPackage(typeNs.uri),
        typePrefix = (pkg.xml && pkg.xml.typePrefix) || '';

    this.addAttribute(
      this.nsAttributeName(XSI_TYPE$1),
      (typeNs.prefix ? typeNs.prefix + ':' : '') + typePrefix + descriptor.ns.localName
    );

    return attributes;
  };

  TypeSerializer.prototype.isLocalNs = function(ns) {
    return ns.uri === (this.typeNs || this.ns).uri;
  };

  function SavingWriter() {
    this.value = '';

    this.write = function(str) {
      this.value += str;
    };
  }

  function FormatingWriter(out, format) {

    var indent = [''];

    this.append = function(str) {
      out.write(str);

      return this;
    };

    this.appendNewLine = function() {
      if (format) {
        out.write('\n');
      }

      return this;
    };

    this.appendIndent = function() {
      if (format) {
        out.write(indent.join('  '));
      }

      return this;
    };

    this.indent = function() {
      indent.push('');
      return this;
    };

    this.unindent = function() {
      indent.pop();
      return this;
    };
  }

  /**
   * A writer for meta-model backed document trees
   *
   * @param {Object} options output options to pass into the writer
   */
  function Writer(options) {

    options = assign({ format: false, preamble: true }, options || {});

    function toXML(tree, writer) {
      var internalWriter = writer || new SavingWriter();
      var formatingWriter = new FormatingWriter(internalWriter, options.format);

      if (options.preamble) {
        formatingWriter.append(XML_PREAMBLE);
      }

      new ElementSerializer().build(tree).serializeTo(formatingWriter);

      if (!writer) {
        return internalWriter.value;
      }
    }

    return {
      toXML: toXML
    };
  }

  /**
   * A sub class of {@link Moddle} with support for import and export of BPMN 2.0 xml files.
   *
   * @class BpmnModdle
   * @extends Moddle
   *
   * @param {Object|Array} packages to use for instantiating the model
   * @param {Object} [options] additional options to pass over
   */
  function BpmnModdle(packages, options) {
    Moddle.call(this, packages, options);
  }

  BpmnModdle.prototype = Object.create(Moddle.prototype);


  /**
   * Instantiates a BPMN model tree from a given xml string.
   *
   * @param {String}   xmlStr
   * @param {String}   [typeName='bpmn:Definitions'] name of the root element
   * @param {Object}   [options]  options to pass to the underlying reader
   * @param {Function} done       callback that is invoked with (err, result, parseContext)
   *                              once the import completes
   */
  BpmnModdle.prototype.fromXML = function(xmlStr, typeName, options, done) {

    if (!isString(typeName)) {
      done = options;
      options = typeName;
      typeName = 'bpmn:Definitions';
    }

    if (isFunction(options)) {
      done = options;
      options = {};
    }

    var reader = new Reader(assign({ model: this, lax: true }, options));
    var rootHandler = reader.handler(typeName);

    reader.fromXML(xmlStr, rootHandler, done);
  };


  /**
   * Serializes a BPMN 2.0 object tree to XML.
   *
   * @param {String}   element    the root element, typically an instance of `bpmn:Definitions`
   * @param {Object}   [options]  to pass to the underlying writer
   * @param {Function} done       callback invoked with (err, xmlStr) once the import completes
   */
  BpmnModdle.prototype.toXML = function(element, options, done) {

    if (isFunction(options)) {
      done = options;
      options = {};
    }

    var writer = new Writer(options);

    var result;
    var err;

    try {
      result = writer.toXML(element);
    } catch (e) {
      err = e;
    }

    return done(err, result);
  };

  var name = "BPMN20";
  var uri = "http://www.omg.org/spec/BPMN/20100524/MODEL";
  var associations = [
  ];
  var types = [
  	{
  		name: "Interface",
  		superClass: [
  			"RootElement"
  		],
  		properties: [
  			{
  				name: "name",
  				isAttr: true,
  				type: "String"
  			},
  			{
  				name: "operations",
  				type: "Operation",
  				isMany: true
  			},
  			{
  				name: "implementationRef",
  				type: "String",
  				isAttr: true
  			}
  		]
  	},
  	{
  		name: "Operation",
  		superClass: [
  			"BaseElement"
  		],
  		properties: [
  			{
  				name: "name",
  				isAttr: true,
  				type: "String"
  			},
  			{
  				name: "inMessageRef",
  				type: "Message",
  				isReference: true
  			},
  			{
  				name: "outMessageRef",
  				type: "Message",
  				isReference: true
  			},
  			{
  				name: "errorRef",
  				type: "Error",
  				isMany: true,
  				isReference: true
  			},
  			{
  				name: "implementationRef",
  				type: "String",
  				isAttr: true
  			}
  		]
  	},
  	{
  		name: "EndPoint",
  		superClass: [
  			"RootElement"
  		]
  	},
  	{
  		name: "Auditing",
  		superClass: [
  			"BaseElement"
  		]
  	},
  	{
  		name: "GlobalTask",
  		superClass: [
  			"CallableElement"
  		],
  		properties: [
  			{
  				name: "resources",
  				type: "ResourceRole",
  				isMany: true
  			}
  		]
  	},
  	{
  		name: "Monitoring",
  		superClass: [
  			"BaseElement"
  		]
  	},
  	{
  		name: "Performer",
  		superClass: [
  			"ResourceRole"
  		]
  	},
  	{
  		name: "Process",
  		superClass: [
  			"FlowElementsContainer",
  			"CallableElement"
  		],
  		properties: [
  			{
  				name: "processType",
  				type: "ProcessType",
  				isAttr: true
  			},
  			{
  				name: "isClosed",
  				isAttr: true,
  				type: "Boolean"
  			},
  			{
  				name: "auditing",
  				type: "Auditing"
  			},
  			{
  				name: "monitoring",
  				type: "Monitoring"
  			},
  			{
  				name: "properties",
  				type: "Property",
  				isMany: true
  			},
  			{
  				name: "laneSets",
  				type: "LaneSet",
  				isMany: true,
  				replaces: "FlowElementsContainer#laneSets"
  			},
  			{
  				name: "flowElements",
  				type: "FlowElement",
  				isMany: true,
  				replaces: "FlowElementsContainer#flowElements"
  			},
  			{
  				name: "artifacts",
  				type: "Artifact",
  				isMany: true
  			},
  			{
  				name: "resources",
  				type: "ResourceRole",
  				isMany: true
  			},
  			{
  				name: "correlationSubscriptions",
  				type: "CorrelationSubscription",
  				isMany: true
  			},
  			{
  				name: "supports",
  				type: "Process",
  				isMany: true,
  				isReference: true
  			},
  			{
  				name: "definitionalCollaborationRef",
  				type: "Collaboration",
  				isAttr: true,
  				isReference: true
  			},
  			{
  				name: "isExecutable",
  				isAttr: true,
  				type: "Boolean"
  			}
  		]
  	},
  	{
  		name: "LaneSet",
  		superClass: [
  			"BaseElement"
  		],
  		properties: [
  			{
  				name: "lanes",
  				type: "Lane",
  				isMany: true
  			},
  			{
  				name: "name",
  				isAttr: true,
  				type: "String"
  			}
  		]
  	},
  	{
  		name: "Lane",
  		superClass: [
  			"BaseElement"
  		],
  		properties: [
  			{
  				name: "name",
  				isAttr: true,
  				type: "String"
  			},
  			{
  				name: "partitionElementRef",
  				type: "BaseElement",
  				isAttr: true,
  				isReference: true
  			},
  			{
  				name: "partitionElement",
  				type: "BaseElement"
  			},
  			{
  				name: "flowNodeRef",
  				type: "FlowNode",
  				isMany: true,
  				isReference: true
  			},
  			{
  				name: "childLaneSet",
  				type: "LaneSet",
  				xml: {
  					serialize: "xsi:type"
  				}
  			}
  		]
  	},
  	{
  		name: "GlobalManualTask",
  		superClass: [
  			"GlobalTask"
  		]
  	},
  	{
  		name: "ManualTask",
  		superClass: [
  			"Task"
  		]
  	},
  	{
  		name: "UserTask",
  		superClass: [
  			"Task"
  		],
  		properties: [
  			{
  				name: "renderings",
  				type: "Rendering",
  				isMany: true
  			},
  			{
  				name: "implementation",
  				isAttr: true,
  				type: "String"
  			}
  		]
  	},
  	{
  		name: "Rendering",
  		superClass: [
  			"BaseElement"
  		]
  	},
  	{
  		name: "HumanPerformer",
  		superClass: [
  			"Performer"
  		]
  	},
  	{
  		name: "PotentialOwner",
  		superClass: [
  			"HumanPerformer"
  		]
  	},
  	{
  		name: "GlobalUserTask",
  		superClass: [
  			"GlobalTask"
  		],
  		properties: [
  			{
  				name: "implementation",
  				isAttr: true,
  				type: "String"
  			},
  			{
  				name: "renderings",
  				type: "Rendering",
  				isMany: true
  			}
  		]
  	},
  	{
  		name: "Gateway",
  		isAbstract: true,
  		superClass: [
  			"FlowNode"
  		],
  		properties: [
  			{
  				name: "gatewayDirection",
  				type: "GatewayDirection",
  				"default": "Unspecified",
  				isAttr: true
  			}
  		]
  	},
  	{
  		name: "EventBasedGateway",
  		superClass: [
  			"Gateway"
  		],
  		properties: [
  			{
  				name: "instantiate",
  				"default": false,
  				isAttr: true,
  				type: "Boolean"
  			},
  			{
  				name: "eventGatewayType",
  				type: "EventBasedGatewayType",
  				isAttr: true,
  				"default": "Exclusive"
  			}
  		]
  	},
  	{
  		name: "ComplexGateway",
  		superClass: [
  			"Gateway"
  		],
  		properties: [
  			{
  				name: "activationCondition",
  				type: "Expression",
  				xml: {
  					serialize: "xsi:type"
  				}
  			},
  			{
  				name: "default",
  				type: "SequenceFlow",
  				isAttr: true,
  				isReference: true
  			}
  		]
  	},
  	{
  		name: "ExclusiveGateway",
  		superClass: [
  			"Gateway"
  		],
  		properties: [
  			{
  				name: "default",
  				type: "SequenceFlow",
  				isAttr: true,
  				isReference: true
  			}
  		]
  	},
  	{
  		name: "InclusiveGateway",
  		superClass: [
  			"Gateway"
  		],
  		properties: [
  			{
  				name: "default",
  				type: "SequenceFlow",
  				isAttr: true,
  				isReference: true
  			}
  		]
  	},
  	{
  		name: "ParallelGateway",
  		superClass: [
  			"Gateway"
  		]
  	},
  	{
  		name: "RootElement",
  		isAbstract: true,
  		superClass: [
  			"BaseElement"
  		]
  	},
  	{
  		name: "Relationship",
  		superClass: [
  			"BaseElement"
  		],
  		properties: [
  			{
  				name: "type",
  				isAttr: true,
  				type: "String"
  			},
  			{
  				name: "direction",
  				type: "RelationshipDirection",
  				isAttr: true
  			},
  			{
  				name: "source",
  				isMany: true,
  				isReference: true,
  				type: "Element"
  			},
  			{
  				name: "target",
  				isMany: true,
  				isReference: true,
  				type: "Element"
  			}
  		]
  	},
  	{
  		name: "BaseElement",
  		isAbstract: true,
  		properties: [
  			{
  				name: "id",
  				isAttr: true,
  				type: "String",
  				isId: true
  			},
  			{
  				name: "documentation",
  				type: "Documentation",
  				isMany: true
  			},
  			{
  				name: "extensionDefinitions",
  				type: "ExtensionDefinition",
  				isMany: true,
  				isReference: true
  			},
  			{
  				name: "extensionElements",
  				type: "ExtensionElements"
  			}
  		]
  	},
  	{
  		name: "Extension",
  		properties: [
  			{
  				name: "mustUnderstand",
  				"default": false,
  				isAttr: true,
  				type: "Boolean"
  			},
  			{
  				name: "definition",
  				type: "ExtensionDefinition",
  				isAttr: true,
  				isReference: true
  			}
  		]
  	},
  	{
  		name: "ExtensionDefinition",
  		properties: [
  			{
  				name: "name",
  				isAttr: true,
  				type: "String"
  			},
  			{
  				name: "extensionAttributeDefinitions",
  				type: "ExtensionAttributeDefinition",
  				isMany: true
  			}
  		]
  	},
  	{
  		name: "ExtensionAttributeDefinition",
  		properties: [
  			{
  				name: "name",
  				isAttr: true,
  				type: "String"
  			},
  			{
  				name: "type",
  				isAttr: true,
  				type: "String"
  			},
  			{
  				name: "isReference",
  				"default": false,
  				isAttr: true,
  				type: "Boolean"
  			},
  			{
  				name: "extensionDefinition",
  				type: "ExtensionDefinition",
  				isAttr: true,
  				isReference: true
  			}
  		]
  	},
  	{
  		name: "ExtensionElements",
  		properties: [
  			{
  				name: "valueRef",
  				isAttr: true,
  				isReference: true,
  				type: "Element"
  			},
  			{
  				name: "values",
  				type: "Element",
  				isMany: true
  			},
  			{
  				name: "extensionAttributeDefinition",
  				type: "ExtensionAttributeDefinition",
  				isAttr: true,
  				isReference: true
  			}
  		]
  	},
  	{
  		name: "Documentation",
  		superClass: [
  			"BaseElement"
  		],
  		properties: [
  			{
  				name: "text",
  				type: "String",
  				isBody: true
  			},
  			{
  				name: "textFormat",
  				"default": "text/plain",
  				isAttr: true,
  				type: "String"
  			}
  		]
  	},
  	{
  		name: "Event",
  		isAbstract: true,
  		superClass: [
  			"FlowNode",
  			"InteractionNode"
  		],
  		properties: [
  			{
  				name: "properties",
  				type: "Property",
  				isMany: true
  			}
  		]
  	},
  	{
  		name: "IntermediateCatchEvent",
  		superClass: [
  			"CatchEvent"
  		]
  	},
  	{
  		name: "IntermediateThrowEvent",
  		superClass: [
  			"ThrowEvent"
  		]
  	},
  	{
  		name: "EndEvent",
  		superClass: [
  			"ThrowEvent"
  		]
  	},
  	{
  		name: "StartEvent",
  		superClass: [
  			"CatchEvent"
  		],
  		properties: [
  			{
  				name: "isInterrupting",
  				"default": true,
  				isAttr: true,
  				type: "Boolean"
  			}
  		]
  	},
  	{
  		name: "ThrowEvent",
  		isAbstract: true,
  		superClass: [
  			"Event"
  		],
  		properties: [
  			{
  				name: "dataInputs",
  				type: "DataInput",
  				isMany: true
  			},
  			{
  				name: "dataInputAssociations",
  				type: "DataInputAssociation",
  				isMany: true
  			},
  			{
  				name: "inputSet",
  				type: "InputSet"
  			},
  			{
  				name: "eventDefinitions",
  				type: "EventDefinition",
  				isMany: true
  			},
  			{
  				name: "eventDefinitionRef",
  				type: "EventDefinition",
  				isMany: true,
  				isReference: true
  			}
  		]
  	},
  	{
  		name: "CatchEvent",
  		isAbstract: true,
  		superClass: [
  			"Event"
  		],
  		properties: [
  			{
  				name: "parallelMultiple",
  				isAttr: true,
  				type: "Boolean",
  				"default": false
  			},
  			{
  				name: "dataOutputs",
  				type: "DataOutput",
  				isMany: true
  			},
  			{
  				name: "dataOutputAssociations",
  				type: "DataOutputAssociation",
  				isMany: true
  			},
  			{
  				name: "outputSet",
  				type: "OutputSet"
  			},
  			{
  				name: "eventDefinitions",
  				type: "EventDefinition",
  				isMany: true
  			},
  			{
  				name: "eventDefinitionRef",
  				type: "EventDefinition",
  				isMany: true,
  				isReference: true
  			}
  		]
  	},
  	{
  		name: "BoundaryEvent",
  		superClass: [
  			"CatchEvent"
  		],
  		properties: [
  			{
  				name: "cancelActivity",
  				"default": true,
  				isAttr: true,
  				type: "Boolean"
  			},
  			{
  				name: "attachedToRef",
  				type: "Activity",
  				isAttr: true,
  				isReference: true
  			}
  		]
  	},
  	{
  		name: "EventDefinition",
  		isAbstract: true,
  		superClass: [
  			"RootElement"
  		]
  	},
  	{
  		name: "CancelEventDefinition",
  		superClass: [
  			"EventDefinition"
  		]
  	},
  	{
  		name: "ErrorEventDefinition",
  		superClass: [
  			"EventDefinition"
  		],
  		properties: [
  			{
  				name: "errorRef",
  				type: "Error",
  				isAttr: true,
  				isReference: true
  			}
  		]
  	},
  	{
  		name: "TerminateEventDefinition",
  		superClass: [
  			"EventDefinition"
  		]
  	},
  	{
  		name: "EscalationEventDefinition",
  		superClass: [
  			"EventDefinition"
  		],
  		properties: [
  			{
  				name: "escalationRef",
  				type: "Escalation",
  				isAttr: true,
  				isReference: true
  			}
  		]
  	},
  	{
  		name: "Escalation",
  		properties: [
  			{
  				name: "structureRef",
  				type: "ItemDefinition",
  				isAttr: true,
  				isReference: true
  			},
  			{
  				name: "name",
  				isAttr: true,
  				type: "String"
  			},
  			{
  				name: "escalationCode",
  				isAttr: true,
  				type: "String"
  			}
  		],
  		superClass: [
  			"RootElement"
  		]
  	},
  	{
  		name: "CompensateEventDefinition",
  		superClass: [
  			"EventDefinition"
  		],
  		properties: [
  			{
  				name: "waitForCompletion",
  				isAttr: true,
  				type: "Boolean",
  				"default": true
  			},
  			{
  				name: "activityRef",
  				type: "Activity",
  				isAttr: true,
  				isReference: true
  			}
  		]
  	},
  	{
  		name: "TimerEventDefinition",
  		superClass: [
  			"EventDefinition"
  		],
  		properties: [
  			{
  				name: "timeDate",
  				type: "Expression",
  				xml: {
  					serialize: "xsi:type"
  				}
  			},
  			{
  				name: "timeCycle",
  				type: "Expression",
  				xml: {
  					serialize: "xsi:type"
  				}
  			},
  			{
  				name: "timeDuration",
  				type: "Expression",
  				xml: {
  					serialize: "xsi:type"
  				}
  			}
  		]
  	},
  	{
  		name: "LinkEventDefinition",
  		superClass: [
  			"EventDefinition"
  		],
  		properties: [
  			{
  				name: "name",
  				isAttr: true,
  				type: "String"
  			},
  			{
  				name: "target",
  				type: "LinkEventDefinition",
  				isAttr: true,
  				isReference: true
  			},
  			{
  				name: "source",
  				type: "LinkEventDefinition",
  				isMany: true,
  				isReference: true
  			}
  		]
  	},
  	{
  		name: "MessageEventDefinition",
  		superClass: [
  			"EventDefinition"
  		],
  		properties: [
  			{
  				name: "messageRef",
  				type: "Message",
  				isAttr: true,
  				isReference: true
  			},
  			{
  				name: "operationRef",
  				type: "Operation",
  				isAttr: true,
  				isReference: true
  			}
  		]
  	},
  	{
  		name: "ConditionalEventDefinition",
  		superClass: [
  			"EventDefinition"
  		],
  		properties: [
  			{
  				name: "condition",
  				type: "Expression",
  				xml: {
  					serialize: "xsi:type"
  				}
  			}
  		]
  	},
  	{
  		name: "SignalEventDefinition",
  		superClass: [
  			"EventDefinition"
  		],
  		properties: [
  			{
  				name: "signalRef",
  				type: "Signal",
  				isAttr: true,
  				isReference: true
  			}
  		]
  	},
  	{
  		name: "Signal",
  		superClass: [
  			"RootElement"
  		],
  		properties: [
  			{
  				name: "structureRef",
  				type: "ItemDefinition",
  				isAttr: true,
  				isReference: true
  			},
  			{
  				name: "name",
  				isAttr: true,
  				type: "String"
  			}
  		]
  	},
  	{
  		name: "ImplicitThrowEvent",
  		superClass: [
  			"ThrowEvent"
  		]
  	},
  	{
  		name: "DataState",
  		superClass: [
  			"BaseElement"
  		],
  		properties: [
  			{
  				name: "name",
  				isAttr: true,
  				type: "String"
  			}
  		]
  	},
  	{
  		name: "ItemAwareElement",
  		superClass: [
  			"BaseElement"
  		],
  		properties: [
  			{
  				name: "itemSubjectRef",
  				type: "ItemDefinition",
  				isAttr: true,
  				isReference: true
  			},
  			{
  				name: "dataState",
  				type: "DataState"
  			}
  		]
  	},
  	{
  		name: "DataAssociation",
  		superClass: [
  			"BaseElement"
  		],
  		properties: [
  			{
  				name: "assignment",
  				type: "Assignment",
  				isMany: true
  			},
  			{
  				name: "sourceRef",
  				type: "ItemAwareElement",
  				isMany: true,
  				isReference: true
  			},
  			{
  				name: "targetRef",
  				type: "ItemAwareElement",
  				isReference: true
  			},
  			{
  				name: "transformation",
  				type: "FormalExpression",
  				xml: {
  					serialize: "property"
  				}
  			}
  		]
  	},
  	{
  		name: "DataInput",
  		superClass: [
  			"ItemAwareElement"
  		],
  		properties: [
  			{
  				name: "name",
  				isAttr: true,
  				type: "String"
  			},
  			{
  				name: "isCollection",
  				"default": false,
  				isAttr: true,
  				type: "Boolean"
  			},
  			{
  				name: "inputSetRef",
  				type: "InputSet",
  				isVirtual: true,
  				isMany: true,
  				isReference: true
  			},
  			{
  				name: "inputSetWithOptional",
  				type: "InputSet",
  				isVirtual: true,
  				isMany: true,
  				isReference: true
  			},
  			{
  				name: "inputSetWithWhileExecuting",
  				type: "InputSet",
  				isVirtual: true,
  				isMany: true,
  				isReference: true
  			}
  		]
  	},
  	{
  		name: "DataOutput",
  		superClass: [
  			"ItemAwareElement"
  		],
  		properties: [
  			{
  				name: "name",
  				isAttr: true,
  				type: "String"
  			},
  			{
  				name: "isCollection",
  				"default": false,
  				isAttr: true,
  				type: "Boolean"
  			},
  			{
  				name: "outputSetRef",
  				type: "OutputSet",
  				isVirtual: true,
  				isMany: true,
  				isReference: true
  			},
  			{
  				name: "outputSetWithOptional",
  				type: "OutputSet",
  				isVirtual: true,
  				isMany: true,
  				isReference: true
  			},
  			{
  				name: "outputSetWithWhileExecuting",
  				type: "OutputSet",
  				isVirtual: true,
  				isMany: true,
  				isReference: true
  			}
  		]
  	},
  	{
  		name: "InputSet",
  		superClass: [
  			"BaseElement"
  		],
  		properties: [
  			{
  				name: "name",
  				isAttr: true,
  				type: "String"
  			},
  			{
  				name: "dataInputRefs",
  				type: "DataInput",
  				isMany: true,
  				isReference: true
  			},
  			{
  				name: "optionalInputRefs",
  				type: "DataInput",
  				isMany: true,
  				isReference: true
  			},
  			{
  				name: "whileExecutingInputRefs",
  				type: "DataInput",
  				isMany: true,
  				isReference: true
  			},
  			{
  				name: "outputSetRefs",
  				type: "OutputSet",
  				isMany: true,
  				isReference: true
  			}
  		]
  	},
  	{
  		name: "OutputSet",
  		superClass: [
  			"BaseElement"
  		],
  		properties: [
  			{
  				name: "dataOutputRefs",
  				type: "DataOutput",
  				isMany: true,
  				isReference: true
  			},
  			{
  				name: "name",
  				isAttr: true,
  				type: "String"
  			},
  			{
  				name: "inputSetRefs",
  				type: "InputSet",
  				isMany: true,
  				isReference: true
  			},
  			{
  				name: "optionalOutputRefs",
  				type: "DataOutput",
  				isMany: true,
  				isReference: true
  			},
  			{
  				name: "whileExecutingOutputRefs",
  				type: "DataOutput",
  				isMany: true,
  				isReference: true
  			}
  		]
  	},
  	{
  		name: "Property",
  		superClass: [
  			"ItemAwareElement"
  		],
  		properties: [
  			{
  				name: "name",
  				isAttr: true,
  				type: "String"
  			}
  		]
  	},
  	{
  		name: "DataInputAssociation",
  		superClass: [
  			"DataAssociation"
  		]
  	},
  	{
  		name: "DataOutputAssociation",
  		superClass: [
  			"DataAssociation"
  		]
  	},
  	{
  		name: "InputOutputSpecification",
  		superClass: [
  			"BaseElement"
  		],
  		properties: [
  			{
  				name: "dataInputs",
  				type: "DataInput",
  				isMany: true
  			},
  			{
  				name: "dataOutputs",
  				type: "DataOutput",
  				isMany: true
  			},
  			{
  				name: "inputSets",
  				type: "InputSet",
  				isMany: true
  			},
  			{
  				name: "outputSets",
  				type: "OutputSet",
  				isMany: true
  			}
  		]
  	},
  	{
  		name: "DataObject",
  		superClass: [
  			"FlowElement",
  			"ItemAwareElement"
  		],
  		properties: [
  			{
  				name: "isCollection",
  				"default": false,
  				isAttr: true,
  				type: "Boolean"
  			}
  		]
  	},
  	{
  		name: "InputOutputBinding",
  		properties: [
  			{
  				name: "inputDataRef",
  				type: "InputSet",
  				isAttr: true,
  				isReference: true
  			},
  			{
  				name: "outputDataRef",
  				type: "OutputSet",
  				isAttr: true,
  				isReference: true
  			},
  			{
  				name: "operationRef",
  				type: "Operation",
  				isAttr: true,
  				isReference: true
  			}
  		]
  	},
  	{
  		name: "Assignment",
  		superClass: [
  			"BaseElement"
  		],
  		properties: [
  			{
  				name: "from",
  				type: "Expression",
  				xml: {
  					serialize: "xsi:type"
  				}
  			},
  			{
  				name: "to",
  				type: "Expression",
  				xml: {
  					serialize: "xsi:type"
  				}
  			}
  		]
  	},
  	{
  		name: "DataStore",
  		superClass: [
  			"RootElement",
  			"ItemAwareElement"
  		],
  		properties: [
  			{
  				name: "name",
  				isAttr: true,
  				type: "String"
  			},
  			{
  				name: "capacity",
  				isAttr: true,
  				type: "Integer"
  			},
  			{
  				name: "isUnlimited",
  				"default": true,
  				isAttr: true,
  				type: "Boolean"
  			}
  		]
  	},
  	{
  		name: "DataStoreReference",
  		superClass: [
  			"ItemAwareElement",
  			"FlowElement"
  		],
  		properties: [
  			{
  				name: "dataStoreRef",
  				type: "DataStore",
  				isAttr: true,
  				isReference: true
  			}
  		]
  	},
  	{
  		name: "DataObjectReference",
  		superClass: [
  			"ItemAwareElement",
  			"FlowElement"
  		],
  		properties: [
  			{
  				name: "dataObjectRef",
  				type: "DataObject",
  				isAttr: true,
  				isReference: true
  			}
  		]
  	},
  	{
  		name: "ConversationLink",
  		superClass: [
  			"BaseElement"
  		],
  		properties: [
  			{
  				name: "sourceRef",
  				type: "InteractionNode",
  				isAttr: true,
  				isReference: true
  			},
  			{
  				name: "targetRef",
  				type: "InteractionNode",
  				isAttr: true,
  				isReference: true
  			},
  			{
  				name: "name",
  				isAttr: true,
  				type: "String"
  			}
  		]
  	},
  	{
  		name: "ConversationAssociation",
  		superClass: [
  			"BaseElement"
  		],
  		properties: [
  			{
  				name: "innerConversationNodeRef",
  				type: "ConversationNode",
  				isAttr: true,
  				isReference: true
  			},
  			{
  				name: "outerConversationNodeRef",
  				type: "ConversationNode",
  				isAttr: true,
  				isReference: true
  			}
  		]
  	},
  	{
  		name: "CallConversation",
  		superClass: [
  			"ConversationNode"
  		],
  		properties: [
  			{
  				name: "calledCollaborationRef",
  				type: "Collaboration",
  				isAttr: true,
  				isReference: true
  			},
  			{
  				name: "participantAssociations",
  				type: "ParticipantAssociation",
  				isMany: true
  			}
  		]
  	},
  	{
  		name: "Conversation",
  		superClass: [
  			"ConversationNode"
  		]
  	},
  	{
  		name: "SubConversation",
  		superClass: [
  			"ConversationNode"
  		],
  		properties: [
  			{
  				name: "conversationNodes",
  				type: "ConversationNode",
  				isMany: true
  			}
  		]
  	},
  	{
  		name: "ConversationNode",
  		isAbstract: true,
  		superClass: [
  			"InteractionNode",
  			"BaseElement"
  		],
  		properties: [
  			{
  				name: "name",
  				isAttr: true,
  				type: "String"
  			},
  			{
  				name: "participantRef",
  				type: "Participant",
  				isMany: true,
  				isReference: true
  			},
  			{
  				name: "messageFlowRefs",
  				type: "MessageFlow",
  				isMany: true,
  				isReference: true
  			},
  			{
  				name: "correlationKeys",
  				type: "CorrelationKey",
  				isMany: true
  			}
  		]
  	},
  	{
  		name: "GlobalConversation",
  		superClass: [
  			"Collaboration"
  		]
  	},
  	{
  		name: "PartnerEntity",
  		superClass: [
  			"RootElement"
  		],
  		properties: [
  			{
  				name: "name",
  				isAttr: true,
  				type: "String"
  			},
  			{
  				name: "participantRef",
  				type: "Participant",
  				isMany: true,
  				isReference: true
  			}
  		]
  	},
  	{
  		name: "PartnerRole",
  		superClass: [
  			"RootElement"
  		],
  		properties: [
  			{
  				name: "name",
  				isAttr: true,
  				type: "String"
  			},
  			{
  				name: "participantRef",
  				type: "Participant",
  				isMany: true,
  				isReference: true
  			}
  		]
  	},
  	{
  		name: "CorrelationProperty",
  		superClass: [
  			"RootElement"
  		],
  		properties: [
  			{
  				name: "correlationPropertyRetrievalExpression",
  				type: "CorrelationPropertyRetrievalExpression",
  				isMany: true
  			},
  			{
  				name: "name",
  				isAttr: true,
  				type: "String"
  			},
  			{
  				name: "type",
  				type: "ItemDefinition",
  				isAttr: true,
  				isReference: true
  			}
  		]
  	},
  	{
  		name: "Error",
  		superClass: [
  			"RootElement"
  		],
  		properties: [
  			{
  				name: "structureRef",
  				type: "ItemDefinition",
  				isAttr: true,
  				isReference: true
  			},
  			{
  				name: "name",
  				isAttr: true,
  				type: "String"
  			},
  			{
  				name: "errorCode",
  				isAttr: true,
  				type: "String"
  			}
  		]
  	},
  	{
  		name: "CorrelationKey",
  		superClass: [
  			"BaseElement"
  		],
  		properties: [
  			{
  				name: "correlationPropertyRef",
  				type: "CorrelationProperty",
  				isMany: true,
  				isReference: true
  			},
  			{
  				name: "name",
  				isAttr: true,
  				type: "String"
  			}
  		]
  	},
  	{
  		name: "Expression",
  		superClass: [
  			"BaseElement"
  		],
  		isAbstract: false,
  		properties: [
  			{
  				name: "body",
  				type: "String",
  				isBody: true
  			}
  		]
  	},
  	{
  		name: "FormalExpression",
  		superClass: [
  			"Expression"
  		],
  		properties: [
  			{
  				name: "language",
  				isAttr: true,
  				type: "String"
  			},
  			{
  				name: "evaluatesToTypeRef",
  				type: "ItemDefinition",
  				isAttr: true,
  				isReference: true
  			}
  		]
  	},
  	{
  		name: "Message",
  		superClass: [
  			"RootElement"
  		],
  		properties: [
  			{
  				name: "name",
  				isAttr: true,
  				type: "String"
  			},
  			{
  				name: "itemRef",
  				type: "ItemDefinition",
  				isAttr: true,
  				isReference: true
  			}
  		]
  	},
  	{
  		name: "ItemDefinition",
  		superClass: [
  			"RootElement"
  		],
  		properties: [
  			{
  				name: "itemKind",
  				type: "ItemKind",
  				isAttr: true
  			},
  			{
  				name: "structureRef",
  				type: "String",
  				isAttr: true
  			},
  			{
  				name: "isCollection",
  				"default": false,
  				isAttr: true,
  				type: "Boolean"
  			},
  			{
  				name: "import",
  				type: "Import",
  				isAttr: true,
  				isReference: true
  			}
  		]
  	},
  	{
  		name: "FlowElement",
  		isAbstract: true,
  		superClass: [
  			"BaseElement"
  		],
  		properties: [
  			{
  				name: "name",
  				isAttr: true,
  				type: "String"
  			},
  			{
  				name: "auditing",
  				type: "Auditing"
  			},
  			{
  				name: "monitoring",
  				type: "Monitoring"
  			},
  			{
  				name: "categoryValueRef",
  				type: "CategoryValue",
  				isMany: true,
  				isReference: true
  			}
  		]
  	},
  	{
  		name: "SequenceFlow",
  		superClass: [
  			"FlowElement"
  		],
  		properties: [
  			{
  				name: "isImmediate",
  				isAttr: true,
  				type: "Boolean"
  			},
  			{
  				name: "conditionExpression",
  				type: "Expression",
  				xml: {
  					serialize: "xsi:type"
  				}
  			},
  			{
  				name: "sourceRef",
  				type: "FlowNode",
  				isAttr: true,
  				isReference: true
  			},
  			{
  				name: "targetRef",
  				type: "FlowNode",
  				isAttr: true,
  				isReference: true
  			}
  		]
  	},
  	{
  		name: "FlowElementsContainer",
  		isAbstract: true,
  		superClass: [
  			"BaseElement"
  		],
  		properties: [
  			{
  				name: "laneSets",
  				type: "LaneSet",
  				isMany: true
  			},
  			{
  				name: "flowElements",
  				type: "FlowElement",
  				isMany: true
  			}
  		]
  	},
  	{
  		name: "CallableElement",
  		isAbstract: true,
  		superClass: [
  			"RootElement"
  		],
  		properties: [
  			{
  				name: "name",
  				isAttr: true,
  				type: "String"
  			},
  			{
  				name: "ioSpecification",
  				type: "InputOutputSpecification",
  				xml: {
  					serialize: "property"
  				}
  			},
  			{
  				name: "supportedInterfaceRef",
  				type: "Interface",
  				isMany: true,
  				isReference: true
  			},
  			{
  				name: "ioBinding",
  				type: "InputOutputBinding",
  				isMany: true,
  				xml: {
  					serialize: "property"
  				}
  			}
  		]
  	},
  	{
  		name: "FlowNode",
  		isAbstract: true,
  		superClass: [
  			"FlowElement"
  		],
  		properties: [
  			{
  				name: "incoming",
  				type: "SequenceFlow",
  				isMany: true,
  				isReference: true
  			},
  			{
  				name: "outgoing",
  				type: "SequenceFlow",
  				isMany: true,
  				isReference: true
  			},
  			{
  				name: "lanes",
  				type: "Lane",
  				isVirtual: true,
  				isMany: true,
  				isReference: true
  			}
  		]
  	},
  	{
  		name: "CorrelationPropertyRetrievalExpression",
  		superClass: [
  			"BaseElement"
  		],
  		properties: [
  			{
  				name: "messagePath",
  				type: "FormalExpression"
  			},
  			{
  				name: "messageRef",
  				type: "Message",
  				isAttr: true,
  				isReference: true
  			}
  		]
  	},
  	{
  		name: "CorrelationPropertyBinding",
  		superClass: [
  			"BaseElement"
  		],
  		properties: [
  			{
  				name: "dataPath",
  				type: "FormalExpression"
  			},
  			{
  				name: "correlationPropertyRef",
  				type: "CorrelationProperty",
  				isAttr: true,
  				isReference: true
  			}
  		]
  	},
  	{
  		name: "Resource",
  		superClass: [
  			"RootElement"
  		],
  		properties: [
  			{
  				name: "name",
  				isAttr: true,
  				type: "String"
  			},
  			{
  				name: "resourceParameters",
  				type: "ResourceParameter",
  				isMany: true
  			}
  		]
  	},
  	{
  		name: "ResourceParameter",
  		superClass: [
  			"BaseElement"
  		],
  		properties: [
  			{
  				name: "name",
  				isAttr: true,
  				type: "String"
  			},
  			{
  				name: "isRequired",
  				isAttr: true,
  				type: "Boolean"
  			},
  			{
  				name: "type",
  				type: "ItemDefinition",
  				isAttr: true,
  				isReference: true
  			}
  		]
  	},
  	{
  		name: "CorrelationSubscription",
  		superClass: [
  			"BaseElement"
  		],
  		properties: [
  			{
  				name: "correlationKeyRef",
  				type: "CorrelationKey",
  				isAttr: true,
  				isReference: true
  			},
  			{
  				name: "correlationPropertyBinding",
  				type: "CorrelationPropertyBinding",
  				isMany: true
  			}
  		]
  	},
  	{
  		name: "MessageFlow",
  		superClass: [
  			"BaseElement"
  		],
  		properties: [
  			{
  				name: "name",
  				isAttr: true,
  				type: "String"
  			},
  			{
  				name: "sourceRef",
  				type: "InteractionNode",
  				isAttr: true,
  				isReference: true
  			},
  			{
  				name: "targetRef",
  				type: "InteractionNode",
  				isAttr: true,
  				isReference: true
  			},
  			{
  				name: "messageRef",
  				type: "Message",
  				isAttr: true,
  				isReference: true
  			}
  		]
  	},
  	{
  		name: "MessageFlowAssociation",
  		superClass: [
  			"BaseElement"
  		],
  		properties: [
  			{
  				name: "innerMessageFlowRef",
  				type: "MessageFlow",
  				isAttr: true,
  				isReference: true
  			},
  			{
  				name: "outerMessageFlowRef",
  				type: "MessageFlow",
  				isAttr: true,
  				isReference: true
  			}
  		]
  	},
  	{
  		name: "InteractionNode",
  		isAbstract: true,
  		properties: [
  			{
  				name: "incomingConversationLinks",
  				type: "ConversationLink",
  				isVirtual: true,
  				isMany: true,
  				isReference: true
  			},
  			{
  				name: "outgoingConversationLinks",
  				type: "ConversationLink",
  				isVirtual: true,
  				isMany: true,
  				isReference: true
  			}
  		]
  	},
  	{
  		name: "Participant",
  		superClass: [
  			"InteractionNode",
  			"BaseElement"
  		],
  		properties: [
  			{
  				name: "name",
  				isAttr: true,
  				type: "String"
  			},
  			{
  				name: "interfaceRef",
  				type: "Interface",
  				isMany: true,
  				isReference: true
  			},
  			{
  				name: "participantMultiplicity",
  				type: "ParticipantMultiplicity"
  			},
  			{
  				name: "endPointRefs",
  				type: "EndPoint",
  				isMany: true,
  				isReference: true
  			},
  			{
  				name: "processRef",
  				type: "Process",
  				isAttr: true,
  				isReference: true
  			}
  		]
  	},
  	{
  		name: "ParticipantAssociation",
  		superClass: [
  			"BaseElement"
  		],
  		properties: [
  			{
  				name: "innerParticipantRef",
  				type: "Participant",
  				isAttr: true,
  				isReference: true
  			},
  			{
  				name: "outerParticipantRef",
  				type: "Participant",
  				isAttr: true,
  				isReference: true
  			}
  		]
  	},
  	{
  		name: "ParticipantMultiplicity",
  		properties: [
  			{
  				name: "minimum",
  				"default": 0,
  				isAttr: true,
  				type: "Integer"
  			},
  			{
  				name: "maximum",
  				"default": 1,
  				isAttr: true,
  				type: "Integer"
  			}
  		],
  		superClass: [
  			"BaseElement"
  		]
  	},
  	{
  		name: "Collaboration",
  		superClass: [
  			"RootElement"
  		],
  		properties: [
  			{
  				name: "name",
  				isAttr: true,
  				type: "String"
  			},
  			{
  				name: "isClosed",
  				isAttr: true,
  				type: "Boolean"
  			},
  			{
  				name: "participants",
  				type: "Participant",
  				isMany: true
  			},
  			{
  				name: "messageFlows",
  				type: "MessageFlow",
  				isMany: true
  			},
  			{
  				name: "artifacts",
  				type: "Artifact",
  				isMany: true
  			},
  			{
  				name: "conversations",
  				type: "ConversationNode",
  				isMany: true
  			},
  			{
  				name: "conversationAssociations",
  				type: "ConversationAssociation"
  			},
  			{
  				name: "participantAssociations",
  				type: "ParticipantAssociation",
  				isMany: true
  			},
  			{
  				name: "messageFlowAssociations",
  				type: "MessageFlowAssociation",
  				isMany: true
  			},
  			{
  				name: "correlationKeys",
  				type: "CorrelationKey",
  				isMany: true
  			},
  			{
  				name: "choreographyRef",
  				type: "Choreography",
  				isMany: true,
  				isReference: true
  			},
  			{
  				name: "conversationLinks",
  				type: "ConversationLink",
  				isMany: true
  			}
  		]
  	},
  	{
  		name: "ChoreographyActivity",
  		isAbstract: true,
  		superClass: [
  			"FlowNode"
  		],
  		properties: [
  			{
  				name: "participantRef",
  				type: "Participant",
  				isMany: true,
  				isReference: true
  			},
  			{
  				name: "initiatingParticipantRef",
  				type: "Participant",
  				isAttr: true,
  				isReference: true
  			},
  			{
  				name: "correlationKeys",
  				type: "CorrelationKey",
  				isMany: true
  			},
  			{
  				name: "loopType",
  				type: "ChoreographyLoopType",
  				"default": "None",
  				isAttr: true
  			}
  		]
  	},
  	{
  		name: "CallChoreography",
  		superClass: [
  			"ChoreographyActivity"
  		],
  		properties: [
  			{
  				name: "calledChoreographyRef",
  				type: "Choreography",
  				isAttr: true,
  				isReference: true
  			},
  			{
  				name: "participantAssociations",
  				type: "ParticipantAssociation",
  				isMany: true
  			}
  		]
  	},
  	{
  		name: "SubChoreography",
  		superClass: [
  			"ChoreographyActivity",
  			"FlowElementsContainer"
  		],
  		properties: [
  			{
  				name: "artifacts",
  				type: "Artifact",
  				isMany: true
  			}
  		]
  	},
  	{
  		name: "ChoreographyTask",
  		superClass: [
  			"ChoreographyActivity"
  		],
  		properties: [
  			{
  				name: "messageFlowRef",
  				type: "MessageFlow",
  				isMany: true,
  				isReference: true
  			}
  		]
  	},
  	{
  		name: "Choreography",
  		superClass: [
  			"Collaboration",
  			"FlowElementsContainer"
  		]
  	},
  	{
  		name: "GlobalChoreographyTask",
  		superClass: [
  			"Choreography"
  		],
  		properties: [
  			{
  				name: "initiatingParticipantRef",
  				type: "Participant",
  				isAttr: true,
  				isReference: true
  			}
  		]
  	},
  	{
  		name: "TextAnnotation",
  		superClass: [
  			"Artifact"
  		],
  		properties: [
  			{
  				name: "text",
  				type: "String"
  			},
  			{
  				name: "textFormat",
  				"default": "text/plain",
  				isAttr: true,
  				type: "String"
  			}
  		]
  	},
  	{
  		name: "Group",
  		superClass: [
  			"Artifact"
  		],
  		properties: [
  			{
  				name: "categoryValueRef",
  				type: "CategoryValue",
  				isAttr: true,
  				isReference: true
  			}
  		]
  	},
  	{
  		name: "Association",
  		superClass: [
  			"Artifact"
  		],
  		properties: [
  			{
  				name: "associationDirection",
  				type: "AssociationDirection",
  				isAttr: true
  			},
  			{
  				name: "sourceRef",
  				type: "BaseElement",
  				isAttr: true,
  				isReference: true
  			},
  			{
  				name: "targetRef",
  				type: "BaseElement",
  				isAttr: true,
  				isReference: true
  			}
  		]
  	},
  	{
  		name: "Category",
  		superClass: [
  			"RootElement"
  		],
  		properties: [
  			{
  				name: "categoryValue",
  				type: "CategoryValue",
  				isMany: true
  			},
  			{
  				name: "name",
  				isAttr: true,
  				type: "String"
  			}
  		]
  	},
  	{
  		name: "Artifact",
  		isAbstract: true,
  		superClass: [
  			"BaseElement"
  		]
  	},
  	{
  		name: "CategoryValue",
  		superClass: [
  			"BaseElement"
  		],
  		properties: [
  			{
  				name: "categorizedFlowElements",
  				type: "FlowElement",
  				isVirtual: true,
  				isMany: true,
  				isReference: true
  			},
  			{
  				name: "value",
  				isAttr: true,
  				type: "String"
  			}
  		]
  	},
  	{
  		name: "Activity",
  		isAbstract: true,
  		superClass: [
  			"FlowNode"
  		],
  		properties: [
  			{
  				name: "isForCompensation",
  				"default": false,
  				isAttr: true,
  				type: "Boolean"
  			},
  			{
  				name: "default",
  				type: "SequenceFlow",
  				isAttr: true,
  				isReference: true
  			},
  			{
  				name: "ioSpecification",
  				type: "InputOutputSpecification",
  				xml: {
  					serialize: "property"
  				}
  			},
  			{
  				name: "boundaryEventRefs",
  				type: "BoundaryEvent",
  				isMany: true,
  				isReference: true
  			},
  			{
  				name: "properties",
  				type: "Property",
  				isMany: true
  			},
  			{
  				name: "dataInputAssociations",
  				type: "DataInputAssociation",
  				isMany: true
  			},
  			{
  				name: "dataOutputAssociations",
  				type: "DataOutputAssociation",
  				isMany: true
  			},
  			{
  				name: "startQuantity",
  				"default": 1,
  				isAttr: true,
  				type: "Integer"
  			},
  			{
  				name: "resources",
  				type: "ResourceRole",
  				isMany: true
  			},
  			{
  				name: "completionQuantity",
  				"default": 1,
  				isAttr: true,
  				type: "Integer"
  			},
  			{
  				name: "loopCharacteristics",
  				type: "LoopCharacteristics"
  			}
  		]
  	},
  	{
  		name: "ServiceTask",
  		superClass: [
  			"Task"
  		],
  		properties: [
  			{
  				name: "implementation",
  				isAttr: true,
  				type: "String"
  			},
  			{
  				name: "operationRef",
  				type: "Operation",
  				isAttr: true,
  				isReference: true
  			}
  		]
  	},
  	{
  		name: "SubProcess",
  		superClass: [
  			"Activity",
  			"FlowElementsContainer",
  			"InteractionNode"
  		],
  		properties: [
  			{
  				name: "triggeredByEvent",
  				"default": false,
  				isAttr: true,
  				type: "Boolean"
  			},
  			{
  				name: "artifacts",
  				type: "Artifact",
  				isMany: true
  			}
  		]
  	},
  	{
  		name: "LoopCharacteristics",
  		isAbstract: true,
  		superClass: [
  			"BaseElement"
  		]
  	},
  	{
  		name: "MultiInstanceLoopCharacteristics",
  		superClass: [
  			"LoopCharacteristics"
  		],
  		properties: [
  			{
  				name: "isSequential",
  				"default": false,
  				isAttr: true,
  				type: "Boolean"
  			},
  			{
  				name: "behavior",
  				type: "MultiInstanceBehavior",
  				"default": "All",
  				isAttr: true
  			},
  			{
  				name: "loopCardinality",
  				type: "Expression",
  				xml: {
  					serialize: "xsi:type"
  				}
  			},
  			{
  				name: "loopDataInputRef",
  				type: "ItemAwareElement",
  				isReference: true
  			},
  			{
  				name: "loopDataOutputRef",
  				type: "ItemAwareElement",
  				isReference: true
  			},
  			{
  				name: "inputDataItem",
  				type: "DataInput",
  				xml: {
  					serialize: "property"
  				}
  			},
  			{
  				name: "outputDataItem",
  				type: "DataOutput",
  				xml: {
  					serialize: "property"
  				}
  			},
  			{
  				name: "complexBehaviorDefinition",
  				type: "ComplexBehaviorDefinition",
  				isMany: true
  			},
  			{
  				name: "completionCondition",
  				type: "Expression",
  				xml: {
  					serialize: "xsi:type"
  				}
  			},
  			{
  				name: "oneBehaviorEventRef",
  				type: "EventDefinition",
  				isAttr: true,
  				isReference: true
  			},
  			{
  				name: "noneBehaviorEventRef",
  				type: "EventDefinition",
  				isAttr: true,
  				isReference: true
  			}
  		]
  	},
  	{
  		name: "StandardLoopCharacteristics",
  		superClass: [
  			"LoopCharacteristics"
  		],
  		properties: [
  			{
  				name: "testBefore",
  				"default": false,
  				isAttr: true,
  				type: "Boolean"
  			},
  			{
  				name: "loopCondition",
  				type: "Expression",
  				xml: {
  					serialize: "xsi:type"
  				}
  			},
  			{
  				name: "loopMaximum",
  				type: "Integer",
  				isAttr: true
  			}
  		]
  	},
  	{
  		name: "CallActivity",
  		superClass: [
  			"Activity"
  		],
  		properties: [
  			{
  				name: "calledElement",
  				type: "String",
  				isAttr: true
  			}
  		]
  	},
  	{
  		name: "Task",
  		superClass: [
  			"Activity",
  			"InteractionNode"
  		]
  	},
  	{
  		name: "SendTask",
  		superClass: [
  			"Task"
  		],
  		properties: [
  			{
  				name: "implementation",
  				isAttr: true,
  				type: "String"
  			},
  			{
  				name: "operationRef",
  				type: "Operation",
  				isAttr: true,
  				isReference: true
  			},
  			{
  				name: "messageRef",
  				type: "Message",
  				isAttr: true,
  				isReference: true
  			}
  		]
  	},
  	{
  		name: "ReceiveTask",
  		superClass: [
  			"Task"
  		],
  		properties: [
  			{
  				name: "implementation",
  				isAttr: true,
  				type: "String"
  			},
  			{
  				name: "instantiate",
  				"default": false,
  				isAttr: true,
  				type: "Boolean"
  			},
  			{
  				name: "operationRef",
  				type: "Operation",
  				isAttr: true,
  				isReference: true
  			},
  			{
  				name: "messageRef",
  				type: "Message",
  				isAttr: true,
  				isReference: true
  			}
  		]
  	},
  	{
  		name: "ScriptTask",
  		superClass: [
  			"Task"
  		],
  		properties: [
  			{
  				name: "scriptFormat",
  				isAttr: true,
  				type: "String"
  			},
  			{
  				name: "script",
  				type: "String"
  			}
  		]
  	},
  	{
  		name: "BusinessRuleTask",
  		superClass: [
  			"Task"
  		],
  		properties: [
  			{
  				name: "implementation",
  				isAttr: true,
  				type: "String"
  			}
  		]
  	},
  	{
  		name: "AdHocSubProcess",
  		superClass: [
  			"SubProcess"
  		],
  		properties: [
  			{
  				name: "completionCondition",
  				type: "Expression",
  				xml: {
  					serialize: "xsi:type"
  				}
  			},
  			{
  				name: "ordering",
  				type: "AdHocOrdering",
  				isAttr: true
  			},
  			{
  				name: "cancelRemainingInstances",
  				"default": true,
  				isAttr: true,
  				type: "Boolean"
  			}
  		]
  	},
  	{
  		name: "Transaction",
  		superClass: [
  			"SubProcess"
  		],
  		properties: [
  			{
  				name: "protocol",
  				isAttr: true,
  				type: "String"
  			},
  			{
  				name: "method",
  				isAttr: true,
  				type: "String"
  			}
  		]
  	},
  	{
  		name: "GlobalScriptTask",
  		superClass: [
  			"GlobalTask"
  		],
  		properties: [
  			{
  				name: "scriptLanguage",
  				isAttr: true,
  				type: "String"
  			},
  			{
  				name: "script",
  				isAttr: true,
  				type: "String"
  			}
  		]
  	},
  	{
  		name: "GlobalBusinessRuleTask",
  		superClass: [
  			"GlobalTask"
  		],
  		properties: [
  			{
  				name: "implementation",
  				isAttr: true,
  				type: "String"
  			}
  		]
  	},
  	{
  		name: "ComplexBehaviorDefinition",
  		superClass: [
  			"BaseElement"
  		],
  		properties: [
  			{
  				name: "condition",
  				type: "FormalExpression"
  			},
  			{
  				name: "event",
  				type: "ImplicitThrowEvent"
  			}
  		]
  	},
  	{
  		name: "ResourceRole",
  		superClass: [
  			"BaseElement"
  		],
  		properties: [
  			{
  				name: "resourceRef",
  				type: "Resource",
  				isReference: true
  			},
  			{
  				name: "resourceParameterBindings",
  				type: "ResourceParameterBinding",
  				isMany: true
  			},
  			{
  				name: "resourceAssignmentExpression",
  				type: "ResourceAssignmentExpression"
  			},
  			{
  				name: "name",
  				isAttr: true,
  				type: "String"
  			}
  		]
  	},
  	{
  		name: "ResourceParameterBinding",
  		properties: [
  			{
  				name: "expression",
  				type: "Expression",
  				xml: {
  					serialize: "xsi:type"
  				}
  			},
  			{
  				name: "parameterRef",
  				type: "ResourceParameter",
  				isAttr: true,
  				isReference: true
  			}
  		],
  		superClass: [
  			"BaseElement"
  		]
  	},
  	{
  		name: "ResourceAssignmentExpression",
  		properties: [
  			{
  				name: "expression",
  				type: "Expression",
  				xml: {
  					serialize: "xsi:type"
  				}
  			}
  		],
  		superClass: [
  			"BaseElement"
  		]
  	},
  	{
  		name: "Import",
  		properties: [
  			{
  				name: "importType",
  				isAttr: true,
  				type: "String"
  			},
  			{
  				name: "location",
  				isAttr: true,
  				type: "String"
  			},
  			{
  				name: "namespace",
  				isAttr: true,
  				type: "String"
  			}
  		]
  	},
  	{
  		name: "Definitions",
  		superClass: [
  			"BaseElement"
  		],
  		properties: [
  			{
  				name: "name",
  				isAttr: true,
  				type: "String"
  			},
  			{
  				name: "targetNamespace",
  				isAttr: true,
  				type: "String"
  			},
  			{
  				name: "expressionLanguage",
  				"default": "http://www.w3.org/1999/XPath",
  				isAttr: true,
  				type: "String"
  			},
  			{
  				name: "typeLanguage",
  				"default": "http://www.w3.org/2001/XMLSchema",
  				isAttr: true,
  				type: "String"
  			},
  			{
  				name: "imports",
  				type: "Import",
  				isMany: true
  			},
  			{
  				name: "extensions",
  				type: "Extension",
  				isMany: true
  			},
  			{
  				name: "rootElements",
  				type: "RootElement",
  				isMany: true
  			},
  			{
  				name: "diagrams",
  				isMany: true,
  				type: "bpmndi:BPMNDiagram"
  			},
  			{
  				name: "exporter",
  				isAttr: true,
  				type: "String"
  			},
  			{
  				name: "relationships",
  				type: "Relationship",
  				isMany: true
  			},
  			{
  				name: "exporterVersion",
  				isAttr: true,
  				type: "String"
  			}
  		]
  	}
  ];
  var enumerations = [
  	{
  		name: "ProcessType",
  		literalValues: [
  			{
  				name: "None"
  			},
  			{
  				name: "Public"
  			},
  			{
  				name: "Private"
  			}
  		]
  	},
  	{
  		name: "GatewayDirection",
  		literalValues: [
  			{
  				name: "Unspecified"
  			},
  			{
  				name: "Converging"
  			},
  			{
  				name: "Diverging"
  			},
  			{
  				name: "Mixed"
  			}
  		]
  	},
  	{
  		name: "EventBasedGatewayType",
  		literalValues: [
  			{
  				name: "Parallel"
  			},
  			{
  				name: "Exclusive"
  			}
  		]
  	},
  	{
  		name: "RelationshipDirection",
  		literalValues: [
  			{
  				name: "None"
  			},
  			{
  				name: "Forward"
  			},
  			{
  				name: "Backward"
  			},
  			{
  				name: "Both"
  			}
  		]
  	},
  	{
  		name: "ItemKind",
  		literalValues: [
  			{
  				name: "Physical"
  			},
  			{
  				name: "Information"
  			}
  		]
  	},
  	{
  		name: "ChoreographyLoopType",
  		literalValues: [
  			{
  				name: "None"
  			},
  			{
  				name: "Standard"
  			},
  			{
  				name: "MultiInstanceSequential"
  			},
  			{
  				name: "MultiInstanceParallel"
  			}
  		]
  	},
  	{
  		name: "AssociationDirection",
  		literalValues: [
  			{
  				name: "None"
  			},
  			{
  				name: "One"
  			},
  			{
  				name: "Both"
  			}
  		]
  	},
  	{
  		name: "MultiInstanceBehavior",
  		literalValues: [
  			{
  				name: "None"
  			},
  			{
  				name: "One"
  			},
  			{
  				name: "All"
  			},
  			{
  				name: "Complex"
  			}
  		]
  	},
  	{
  		name: "AdHocOrdering",
  		literalValues: [
  			{
  				name: "Parallel"
  			},
  			{
  				name: "Sequential"
  			}
  		]
  	}
  ];
  var prefix = "bpmn";
  var xml = {
  	tagAlias: "lowerCase",
  	typePrefix: "t"
  };
  var BpmnPackage = {
  	name: name,
  	uri: uri,
  	associations: associations,
  	types: types,
  	enumerations: enumerations,
  	prefix: prefix,
  	xml: xml
  };

  var name$1 = "BPMNDI";
  var uri$1 = "http://www.omg.org/spec/BPMN/20100524/DI";
  var types$1 = [
  	{
  		name: "BPMNDiagram",
  		properties: [
  			{
  				name: "plane",
  				type: "BPMNPlane",
  				redefines: "di:Diagram#rootElement"
  			},
  			{
  				name: "labelStyle",
  				type: "BPMNLabelStyle",
  				isMany: true
  			}
  		],
  		superClass: [
  			"di:Diagram"
  		]
  	},
  	{
  		name: "BPMNPlane",
  		properties: [
  			{
  				name: "bpmnElement",
  				isAttr: true,
  				isReference: true,
  				type: "bpmn:BaseElement",
  				redefines: "di:DiagramElement#modelElement"
  			}
  		],
  		superClass: [
  			"di:Plane"
  		]
  	},
  	{
  		name: "BPMNShape",
  		properties: [
  			{
  				name: "bpmnElement",
  				isAttr: true,
  				isReference: true,
  				type: "bpmn:BaseElement",
  				redefines: "di:DiagramElement#modelElement"
  			},
  			{
  				name: "isHorizontal",
  				isAttr: true,
  				type: "Boolean"
  			},
  			{
  				name: "isExpanded",
  				isAttr: true,
  				type: "Boolean"
  			},
  			{
  				name: "isMarkerVisible",
  				isAttr: true,
  				type: "Boolean"
  			},
  			{
  				name: "label",
  				type: "BPMNLabel"
  			},
  			{
  				name: "isMessageVisible",
  				isAttr: true,
  				type: "Boolean"
  			},
  			{
  				name: "participantBandKind",
  				type: "ParticipantBandKind",
  				isAttr: true
  			},
  			{
  				name: "choreographyActivityShape",
  				type: "BPMNShape",
  				isAttr: true,
  				isReference: true
  			}
  		],
  		superClass: [
  			"di:LabeledShape"
  		]
  	},
  	{
  		name: "BPMNEdge",
  		properties: [
  			{
  				name: "label",
  				type: "BPMNLabel"
  			},
  			{
  				name: "bpmnElement",
  				isAttr: true,
  				isReference: true,
  				type: "bpmn:BaseElement",
  				redefines: "di:DiagramElement#modelElement"
  			},
  			{
  				name: "sourceElement",
  				isAttr: true,
  				isReference: true,
  				type: "di:DiagramElement",
  				redefines: "di:Edge#source"
  			},
  			{
  				name: "targetElement",
  				isAttr: true,
  				isReference: true,
  				type: "di:DiagramElement",
  				redefines: "di:Edge#target"
  			},
  			{
  				name: "messageVisibleKind",
  				type: "MessageVisibleKind",
  				isAttr: true,
  				"default": "initiating"
  			}
  		],
  		superClass: [
  			"di:LabeledEdge"
  		]
  	},
  	{
  		name: "BPMNLabel",
  		properties: [
  			{
  				name: "labelStyle",
  				type: "BPMNLabelStyle",
  				isAttr: true,
  				isReference: true,
  				redefines: "di:DiagramElement#style"
  			}
  		],
  		superClass: [
  			"di:Label"
  		]
  	},
  	{
  		name: "BPMNLabelStyle",
  		properties: [
  			{
  				name: "font",
  				type: "dc:Font"
  			}
  		],
  		superClass: [
  			"di:Style"
  		]
  	}
  ];
  var enumerations$1 = [
  	{
  		name: "ParticipantBandKind",
  		literalValues: [
  			{
  				name: "top_initiating"
  			},
  			{
  				name: "middle_initiating"
  			},
  			{
  				name: "bottom_initiating"
  			},
  			{
  				name: "top_non_initiating"
  			},
  			{
  				name: "middle_non_initiating"
  			},
  			{
  				name: "bottom_non_initiating"
  			}
  		]
  	},
  	{
  		name: "MessageVisibleKind",
  		literalValues: [
  			{
  				name: "initiating"
  			},
  			{
  				name: "non_initiating"
  			}
  		]
  	}
  ];
  var associations$1 = [
  ];
  var prefix$1 = "bpmndi";
  var BpmnDiPackage = {
  	name: name$1,
  	uri: uri$1,
  	types: types$1,
  	enumerations: enumerations$1,
  	associations: associations$1,
  	prefix: prefix$1
  };

  var name$2 = "DC";
  var uri$2 = "http://www.omg.org/spec/DD/20100524/DC";
  var types$2 = [
  	{
  		name: "Boolean"
  	},
  	{
  		name: "Integer"
  	},
  	{
  		name: "Real"
  	},
  	{
  		name: "String"
  	},
  	{
  		name: "Font",
  		properties: [
  			{
  				name: "name",
  				type: "String",
  				isAttr: true
  			},
  			{
  				name: "size",
  				type: "Real",
  				isAttr: true
  			},
  			{
  				name: "isBold",
  				type: "Boolean",
  				isAttr: true
  			},
  			{
  				name: "isItalic",
  				type: "Boolean",
  				isAttr: true
  			},
  			{
  				name: "isUnderline",
  				type: "Boolean",
  				isAttr: true
  			},
  			{
  				name: "isStrikeThrough",
  				type: "Boolean",
  				isAttr: true
  			}
  		]
  	},
  	{
  		name: "Point",
  		properties: [
  			{
  				name: "x",
  				type: "Real",
  				"default": "0",
  				isAttr: true
  			},
  			{
  				name: "y",
  				type: "Real",
  				"default": "0",
  				isAttr: true
  			}
  		]
  	},
  	{
  		name: "Bounds",
  		properties: [
  			{
  				name: "x",
  				type: "Real",
  				"default": "0",
  				isAttr: true
  			},
  			{
  				name: "y",
  				type: "Real",
  				"default": "0",
  				isAttr: true
  			},
  			{
  				name: "width",
  				type: "Real",
  				isAttr: true
  			},
  			{
  				name: "height",
  				type: "Real",
  				isAttr: true
  			}
  		]
  	}
  ];
  var prefix$2 = "dc";
  var associations$2 = [
  ];
  var DcPackage = {
  	name: name$2,
  	uri: uri$2,
  	types: types$2,
  	prefix: prefix$2,
  	associations: associations$2
  };

  var name$3 = "DI";
  var uri$3 = "http://www.omg.org/spec/DD/20100524/DI";
  var types$3 = [
  	{
  		name: "DiagramElement",
  		isAbstract: true,
  		properties: [
  			{
  				name: "id",
  				type: "String",
  				isAttr: true,
  				isId: true
  			},
  			{
  				name: "extension",
  				type: "Extension"
  			},
  			{
  				name: "owningDiagram",
  				type: "Diagram",
  				isReadOnly: true,
  				isVirtual: true,
  				isReference: true
  			},
  			{
  				name: "owningElement",
  				type: "DiagramElement",
  				isReadOnly: true,
  				isVirtual: true,
  				isReference: true
  			},
  			{
  				name: "modelElement",
  				isReadOnly: true,
  				isVirtual: true,
  				isReference: true,
  				type: "Element"
  			},
  			{
  				name: "style",
  				type: "Style",
  				isReadOnly: true,
  				isVirtual: true,
  				isReference: true
  			},
  			{
  				name: "ownedElement",
  				type: "DiagramElement",
  				isReadOnly: true,
  				isVirtual: true,
  				isMany: true
  			}
  		]
  	},
  	{
  		name: "Node",
  		isAbstract: true,
  		superClass: [
  			"DiagramElement"
  		]
  	},
  	{
  		name: "Edge",
  		isAbstract: true,
  		superClass: [
  			"DiagramElement"
  		],
  		properties: [
  			{
  				name: "source",
  				type: "DiagramElement",
  				isReadOnly: true,
  				isVirtual: true,
  				isReference: true
  			},
  			{
  				name: "target",
  				type: "DiagramElement",
  				isReadOnly: true,
  				isVirtual: true,
  				isReference: true
  			},
  			{
  				name: "waypoint",
  				isUnique: false,
  				isMany: true,
  				type: "dc:Point",
  				xml: {
  					serialize: "xsi:type"
  				}
  			}
  		]
  	},
  	{
  		name: "Diagram",
  		isAbstract: true,
  		properties: [
  			{
  				name: "id",
  				type: "String",
  				isAttr: true,
  				isId: true
  			},
  			{
  				name: "rootElement",
  				type: "DiagramElement",
  				isReadOnly: true,
  				isVirtual: true
  			},
  			{
  				name: "name",
  				isAttr: true,
  				type: "String"
  			},
  			{
  				name: "documentation",
  				isAttr: true,
  				type: "String"
  			},
  			{
  				name: "resolution",
  				isAttr: true,
  				type: "Real"
  			},
  			{
  				name: "ownedStyle",
  				type: "Style",
  				isReadOnly: true,
  				isVirtual: true,
  				isMany: true
  			}
  		]
  	},
  	{
  		name: "Shape",
  		isAbstract: true,
  		superClass: [
  			"Node"
  		],
  		properties: [
  			{
  				name: "bounds",
  				type: "dc:Bounds"
  			}
  		]
  	},
  	{
  		name: "Plane",
  		isAbstract: true,
  		superClass: [
  			"Node"
  		],
  		properties: [
  			{
  				name: "planeElement",
  				type: "DiagramElement",
  				subsettedProperty: "DiagramElement-ownedElement",
  				isMany: true
  			}
  		]
  	},
  	{
  		name: "LabeledEdge",
  		isAbstract: true,
  		superClass: [
  			"Edge"
  		],
  		properties: [
  			{
  				name: "ownedLabel",
  				type: "Label",
  				isReadOnly: true,
  				subsettedProperty: "DiagramElement-ownedElement",
  				isVirtual: true,
  				isMany: true
  			}
  		]
  	},
  	{
  		name: "LabeledShape",
  		isAbstract: true,
  		superClass: [
  			"Shape"
  		],
  		properties: [
  			{
  				name: "ownedLabel",
  				type: "Label",
  				isReadOnly: true,
  				subsettedProperty: "DiagramElement-ownedElement",
  				isVirtual: true,
  				isMany: true
  			}
  		]
  	},
  	{
  		name: "Label",
  		isAbstract: true,
  		superClass: [
  			"Node"
  		],
  		properties: [
  			{
  				name: "bounds",
  				type: "dc:Bounds"
  			}
  		]
  	},
  	{
  		name: "Style",
  		isAbstract: true,
  		properties: [
  			{
  				name: "id",
  				type: "String",
  				isAttr: true,
  				isId: true
  			}
  		]
  	},
  	{
  		name: "Extension",
  		properties: [
  			{
  				name: "values",
  				type: "Element",
  				isMany: true
  			}
  		]
  	}
  ];
  var associations$3 = [
  ];
  var prefix$3 = "di";
  var xml$1 = {
  	tagAlias: "lowerCase"
  };
  var DiPackage = {
  	name: name$3,
  	uri: uri$3,
  	types: types$3,
  	associations: associations$3,
  	prefix: prefix$3,
  	xml: xml$1
  };

  var name$4 = "bpmn.io colors for BPMN";
  var uri$4 = "http://bpmn.io/schema/bpmn/biocolor/1.0";
  var prefix$4 = "bioc";
  var types$4 = [
  	{
  		name: "ColoredShape",
  		"extends": [
  			"bpmndi:BPMNShape"
  		],
  		properties: [
  			{
  				name: "stroke",
  				isAttr: true,
  				type: "String"
  			},
  			{
  				name: "fill",
  				isAttr: true,
  				type: "String"
  			}
  		]
  	},
  	{
  		name: "ColoredEdge",
  		"extends": [
  			"bpmndi:BPMNEdge"
  		],
  		properties: [
  			{
  				name: "stroke",
  				isAttr: true,
  				type: "String"
  			},
  			{
  				name: "fill",
  				isAttr: true,
  				type: "String"
  			}
  		]
  	}
  ];
  var enumerations$2 = [
  ];
  var associations$4 = [
  ];
  var BiocPackage = {
  	name: name$4,
  	uri: uri$4,
  	prefix: prefix$4,
  	types: types$4,
  	enumerations: enumerations$2,
  	associations: associations$4
  };

  var packages = {
    bpmn: BpmnPackage,
    bpmndi: BpmnDiPackage,
    dc: DcPackage,
    di: DiPackage,
    bioc: BiocPackage
  };

  function simple(additionalPackages, options) {
    var pks = assign({}, packages, additionalPackages);

    return new BpmnModdle(pks, options);
  }

  var index_esm = /*#__PURE__*/Object.freeze({
    __proto__: null,
    'default': simple
  });

  function unwrapExports (x) {
  	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
  }

  function createCommonjsModule(fn, module) {
  	return module = { exports: {} }, fn(module, module.exports), module.exports;
  }

  function getCjsExportFromNamespace (n) {
  	return n && n['default'] || n;
  }

  /**
   * Helpers.
   */

  var s = 1000;
  var m = s * 60;
  var h = m * 60;
  var d = h * 24;
  var w = d * 7;
  var y = d * 365.25;

  /**
   * Parse or format the given `val`.
   *
   * Options:
   *
   *  - `long` verbose formatting [false]
   *
   * @param {String|Number} val
   * @param {Object} [options]
   * @throws {Error} throw an error if val is not a non-empty string or a number
   * @return {String|Number}
   * @api public
   */

  var ms = function(val, options) {
    options = options || {};
    var type = typeof val;
    if (type === 'string' && val.length > 0) {
      return parse(val);
    } else if (type === 'number' && isFinite(val)) {
      return options.long ? fmtLong(val) : fmtShort(val);
    }
    throw new Error(
      'val is not a non-empty string or a valid number. val=' +
        JSON.stringify(val)
    );
  };

  /**
   * Parse the given `str` and return milliseconds.
   *
   * @param {String} str
   * @return {Number}
   * @api private
   */

  function parse(str) {
    str = String(str);
    if (str.length > 100) {
      return;
    }
    var match = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
      str
    );
    if (!match) {
      return;
    }
    var n = parseFloat(match[1]);
    var type = (match[2] || 'ms').toLowerCase();
    switch (type) {
      case 'years':
      case 'year':
      case 'yrs':
      case 'yr':
      case 'y':
        return n * y;
      case 'weeks':
      case 'week':
      case 'w':
        return n * w;
      case 'days':
      case 'day':
      case 'd':
        return n * d;
      case 'hours':
      case 'hour':
      case 'hrs':
      case 'hr':
      case 'h':
        return n * h;
      case 'minutes':
      case 'minute':
      case 'mins':
      case 'min':
      case 'm':
        return n * m;
      case 'seconds':
      case 'second':
      case 'secs':
      case 'sec':
      case 's':
        return n * s;
      case 'milliseconds':
      case 'millisecond':
      case 'msecs':
      case 'msec':
      case 'ms':
        return n;
      default:
        return undefined;
    }
  }

  /**
   * Short format for `ms`.
   *
   * @param {Number} ms
   * @return {String}
   * @api private
   */

  function fmtShort(ms) {
    var msAbs = Math.abs(ms);
    if (msAbs >= d) {
      return Math.round(ms / d) + 'd';
    }
    if (msAbs >= h) {
      return Math.round(ms / h) + 'h';
    }
    if (msAbs >= m) {
      return Math.round(ms / m) + 'm';
    }
    if (msAbs >= s) {
      return Math.round(ms / s) + 's';
    }
    return ms + 'ms';
  }

  /**
   * Long format for `ms`.
   *
   * @param {Number} ms
   * @return {String}
   * @api private
   */

  function fmtLong(ms) {
    var msAbs = Math.abs(ms);
    if (msAbs >= d) {
      return plural(ms, msAbs, d, 'day');
    }
    if (msAbs >= h) {
      return plural(ms, msAbs, h, 'hour');
    }
    if (msAbs >= m) {
      return plural(ms, msAbs, m, 'minute');
    }
    if (msAbs >= s) {
      return plural(ms, msAbs, s, 'second');
    }
    return ms + ' ms';
  }

  /**
   * Pluralization helper.
   */

  function plural(ms, msAbs, n, name) {
    var isPlural = msAbs >= n * 1.5;
    return Math.round(ms / n) + ' ' + name + (isPlural ? 's' : '');
  }

  /**
   * This is the common logic for both the Node.js and web browser
   * implementations of `debug()`.
   */

  function setup(env) {
  	createDebug.debug = createDebug;
  	createDebug.default = createDebug;
  	createDebug.coerce = coerce;
  	createDebug.disable = disable;
  	createDebug.enable = enable;
  	createDebug.enabled = enabled;
  	createDebug.humanize = ms;

  	Object.keys(env).forEach(key => {
  		createDebug[key] = env[key];
  	});

  	/**
  	* Active `debug` instances.
  	*/
  	createDebug.instances = [];

  	/**
  	* The currently active debug mode names, and names to skip.
  	*/

  	createDebug.names = [];
  	createDebug.skips = [];

  	/**
  	* Map of special "%n" handling functions, for the debug "format" argument.
  	*
  	* Valid key names are a single, lower or upper-case letter, i.e. "n" and "N".
  	*/
  	createDebug.formatters = {};

  	/**
  	* Selects a color for a debug namespace
  	* @param {String} namespace The namespace string for the for the debug instance to be colored
  	* @return {Number|String} An ANSI color code for the given namespace
  	* @api private
  	*/
  	function selectColor(namespace) {
  		let hash = 0;

  		for (let i = 0; i < namespace.length; i++) {
  			hash = ((hash << 5) - hash) + namespace.charCodeAt(i);
  			hash |= 0; // Convert to 32bit integer
  		}

  		return createDebug.colors[Math.abs(hash) % createDebug.colors.length];
  	}
  	createDebug.selectColor = selectColor;

  	/**
  	* Create a debugger with the given `namespace`.
  	*
  	* @param {String} namespace
  	* @return {Function}
  	* @api public
  	*/
  	function createDebug(namespace) {
  		let prevTime;

  		function debug(...args) {
  			// Disabled?
  			if (!debug.enabled) {
  				return;
  			}

  			const self = debug;

  			// Set `diff` timestamp
  			const curr = Number(new Date());
  			const ms = curr - (prevTime || curr);
  			self.diff = ms;
  			self.prev = prevTime;
  			self.curr = curr;
  			prevTime = curr;

  			args[0] = createDebug.coerce(args[0]);

  			if (typeof args[0] !== 'string') {
  				// Anything else let's inspect with %O
  				args.unshift('%O');
  			}

  			// Apply any `formatters` transformations
  			let index = 0;
  			args[0] = args[0].replace(/%([a-zA-Z%])/g, (match, format) => {
  				// If we encounter an escaped % then don't increase the array index
  				if (match === '%%') {
  					return match;
  				}
  				index++;
  				const formatter = createDebug.formatters[format];
  				if (typeof formatter === 'function') {
  					const val = args[index];
  					match = formatter.call(self, val);

  					// Now we need to remove `args[index]` since it's inlined in the `format`
  					args.splice(index, 1);
  					index--;
  				}
  				return match;
  			});

  			// Apply env-specific formatting (colors, etc.)
  			createDebug.formatArgs.call(self, args);

  			const logFn = self.log || createDebug.log;
  			logFn.apply(self, args);
  		}

  		debug.namespace = namespace;
  		debug.enabled = createDebug.enabled(namespace);
  		debug.useColors = createDebug.useColors();
  		debug.color = selectColor(namespace);
  		debug.destroy = destroy;
  		debug.extend = extend;
  		// Debug.formatArgs = formatArgs;
  		// debug.rawLog = rawLog;

  		// env-specific initialization logic for debug instances
  		if (typeof createDebug.init === 'function') {
  			createDebug.init(debug);
  		}

  		createDebug.instances.push(debug);

  		return debug;
  	}

  	function destroy() {
  		const index = createDebug.instances.indexOf(this);
  		if (index !== -1) {
  			createDebug.instances.splice(index, 1);
  			return true;
  		}
  		return false;
  	}

  	function extend(namespace, delimiter) {
  		const newDebug = createDebug(this.namespace + (typeof delimiter === 'undefined' ? ':' : delimiter) + namespace);
  		newDebug.log = this.log;
  		return newDebug;
  	}

  	/**
  	* Enables a debug mode by namespaces. This can include modes
  	* separated by a colon and wildcards.
  	*
  	* @param {String} namespaces
  	* @api public
  	*/
  	function enable(namespaces) {
  		createDebug.save(namespaces);

  		createDebug.names = [];
  		createDebug.skips = [];

  		let i;
  		const split = (typeof namespaces === 'string' ? namespaces : '').split(/[\s,]+/);
  		const len = split.length;

  		for (i = 0; i < len; i++) {
  			if (!split[i]) {
  				// ignore empty strings
  				continue;
  			}

  			namespaces = split[i].replace(/\*/g, '.*?');

  			if (namespaces[0] === '-') {
  				createDebug.skips.push(new RegExp('^' + namespaces.substr(1) + '$'));
  			} else {
  				createDebug.names.push(new RegExp('^' + namespaces + '$'));
  			}
  		}

  		for (i = 0; i < createDebug.instances.length; i++) {
  			const instance = createDebug.instances[i];
  			instance.enabled = createDebug.enabled(instance.namespace);
  		}
  	}

  	/**
  	* Disable debug output.
  	*
  	* @return {String} namespaces
  	* @api public
  	*/
  	function disable() {
  		const namespaces = [
  			...createDebug.names.map(toNamespace),
  			...createDebug.skips.map(toNamespace).map(namespace => '-' + namespace)
  		].join(',');
  		createDebug.enable('');
  		return namespaces;
  	}

  	/**
  	* Returns true if the given mode name is enabled, false otherwise.
  	*
  	* @param {String} name
  	* @return {Boolean}
  	* @api public
  	*/
  	function enabled(name) {
  		if (name[name.length - 1] === '*') {
  			return true;
  		}

  		let i;
  		let len;

  		for (i = 0, len = createDebug.skips.length; i < len; i++) {
  			if (createDebug.skips[i].test(name)) {
  				return false;
  			}
  		}

  		for (i = 0, len = createDebug.names.length; i < len; i++) {
  			if (createDebug.names[i].test(name)) {
  				return true;
  			}
  		}

  		return false;
  	}

  	/**
  	* Convert regexp to namespace
  	*
  	* @param {RegExp} regxep
  	* @return {String} namespace
  	* @api private
  	*/
  	function toNamespace(regexp) {
  		return regexp.toString()
  			.substring(2, regexp.toString().length - 2)
  			.replace(/\.\*\?$/, '*');
  	}

  	/**
  	* Coerce `val`.
  	*
  	* @param {Mixed} val
  	* @return {Mixed}
  	* @api private
  	*/
  	function coerce(val) {
  		if (val instanceof Error) {
  			return val.stack || val.message;
  		}
  		return val;
  	}

  	createDebug.enable(createDebug.load());

  	return createDebug;
  }

  var common = setup;

  var browser = createCommonjsModule(function (module, exports) {
  /* eslint-env browser */

  /**
   * This is the web browser implementation of `debug()`.
   */

  exports.log = log;
  exports.formatArgs = formatArgs;
  exports.save = save;
  exports.load = load;
  exports.useColors = useColors;
  exports.storage = localstorage();

  /**
   * Colors.
   */

  exports.colors = [
  	'#0000CC',
  	'#0000FF',
  	'#0033CC',
  	'#0033FF',
  	'#0066CC',
  	'#0066FF',
  	'#0099CC',
  	'#0099FF',
  	'#00CC00',
  	'#00CC33',
  	'#00CC66',
  	'#00CC99',
  	'#00CCCC',
  	'#00CCFF',
  	'#3300CC',
  	'#3300FF',
  	'#3333CC',
  	'#3333FF',
  	'#3366CC',
  	'#3366FF',
  	'#3399CC',
  	'#3399FF',
  	'#33CC00',
  	'#33CC33',
  	'#33CC66',
  	'#33CC99',
  	'#33CCCC',
  	'#33CCFF',
  	'#6600CC',
  	'#6600FF',
  	'#6633CC',
  	'#6633FF',
  	'#66CC00',
  	'#66CC33',
  	'#9900CC',
  	'#9900FF',
  	'#9933CC',
  	'#9933FF',
  	'#99CC00',
  	'#99CC33',
  	'#CC0000',
  	'#CC0033',
  	'#CC0066',
  	'#CC0099',
  	'#CC00CC',
  	'#CC00FF',
  	'#CC3300',
  	'#CC3333',
  	'#CC3366',
  	'#CC3399',
  	'#CC33CC',
  	'#CC33FF',
  	'#CC6600',
  	'#CC6633',
  	'#CC9900',
  	'#CC9933',
  	'#CCCC00',
  	'#CCCC33',
  	'#FF0000',
  	'#FF0033',
  	'#FF0066',
  	'#FF0099',
  	'#FF00CC',
  	'#FF00FF',
  	'#FF3300',
  	'#FF3333',
  	'#FF3366',
  	'#FF3399',
  	'#FF33CC',
  	'#FF33FF',
  	'#FF6600',
  	'#FF6633',
  	'#FF9900',
  	'#FF9933',
  	'#FFCC00',
  	'#FFCC33'
  ];

  /**
   * Currently only WebKit-based Web Inspectors, Firefox >= v31,
   * and the Firebug extension (any Firefox version) are known
   * to support "%c" CSS customizations.
   *
   * TODO: add a `localStorage` variable to explicitly enable/disable colors
   */

  // eslint-disable-next-line complexity
  function useColors() {
  	// NB: In an Electron preload script, document will be defined but not fully
  	// initialized. Since we know we're in Chrome, we'll just detect this case
  	// explicitly
  	if (typeof window !== 'undefined' && window.process && (window.process.type === 'renderer' || window.process.__nwjs)) {
  		return true;
  	}

  	// Internet Explorer and Edge do not support colors.
  	if (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
  		return false;
  	}

  	// Is webkit? http://stackoverflow.com/a/16459606/376773
  	// document is undefined in react-native: https://github.com/facebook/react-native/pull/1632
  	return (typeof document !== 'undefined' && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance) ||
  		// Is firebug? http://stackoverflow.com/a/398120/376773
  		(typeof window !== 'undefined' && window.console && (window.console.firebug || (window.console.exception && window.console.table))) ||
  		// Is firefox >= v31?
  		// https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
  		(typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31) ||
  		// Double check webkit in userAgent just in case we are in a worker
  		(typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/));
  }

  /**
   * Colorize log arguments if enabled.
   *
   * @api public
   */

  function formatArgs(args) {
  	args[0] = (this.useColors ? '%c' : '') +
  		this.namespace +
  		(this.useColors ? ' %c' : ' ') +
  		args[0] +
  		(this.useColors ? '%c ' : ' ') +
  		'+' + module.exports.humanize(this.diff);

  	if (!this.useColors) {
  		return;
  	}

  	const c = 'color: ' + this.color;
  	args.splice(1, 0, c, 'color: inherit');

  	// The final "%c" is somewhat tricky, because there could be other
  	// arguments passed either before or after the %c, so we need to
  	// figure out the correct index to insert the CSS into
  	let index = 0;
  	let lastC = 0;
  	args[0].replace(/%[a-zA-Z%]/g, match => {
  		if (match === '%%') {
  			return;
  		}
  		index++;
  		if (match === '%c') {
  			// We only are interested in the *last* %c
  			// (the user may have provided their own)
  			lastC = index;
  		}
  	});

  	args.splice(lastC, 0, c);
  }

  /**
   * Invokes `console.log()` when available.
   * No-op when `console.log` is not a "function".
   *
   * @api public
   */
  function log(...args) {
  	// This hackery is required for IE8/9, where
  	// the `console.log` function doesn't have 'apply'
  	return typeof console === 'object' &&
  		console.log &&
  		console.log(...args);
  }

  /**
   * Save `namespaces`.
   *
   * @param {String} namespaces
   * @api private
   */
  function save(namespaces) {
  	try {
  		if (namespaces) {
  			exports.storage.setItem('debug', namespaces);
  		} else {
  			exports.storage.removeItem('debug');
  		}
  	} catch (error) {
  		// Swallow
  		// XXX (@Qix-) should we be logging these?
  	}
  }

  /**
   * Load `namespaces`.
   *
   * @return {String} returns the previously persisted debug modes
   * @api private
   */
  function load() {
  	let r;
  	try {
  		r = exports.storage.getItem('debug');
  	} catch (error) {
  		// Swallow
  		// XXX (@Qix-) should we be logging these?
  	}

  	// If debug isn't set in LS, and we're in Electron, try to load $DEBUG
  	if (!r && typeof process !== 'undefined' && 'env' in process) {
  		r = process.env.DEBUG;
  	}

  	return r;
  }

  /**
   * Localstorage attempts to return the localstorage.
   *
   * This is necessary because safari throws
   * when a user disables cookies/localstorage
   * and you attempt to access it.
   *
   * @return {LocalStorage}
   * @api private
   */

  function localstorage() {
  	try {
  		// TVMLKit (Apple TV JS Runtime) does not have a window object, just localStorage in the global context
  		// The Browser also has localStorage in the global context.
  		return localStorage;
  	} catch (error) {
  		// Swallow
  		// XXX (@Qix-) should we be logging these?
  	}
  }

  module.exports = common(exports);

  const {formatters} = module.exports;

  /**
   * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
   */

  formatters.j = function (v) {
  	try {
  		return JSON.stringify(v);
  	} catch (error) {
  		return '[UnexpectedJSONParseError]: ' + error.message;
  	}
  };
  });
  var browser_1 = browser.log;
  var browser_2 = browser.formatArgs;
  var browser_3 = browser.save;
  var browser_4 = browser.load;
  var browser_5 = browser.useColors;
  var browser_6 = browser.storage;
  var browser_7 = browser.colors;

  var hasFlag = (flag, argv) => {
  	argv = argv || process.argv;
  	const prefix = flag.startsWith('-') ? '' : (flag.length === 1 ? '-' : '--');
  	const pos = argv.indexOf(prefix + flag);
  	const terminatorPos = argv.indexOf('--');
  	return pos !== -1 && (terminatorPos === -1 ? true : pos < terminatorPos);
  };

  const env = process.env;

  let forceColor;
  if (hasFlag('no-color') ||
  	hasFlag('no-colors') ||
  	hasFlag('color=false')) {
  	forceColor = false;
  } else if (hasFlag('color') ||
  	hasFlag('colors') ||
  	hasFlag('color=true') ||
  	hasFlag('color=always')) {
  	forceColor = true;
  }
  if ('FORCE_COLOR' in env) {
  	forceColor = env.FORCE_COLOR.length === 0 || parseInt(env.FORCE_COLOR, 10) !== 0;
  }

  function translateLevel(level) {
  	if (level === 0) {
  		return false;
  	}

  	return {
  		level,
  		hasBasic: true,
  		has256: level >= 2,
  		has16m: level >= 3
  	};
  }

  function supportsColor(stream) {
  	if (forceColor === false) {
  		return 0;
  	}

  	if (hasFlag('color=16m') ||
  		hasFlag('color=full') ||
  		hasFlag('color=truecolor')) {
  		return 3;
  	}

  	if (hasFlag('color=256')) {
  		return 2;
  	}

  	if (stream && !stream.isTTY && forceColor !== true) {
  		return 0;
  	}

  	const min = forceColor ? 1 : 0;

  	if (process.platform === 'win32') {
  		// Node.js 7.5.0 is the first version of Node.js to include a patch to
  		// libuv that enables 256 color output on Windows. Anything earlier and it
  		// won't work. However, here we target Node.js 8 at minimum as it is an LTS
  		// release, and Node.js 7 is not. Windows 10 build 10586 is the first Windows
  		// release that supports 256 colors. Windows 10 build 14931 is the first release
  		// that supports 16m/TrueColor.
  		const osRelease = os.release().split('.');
  		if (
  			Number(process.versions.node.split('.')[0]) >= 8 &&
  			Number(osRelease[0]) >= 10 &&
  			Number(osRelease[2]) >= 10586
  		) {
  			return Number(osRelease[2]) >= 14931 ? 3 : 2;
  		}

  		return 1;
  	}

  	if ('CI' in env) {
  		if (['TRAVIS', 'CIRCLECI', 'APPVEYOR', 'GITLAB_CI'].some(sign => sign in env) || env.CI_NAME === 'codeship') {
  			return 1;
  		}

  		return min;
  	}

  	if ('TEAMCITY_VERSION' in env) {
  		return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(env.TEAMCITY_VERSION) ? 1 : 0;
  	}

  	if (env.COLORTERM === 'truecolor') {
  		return 3;
  	}

  	if ('TERM_PROGRAM' in env) {
  		const version = parseInt((env.TERM_PROGRAM_VERSION || '').split('.')[0], 10);

  		switch (env.TERM_PROGRAM) {
  			case 'iTerm.app':
  				return version >= 3 ? 3 : 2;
  			case 'Apple_Terminal':
  				return 2;
  			// No default
  		}
  	}

  	if (/-256(color)?$/i.test(env.TERM)) {
  		return 2;
  	}

  	if (/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(env.TERM)) {
  		return 1;
  	}

  	if ('COLORTERM' in env) {
  		return 1;
  	}

  	if (env.TERM === 'dumb') {
  		return min;
  	}

  	return min;
  }

  function getSupportLevel(stream) {
  	const level = supportsColor(stream);
  	return translateLevel(level);
  }

  var supportsColor_1 = {
  	supportsColor: getSupportLevel,
  	stdout: getSupportLevel(process.stdout),
  	stderr: getSupportLevel(process.stderr)
  };

  var node = createCommonjsModule(function (module, exports) {
  /**
   * Module dependencies.
   */




  /**
   * This is the Node.js implementation of `debug()`.
   */

  exports.init = init;
  exports.log = log;
  exports.formatArgs = formatArgs;
  exports.save = save;
  exports.load = load;
  exports.useColors = useColors;

  /**
   * Colors.
   */

  exports.colors = [6, 2, 3, 4, 5, 1];

  try {
  	// Optional dependency (as in, doesn't need to be installed, NOT like optionalDependencies in package.json)
  	// eslint-disable-next-line import/no-extraneous-dependencies
  	const supportsColor = supportsColor_1;

  	if (supportsColor && (supportsColor.stderr || supportsColor).level >= 2) {
  		exports.colors = [
  			20,
  			21,
  			26,
  			27,
  			32,
  			33,
  			38,
  			39,
  			40,
  			41,
  			42,
  			43,
  			44,
  			45,
  			56,
  			57,
  			62,
  			63,
  			68,
  			69,
  			74,
  			75,
  			76,
  			77,
  			78,
  			79,
  			80,
  			81,
  			92,
  			93,
  			98,
  			99,
  			112,
  			113,
  			128,
  			129,
  			134,
  			135,
  			148,
  			149,
  			160,
  			161,
  			162,
  			163,
  			164,
  			165,
  			166,
  			167,
  			168,
  			169,
  			170,
  			171,
  			172,
  			173,
  			178,
  			179,
  			184,
  			185,
  			196,
  			197,
  			198,
  			199,
  			200,
  			201,
  			202,
  			203,
  			204,
  			205,
  			206,
  			207,
  			208,
  			209,
  			214,
  			215,
  			220,
  			221
  		];
  	}
  } catch (error) {
  	// Swallow - we only care if `supports-color` is available; it doesn't have to be.
  }

  /**
   * Build up the default `inspectOpts` object from the environment variables.
   *
   *   $ DEBUG_COLORS=no DEBUG_DEPTH=10 DEBUG_SHOW_HIDDEN=enabled node script.js
   */

  exports.inspectOpts = Object.keys(process.env).filter(key => {
  	return /^debug_/i.test(key);
  }).reduce((obj, key) => {
  	// Camel-case
  	const prop = key
  		.substring(6)
  		.toLowerCase()
  		.replace(/_([a-z])/g, (_, k) => {
  			return k.toUpperCase();
  		});

  	// Coerce string value into JS value
  	let val = process.env[key];
  	if (/^(yes|on|true|enabled)$/i.test(val)) {
  		val = true;
  	} else if (/^(no|off|false|disabled)$/i.test(val)) {
  		val = false;
  	} else if (val === 'null') {
  		val = null;
  	} else {
  		val = Number(val);
  	}

  	obj[prop] = val;
  	return obj;
  }, {});

  /**
   * Is stdout a TTY? Colored output is enabled when `true`.
   */

  function useColors() {
  	return 'colors' in exports.inspectOpts ?
  		Boolean(exports.inspectOpts.colors) :
  		tty.isatty(process.stderr.fd);
  }

  /**
   * Adds ANSI color escape codes if enabled.
   *
   * @api public
   */

  function formatArgs(args) {
  	const {namespace: name, useColors} = this;

  	if (useColors) {
  		const c = this.color;
  		const colorCode = '\u001B[3' + (c < 8 ? c : '8;5;' + c);
  		const prefix = `  ${colorCode};1m${name} \u001B[0m`;

  		args[0] = prefix + args[0].split('\n').join('\n' + prefix);
  		args.push(colorCode + 'm+' + module.exports.humanize(this.diff) + '\u001B[0m');
  	} else {
  		args[0] = getDate() + name + ' ' + args[0];
  	}
  }

  function getDate() {
  	if (exports.inspectOpts.hideDate) {
  		return '';
  	}
  	return new Date().toISOString() + ' ';
  }

  /**
   * Invokes `util.format()` with the specified arguments and writes to stderr.
   */

  function log(...args) {
  	return process.stderr.write(util.format(...args) + '\n');
  }

  /**
   * Save `namespaces`.
   *
   * @param {String} namespaces
   * @api private
   */
  function save(namespaces) {
  	if (namespaces) {
  		process.env.DEBUG = namespaces;
  	} else {
  		// If you set a process.env field to null or undefined, it gets cast to the
  		// string 'null' or 'undefined'. Just delete instead.
  		delete process.env.DEBUG;
  	}
  }

  /**
   * Load `namespaces`.
   *
   * @return {String} returns the previously persisted debug modes
   * @api private
   */

  function load() {
  	return process.env.DEBUG;
  }

  /**
   * Init logic for `debug` instances.
   *
   * Create a new `inspectOpts` object in case `useColors` is set
   * differently for a particular `debug` instance.
   */

  function init(debug) {
  	debug.inspectOpts = {};

  	const keys = Object.keys(exports.inspectOpts);
  	for (let i = 0; i < keys.length; i++) {
  		debug.inspectOpts[keys[i]] = exports.inspectOpts[keys[i]];
  	}
  }

  module.exports = common(exports);

  const {formatters} = module.exports;

  /**
   * Map %o to `util.inspect()`, all on a single line.
   */

  formatters.o = function (v) {
  	this.inspectOpts.colors = this.useColors;
  	return util.inspect(v, this.inspectOpts)
  		.replace(/\s*\n\s*/g, ' ');
  };

  /**
   * Map %O to `util.inspect()`, allowing multiple lines if needed.
   */

  formatters.O = function (v) {
  	this.inspectOpts.colors = this.useColors;
  	return util.inspect(v, this.inspectOpts);
  };
  });
  var node_1 = node.init;
  var node_2 = node.log;
  var node_3 = node.formatArgs;
  var node_4 = node.save;
  var node_5 = node.load;
  var node_6 = node.useColors;
  var node_7 = node.colors;
  var node_8 = node.inspectOpts;

  var src = createCommonjsModule(function (module) {
  /**
   * Detect Electron renderer / nwjs process, which is node, but we should
   * treat as a browser.
   */

  if (typeof process === 'undefined' || process.type === 'renderer' || process.browser === true || process.__nwjs) {
  	module.exports = browser;
  } else {
  	module.exports = node;
  }
  });

  var Logger = function Logger(scope) {
    return {
      debug: src('bpmn-engine:' + scope),
      error: src('bpmn-engine:error:' + scope),
      warn: src('bpmn-engine:warn:' + scope),
    };
  };

  function cloneContent(content, extend) {
    const {discardSequence, inbound, outbound, parent, sequence} = content;

    const clone = {
      ...content,
      ...extend,
    };

    if (parent) {
      clone.parent = cloneParent(parent);
    }
    if (discardSequence) {
      clone.discardSequence = discardSequence.slice();
    }
    if (inbound) {
      clone.inbound = inbound.map((c) => cloneContent(c));
    }
    if (outbound) {
      clone.outbound = outbound.map((c) => cloneContent(c));
    }
    if (sequence) {
      clone.sequence = sequence.map((c) => cloneContent(c));
    }

    return clone;
  }

  function cloneMessage(message, overrideContent) {
    return {
      fields: {...message.fields},
      content: cloneContent(message.content, overrideContent),
      properties: {...message.properties},
    };
  }

  function cloneParent(parent) {
    const {path} = parent;
    const clone = {...parent};
    if (!path) return clone;

    clone.path = path.map((p) => {
      return {...p};
    });

    return clone;
  }

  function unshiftParent(parent, adoptingParent) {
    const {id, type, executionId} = adoptingParent;
    if (!parent) {
      return {
        id,
        type,
        executionId,
      };
    }

    const clone = cloneParent(parent);
    const {id: parentId, type: parentType, executionId: parentExecutionId} = parent;
    clone.id = id;
    clone.executionId = executionId;
    clone.type = type;

    const path = clone.path = clone.path || [];
    path.unshift({id: parentId, type: parentType, executionId: parentExecutionId});

    return clone;
  }

  function shiftParent(parent) {
    if (!parent) return;
    if (!parent.path || !parent.path.length) return;

    const clone = cloneParent(parent);
    const {id, executionId, type} = clone.path.shift();
    clone.id = id;
    clone.executionId = executionId;
    clone.type = type;
    clone.path = clone.path.length ? clone.path : undefined;
    return clone;
  }

  function pushParent(parent, ancestor) {
    const {id, type, executionId} = ancestor;
    if (!parent) return {id, type, executionId};

    const clone = cloneParent(parent);
    if (clone.id === id) {
      if (executionId) clone.executionId = executionId;
      return clone;
    }
    const path = clone.path = clone.path || [];

    for (const p of path) {
      if (p.id === id) {
        if (executionId) p.executionId = executionId;
        return clone;
      }
    }

    path.push({id, type, executionId});
    return clone;
  }

  function ActivityApi(broker, apiMessage, environment) {
    return Api('activity', broker, apiMessage, environment);
  }

  function DefinitionApi(broker, apiMessage, environment) {
    return Api('definition', broker, apiMessage, environment);
  }

  function ProcessApi(broker, apiMessage, environment) {
    return Api('process', broker, apiMessage, environment);
  }

  function FlowApi(broker, apiMessage, environment) {
    return Api('flow', broker, apiMessage, environment);
  }

  function Api(pfx, broker, sourceMessage, environment) {
    if (!sourceMessage) throw new Error('Api requires message');

    const apiMessage = cloneMessage(sourceMessage);
    const apiContent = apiMessage.content;
    const executionId = apiContent.executionId;
    const owner = broker.owner;
    environment = environment || broker.owner.environment;

    return {
      id: apiContent.id,
      type: apiContent.type,
      name: apiContent.name,
      executionId,
      environment,
      fields: apiMessage.fields,
      content: apiContent,
      messageProperties: apiMessage.properties,
      get owner() {
        return owner;
      },
      cancel() {
        sendApiMessage('cancel');
      },
      discard() {
        sendApiMessage('discard');
      },
      signal(message, options) {
        sendApiMessage('signal', {message}, options);
      },
      stop() {
        sendApiMessage('stop');
      },
      resolveExpression(expression) {
        return environment.resolveExpression(expression, apiMessage, broker.owner);
      },
      sendApiMessage,
      createMessage,
      getPostponed,
    };

    function sendApiMessage(action, content, options = {}) {
      let key = `${pfx}.${action}`;
      if (executionId) key += `.${executionId}`;
      broker.publish('api', key, createMessage(content), {...options, type: action});
    }

    function getPostponed(...args) {
      if (owner.getPostponed) return owner.getPostponed(...args);
      if (owner.isSubProcess && owner.execution) return owner.execution.getPostponed(...args);
      return [];
    }

    function createMessage(content = {}) {
      return {
        ...apiContent,
        ...content,
      };
    }
  }

  function ActivityExecution(activity, context) {
    const {id, broker, logger, isSubProcess, Behaviour} = activity;
    const postponed = [];

    let source, initMessage, completed = false, executionId;

    const executeQ = broker.assertQueue('execute-q', {durable: true, autoDelete: false});

    const executionApi = {
      get completed() {
        return completed;
      },
      get source() {
        return source;
      },
      discard,
      execute,
      getApi,
      getPostponed,
      getState,
      recover,
      stop,
    };

    return executionApi;

    function getPostponed() {
      let apis = postponed.map((msg) => getApi(msg));
      if (!isSubProcess || !source) return apis;
      apis = apis.concat(source.getPostponed());
      return apis;
    }

    function execute(executeMessage) {
      if (!executeMessage) throw new Error('Execution requires message');
      if (!executeMessage.content || !executeMessage.content.executionId) throw new Error('Execution requires execution id');

      const isRedelivered = executeMessage.fields.redelivered;
      executionId = executeMessage.content.executionId;

      initMessage = cloneMessage(executeMessage);
      initMessage.content = {...initMessage.content, executionId, state: 'start', isRootScope: true};

      if (isRedelivered) {
        postponed.splice(0);
        logger.debug(`<${executionId} (${id})> resume execution`);

        if (!source) source = Behaviour(activity, context);

        activate();
        return broker.publish('execution', 'execute.resume.execution', cloneContent(initMessage.content), {persistent: false});
      }

      logger.debug(`<${executionId} (${id})> execute`);
      activate();
      source = Behaviour(activity, context);
      broker.publish('execution', 'execute.start', cloneContent(initMessage.content));
    }

    function discard() {
      if (completed) return;
      if (!initMessage) return logger.warn(`<${id}> is not executing`);
      getApi(initMessage).discard();
    }

    function stop() {
      if (!initMessage) return;
      getApi(initMessage).stop();
    }

    function getState() {
      const result = {completed};

      if (!source || !source.getState) return result;
      return {...result, ...source.getState()};
    }

    function recover(state) {
      postponed.splice(0);

      if (!state) return executionApi;
      if ('completed' in state) completed = state.completed;

      source = Behaviour(activity, context);
      if (source.recover) {
        source.recover(state);
      }

      return executionApi;
    }

    function activate() {
      if (completed) return;

      broker.bindQueue(executeQ.name, 'execution', 'execute.#', {priority: 100});
      executeQ.assertConsumer(onExecuteMessage, {exclusive: true, prefetch: 100, priority: 100, consumerTag: '_activity-execute'});
      if (completed) return deactivate();

      broker.subscribeTmp('api', `activity.*.${executionId}`, onParentApiMessage, {noAck: true, consumerTag: '_activity-api-execution', priority: 200});
    }

    function deactivate() {
      broker.cancel('_activity-api-execution');
      broker.cancel('_activity-execute');
      broker.unbindQueue(executeQ.name, 'execution', 'execute.#');
    }

    function onParentApiMessage(routingKey, message) {
      const messageType = message.properties.type;

      switch (messageType) {
        case 'discard':
          executeQ.queueMessage({routingKey: 'execute.discard'}, cloneContent(initMessage.content));
          break;
        case 'stop':
          onStop(message);
          break;
      }
    }

    function onStop(message) {
      const stoppedId = message && message.content && message.content.executionId;
      const running = getPostponed();
      running.forEach((api) => {
        if (stoppedId !== api.content.executionId) {
          api.stop();
        }
      });

      broker.cancel('_activity-execute');
      broker.cancel('_activity-api-execution');
    }

    function onExecuteMessage(routingKey, message) {
      const {fields = {}, content = {}, properties = {}} = message;
      const isRedelivered = fields.redelivered;
      const {isRootScope, ignoreIfExecuting, keep, executionId: cexid, error} = content;

      if (isRedelivered && properties.persistent === false) return message.ack();

      switch (routingKey) {
        case 'execute.resume.execution': {
          if (!postponed.length) return broker.publish('execution', 'execute.start', cloneContent(initMessage.content));
          break;
        }
        case 'execute.error':
        case 'execute.discard':
          executionDiscard();
          break;
        case 'execute.cancel':
        case 'execute.completed': {
          if (isRedelivered) {
            message.ack();
            return broker.publish('execution', routingKey, getExecuteMessage().content);
          }

          executionCompleted();
          break;
        }
        case 'execute.start': {
          if (!stateChangeMessage()) return;
          return source.execute(getExecuteMessage());
        }
        case 'execute.outbound.take': {
          if (isRedelivered) {
            message.ack();
            break;
          }
          broker.publish('execution', 'execution.outbound.take', cloneContent(content), {type: 'outbound'});
          break;
        }
        default: {
          if (!stateChangeMessage()) return;
          if (isRedelivered) {
            return source.execute(getExecuteMessage());
          }
        }
      }

      function stateChangeMessage() {
        const idx = postponed.findIndex((msg) => msg.content.executionId === cexid);
        let previousMsg;
        if (idx > -1) {
          if (ignoreIfExecuting) {
            message.ack();
            return false;
          }

          previousMsg = postponed.splice(idx, 1, message)[0];
          previousMsg.ack();
          return true;
        }

        postponed.push(message);
        return true;
      }

      function getExecuteMessage() {
        const result = cloneMessage(message);
        result.content.ignoreIfExecuting = undefined;
        return result;
      }

      function executionCompleted() {
        const postponedMsg = ackPostponed(message);
        if (!postponedMsg) return;

        if (!isRootScope) {
          logger.debug(`<${cexid} (${id})> completed sub execution`);
          if (!keep) message.ack();
          if (postponed.length === 1 && postponed[0].content.isRootScope && !postponed[0].content.preventComplete) {
            return broker.publish('execution', 'execute.completed', cloneContent(postponed[0].content));
          }
          return;
        }

        logger.debug(`<${cexid} (${id})> completed execution`);
        completed = true;

        message.ack(true);

        deactivate();

        const subApis = getPostponed();
        postponed.splice(0);
        subApis.forEach((api) => api.discard());

        publishExecutionCompleted('completed', {...postponedMsg.content, ...message.content});
      }

      function executionDiscard() {
        const postponedMsg = ackPostponed(message);
        if (!isRootScope && !postponedMsg) return;

        if (!error && !isRootScope) {
          message.ack();
          if (postponed.length === 1 && postponed[0].content.isRootScope) {
            return broker.publish('execution', 'execute.discard', {...postponed[0].content});
          }
          return;
        }

        message.ack(true);

        deactivate();

        const subApis = getPostponed();
        postponed.splice(0);
        subApis.forEach((api) => api.discard());

        publishExecutionCompleted(error ? 'error' : 'discard', {...content});
      }

      function publishExecutionCompleted(completionType, completeContent) {
        completed = true;

        broker.publish('execution', `execution.${completionType}`, {
          ...completeContent,
          state: completionType,
        }, {type: completionType});
      }
    }

    function ackPostponed(completeMessage) {
      const {executionId: eid} = completeMessage.content;

      const idx = postponed.findIndex(({content}) => content.executionId === eid);
      if (idx === -1) return;
      const [msg] = postponed.splice(idx, 1);
      msg.ack();
      return msg;
    }

    function getApi(apiMessage) {
      if (!apiMessage) apiMessage = initMessage;

      if (source.getApi) {
        const sourceApi = source.getApi(apiMessage);
        if (sourceApi) return sourceApi;
      }

      const api = ActivityApi(broker, apiMessage);

      api.getExecuting = function getExecuting() {
        return postponed.reduce((result, msg) => {
          if (msg.content.executionId === apiMessage.content.executionId) return result;
          result.push(getApi(msg));
          return result;
        }, []);
      };

      return api;
    }
  }

  const safePattern = /[./\\#*:\s]/g;

  function generateId() {
    const min = 100000000;
    const max = 999999999;
    const rand = Math.floor(Math.random() * (max - min)) + min;

    return rand.toString(16);
  }

  function brokerSafeId(id) {
    return id.replace(safePattern, '_');
  }

  function getUniqueId(prefix) {
    return `${brokerSafeId(prefix)}_${generateId()}`;
  }

  function filterUndefined(obj) {
    return Object.keys(obj).reduce((filtered, key) => {
      const objValue = obj[key];
      if (objValue !== undefined) filtered[key] = objValue;
      return filtered;
    }, {});
  }

  function generateId$1() {
    const min = 110000;
    const max = 9999999;
    const rand = Math.floor(Math.random() * (max - min)) + min;

    return rand.toString(16);
  }

  function getRoutingKeyPattern(pattern) {
    const len = pattern.length;
    const hashIdx = pattern.indexOf('#');
    const astxIdx = pattern.indexOf('*');
    if (hashIdx === -1) {
      if (astxIdx === -1) {
        return directMatch();
      }
    } else if (hashIdx === len - 1 && astxIdx === -1) {
      return endMatch();
    }

    const rpattern = pattern
      .replace('.', '\\.')
      .replace('*', '[^.]+?')
      .replace('#', '.+?');

    return new RegExp(`^${rpattern}$`);

    function directMatch() {
      return {
        test
      };
      function test(routingKey) {
        return routingKey === pattern;
      }
    }

    function endMatch() {
      const testString = pattern.replace('#', '');
      return {
        test
      };
      function test(routingKey) {
        return routingKey.indexOf(testString) === 0;
      }
    }
  }

  function sortByPriority(a, b) {
    return (b.options.priority || 0) - (a.options.priority || 0);
  }

  function Message(fields = {}, content, properties = {}, onConsumed) {
    let pending = false;
    let consumedCallback;

    const messageId = properties.messageId || `smq.mid-${generateId$1()}`;
    const messageProperties = {...properties, messageId};
    const timestamp = messageProperties.timestamp = properties.timestamp || Date.now();
    let ttl;
    if (properties.expiration) {
      ttl = messageProperties.ttl = timestamp + parseInt(properties.expiration);
    }

    const message = {
      fields: {...fields, consumerTag: undefined},
      content,
      properties: messageProperties,
      consume,
      ack,
      nack,
      reject,
    };

    Object.defineProperty(message, 'messageId', {
      get() {
        return messageId;
      }
    });

    Object.defineProperty(message, 'ttl', {
      value: ttl
    });

    Object.defineProperty(message, 'consumerTag', {
      get: () => message.fields.consumerTag,
      set: (value) => {
        message.fields.consumerTag = value;
      },
    });

    Object.defineProperty(message, 'pending', {
      get: () => pending
    });

    return message;

    function consume({consumerTag} = {}, consumedCb) {
      pending = true;
      message.fields.consumerTag = consumerTag;
      consumedCallback = consumedCb;
    }

    function reset() {
      pending = false;
    }

    function ack(allUpTo) {
      if (!pending) return;
      consumed('ack', allUpTo);
    }

    function nack(allUpTo, requeue = true) {
      if (!pending) return;
      consumed('nack', allUpTo, requeue);
    }

    function reject(requeue = true) {
      nack(false, requeue);
    }

    function consumed(operation, allUpTo, requeue) {
      [consumedCallback, onConsumed, reset].forEach((fn) => {
        if (fn) fn(message, operation, allUpTo, requeue);
      });
    }
  }

  function Queue(name, options = {}, eventEmitter) {
    if (!name) name = `smq.qname-${generateId$1()}`;

    const messages = [], consumers = [];
    let exclusivelyConsumed, stopped, pendingMessageCount = 0;
    options = {autoDelete: true, ...options};

    let maxLength = 'maxLength' in options ? options.maxLength : Infinity;
    const messageTtl = options.messageTtl;

    const {deadLetterExchange, deadLetterRoutingKey} = options;

    const queue = {
      name,
      options,
      messages,
      ack,
      ackAll,
      assertConsumer,
      cancel,
      close,
      consume,
      delete: deleteQueue,
      dequeueMessage,
      dismiss,
      get,
      getState,
      nack,
      nackAll,
      off,
      on,
      peek,
      purge,
      queueMessage,
      recover,
      reject,
      stop,
      unbindConsumer,
    };

    Object.defineProperty(queue, 'messageCount', {
      enumerable: true,
      get: () => messages.length
    });

    Object.defineProperty(queue, 'consumers', {
      get: () => consumers.slice()
    });

    Object.defineProperty(queue, 'consumerCount', {
      get: () => consumers.length
    });

    Object.defineProperty(queue, 'stopped', {
      get: () => stopped
    });

    Object.defineProperty(queue, 'exclusive', {
      get: () => exclusivelyConsumed
    });

    Object.defineProperty(queue, 'maxLength', {
      set(value) {
        maxLength = options.maxLength = value;
      },
      get: () => maxLength
    });

    Object.defineProperty(queue, 'capacity', {
      get: getCapacity
    });

    return queue;

    function queueMessage(fields, content, properties, onMessageQueued) {
      if (stopped) return;

      const messageProperties = {...properties};
      if (messageTtl) messageProperties.expiration = messageProperties.expiration || messageTtl;
      const message = Message(fields, content, messageProperties, onMessageConsumed);

      const capacity = getCapacity();
      messages.push(message);
      pendingMessageCount++;

      let discarded;
      switch (capacity) {
        case 0:
          discarded = evictOld();
        case 1:
          emit('saturated');
      }

      if (onMessageQueued) onMessageQueued(message);
      emit('message', message);

      return discarded ? 0 : consumeNext();

      function evictOld() {
        const evict = get();
        if (!evict) return;
        evict.nack(false, false);
        return evict === message;
      }
    }

    function consumeNext() {
      if (stopped) return;
      if (!pendingMessageCount) return;
      if (!consumers.length) return;

      const readyConsumers = consumers.filter((consumer) => consumer.ready);
      if (!readyConsumers.length) return 0;

      let consumed = 0;
      for (const consumer of readyConsumers) {
        const msgs = consumeMessages(consumer.capacity, consumer.options);
        if (!msgs.length) return consumed;
        consumer.push(msgs);
        consumed += msgs.length;
      }

      return consumed;
    }

    function consume(onMessage, consumeOptions = {}, owner) {
      if (exclusivelyConsumed && consumers.length) throw new Error(`Queue ${name} is exclusively consumed by ${consumers[0].consumerTag}`);
      else if (consumeOptions.exclusive && consumers.length) throw new Error(`Queue ${name} already has consumers and cannot be exclusively consumed`);

      const consumer = Consumer(queue, onMessage, consumeOptions, owner, consumerEmitter());
      consumers.push(consumer);
      consumers.sort(sortByPriority);

      exclusivelyConsumed = consumer.options.exclusive;

      emit('consume', consumer);

      const pendingMessages = consumeMessages(consumer.capacity, consumer.options);
      if (pendingMessages.length) consumer.push(pendingMessages);

      return consumer;

      function consumerEmitter() {
        return {
          emit: onConsumerEmit,
          on: onConsumer,
        };

        function onConsumerEmit(eventName, ...args) {
          if (eventName === 'consumer.cancel') {
            unbindConsumer(consumer);
          }
          emit(eventName, ...args);
        }

        function onConsumer(...args) {
          if (eventEmitter && eventEmitter.on) return;
          eventEmitter.on(...args);
        }
      }
    }

    function assertConsumer(onMessage, consumeOptions = {}, owner) {
      if (!consumers.length) return consume(onMessage, consumeOptions, owner);
      for (const consumer of consumers) {
        if (consumer.onMessage !== onMessage) continue;

        if (consumeOptions.consumerTag && consumeOptions.consumerTag !== consumer.consumerTag) {
          continue;
        } else if ('exclusive' in consumeOptions && consumeOptions.exclusive !== consumer.options.exclusive) {
          continue;
        }

        return consumer;
      }
      return consume(onMessage, consumeOptions, owner);
    }

    function get({noAck, consumerTag} = {}) {
      const message = consumeMessages(1, {noAck, consumerTag})[0];
      if (!message) return;
      if (noAck) dequeue(message);

      return message;
    }

    function consumeMessages(n, consumeOptions) {
      if (stopped || !pendingMessageCount || !n) return [];

      const now = Date.now();
      const msgs = [];
      const evict = [];
      for (const message of messages) {
        if (message.pending) continue;
        if (message.ttl && message.ttl < now) {
          evict.push(message);
          continue;
        }
        message.consume(consumeOptions);
        pendingMessageCount--;
        msgs.push(message);
        if (!--n) break;
      }

      for (const expired of evict) nack(expired, false, false);

      return msgs;
    }

    function ack(message, allUpTo) {
      onMessageConsumed(message, 'ack', allUpTo);
    }

    function nack(message, allUpTo, requeue = true) {
      onMessageConsumed(message, 'nack', allUpTo, requeue);
    }

    function reject(message, requeue = true) {
      onMessageConsumed(message, 'nack', false, requeue);
    }

    function onMessageConsumed(message, operation, allUpTo, requeue) {
      if (stopped) return;
      const pending = allUpTo && getPendingMessages(message);

      let deadLetter = false;
      switch (operation) {
        case 'ack': {
          if (!dequeue(message)) return;
          break;
        }
        case 'nack':
          if (requeue) {
            requeueMessage(message);
            break;
          }

          if (!dequeue(message)) return;
          deadLetter = !!deadLetterExchange;
          break;
      }

      let capacity;
      if (!messages.length) emit('depleted', queue);
      else if ((capacity = getCapacity()) === 1) emit('ready', capacity);

      if (!pending || !pending.length) consumeNext();

      if (deadLetter) {
        const deadMessage = Message(message.fields, message.content, {...message.properties, expiration: undefined});
        if (deadLetterRoutingKey) deadMessage.fields.routingKey = deadLetterRoutingKey;

        emit('dead-letter', {
          deadLetterExchange,
          message: deadMessage
        });
      }

      if (pending && pending.length) {
        pending.forEach((msg) => msg[operation](false, requeue));
      }
    }

    function ackAll() {
      getPendingMessages().forEach((msg) => msg.ack(false));
    }

    function nackAll(requeue = true) {
      getPendingMessages().forEach((msg) => msg.nack(false, requeue));
    }

    function getPendingMessages(fromAndNotIncluding) {
      if (!fromAndNotIncluding) return messages.filter((msg) => msg.pending);

      const msgIdx = messages.indexOf(fromAndNotIncluding);
      if (msgIdx === -1) return [];

      return messages.slice(0, msgIdx).filter((msg) => msg.pending);
    }

    function requeueMessage(message) {
      const msgIdx = messages.indexOf(message);
      if (msgIdx === -1) return;
      pendingMessageCount++;
      messages.splice(msgIdx, 1, Message({...message.fields, redelivered: true}, message.content, message.properties, onMessageConsumed));
    }

    function peek(ignoreDelivered) {
      const message = messages[0];
      if (!message) return;

      if (!ignoreDelivered) return message;
      if (!message.pending) return message;

      for (let idx = 1; idx < messages.length; idx++) {
        if (!messages[idx].pending) {
          return messages[idx];
        }
      }
    }

    function cancel(consumerTag) {
      const idx = consumers.findIndex((c) => c.consumerTag === consumerTag);
      if (idx === -1) return;

      return unbindConsumer(consumers[idx]);
    }

    function dismiss(onMessage) {
      const consumer = consumers.find((c) => c.onMessage === onMessage);
      if (!consumer) return;
      unbindConsumer(consumer);
    }

    function unbindConsumer(consumer) {
      const idx = consumers.indexOf(consumer);
      if (idx === -1) return;

      consumers.splice(idx, 1);

      if (exclusivelyConsumed) {
        exclusivelyConsumed = false;
      }

      consumer.stop();

      if (options.autoDelete && !consumers.length) return deleteQueue();

      consumer.nackAll(true);
    }

    function emit(eventName, content) {
      if (!eventEmitter || !eventEmitter.emit) return;
      const routingKey = `queue.${eventName}`;
      eventEmitter.emit(routingKey, content);
    }

    function on(eventName, handler) {
      if (!eventEmitter || !eventEmitter.on) return;
      const pattern = `queue.${eventName}`;
      return eventEmitter.on(pattern, handler);
    }

    function off(eventName, handler) {
      if (!eventEmitter || !eventEmitter.off) return;
      const pattern = `queue.${eventName}`;
      return eventEmitter.off(pattern, handler);
    }

    function purge() {
      const toDelete = messages.filter(({pending}) => !pending);
      pendingMessageCount = 0;

      toDelete.forEach(dequeue);

      if (!messages.length) emit('depleted', queue);
      return toDelete.length;
    }

    function dequeueMessage(message) {
      if (message.pending) return nack(message, false, false);

      message.consume({});

      nack(message, false, false);
    }

    function dequeue(message) {
      const msgIdx = messages.indexOf(message);
      if (msgIdx === -1) return;

      messages.splice(msgIdx, 1);

      return true;
    }

    function getState() {
      return JSON.parse(JSON.stringify(queue));
    }

    function recover(state) {
      stopped = false;
      if (!state) return consumeNext();

      name = queue.name = state.name;
      messages.splice(0);

      let continueConsume;
      if (consumers.length) {
        consumers.forEach((c) => c.nackAll(false));
        continueConsume = true;
      }

      state.messages.forEach(({fields, content, properties}) => {
        if (properties.persistent === false) return;
        const msg = Message({...fields, redelivered: true}, content, properties, onMessageConsumed);
        messages.push(msg);
      });
      pendingMessageCount = messages.length;
      consumers.forEach((c) => c.recover());
      if (continueConsume) {
        consumeNext();
      }
    }

    function deleteQueue({ifUnused, ifEmpty} = {}) {
      if (ifUnused && consumers.length) return;
      if (ifEmpty && messages.length) return;

      const messageCount = messages.length;
      queue.stop();

      const deleteConsumers = consumers.splice(0);
      deleteConsumers.forEach((consumer) => {
        consumer.cancel();
      });

      if (deadLetterExchange) nackAll(false);
      else messages.splice(0);

      emit('delete', queue);
      return {messageCount};
    }

    function close() {
      consumers.splice(0).forEach((consumer) => consumer.cancel());
      exclusivelyConsumed = false;
    }

    function stop() {
      stopped = true;
    }

    function getCapacity() {
      return maxLength - messages.length;
    }
  }

  function Consumer(queue, onMessage, options = {}, owner, eventEmitter) {
    if (typeof onMessage !== 'function') throw new Error('message callback is required and must be a function');
    options = {prefetch: 1, priority: 0, noAck: false, ...options};
    if (!options.consumerTag) options.consumerTag = `smq.ctag-${generateId$1()}`;

    let ready = true, stopped = false, consuming;
    const internalQueue = Queue(`${options.consumerTag}-q`, {maxLength: options.prefetch}, {emit: onInternalQueueEvent});

    const consumer = {
      queue,
      options,
      on,
      onMessage,
      ackAll,
      cancel,
      nackAll,
      prefetch,
      push,
      recover,
      stop,
    };

    Object.defineProperty(consumer, 'consumerTag', {
      value: options.consumerTag
    });

    Object.defineProperty(consumer, 'messageCount', {
      get: () => internalQueue.messageCount
    });

    Object.defineProperty(consumer, 'capacity', {
      get: () => internalQueue.capacity
    });

    Object.defineProperty(consumer, 'queueName', {
      get: () => queue.name
    });

    Object.defineProperty(consumer, 'ready', {
      get: () => ready && !stopped
    });

    Object.defineProperty(consumer, 'stopped', {
      get: () => stopped
    });

    return consumer;

    function push(messages) {
      messages.forEach((message) => {
        internalQueue.queueMessage(message.fields, message, message.properties, onInternalMessageQueued);
      });
      if (!consuming) {
        consume();
      }
    }

    function onInternalMessageQueued(msg) {
      const message = msg.content;
      message.consume(options, onConsumed);

      function onConsumed() {
        internalQueue.dequeueMessage(msg);
      }
    }

    function consume() {
      if (stopped) return;
      consuming = true;

      const msg = internalQueue.get();

      if (!msg) {
        consuming = false;
        return;
      }

      msg.consume(options);
      const message = msg.content;
      message.consume(options, onConsumed);

      if (options.noAck) msg.content.ack();
      onMessage(msg.fields.routingKey, msg.content, owner);

      consuming = false;

      return consume();

      function onConsumed() {
        msg.nack(false, false);
      }
    }

    function onInternalQueueEvent(eventName) {
      switch (eventName) {
        case 'queue.saturated': {
          ready = false;
          break;
        }
        case 'queue.depleted':
        case 'queue.ready':
          ready = true;
          break;
      }
    }

    function nackAll(requeue) {
      internalQueue.messages.slice().forEach((msg) => {
        msg.content.nack(false, requeue);
      });
    }

    function ackAll() {
      internalQueue.messages.slice().forEach((msg) => {
        msg.content.ack(false);
      });
    }

    function cancel(requeue = true) {
      emit('cancel', consumer);
      nackAll(requeue);
    }

    function prefetch(value) {
      options.prefetch = internalQueue.maxLength = value;
    }

    function emit(eventName, content) {
      if (!eventEmitter) return;
      const routingKey = `consumer.${eventName}`;
      eventEmitter.emit(routingKey, content);
    }

    function on(eventName, handler) {
      if (!eventEmitter) return;
      const pattern = `consumer.${eventName}`;
      return eventEmitter.on(pattern, handler);
    }

    function recover() {
      stopped = false;
    }

    function stop() {
      stopped = true;
    }
  }

  function Exchange(name, type, options) {
    const eventExchange = EventExchange();
    return ExchangeBase(name, true, type, options, eventExchange);
  }

  function EventExchange(name) {
    if (!name) name = `smq.ename-${generateId$1()}`;
    return ExchangeBase(name, false, 'topic', {durable: false, autoDelete: true});
  }

  function ExchangeBase(name, isExchange, type = 'topic', options = {}, eventExchange) {
    if (!name) throw new Error('Exchange name is required');
    if (['topic', 'direct'].indexOf(type) === -1) throw Error('Exchange type must be one of topic or direct');

    const deliveryQueue = Queue('delivery-q', {}, {emit: onInternalQueueEmit});
    let consumer = deliveryQueue.consume(type === 'topic' ? topic : direct);
    if (!isExchange) eventExchange = undefined;

    const bindings = [];
    let stopped;
    options = {durable: true, autoDelete: true, ...options};

    const exchange = {
      name,
      type,
      options,
      bind,
      close,
      emit,
      getBinding,
      getState,
      on,
      off,
      publish,
      recover,
      stop,
      unbind,
      unbindQueueByName,
    };

    Object.defineProperty(exchange, 'bindingCount', {
      enumerable: true,
      get: () => bindings.length
    });

    Object.defineProperty(exchange, 'bindings', {
      enumerable: true,
      get: () => bindings.slice()
    });

    Object.defineProperty(exchange, 'stopped', {
      enumerable: true,
      get: () => stopped
    });

    return exchange;

    function publish(routingKey, content, properties = {}) {
      if (stopped) return;
      return deliveryQueue.queueMessage({routingKey}, {
        content,
        properties,
      });
    }

    function topic(routingKey, message) {
      const deliverTo = getConcernedBindings(routingKey);
      const publishedMsg = message.content;

      if (!deliverTo.length) {
        message.ack();
        if (publishedMsg.properties.mandatory) {
          emitReturn(routingKey, publishedMsg);
        }
        return 0;
      }

      message.ack();
      deliverTo.forEach(({queue}) => publishToQueue(queue, routingKey, publishedMsg.content, publishedMsg.properties));
    }

    function direct(routingKey, message) {
      const deliverTo = getConcernedBindings(routingKey);
      const publishedMsg = message.content;

      const first = deliverTo[0];
      if (!first) {
        message.ack();
        if (publishedMsg.properties.mandatory) {
          emitReturn(routingKey, publishedMsg);
        }
        return 0;
      }

      if (deliverTo.length > 1) shift(deliverTo[0]);

      message.ack();
      publishToQueue(first.queue, routingKey, publishedMsg.content, publishedMsg.properties);
    }

    function publishToQueue(queue, routingKey, content, properties) {
      queue.queueMessage({routingKey, exchange: name}, content, properties);
    }

    function emitReturn(routingKey, returnMessage) {
      emit('return', Message({routingKey, exchange: name}, returnMessage.content, returnMessage.properties));
    }

    function getConcernedBindings(routingKey) {
      return bindings.reduce((result, bound) => {
        if (bound.testPattern(routingKey)) result.push(bound);
        return result;
      }, []);
    }

    function shift(bound) {
      const idx = bindings.indexOf(bound);
      bindings.splice(idx, 1);
      bindings.push(bound);
    }

    function bind(queue, pattern, bindOptions) {
      const bound = bindings.find((bq) => bq.queue === queue && bq.pattern === pattern);
      if (bound) return bound;

      const binding = Binding(queue, pattern, bindOptions);
      bindings.push(binding);
      bindings.sort(sortByPriority);

      emit('bind', binding);

      return binding;
    }

    function unbind(queue, pattern) {
      const idx = bindings.findIndex((bq) => bq.queue === queue && bq.pattern === pattern);
      if (idx === -1) return;

      const [binding] = bindings.splice(idx, 1);
      binding.close();

      emit('unbind', binding);

      if (!bindings.length && options.autoDelete) emit('delete', exchange);
    }

    function unbindQueueByName(queueName) {
      const bounds = bindings.filter((bq) => bq.queue.name === queueName);
      bounds.forEach((bound) => {
        unbind(bound.queue, bound.pattern);
      });
    }

    function close() {
      bindings.slice().forEach((binding) => binding.close());
      deliveryQueue.unbindConsumer(consumer);
      deliveryQueue.close();
    }

    function getState() {
      return JSON.parse(JSON.stringify({
        name: name,
        type,
        options: {...options},
        deliveryQueue,
        bindings: getBoundState()}));

      function getBoundState() {
        return bindings.reduce((result, binding) => {
          if (!binding.queue.options.durable) return result;
          if (!result) result = [];
          result.push(binding);
          return result;
        }, undefined);
      }
    }

    function stop() {
      stopped = true;
    }

    function recover(state, getQueue) {
      stopped = false;

      recoverBindings();
      if (state) {
        name = exchange.name = state.name;
        deliveryQueue.recover(state.deliveryQueue);
        consumer = deliveryQueue.consume(type === 'topic' ? topic : direct);
      }

      return exchange;

      function recoverBindings() {
        if (!state || !state.bindings) return;
        state.bindings.forEach((bindingState) => {
          const queue = getQueue(bindingState.queueName);
          if (!queue) return;
          bind(queue, bindingState.pattern, bindingState.options);
        });
      }
    }

    function getBinding(queueName, pattern) {
      return bindings.find((binding) => binding.queue.name === queueName && binding.pattern === pattern);
    }

    function emit(eventName, content) {
      if (isExchange) return eventExchange.publish(`exchange.${eventName}`, content);
      publish(eventName, content);
    }

    function on(pattern, handler, consumeOptions = {}) {
      if (isExchange) return eventExchange.on(`exchange.${pattern}`, handler);

      const eventQueue = Queue(null, {durable: false, autoDelete: true});
      bind(eventQueue, pattern);
      const eventConsumer = eventQueue.consume(handler, {...consumeOptions, noAck: true}, exchange);
      return eventConsumer;
    }

    function off(pattern, handler) {
      if (isExchange) return eventExchange.off(`exchange.${pattern}`, handler);

      for (const binding of bindings) {
        if (binding.pattern === pattern) {
          binding.queue.dismiss(handler);
        }
      }
    }

    function Binding(queue, pattern, bindOptions = {}) {
      const rPattern = getRoutingKeyPattern(pattern);
      queue.on('delete', closeBinding);

      const binding = {
        id: `${queue.name}/${pattern}`,
        options: {priority: 0, ...bindOptions},
        pattern,
        close: closeBinding,
        testPattern,
      };

      Object.defineProperty(binding, 'queue', {
        enumerable: false,
        value: queue,
      });

      Object.defineProperty(binding, 'queueName', {
        enumerable: true,
        get: () => queue.name,
      });

      return binding;

      function testPattern(routingKey) {
        return rPattern.test(routingKey);
      }

      function closeBinding() {
        unbind(queue, pattern);
      }
    }

    function onInternalQueueEmit() {}
  }

  function Broker(owner) {
    const exchanges = [];
    const queues = [];
    const consumers = [];
    const events = EventExchange();

    const broker = {
      owner,
      subscribe,
      subscribeOnce,
      subscribeTmp,
      unsubscribe,
      assertExchange,
      ack,
      ackAll,
      nack,
      nackAll,
      cancel,
      close,
      deleteExchange,
      bindExchange,
      bindQueue,
      assertQueue,
      consume,
      createQueue,
      deleteQueue,
      get: getMessageFromQueue,
      getExchange,
      getQueue,
      getState,
      on,
      off,
      prefetch: setPrefetch,
      publish,
      purgeQueue,
      recover,
      reject,
      reset,
      sendToQueue,
      stop,
      unbindExchange,
      unbindQueue,
    };

    Object.defineProperty(broker, 'exchangeCount', {
      enumerable: true,
      get: () => exchanges.length
    });

    Object.defineProperty(broker, 'queueCount', {
      enumerable: true,
      get: () => queues.length
    });

    Object.defineProperty(broker, 'consumerCount', {
      enumerable: true,
      get: () => consumers.length
    });

    return broker;

    function subscribe(exchangeName, pattern, queueName, onMessage, options = {durable: true}) {
      if (!exchangeName || !pattern || typeof onMessage !== 'function') throw new Error('exchange name, pattern, and message callback are required');
      if (options && options.consumerTag) validateConsumerTag(options.consumerTag);

      assertExchange(exchangeName);
      const queue = assertQueue(queueName, options);

      bindQueue(queue.name, exchangeName, pattern, options);

      return queue.assertConsumer(onMessage, options, owner);
    }

    function subscribeTmp(exchangeName, pattern, onMessage, options = {}) {
      return subscribe(exchangeName, pattern, null, onMessage, {...options, durable: false});
    }

    function subscribeOnce(exchangeName, pattern, onMessage, options = {}) {
      if (typeof onMessage !== 'function') throw new Error('message callback is required');
      if (options && options.consumerTag) validateConsumerTag(options.consumerTag);

      assertExchange(exchangeName);
      const onceOptions = {autoDelete: true, durable: false, priority: options.priority || 0};
      const onceQueue = createQueue(null, onceOptions);

      bindQueue(onceQueue.name, exchangeName, pattern, {...onceOptions});

      return consume(onceQueue.name, wrappedOnMessage, {noAck: true, consumerTag: options.consumerTag});

      function wrappedOnMessage(...args) {
        onceQueue.delete();
        onMessage(...args);
      }
    }

    function unsubscribe(queueName, onMessage) {
      const queue = getQueue(queueName);
      if (!queue) return;
      queue.dismiss(onMessage);
    }

    function assertExchange(exchangeName, type, options) {
      let exchange = getExchangeByName(exchangeName);
      if (exchange) {
        if (type && exchange.type !== type) throw new Error('Type doesn\'t match');
      } else {
        exchange = Exchange(exchangeName, type || 'topic', options);
        exchange.on('delete', () => {
          const idx = exchanges.indexOf(exchange);
          if (idx === -1) return;
          exchanges.splice(idx, 1);
        });
        exchange.on('return', (_, msg) => {
          events.publish('return', msg);
        });
        exchanges.push(exchange);
      }

      return exchange;
    }

    function getExchangeByName(exchangeName) {
      return exchanges.find((exchange) => exchange.name === exchangeName);
    }

    function bindQueue(queueName, exchangeName, pattern, bindOptions) {
      const exchange = getExchange(exchangeName);
      const queue = getQueue(queueName);
      exchange.bind(queue, pattern, bindOptions);
    }

    function unbindQueue(queueName, exchangeName, pattern) {
      const exchange = getExchange(exchangeName);
      if (!exchange) return;
      const queue = getQueue(queueName);
      if (!queue) return;
      exchange.unbind(queue, pattern);
    }

    function consume(queueName, onMessage, options) {
      const queue = getQueue(queueName);
      if (!queue) throw new Error(`Queue with name <${queueName}> was not found`);

      if (options) validateConsumerTag(options.consumerTag);

      return queue.consume(onMessage, options, owner);
    }

    function cancel(consumerTag) {
      const consumer = consumers.find((c) => c.consumerTag === consumerTag);
      if (!consumer) return false;
      consumer.cancel(false);
      return true;
    }

    function getExchange(exchangeName) {
      return exchanges.find(({name}) => name === exchangeName);
    }

    function deleteExchange(exchangeName, {ifUnused} = {}) {
      const idx = exchanges.findIndex((exchange) => exchange.name === exchangeName);
      if (idx === -1) return false;

      const exchange = exchanges[idx];
      if (ifUnused && exchange.bindingCount) return false;

      exchanges.splice(idx, 1);
      exchange.close();
      return true;
    }

    function stop() {
      for (const exchange of exchanges) exchange.stop();
      for (const queue of queues) queue.stop();
    }

    function close() {
      for (const exchange of exchanges) exchange.close();
      for (const queue of queues) queue.close();
    }

    function reset() {
      stop();
      close();
      exchanges.splice(0);
      queues.splice(0);
      consumers.splice(0);
    }

    function getState() {
      return {
        exchanges: getExchangeState(),
        queues: getQueuesState(),
      };
    }

    function recover(state) {
      if (state) {
        if (state.queues) for (const qState of state.queues) recoverQueue(qState);
        if (state.exchanges) for (const eState of state.exchanges) recoverExchange(eState);
      } else {
        for (const queue of queues) {
          if (queue.stopped) queue.recover();
        }
        for (const exchange of exchanges) {
          if (exchange.stopped) exchange.recover(null, getQueue);
        }
      }

      return broker;

      function recoverQueue(qState) {
        const queue = assertQueue(qState.name, qState.options);
        queue.recover(qState);
      }

      function recoverExchange(eState) {
        const exchange = assertExchange(eState.name, eState.type, eState.options);
        exchange.recover(eState, getQueue);
      }
    }

    function bindExchange() {}
    function unbindExchange() {}

    function publish(exchangeName, routingKey, content, options) {
      const exchange = getExchangeByName(exchangeName);
      if (!exchange) return;
      return exchange.publish(routingKey, content, options);
    }

    function purgeQueue(queueName) {
      const queue = getQueue(queueName);
      if (!queue) return;
      return queue.purge();
    }

    function sendToQueue(queueName, content, options) {
      const queue = getQueue(queueName);
      if (!queue) throw new Error(`Queue named ${queueName} doesn't exists`);
      return queue.queueMessage(null, content, options);
    }

    function getQueuesState() {
      return queues.reduce((result, queue) => {
        if (!queue.options.durable) return result;
        if (!result) result = [];
        result.push(queue.getState());
        return result;
      }, undefined);
    }

    function getExchangeState() {
      return exchanges.reduce((result, exchange) => {
        if (!exchange.options.durable) return result;
        if (!result) result = [];
        result.push(exchange.getState());
        return result;
      }, undefined);
    }

    function createQueue(queueName, options) {
      if (getQueue(queueName)) throw new Error(`Queue named ${queueName} already exists`);

      const queue = Queue(queueName, options, EventExchange());
      queue.on('delete', onDelete);
      queue.on('dead-letter', onDeadLetter);
      queue.on('consume', (_, event) => consumers.push(event.content));
      queue.on('consumer.cancel', (_, event) => {
        const idx = consumers.indexOf(event.content);

        if (idx !== -1) consumers.splice(idx, 1);
      });

      queues.push(queue);
      return queue;

      function onDelete() {
        const idx = queues.indexOf(queue);
        if (idx === -1) return;
        queues.splice(idx, 1);
      }

      function onDeadLetter(_, {content}) {
        const exchange = getExchange(content.deadLetterExchange);
        if (!exchange) return;
        exchange.publish(content.message.fields.routingKey, content.message.content, content.message.properties);
      }
    }

    function getQueue(queueName) {
      if (!queueName) return;
      const idx = queues.findIndex((queue) => queue.name === queueName);
      if (idx > -1) return queues[idx];
    }

    function assertQueue(queueName, options = {}) {
      if (!queueName) return createQueue(null, options);

      const queue = getQueue(queueName);
      options = {durable: true, ...options};
      if (!queue) return createQueue(queueName, options);

      if (queue.options.durable !== options.durable) throw new Error('Durable doesn\'t match');
      return queue;
    }

    function deleteQueue(queueName, options) {
      if (!queueName) return false;
      const queue = getQueue(queueName);
      if (!queue) return false;
      return queue.delete(options);
    }

    function getMessageFromQueue(queueName, {noAck} = {}) {
      const queue = getQueue(queueName);
      if (!queue) return;

      return queue.get({noAck});
    }

    function ack(message, allUpTo) {
      message.ack(allUpTo);
    }

    function ackAll() {
      for (const queue of queues) queue.ackAll();
    }

    function nack(message, allUpTo, requeue) {
      message.nack(allUpTo, requeue);
    }

    function nackAll(requeue) {
      for (const queue of queues) queue.nackAll(requeue);
    }

    function reject(message, requeue) {
      message.reject(requeue);
    }

    function validateConsumerTag(consumerTag) {
      if (!consumerTag) return true;

      if (consumers.find((c) => c.consumerTag === consumerTag)) {
        throw new Error(`Consumer tag must be unique, ${consumerTag} is occupied`);
      }

      return true;
    }

    function on(eventName, callback) {
      switch (eventName) {
        case 'return': {
          return events.on('return', getEventCallback(), {origin: callback});
        }
      }

      function getEventCallback() {
        return function eventCallback(_, msg) {
          callback(msg.content.content);
        };
      }
    }

    function off(eventName, callback) {
      for (const binding of events.bindings) {
        if (binding.pattern === eventName) {
          for (const consumer of binding.queue.consumers) {
            if (consumer.options && consumer.options.origin === callback) {
              consumer.cancel();
            }
          }
        }
      }
    }

    function setPrefetch() {}
  }



  var smqp = /*#__PURE__*/Object.freeze({
    __proto__: null,
    'default': Broker,
    Broker: Broker,
    getRoutingKeyPattern: getRoutingKeyPattern
  });

  class ActivityError extends Error {
    constructor(description, sourceMessage, inner) {
      super(description);
      this.type = 'ActivityError';
      this.name = this.constructor.name;
      this.description = description;
      if (sourceMessage) this.source = cloneMessage(sourceMessage, (sourceMessage.content && sourceMessage.content.error) && {error: undefined});
      if (inner) {
        this.inner = inner;
        if (inner.name) this.name = inner.name;
        if (inner.code) this.code = inner.code;
      }
    }
  }

  class BpmnError extends Error {
    constructor(description, behaviour = {}, sourceMessage, inner) {
      const {errorCode} = behaviour;

      super(description);
      this.type = 'BpmnError';
      this.name = behaviour.name || this.constructor.name;
      this.description = description;
      this.code = ('errorCode' in behaviour && errorCode && errorCode.toString()) || behaviour.code;
      this.id = behaviour.id;
      if (sourceMessage) this.source = cloneMessage(sourceMessage, (sourceMessage.content && sourceMessage.content.error) && {error: undefined});
      if (inner) this.inner = inner;
    }
  }

  function makeErrorFromMessage(errorMessage) {
    const {content} = errorMessage;
    if (isKnownError(content)) return content;

    const {error} = content;
    if (!error) return;

    if (isKnownError(error)) return error;
    switch (error.type) {
      case 'ActivityError':
        return new ActivityError(error.message || error.description, error.source, error.inner ? error.inner : {code: error.code, name: error.name});
      case 'BpmnError':
        return new BpmnError(error.message || error.description, error, error.source);
    }

    return error;

    function isKnownError(test) {
      if (test instanceof Error) return test;
      if (test instanceof ActivityError) return test;
      if (test instanceof BpmnError) return test;
    }
  }

  function ActivityBroker(activity) {
    const executionBroker = ExecutionBroker(activity, 'activity');
    return executionBroker;
  }

  function ProcessBroker(owner) {
    return ExecutionBroker(owner, 'process');
  }

  function DefinitionBroker(owner, onBrokerReturn) {
    return ExecutionBroker(owner, 'definition', onBrokerReturn);
  }

  function MessageFlowBroker(owner) {
    const eventBroker = EventBroker(owner, {prefix: 'messageflow', autoDelete: false, durable: false});
    const broker = eventBroker.broker;

    broker.assertExchange('message', 'topic', {durable: true, autoDelete: false});
    broker.assertQueue('message-q', {durable: true, autoDelete: false});
    broker.bindQueue('message-q', 'message', 'message.#');

    return eventBroker;
  }

  function ExecutionBroker(brokerOwner, prefix, onBrokerReturn) {
    const eventBroker = EventBroker(brokerOwner, {prefix, autoDelete: false, durable: false}, onBrokerReturn);
    const broker = eventBroker.broker;

    broker.assertExchange('api', 'topic', {autoDelete: false, durable: false});
    broker.assertExchange('run', 'topic', {autoDelete: false});
    broker.assertExchange('format', 'topic', {autoDelete: false});
    broker.assertExchange('execution', 'topic', {autoDelete: false});

    const runQ = broker.assertQueue('run-q', {durable: true, autoDelete: false});
    const formatRunQ = broker.assertQueue('format-run-q', {durable: true, autoDelete: false});
    const executionQ = broker.assertQueue('execution-q', {durable: true, autoDelete: false});

    broker.bindQueue(runQ.name, 'run', 'run.#');
    broker.bindQueue(formatRunQ.name, 'format', 'run.#');
    broker.bindQueue(executionQ.name, 'execution', 'execution.#');

    return eventBroker;
  }

  function EventBroker(brokerOwner, options, onBrokerReturn) {
    const broker = Broker(brokerOwner);
    const pfx = options.prefix;

    broker.assertExchange('event', 'topic', options);
    broker.on('return', onBrokerReturn || onBrokerReturnFn);

    return {
      eventPrefix: pfx,
      broker,
      on,
      once,
      waitFor,
      emit,
      emitFatal,
    };

    function on(eventName, callback, eventOptions = { once: false }) {
      const key = getEventRoutingKey(eventName);

      if (eventOptions.once) return broker.subscribeOnce('event', key, eventCallback, eventOptions);
      return broker.subscribeTmp('event', key, eventCallback, {...eventOptions, noAck: true});

      function eventCallback(routingKey, message, owner) {
        if (eventName === 'error') return callback(makeErrorFromMessage(message));
        callback(owner.getApi(message));
      }
    }

    function once(eventName, callback, eventOptions = {}) {
      return on(eventName, callback, {...eventOptions, once: true});
    }

    function waitFor(eventName, onMessage) {
      const key = getEventRoutingKey(eventName);

      return new Promise((resolve, reject) => {
        const consumers = [
          broker.subscribeTmp('event', key, eventCallback, {noAck: true}),
          broker.subscribeTmp('event', '*.error', errorCallback, {noAck: true})
        ];

        function eventCallback(routingKey, message, owner) {
          if (onMessage && !onMessage(routingKey, message, owner)) return;
          unsubscribe();
          return resolve(owner.getApi(message));
        }

        function errorCallback(routingKey, message, owner) {
          if (!message.properties.mandatory) return;
          unsubscribe();
          return reject(makeErrorFromMessage(message));
        }

        function unsubscribe() {
          consumers.forEach((consumer) => consumer.cancel());
        }
      });
    }

    function onBrokerReturnFn(message) {
      if (message.properties.type === 'error') {
        const err = makeErrorFromMessage(message);
        throw err;
      }
    }

    function getEventRoutingKey(eventName) {
      if (eventName.indexOf('.') > -1) return eventName;

      switch (eventName) {
        case 'wait': {
          return `activity.${eventName}`;
        }
        case 'error': {
          return `${pfx}.error`;
        }
        default: {
          return `${pfx}.${eventName}`;
        }
      }
    }

    function emit(eventName, content = {}, props = {}) {
      broker.publish('event', `${pfx}.${eventName}`, {...content}, {type: eventName, ...props});
    }

    function emitFatal(error, content = {}) {
      emit('error', {...content, error}, {mandatory: true});
    }
  }

  function Activity(Behaviour, activityDef, context) {
    const {id, type = 'activity', name, parent: originalParent = {}, behaviour = {}, isParallelGateway, isSubProcess, triggeredByEvent, isThrowing} = activityDef;
    const isForCompensation = behaviour.isForCompensation;

    const parent = cloneParent(originalParent);
    const {environment, getInboundSequenceFlows, getOutboundSequenceFlows, getInboundAssociations} = context;

    const logger = environment.Logger(type.toLowerCase());
    const {step} = environment.settings;

    const {attachedTo: attachedToRef, ioSpecification: ioSpecificationDef, eventDefinitions} = behaviour;
    let attachedToActivity, attachedTo;

    if (attachedToRef) {
      attachedTo = attachedToRef.id;
      attachedToActivity = context.getActivityById(attachedToRef.id);
    }

    const inboundSequenceFlows = getInboundSequenceFlows(id) || [];
    const outboundSequenceFlows = getOutboundSequenceFlows(id) || [];
    const inboundAssociations = getInboundAssociations(id) || [];

    const isStart = inboundSequenceFlows.length === 0 && !attachedTo && !triggeredByEvent && !isForCompensation;
    const isEnd = outboundSequenceFlows.length === 0;
    const isParallelJoin = inboundSequenceFlows.length > 1 && isParallelGateway;
    const isMultiInstance = !!behaviour.loopCharacteristics;

    let execution, initExecutionId, executionId, stateMessage, status, stopped = false, executeMessage, consumingRunQ;

    const inboundTriggers = attachedToActivity ? [attachedToActivity] : inboundSequenceFlows.slice();
    const inboundJoinFlows = [];

    let counters = {
      taken: 0,
      discarded: 0,
    };

    const activityApi = {
      id,
      type,
      name,
      isEnd,
      isStart,
      isSubProcess,
      isThrowing,
      isForCompensation,
      triggeredByEvent,
      parent: cloneParent(parent),
      behaviour: {...behaviour, eventDefinitions},
      attachedTo: attachedToActivity,
      environment,
      inbound: inboundSequenceFlows,
      outbound: outboundSequenceFlows,
      get counters() {
        return {...counters};
      },
      get executionId() {
        return executionId;
      },
      get status() {
        return status;
      },
      get stopped() {
        return stopped;
      },
      get isRunning() {
        if (!consumingRunQ) return false;
        return !!status;
      },
      Behaviour,
      activate,
      deactivate,
      logger,
      discard,
      getApi,
      getActivityById,
      getState,
      init,
      recover,
      resume,
      run,
      shake,
      stop,
      next: step && next,
    };

    const {broker, on, once, waitFor, emitFatal} = ActivityBroker(activityApi);

    activityApi.on = on;
    activityApi.once = once;
    activityApi.waitFor = waitFor;
    activityApi.emitFatal = emitFatal;

    const runQ = broker.getQueue('run-q');
    const executionQ = broker.getQueue('execution-q');
    const formatRunQ = broker.getQueue('format-run-q');
    const inboundQ = broker.assertQueue('inbound-q', {durable: true, autoDelete: false});

    if (isForCompensation) {
      inboundAssociations.forEach((trigger) => {
        trigger.broker.subscribeTmp('event', '#', onInboundEvent, {noAck: true, consumerTag: `_inbound-${id}`});
      });
    } else {
      inboundTriggers.forEach((trigger) => {
        if (trigger.isSequenceFlow) trigger.broker.subscribeTmp('event', 'flow.#', onInboundEvent, {noAck: true, consumerTag: `_inbound-${id}`});
        else trigger.broker.subscribeTmp('event', 'activity.#', onInboundEvent, {noAck: true, consumerTag: `_inbound-${id}`});
      });
    }

    Object.defineProperty(activityApi, 'broker', {
      enumerable: true,
      get: () => broker,
    });

    Object.defineProperty(activityApi, 'execution', {
      enumerable: true,
      get: () => execution,
    });

    const ioSpecification = ioSpecificationDef && ioSpecificationDef.Behaviour(activityApi, ioSpecificationDef, context);

    const loaedEventDefinitions = eventDefinitions && eventDefinitions.map((ed) => ed.Behaviour(activityApi, ed, context));
    Object.defineProperty(activityApi, 'eventDefinitions', {
      enumerable: true,
      get: () => loaedEventDefinitions,
    });

    const extensions = context.loadExtensions(activityApi);
    Object.defineProperty(activityApi, 'extensions', {
      enumerable: true,
      get: () => extensions,
    });

    return activityApi;

    function init(initContent) {
      initExecutionId = initExecutionId || getUniqueId(id);
      logger.debug(`<${id}> initialized with executionId <${initExecutionId}>`);
      publishEvent('init', createMessage({...initContent, executionId: initExecutionId}));
    }

    function run(runContent) {
      if (activityApi.isRunning) throw new Error(`activity <${id}> is already running`);

      executionId = initExecutionId || getUniqueId(id);
      initExecutionId = undefined;

      consumeApi();

      const content = createMessage({...runContent, executionId});

      broker.publish('run', 'run.enter', content);
      broker.publish('run', 'run.start', cloneContent(content));

      consumeRunQ();
    }

    function createMessage(override = {}) {
      const result = {
        ...override,
        id,
        type,
        name,
        parent: cloneParent(parent),
      };

      const flags = {isEnd, isStart, isSubProcess, isMultiInstance, isForCompensation, attachedTo};
      for (const flag in flags) {
        if (flags[flag]) result[flag] = flags[flag];
      }

      return result;
    }

    function recover(state) {
      if (activityApi.isRunning) throw new Error(`cannot recover running activity <${id}>`);
      if (!state) return;

      stopped = state.stopped;
      status = state.status;
      executionId = state.executionId;

      if (state.counters) {
        counters = {...counters, ...state.counters};
      }

      if (state.execution) {
        execution = ActivityExecution(activityApi, context).recover(state.execution);
      }

      broker.recover(state.broker);

      return activityApi;
    }

    function resume() {
      if (consumingRunQ) {
        throw new Error(`cannot resume running activity <${id}>`);
      }
      if (!status) return activate();

      stopped = false;

      consumeApi();

      const content = createMessage();
      broker.publish('run', 'run.resume', content, {persistent: false});
      consumeRunQ();
    }

    function discard(discardContent) {
      if (!status) return runDiscard(discardContent);
      if (execution && !execution.completed) return execution.discard();

      deactivateRunConsumers();
      runQ.purge();
      broker.publish('run', 'run.discard', cloneContent(stateMessage.content));
      consumeRunQ();
    }

    function discardRun() {
      if (!status) return;

      if (execution && !execution.completed) return;
      switch (status) {
        case 'executing':
        case 'error':
        case 'discarded':
          return;
      }

      deactivateRunConsumers();
      runQ.purge();
      broker.publish('run', 'run.discard', cloneContent(stateMessage.content));
      consumeRunQ();
    }

    function runDiscard(discardContent = {}) {
      executionId = initExecutionId || getUniqueId(id);

      consumeApi();

      initExecutionId = undefined;

      const content = createMessage({...discardContent, executionId});
      broker.publish('run', 'run.discard', content);

      consumeRunQ();
    }

    function stop() {
      if (!activityApi.isRunning) return;
      getApi().stop();
    }

    function activate() {
      if (isForCompensation) return;
      return consumeInbound();
    }

    function deactivate() {
      broker.cancel('_run-on-inbound');
      broker.cancel('_format-consumer');
    }

    function consumeRunQ() {
      if (consumingRunQ) return;

      consumingRunQ = true;
      runQ.assertConsumer(onRunMessage, {exclusive: true, consumerTag: '_activity-run'});
    }

    function consumeApi() {
      if (!executionId) return;

      broker.cancel('_activity-api');
      broker.subscribeTmp('api', `activity.*.${executionId}`, onApiMessage, {noAck: true, consumerTag: '_activity-api', priority: 100});
    }

    function consumeInbound() {
      if (status) return;
      if (isParallelJoin) {
        return inboundQ.consume(onJoinInbound, {consumerTag: '_run-on-inbound', prefetch: 1000});
      }

      return inboundQ.consume(onInbound, {consumerTag: '_run-on-inbound'});
    }

    function deactivateRunConsumers() {
      broker.cancel('_activity-api');
      broker.cancel('_activity-run');
      broker.cancel('_activity-execution');
      consumingRunQ = false;
    }

    function onInboundEvent(routingKey, message) {
      const {fields, content, properties} = message;

      switch (routingKey) {
        case 'activity.enter':
        case 'activity.discard': {
          if (content.id === attachedToActivity.id) {
            inboundQ.queueMessage(fields, cloneContent(content), properties);
          }
          break;
        }
        case 'flow.shake': {
          shakeOutbound(message);
          break;
        }
        case 'association.take':
        case 'flow.take':
        case 'flow.discard':
          inboundQ.queueMessage(fields, cloneContent(content), properties);
          break;
        case 'association.discard': {
          logger.debug(`<${id}> compensation discarded`);
          inboundQ.purge();
          break;
        }
        case 'association.complete': {
          if (!isForCompensation) break;

          inboundQ.queueMessage(fields, cloneContent(content), properties);

          const compensationId = `${brokerSafeId(id)}_${brokerSafeId(content.sequenceId)}`;
          publishEvent('compensation.start', createMessage({
            executionId: compensationId,
            placeholder: true,
          }));

          logger.debug(`<${id}> start compensation with id <${compensationId}>`);

          consumeInbound();
          break;
        }
      }
    }

    function onInbound(routingKey, message) {
      message.ack();
      broker.cancel('_run-on-inbound');

      const content = message.content;
      const inbound = [cloneContent(content)];

      switch (routingKey) {
        case 'association.take':
        case 'flow.take':
        case 'activity.enter':
          run({
            message: content.message,
            inbound,
          });
          break;
        case 'flow.discard':
        case 'activity.discard': {
          let discardSequence;
          if (content.discardSequence) discardSequence = content.discardSequence.slice();
          runDiscard({inbound, discardSequence});
          break;
        }
        case 'association.complete': {
          broker.cancel('_run-on-inbound');

          const compensationId = `${brokerSafeId(id)}_${brokerSafeId(content.sequenceId)}`;
          logger.debug(`<${id}> completed compensation with id <${compensationId}>`);

          publishEvent('compensation.end', createMessage({
            executionId: compensationId,
          }));
          break;
        }
      }
    }

    function onJoinInbound(routingKey, message) {
      const {content} = message;
      const idx = inboundJoinFlows.findIndex((msg) => msg.content.id === content.id);

      inboundJoinFlows.push(message);

      if (idx > -1) return;

      const allTouched = inboundJoinFlows.length >= inboundTriggers.length;
      if (!allTouched) {
        const remaining = inboundSequenceFlows.filter((inb, i, list) => list.indexOf(inb) === i).length - inboundJoinFlows.length;
        logger.debug(`<${id}> inbound ${message.content.action} from <${message.content.id}>, ${remaining} remaining`);
        return init({inbound: inboundJoinFlows.map((f) => cloneContent(f.content))});
      }

      const evaluatedInbound = inboundJoinFlows.splice(0);

      let taken;
      const inbound = evaluatedInbound.map((im) => {
        if (im.fields.routingKey === 'flow.take') taken = true;
        im.ack();
        return cloneContent(im.content);
      });

      const discardSequence = !taken && evaluatedInbound.reduce((result, im) => {
        if (!im.content.discardSequence) return result;
        im.content.discardSequence.forEach((sourceId) => {
          if (result.indexOf(sourceId) === -1) result.push(sourceId);
        });
        return result;
      }, []);

      broker.cancel('_run-on-inbound');

      if (!taken) return runDiscard({inbound, discardSequence});
      return run({inbound});
    }

    function onRunMessage(routingKey, message, messageProperties) {
      switch (routingKey) {
        case 'run.next':
          return continueRunMessage(routingKey, message);
        case 'run.resume': {
          return onResumeMessage();
        }
      }

      return formatRunMessage(formatRunQ, message, (err, formattedContent) => {
        if (err) return broker.publish('run', 'run.error', err);
        message.content = formattedContent;
        continueRunMessage(routingKey, message);
      });

      function onResumeMessage() {
        message.ack();

        const {fields} = stateMessage;
        switch (fields.routingKey) {
          case 'run.enter':
          case 'run.start':
          case 'run.discarded':
          case 'run.end':
          case 'run.leave':
            break;
          default:
            return;
        }

        if (!fields.redelivered) return;

        logger.debug(`<${id}> resume from ${status}`);

        return broker.publish('run', fields.routingKey, cloneContent(stateMessage.content), stateMessage.properties);
      }
    }

    function continueRunMessage(routingKey, message) {
      broker.cancel('_format-consumer');

      const {fields, content: originalContent, ack} = message;
      const isRedelivered = fields.redelivered;
      const content = cloneContent(originalContent);

      stateMessage = message;

      switch (routingKey) {
        case 'run.enter': {
          logger.debug(`<${id}> enter`, isRedelivered ? 'redelivered' : '');

          status = 'entered';
          if (!isRedelivered) {
            execution = undefined;
          }

          if (extensions) extensions.activate(cloneMessage(message), activityApi);
          if (ioSpecification) ioSpecification.activate(message);

          if (!isRedelivered) publishEvent('enter', content);
          break;
        }
        case 'run.discard': {
          logger.debug(`<${id}> discard`, isRedelivered ? 'redelivered' : '');

          status = 'discard';
          execution = undefined;

          if (extensions) extensions.activate(cloneMessage(message), activityApi);
          if (ioSpecification) ioSpecification.activate(message);

          if (!isRedelivered) {
            broker.publish('run', 'run.discarded', content);
            publishEvent('discard', content);
          }
          break;
        }
        case 'run.start': {
          logger.debug(`<${id}> start`, isRedelivered ? 'redelivered' : '');
          status = 'started';
          if (!isRedelivered) {
            broker.publish('run', 'run.execute', content);
            publishEvent('start', content);
          }

          break;
        }
        case 'run.execute': {
          status = 'executing';
          executeMessage = message;

          if (isRedelivered) {
            if (extensions) extensions.activate(cloneMessage(message), activityApi);
            if (ioSpecification) ioSpecification.activate(message);
          }

          executionQ.assertConsumer(onExecutionMessage, {exclusive: true, consumerTag: '_activity-execution'});
          execution = execution || ActivityExecution(activityApi, context);

          return execution.execute(message);
        }
        case 'run.end': {
          if (status === 'end') break;

          counters.taken++;

          status = 'end';
          if (!isRedelivered) {
            broker.publish('run', 'run.leave', content);
            publishEvent('end', content);
          }
          break;
        }
        case 'run.error': {
          publishEvent('error', cloneContent(content, {
            error: fields.redelivered ? makeErrorFromMessage(message) : content.error,
          }));
          break;
        }
        case 'run.discarded': {
          logger.debug(`<${executionId} (${id})> discarded`);
          counters.discarded++;

          status = 'discarded';
          content.outbound = undefined;
          if (!isRedelivered) {
            broker.publish('run', 'run.leave', content);
          }
          break;
        }
        case 'run.leave': {
          const isDiscarded = status === 'discarded';

          status = undefined;

          broker.cancel('_activity-api');
          if (extensions) extensions.deactivate(message);

          if (isRedelivered) break;

          const ignoreOutbound = content.ignoreOutbound;
          let outbound, leaveContent;
          if (!ignoreOutbound) {
            outbound = prepareOutbound(content, isDiscarded);
            leaveContent = {...content, outbound: outbound.slice()};
          } else {
            leaveContent = content;
          }

          broker.publish('run', 'run.next', content);
          publishEvent('leave', leaveContent);
          if (!ignoreOutbound) doOutbound(outbound);
          break;
        }
        case 'run.next':
          consumeInbound();
          break;
      }

      if (!step) ack();
    }

    function onExecutionMessage(routingKey, message) {
      const content = cloneContent({
        ...executeMessage.content,
        ...message.content,
        executionId: executeMessage.content.executionId,
        parent: {...parent},
      });

      publishEvent(routingKey, content, message.properties);

      switch (routingKey) {
        case 'execution.outbound.take': {
          message.ack();
          const outbound = prepareOutbound(content);
          return doOutbound(outbound);
        }
        case 'execution.stopped': {
          message.ack();
          deactivate();
          deactivateRunConsumers();
          broker.cancel('_activity-execution');
          return publishEvent('stop');
        }
        case 'execution.error': {
          status = 'error';
          broker.publish('run', 'run.error', content);
          broker.publish('run', 'run.discarded', content);
          break;
        }
        case 'execution.discard':
          status = 'discarded';
          broker.publish('run', 'run.discarded', content);
          break;
        default: {
          if (content.outbound && content.outbound.discarded === outboundSequenceFlows.length) {
            status = 'discarded';
            broker.publish('run', 'run.discarded', content);
            break;
          }

          status = 'executed';
          broker.publish('run', 'run.end', content);
        }
      }

      message.ack();

      if (!step && executeMessage) {
        const ackMessage = executeMessage;
        executeMessage = null;
        ackMessage.ack();
      }
    }

    function onApiMessage(routingKey, message) {
      const messageType = message.properties.type;
      switch (messageType) {
        case 'discard': {
          discardRun();
          break;
        }
        case 'stop': {
          onStop(message);
          break;
        }
        case 'shake': {
          shakeOutbound(message);
          break;
        }
      }
    }

    function shake() {
      shakeOutbound({content: createMessage()});
    }

    function shakeOutbound(sourceMessage) {
      const message = cloneMessage(sourceMessage);
      message.content.sequence = message.content.sequence || [];
      message.content.sequence.push({id, type});

      if (!outboundSequenceFlows.length) {
        return broker.publish('event', 'activity.shake.end', message.content, {persistent: false, type: 'shake'});
      }

      outboundSequenceFlows.forEach((f) => f.shake(message));
    }

    function onStop(message) {
      if (!activityApi.isRunning) return;

      stopped = true;

      consumingRunQ = false;
      broker.cancel('_activity-run');
      broker.cancel('_activity-api');
      broker.cancel('_activity-execution');
      broker.cancel('_run-on-inbound');
      broker.cancel('_format-consumer');

      if (extensions) extensions.deactivate(message || createMessage());

      publishEvent('stop');
    }

    function publishEvent(state, content, messageProperties = {}) {
      if (!state) return;
      if (!content) content = createMessage();
      broker.publish('event', `activity.${state}`, {...content, state}, {
        ...messageProperties,
        type: state,
        mandatory: state === 'error',
        persistent: 'persistent' in messageProperties ? messageProperties.persistent : state !== 'stop',
      });
    }

    function prepareOutbound(fromContent, isDiscarded) {
      if (!outboundSequenceFlows.length) return [];

      const {message, outbound: evaluatedOutbound = []} = fromContent;
      let discardSequence = fromContent.discardSequence;
      if (isDiscarded && !discardSequence && attachedTo && fromContent.inbound && fromContent.inbound[0]) {
        discardSequence = [fromContent.inbound[0].id];
      }

      return outboundSequenceFlows.map((flow) => {
        const preparedFlow = getPrepared(flow.id);
        const sequenceId = flow.preFlight(preparedFlow.action);
        preparedFlow.sequenceId = sequenceId;
        return preparedFlow;
      });

      function getPrepared(flowId) {
        let evaluatedFlow = evaluatedOutbound.filter((flow) => flow.id === flowId).pop();
        if (!evaluatedFlow) {
          evaluatedFlow = {
            id: flowId,
            action: isDiscarded ? 'discard' : 'take',
          };
          if (message !== undefined) evaluatedFlow.message = message;
        }
        evaluatedFlow.discardSequence = discardSequence;
        if (message !== undefined && !('message' in evaluatedFlow)) evaluatedFlow.message = message;
        return evaluatedFlow;
      }
    }

    function doOutbound(preparedOutbound) {
      if (!preparedOutbound) return;

      outboundSequenceFlows.forEach((flow, idx) => {
        const preparedFlow = preparedOutbound[idx];
        flow[preparedFlow.action](preparedFlow);
      });
    }

    function getActivityById(elementId) {
      return context.getActivityById(elementId);
    }

    function getState() {
      const msg = createMessage();

      return {
        ...msg,
        status,
        executionId,
        stopped,
        behaviour: {...behaviour},
        counters: {...counters},
        broker: broker.getState(),
        execution: execution && execution.getState(),
      };
    }

    function next() {
      if (!step) return;
      if (!stateMessage) return;
      if (status === 'executing') return false;
      if (status === 'formatting') return false;
      const current = stateMessage;
      stateMessage.ack();
      return current;
    }

    function getApi(message) {
      if (execution && !execution.completed) return execution.getApi(message);
      return ActivityApi(broker, message || stateMessage);
    }

    function formatRunMessage(formatQ, runMessage, callback) {
      const startFormatMsg = formatQ.get();
      if (!startFormatMsg) return callback(null, runMessage.content);

      const pendingFormats = [];
      const {fields, content} = runMessage;
      const fundamentals = {
        id: content.id,
        type: content.type,
        parent: cloneParent(content.parent),
        attachedTo: content.attachedTo,
        executionId: content.executionId,
        isSubProcess: content.isSubProcess,
        isMultiInstance: content.isMultiInstance,
      };
      if (content.inbound) {
        fundamentals.inbound = content.inbound.slice();
      }
      if (content.outbound) {
        fundamentals.outbound = content.outbound.slice();
      }

      let formattedContent = cloneContent(content);

      const depleted = formatQ.on('depleted', () => {
        if (pendingFormats.length) return;
        depleted.cancel();
        logger.debug(`<${id}> completed formatting ${fields.routingKey}`);
        broker.cancel('_format-consumer');
        callback(null, filterUndefined(formattedContent));
      });

      status = 'formatting';

      onFormatMessage(startFormatMsg.fields.routingKey, startFormatMsg);
      formatQ.assertConsumer(onFormatMessage, { consumerTag: '_format-consumer', prefetch: 100 });

      function onFormatMessage(routingKey, message) {
        const isStartFormat = message.content.endRoutingKey;

        if (isStartFormat) {
          pendingFormats.push(message);
          return logger.debug(`<${id}> start formatting ${fields.routingKey} message content with formatter ${routingKey}`);
        }

        popFormattingStart(routingKey);

        logger.debug(`<${id}> format ${fields.routingKey} message content`);

        formattedContent = {
          ...formattedContent,
          ...message.content,
          ...fundamentals,
        };

        message.ack();
      }

      function popFormattingStart(routingKey) {
        for (let i = 0; i < pendingFormats.length; i++) {
          const pendingFormat = pendingFormats[i];
          if (getRoutingKeyPattern(pendingFormat.content.endRoutingKey).test(routingKey)) {
            logger.debug(`<${id}> completed formatting ${fields.routingKey} message content with formatter ${routingKey}`);
            pendingFormats.splice(i, 1);
            pendingFormat.ack();
            break;
          }
        }
      }
    }
  }

  function Association(associationDef, {environment}) {
    const {id, type = 'association', name, parent: originalParent, targetId, sourceId, behaviour = {}} = associationDef;
    const parent = cloneParent(originalParent);
    const logger = environment.Logger(type.toLowerCase());

    const counters = {
      complete: 0,
      take: 0,
      discard: 0,
    };

    const associationApi = {
      id,
      type,
      name,
      parent,
      behaviour,
      sourceId,
      targetId,
      isAssociation: true,
      environment,
      get counters() {
        return {...counters};
      },
      complete,
      discard,
      getApi,
      getState,
      recover,
      stop,
      take,
    };

    const {broker, on, once, waitFor} = EventBroker(associationApi, {prefix: 'association', durable: true, autoDelete: false});

    associationApi.on = on;
    associationApi.once = once;
    associationApi.waitFor = waitFor;

    Object.defineProperty(associationApi, 'broker', {
      enumerable: true,
      get: () => broker,
    });

    logger.debug(`<${id}> init, <${sourceId}> -> <${targetId}>`);

    return associationApi;

    function take(content = {}) {
      logger.debug(`<${id}> take target <${targetId}>`);
      ++counters.discard;

      publishEvent('take', content);

      return true;
    }

    function discard(content = {}) {
      logger.debug(`<${id}> discard target <${targetId}>`);
      ++counters.take;

      publishEvent('discard', content);

      return true;
    }

    function complete(content = {}) {
      logger.debug(`<${id}> completed target <${targetId}>`);
      ++counters.complete;

      publishEvent('complete', content);

      return true;
    }

    function publishEvent(action, content) {
      const eventContent = createMessageContent({
        action,
        message: content,
        sequenceId: getUniqueId(id),
      });

      broker.publish('event', `association.${action}`, eventContent, {type: action});
    }

    function createMessageContent(override = {}) {
      return {
        ...override,
        id,
        type,
        name,
        sourceId,
        targetId,
        isAssociation: true,
        parent: cloneParent(parent),
      };
    }

    function getState() {
      const result = {
        id,
        type,
        name,
        sourceId,
        targetId,
        counters: {...counters},
      };
      result.broker = broker.getState();
      return result;
    }

    function recover(state) {
      Object.assign(counters, state.counters);
      broker.recover(state.broker);
    }

    function getApi(message) {
      return FlowApi(broker, message || {content: createMessageContent()});
    }

    function stop() {
      broker.stop();
    }
  }

  function EventDefinitionExecution(activity, eventDefinitions, completedRoutingKey = 'execute.completed') {
    const {id, broker, logger} = activity;
    const executeConsumerTag = '_eventdefinition-execution-execute-tag';
    const apiConsumerTag = '_eventdefinition-execution-api-tag';

    let parentExecutionContent, parent, completed = false, stopped = false;

    return {
      execute,
      get completed() {
        return completed;
      },
    };

    function execute(executeMessage) {
      const executeContent = executeMessage.content;
      const isRedelivered = executeMessage.fields.redelivered;
      const {isRootScope, isDefinitionScope, executionId: messageExecutionId} = executeContent;

      if (isDefinitionScope) return executeDefinition();

      let parentExecutionId;
      if (isRootScope) {
        parentExecutionId = messageExecutionId;
        parentExecutionContent = executeContent;

        broker.subscribeTmp('execution', 'execute.#', onExecuteMessage, {noAck: true, consumerTag: executeConsumerTag, priority: 300});
        broker.subscribeTmp('api', `activity.*.${parentExecutionId}`, onApiMessage, {noAck: true, consumerTag: apiConsumerTag, priority: 300});

        parent = unshiftParent(parentExecutionContent.parent, parentExecutionContent);
        broker.publish('execution', 'execute.update', {...cloneContent(parentExecutionContent), preventComplete: true});
      }
      if (isRedelivered) return;

      for (let index = 0; index < eventDefinitions.length; ++index) {
        if (completed) break;
        if (stopped) break;

        const ed = eventDefinitions[index];
        const executionId = `${messageExecutionId}_${index}`;

        logger.debug(`<${messageExecutionId} (${id})> start event definition ${ed.type}, index ${index}`);

        broker.publish('execution', 'execute.start', {
          ...cloneContent(parentExecutionContent),
          isRootScope: undefined,
          type: ed.type,
          executionId,
          isDefinitionScope: true,
          index,
          parent,
        });
      }

      function onApiMessage(_, message) {
        const messageType = message.properties.type;
        switch (messageType) {
          case 'stop':
            stopped = true;
          case 'discard':
            return stop();
        }
      }

      function onExecuteMessage(routingKey, message) {
        switch (routingKey) {
          case 'execute.completed': {
            stop();
            if (message.content.isDefinitionScope) return complete();
            break;
          }
          case 'execute.discard': {
            if (message.content.isDefinitionScope) {
              logger.debug(`<${message.content.executionId} (${id})> event definition ${message.content.type} discarded, index ${message.content.index}`);
              break;
            }
            stop();
            logger.debug(`<${message.content.executionId} (${id})> event definition parent execution discarded`);
            break;
          }
        }

        function complete() {
          const content = cloneContent(message.content);
          completed = true;

          logger.debug(`<${content.executionId} (${id})> event definition ${content.type} completed, index ${content.index}`);

          broker.publish('execution', completedRoutingKey, {
            ...cloneContent(content),
            executionId: parentExecutionId,
            isRootScope: true,
            parent: shiftParent(content.parent),
          });
        }
      }

      function executeDefinition() {
        const ed = eventDefinitions[executeContent.index];
        if (!ed) return logger.warn(`<${messageExecutionId} (${id})> found no event definition on index ${executeContent.index}`);
        logger.debug(`<${messageExecutionId} (${id})> execute event definition ${ed.type}, index ${executeContent.index}`);
        ed.execute(executeMessage);
      }

      function stop() {
        broker.cancel(executeConsumerTag);
        broker.cancel(apiConsumerTag);
      }
    }
  }

  function BoundaryEvent(activityDef, context) {
    return Activity(BoundaryEventBehaviour, activityDef, context);
  }

  function BoundaryEventBehaviour(activity) {
    const {id, type = 'BoundaryEvent', broker, environment, attachedTo, behaviour = {}, eventDefinitions, logger} = activity;
    const attachedToId = attachedTo.id;

    const cancelActivity = 'cancelActivity' in behaviour ? behaviour.cancelActivity : true;
    const eventDefinitionExecution = eventDefinitions && EventDefinitionExecution(activity, eventDefinitions, 'execute.bound.completed');

    return {
      id,
      type,
      attachedTo,
      cancelActivity,
      execute,
    };

    function execute(executeMessage) {
      const executeContent = cloneContent(executeMessage.content);
      const {isRootScope, executionId, inbound} = executeContent;

      let parentExecutionId, completeContent;
      const errorConsumerTags = [];
      if (isRootScope) {
        parentExecutionId = executionId;
        if (eventDefinitionExecution && !environment.settings.strict) {
          broker.subscribeTmp('execution', 'execute.expect', onExpectMessage, {noAck: true, consumerTag: '_expect-tag'});
        }

        attachedTo.broker.subscribeTmp('event', 'activity.leave', onAttachedLeave, {noAck: true, consumerTag: `_bound-listener-${parentExecutionId}`, priority: 300});

        broker.subscribeOnce('execution', 'execute.detach', onDetachMessage, {consumerTag: '_detach-tag'});
        broker.subscribeOnce('api', `activity.#.${parentExecutionId}`, onApiMessage, {consumerTag: `_api-${parentExecutionId}`});
        broker.subscribeOnce('execution', 'execute.bound.completed', onCompleted, {consumerTag: `_execution-completed-${parentExecutionId}`});
      }

      if (eventDefinitionExecution) eventDefinitionExecution.execute(executeMessage);

      function onCompleted(_, message) {
        if (!cancelActivity && !message.content.cancelActivity) {
          stop();
          return broker.publish('execution', 'execute.completed', cloneContent(message.content));
        }

        completeContent = message.content;

        const attachedToContent = inbound && inbound[0];
        logger.debug(`<${executionId} (id)> cancel ${attachedTo.status} activity <${attachedToContent.executionId} (${attachedToContent.id})>`);

        attachedTo.getApi({content: attachedToContent}).discard();
      }

      function onAttachedLeave(routingKey, message) {
        if (message.content.id !== attachedToId) return;
        stop();
        if (!completeContent) return broker.publish('execution', 'execute.discard', executeContent);
        return broker.publish('execution', 'execute.completed', completeContent);
      }

      function onExpectMessage(_, message) {
        const errorConsumerTag = `_bound-error-listener-${message.content.executionId}`;
        errorConsumerTags.push(errorConsumerTag);
        attachedTo.broker.subscribeTmp('event', 'activity.error', attachedErrorHandler(message.content.expectRoutingKey), {noAck: true, consumerTag: errorConsumerTag, priority: 300});
      }

      function attachedErrorHandler(routingKey) {
        return function onAttachedError(_, message) {
          if (message.content.id !== attachedToId) return;
          broker.publish('execution', routingKey, cloneContent(message.content));
        };
      }

      function onDetachMessage(_, {content}) {
        logger.debug(`<${parentExecutionId} (${id})> detach from activity <${attachedTo.id}>`);
        stop(true);

        const bindExchange = content.bindExchange;
        attachedTo.broker.subscribeTmp('execution', '#', onAttachedExecuteMessage, {noAck: true, consumerTag: `_bound-listener-${parentExecutionId}`});
        broker.subscribeOnce('execution', 'execute.bound.completed', onDetachedCompleted, {consumerTag: `_execution-completed-${parentExecutionId}`});

        function onAttachedExecuteMessage(routingKey, message) {
          broker.publish(bindExchange, routingKey, cloneContent(message.content), message.properties);
        }
      }

      function onDetachedCompleted(_, message) {
        stop();
        return broker.publish('execution', 'execute.completed', cloneContent(message.content));
      }

      function onApiMessage(_, message) {
        const messageType = message.properties.type;
        switch (messageType) {
          case 'discard':
            stop();
            break;
          case 'stop':
            stop();
            break;
        }
      }

      function stop(detach) {
        attachedTo.broker.cancel(`_bound-listener-${parentExecutionId}`);
        attachedTo.broker.cancel(`_bound-error-listener-${parentExecutionId}`);
        errorConsumerTags.forEach((tag) => attachedTo.broker.cancel(tag));

        broker.cancel('_expect-tag');
        broker.cancel('_detach-tag');
        broker.cancel(`_execution-completed-${parentExecutionId}`);

        if (detach) return;

        broker.cancel(`_api-${parentExecutionId}`);
      }
    }
  }

  function BpmnErrorActivity(errorDef, context) {
    const {id, type, name = 'BpmnError', behaviour = {}} = errorDef;
    const {environment} = context;

    return {
      id,
      type,
      name,
      errorCode: behaviour.errorCode,
      resolve,
    };

    function resolve(executionMessage, error) {
      const resolveCtx = {...executionMessage, error};
      const result = {
        id,
        type,
        messageType: 'throw',
        name: name && environment.resolveExpression(name, resolveCtx),
        code: behaviour.errorCode && environment.resolveExpression(behaviour.errorCode, resolveCtx),
      };

      if (error) result.inner = error;
      return result;
    }
  }

  function CompensationEventDefinition(activity, eventDefinition, context) {
    const {id, broker, environment, isThrowing} = activity;
    const {type} = eventDefinition;
    const {debug} = environment.Logger(type.toLowerCase());
    const compensationQueueName = `compensate-${brokerSafeId(id)}-q`;
    const associations = context.getOutboundAssociations(id) || [];

    if (!isThrowing) setupCatch();

    const source = {
      id,
      type,
      reference: {referenceType: 'compensate'},
      execute: isThrowing ? executeThrow : executeCatch,
    };

    return source;

    function executeCatch(executeMessage) {
      let completed;

      const messageContent = cloneContent(executeMessage.content);
      const {executionId, parent} = messageContent;
      const parentExecutionId = parent && parent.executionId;

      broker.consume(compensationQueueName, onCompensateApiMessage, {noAck: true, consumerTag: `_oncompensate-${executionId}`});

      if (completed) return;

      broker.subscribeTmp('api', `activity.#.${executionId}`, onApiMessage, {noAck: true, consumerTag: `_api-${executionId}`});

      if (completed) return stop();

      debug(`<${executionId} (${id})> expect compensate`);

      broker.assertExchange('compensate', 'topic');
      const compensateQ = broker.assertQueue('compensate-q', {durable: true, autoDelete: false});
      broker.subscribeTmp('compensate', 'execute.#', onCollect, {noAck: true, consumerTag: '_oncollect-messages'});

      broker.publish('execution', 'execute.detach', cloneContent({
        ...messageContent,
        bindExchange: 'compensate',
      }));

      broker.publish('event', 'activity.detach', {
        ...messageContent,
        executionId: parentExecutionId,
        parent: shiftParent(parent),
        bindExchange: 'compensate',
      });

      function onCollect(routingKey, message) {
        switch (routingKey) {
          case 'execute.error':
          case 'execute.completed': {
            return compensateQ.queueMessage(message.fields, cloneContent(message.content), message.properties);
          }
        }
      }

      function onCompensateApiMessage(routingKey, message) {
        const output = message.content.message;
        completed = true;

        stop();

        debug(`<${executionId} (${id})> caught compensate event`);
        broker.publish('event', 'activity.catch', {
          ...messageContent,
          message: {...output},
          executionId: parentExecutionId,
          parent: shiftParent(executeMessage.content.parent),
        }, {type: 'catch'});

        compensateQ.on('depleted', onDepleted);
        compensateQ.consume(onCollected, {noAck: true, consumerTag: '_convey-messages'});

        associations.forEach((association) => {
          association.complete(cloneMessage(message));
        });

        function onDepleted() {
          compensateQ.off('depleted', onDepleted);
          return broker.publish('execution', 'execute.completed', {...messageContent, output, state: 'catch'});
        }
      }

      function onCollected(routingKey, message) {
        associations.forEach((association) => {
          association.take(cloneMessage(message));
        });
      }

      function onApiMessage(routingKey, message) {
        const messageType = message.properties.type;

        switch (messageType) {
          case 'compensate': {
            return onCompensateApiMessage(routingKey, message);
          }
          case 'discard': {
            completed = true;
            stop();
            associations.forEach((association) => {
              association.discard(cloneMessage(message));
            });
            return broker.publish('execution', 'execute.discard', {...messageContent});
          }
          case 'stop': {
            stop();
            break;
          }
        }
      }

      function stop() {
        broker.cancel(`_api-${executionId}`);
        broker.cancel(`_oncompensate-${executionId}`);
        broker.cancel('_oncollect-messages');
        broker.cancel('_convey-messages');
      }
    }

    function executeThrow(executeMessage) {
      const messageContent = cloneContent(executeMessage.content);
      const {executionId, parent} = messageContent;
      const parentExecutionId = parent && parent.executionId;

      debug(`<${executionId} (${id})> throw compensate`);

      broker.publish('event', 'activity.compensate', {
        ...cloneContent(messageContent),
        executionId: parentExecutionId,
        parent: shiftParent(parent),
        state: 'throw',
      }, {type: 'compensate', delegate: true});

      return broker.publish('execution', 'execute.completed', {...messageContent});
    }

    function setupCatch() {
      broker.assertQueue(compensationQueueName, {autoDelete: false, durable: true});
      broker.bindQueue(compensationQueueName, 'api', '*.compensate.#', {durable: true, priority: 400});
    }
  }

  function ConditionalEventDefinition(activity, eventDefinition) {
    const {id, broker, environment, attachedTo} = activity;
    const {type = 'ConditionalEventDefinition', behaviour = {}} = eventDefinition;
    const {debug} = environment.Logger(type.toLowerCase());
    const condition = behaviour.expression;
    const isWaiting = !attachedTo;

    const source = {
      type,
      condition,
      execute,
    };

    return source;

    function execute(executeMessage) {
      return isWaiting ? executeWait(executeMessage) : executeCatch(executeMessage);
    }

    function executeCatch(executeMessage) {
      const attachedToBroker = attachedTo.broker;
      const messageContent = cloneContent(executeMessage.content);

      const {executionId, index} = messageContent;
      messageContent.condition = condition;

      const apiConsumerTag = `_api-${executionId}_${index}`;
      const endConsumerTag = `_onend-${executionId}_${index}`;

      broker.subscribeTmp('api', `activity.#.${executionId}`, onApiMessage, {noAck: true, consumerTag: apiConsumerTag});

      debug(`<${executionId} (${id})> listen for execute completed from <${attachedTo.id}>`);
      attachedToBroker.subscribeOnce('execution', 'execute.completed', onAttachedCompleted, {priority: 300, consumerTag: endConsumerTag});

      function onAttachedCompleted(routingKey, endMessage) {
        stop();

        const output = environment.resolveExpression(condition, endMessage);
        debug(`<${executionId} (${id})> condition from <${endMessage.content.executionId}> evaluated to`, !!output);

        broker.publish('event', 'activity.condition', {
          ...cloneContent(messageContent),
          conditionResult: output,
        });

        if (output) {
          broker.publish('execution', 'execute.completed', {
            ...messageContent,
            output,
          });
        }
      }

      function onApiMessage(routingKey, message) {
        const messageType = message.properties.type;
        switch (messageType) {
          case 'discard': {
            stop();
            debug(`<${executionId} (${id})> discarded`);
            return broker.publish('execution', 'execute.discard', {...messageContent, state: 'discard'});
          }
          case 'stop': {
            stop();
            return debug(`<${executionId} (${id})> stopped`);
          }
        }
      }

      function stop() {
        attachedToBroker.cancel(endConsumerTag);
        broker.cancel(apiConsumerTag);
      }
    }

    function executeWait(executeMessage) {
      const messageContent = cloneContent(executeMessage.content);
      messageContent.condition = condition;
      const {executionId, parent} = messageContent;
      const parentExecutionId = parent && parent.executionId;

      if (evaluate(executeMessage)) return;

      broker.subscribeTmp('api', `activity.#.${executionId}`, onApiMessage, {noAck: true, consumerTag: `_api-${executionId}`});
      broker.subscribeTmp('api', `activity.signal.${parentExecutionId}`, onApiMessage, {noAck: true, consumerTag: `_parent-signal-${executionId}`});

      broker.publish('event', 'activity.wait', {...cloneContent(messageContent), executionId: parentExecutionId, parent: shiftParent(parent)});

      function onApiMessage(routingKey, message) {
        const messageType = message.properties.type;

        switch (messageType) {
          case 'signal': {
            return evaluate(message);
          }
          case 'discard': {
            stop();
            return broker.publish('execution', 'execute.discard', {...messageContent, state: 'discard'});
          }
          case 'stop': {
            stop();
            break;
          }
        }
      }

      function evaluate(message) {
        const output = environment.resolveExpression(condition, message);
        debug(`<${executionId} (${id})> condition evaluated to`, !!output);

        broker.publish('event', 'activity.condition', {
          ...cloneContent(messageContent),
          conditionResult: output,
        });

        if (!output) return;
        stop();
        return broker.publish('execution', 'execute.completed', {...messageContent, output});
      }

      function stop() {
        broker.cancel(`_api-${executionId}`);
        broker.cancel(`_parent-signal-${executionId}`);
      }
    }
  }

  const propertyPattern = /(\w+)\((.*?)(?:\))|(\.|\[|^)(.+?)(?:\]|\[|\.|$)/;
  const stringConstantPattern = /^(['"])(.*)\1$/;
  const numberConstantPattern = /^\W*-?\d+(.\d+)?\W*$/;
  const negativeIndexPattern = /^-\d+$/;

  function getPropertyValue(inputContext, propertyPath, fnScope) {
    if (!inputContext) return;

    let resultValue;
    let next = iterateProps(inputContext, inputContext, propertyPath.trim());
    while (next) {
      resultValue = next.getResult();
      next = next();
    }
    return resultValue;

    function iterateProps(base, iterateContext, iteratePropertyPath) {
      let result;
      const rest = iteratePropertyPath.replace(propertyPattern, (match, fnName, args, p, prop) => {
        if (fnName) {
          result = executeFn(getNamedValue(iterateContext, fnName), args, base);
        } else {
          result = getNamedValue(iterateContext, prop);
        }
        return '';
      });


      if (rest === iteratePropertyPath) return;
      if (result === undefined || result === null) return;

      const iterateNext = () => iterateProps(base, result, rest);
      iterateNext.getResult = () => {
        if (rest !== '') return;
        return result;
      };

      return iterateNext;
    }

    function executeFn(fn, args, base) {
      if (!fn) return;

      let callArguments = [];
      if (args) {
        callArguments = callArguments.concat(args.split(','));
        callArguments = callArguments.map((argument) => {
          return getFunctionArgument(base, argument, fnScope);
        });
      } else {
        callArguments.push(base);
      }

      if (!fnScope) return fn.apply(null, callArguments);

      return (function ScopedIIFE() { // eslint-disable-line no-extra-parens
        return fn.apply(this, callArguments);
      }).call(fnScope);
    }
  }

  function getFunctionArgument(obj, argument, fnScope) {
    const stringMatch = argument.match(stringConstantPattern);
    if (stringMatch) {
      return stringMatch[2];
    } else if (numberConstantPattern.test(argument)) {
      return Number(argument);
    }
    return getPropertyValue(obj, argument, fnScope);
  }

  function getNamedValue(obj, property) {
    if (Array.isArray(obj)) {
      return getArrayItem(obj, property);
    }
    return obj[property];
  }

  function getArrayItem(list, idx) {
    if (negativeIndexPattern.test(idx)) {
      const nidx = Number(idx);
      const aidx = nidx === 0 ? 0 : list.length + nidx;
      return list[aidx];
    }
    return list[idx];
  }

  const expressionPattern = /\${(.+?)}/;

  function resolveExpressions(templatedString, context, expressionFnContext) {
    let result = templatedString;

    while (expressionPattern.test(result)) {
      const expressionMatch = result.match(expressionPattern);
      const innerProperty = expressionMatch[1];

      if (innerProperty === 'true') {
        return true;
      } else if (innerProperty === 'false') {
        return false;
      }

      const contextValue = getPropertyValue(context, innerProperty, expressionFnContext);

      if (expressionMatch.input === expressionMatch[0]) {
        return contextValue;
      }

      result = result.replace(expressionMatch[0], contextValue === undefined ? '' : contextValue);
    }
    return result;
  }

  function Scripts() {
    return {
      getScript,
      register,
    };

    function getScript(/*scriptType, activity*/) {}
    function register(/*activity*/) {}
  }

  const defaultOptions = ['extensions', 'output', 'services', 'scripts', 'settings', 'variables', 'Logger'];

  function Environment(options = {}) {
    const initialOptions = validateOptions(options);

    let variables = options.variables || {};
    const settings = {...(options.settings || {})};
    const output = options.output || {};
    const services = options.services || {};
    const scripts = options.scripts || Scripts();
    const Logger = options.Logger || DummyLogger;
    const extensions = options.extensions;

    const environmentApi = {
      options: initialOptions,
      extensions,
      output,
      scripts,
      services,
      settings,
      get variables() {
        return variables;
      },
      addService,
      assignVariables,
      clone,
      getScript,
      getServiceByName,
      getState,
      registerScript,
      resolveExpression,
      recover,
      Logger,
    };

    return environmentApi;

    function getState() {
      return {
        settings: {...settings},
        variables: {...variables},
        output: {...output},
      };
    }

    function recover(state) {
      if (!state) return environmentApi;

      const recoverOptions = validateOptions(state);
      Object.assign(options, recoverOptions);

      if (state.settings) Object.assign(settings, state.settings);
      if (state.variables) Object.assign(variables, state.variables);
      if (state.output) Object.assign(output, state.output);

      return environmentApi;
    }

    function clone(overrideOptions = {}) {
      const newOptions = {
        settings: {...settings},
        variables: {...variables},
        output: {...output},
        Logger,
        extensions,
        scripts,
        ...initialOptions,
        ...overrideOptions,
        services,
      };

      if (overrideOptions.services) newOptions.services = {...services, ...overrideOptions.services};

      return Environment(newOptions);
    }

    function assignVariables(newVars) {
      if (!newVars || typeof newVars !== 'object') return;

      variables = {
        ...variables,
        ...newVars,
      };
    }

    function getScript(...args) {
      return scripts.getScript(...args);
    }

    function registerScript(...args) {
      return scripts.register(...args);
    }

    function getServiceByName(serviceName) {
      return services[serviceName];
    }

    function resolveExpression(expression, message = {}, expressionFnContext) {
      const from = {
        environment: environmentApi,
        ...message,
      };

      return resolveExpressions(expression, from, expressionFnContext);
    }

    function addService(name, fn) {
      services[name] = fn;
    }
  }

  function validateOptions(input) {
    const options = {};
    for (const key in input) {
      if (defaultOptions.indexOf(key) === -1) {
        options[key] = input[key];
      }
    }

    if (input.scripts) {
      if (typeof input.scripts.register !== 'function') throw new Error('scripts.register is not a function');
      if (typeof input.scripts.getScript !== 'function') throw new Error('scripts.getScript is not a function');
    }

    if (input.extensions) {
      if (typeof input.extensions !== 'object') throw new Error('extensions is not an object');
      for (const key in input.extensions) {
        if (typeof input.extensions[key] !== 'function') throw new Error(`extensions[${key}] is not a function`);
      }
    }

    return options;
  }

  function DummyLogger() {
    return {
      debug,
      error,
      warn,
    };
    function debug() {}
    function error() {}
    function warn() {}
  }

  function ExtensionsMapper(context) {
    const {extensions: envExtensions} = context.environment;
    const extensions = getExtensions();

    return {
      get,
    };

    function get(activity) {
      const activityExtensions = extensions.reduce(applyExtension, []);
      return {
        activate,
        deactivate,
      };

      function applyExtension(result, Extension) {
        const extension = Extension(activity, context);
        if (extension) result.push(extension);
        return result;
      }

      function activate(message) {
        activityExtensions.forEach((extension) => extension.activate(message));
      }
      function deactivate(message) {
        activityExtensions.forEach((extension) => extension.deactivate(message));
      }
    }

    function getExtensions() {
      const result = [];
      if (!envExtensions) return result;

      for (const key in envExtensions) {
        const extension = envExtensions[key];
        if (extension) {
          result.push(extension);
        }
      }
      return result;
    }
  }

  function Context$1(definitionContext, environment) {
    environment = environment ? environment.clone() : Environment();
    return ContextInstance(definitionContext, environment);
  }

  function ContextInstance(definitionContext, environment) {
    const {id = 'Def', name, type = 'context'} = definitionContext;
    const sid = getUniqueId(id);

    const activityRefs = {}, dataObjectRefs = {}, messageFlows = [], processRefs = {}, sequenceFlowRefs = {}, associationRefs = [];

    const context = {
      id,
      name,
      type,
      sid,
      definitionContext,
      environment,
      clone,
      getActivities,
      getActivityById,
      getAssociations,
      getExecutableProcesses,
      getDataObjectById,
      getInboundAssociations,
      getInboundSequenceFlows,
      getMessageFlows,
      getOutboundSequenceFlows,
      getOutboundAssociations,
      getProcessById,
      getProcesses,
      getSequenceFlowById,
      getSequenceFlows,
      getStartActivities,
      loadExtensions,
    };

    const extensionsMapper = ExtensionsMapper(context);

    return context;

    function getActivityById(activityId) {
      const activityInstance = activityRefs[activityId];
      if (activityInstance) return activityInstance;
      const activity = definitionContext.getActivityById(activityId);
      if (!activity) return null;
      return upsertActivity(activity);
    }

    function upsertActivity(activityDef) {
      let activityInstance = activityRefs[activityDef.id];
      if (activityInstance) return activityInstance;

      activityInstance = activityRefs[activityDef.id] = activityDef.Behaviour(activityDef, context);

      return activityInstance;
    }

    function getSequenceFlowById(sequenceFlowId) {
      const flowInstance = sequenceFlowRefs[sequenceFlowId];
      if (flowInstance) return flowInstance;

      const flowDef = definitionContext.getSequenceFlowById(sequenceFlowId);
      if (!flowDef) return null;
      return upsertSequenceFlow(flowDef);
    }

    function getInboundSequenceFlows(activityId) {
      return (definitionContext.getInboundSequenceFlows(activityId) || []).map((flow) => upsertSequenceFlow(flow));
    }

    function getOutboundSequenceFlows(activityId) {
      return (definitionContext.getOutboundSequenceFlows(activityId) || []).map((flow) => upsertSequenceFlow(flow));
    }

    function getInboundAssociations(activityId) {
      return (definitionContext.getInboundAssociations(activityId) || []).map((association) => upsertAssociation(association));
    }

    function getOutboundAssociations(activityId) {
      return (definitionContext.getOutboundAssociations(activityId) || []).map((association) => upsertAssociation(association));
    }

    function getActivities(scopeId) {
      return (definitionContext.getActivities(scopeId) || []).map((activityDef) => upsertActivity(activityDef));
    }

    function getSequenceFlows(scopeId) {
      return (definitionContext.getSequenceFlows(scopeId) || []).map((flow) => upsertSequenceFlow(flow));
    }

    function upsertSequenceFlow(flowDefinition) {
      let flowInstance = sequenceFlowRefs[flowDefinition.id];
      if (flowInstance) return flowInstance;

      flowInstance = sequenceFlowRefs[flowDefinition.id] = flowDefinition.Behaviour(flowDefinition, context);

      return flowInstance;
    }

    function getAssociations(scopeId) {
      return (definitionContext.getAssociations(scopeId) || []).map((association) => upsertAssociation(association));
    }

    function upsertAssociation(associationDefinition) {
      let instance = associationRefs[associationDefinition.id];
      if (instance) return instance;

      instance = associationRefs[associationDefinition.id] = associationDefinition.Behaviour(associationDefinition, context);

      return instance;
    }

    function clone(newEnvironment) {
      return ContextInstance(definitionContext, newEnvironment || environment);
    }

    function getProcessById(processId) {
      let processInstance = processRefs[processId];
      if (processInstance) return processInstance;

      const processDefinition = definitionContext.getProcessById(processId);
      if (!processDefinition) return null;
      processInstance = processRefs[processId] = processDefinition.Behaviour(processDefinition, context);

      return processInstance;
    }

    function getProcesses() {
      return definitionContext.getProcesses().map(({id: processId}) => getProcessById(processId));
    }

    function getExecutableProcesses() {
      return definitionContext.getExecutableProcesses().map(({id: processId}) => getProcessById(processId));
    }

    function getMessageFlows(sourceId) {
      if (!messageFlows.length) {
        const flows = definitionContext.getMessageFlows() || [];
        messageFlows.push(...flows.map((flow) => flow.Behaviour(flow, context)));
      }

      return messageFlows.filter((flow) => flow.source.processId === sourceId);
    }

    function getDataObjectById(dataObjectId) {
      let dataObject;
      if ((dataObject = dataObjectRefs[dataObjectId])) return dataObject;

      const dataObjectDef = definitionContext.getDataObjectById(dataObjectId);
      if (!dataObjectDef) return;

      dataObject = dataObjectRefs[dataObjectDef.id] = dataObjectDef.Behaviour(dataObjectDef, context);

      return dataObject;
    }

    function getStartActivities(filterOptions, scopeId) {
      const {referenceId, referenceType = 'unknown'} = filterOptions || {};
      return getActivities().filter((activity) => {
        if (!activity.isStart) return false;
        if (scopeId && activity.parent.id !== scopeId) return false;
        if (!filterOptions) return true;

        if (!activity.behaviour.eventDefinitions && !activity.behaviour.eventDefinitions) return false;

        return activity.eventDefinitions.some((ed) => {
          return ed.reference && ed.reference.id === referenceId && ed.reference.referenceType === referenceType;
        });
      });
    }

    function loadExtensions(activity) {
      return extensionsMapper.get(activity);
    }
  }

  function EnvironmentDataObject(dataObjectDef, {environment}) {
    const {id, type, name, behaviour, parent} = dataObjectDef;

    const source = {
      id,
      name,
      type,
      behaviour,
      parent,
      read(broker, exchange, routingKeyPrefix, messageProperties) {
        const value = environment.variables._data && environment.variables._data[id];
        return broker.publish(exchange, `${routingKeyPrefix}response`, {id, name, type, value}, messageProperties);
      },
      write(broker, exchange, routingKeyPrefix, value, messageProperties) {
        environment.variables._data = environment.variables._data || {};
        environment.variables._data[id] = value;
        return broker.publish(exchange, `${routingKeyPrefix}response`, {id, name, type, value}, messageProperties);
      },
    };

    return source;
  }

  function DefinitionExecution(definition) {
    const {id, type, broker, logger, environment} = definition;

    const processes = definition.getProcesses();
    const processIds = processes.map(({id: childId}) => childId);
    const executableProcesses = definition.getExecutableProcesses();

    const postponed = [];
    broker.assertExchange('execution', 'topic', {autoDelete: false, durable: true});

    let activityQ, status = 'init', executionId, stopped, activated, initMessage, completed = false;

    const definitionExecution = {
      id,
      type,
      broker,
      get environment() {
        return environment;
      },
      get executionId() {
        return executionId;
      },
      get completed() {
        return completed;
      },
      get status() {
        return status;
      },
      get stopped() {
        return stopped;
      },
      get postponedCount() {
        return postponed.length;
      },
      get isRunning() {
        if (activated) return true;
        return false;
      },
      processes,
      createMessage,
      getApi,
      getState,
      getPostponed,
      execute,
      resume,
      recover,
      stop,
    };

    Object.defineProperty(definitionExecution, 'stopped', {
      enumerable: true,
      get: () => stopped,
    });

    return definitionExecution;

    function execute(executeMessage) {
      if (!executeMessage) throw new Error('Definition execution requires message');
      if (!executeMessage.content || !executeMessage.content.executionId) throw new Error('Definition execution requires execution id');

      const isRedelivered = executeMessage.fields.redelivered;
      executionId = executeMessage.content.executionId;

      initMessage = cloneMessage(executeMessage);
      initMessage.content = {...initMessage.content, executionId, state: 'start'};

      stopped = false;

      activityQ = broker.assertQueue(`execute-${executionId}-q`, {durable: true, autoDelete: false});

      if (isRedelivered) {
        return resume();
      }

      logger.debug(`<${executionId} (${id})> execute definition`);
      activate();
      start();
      return true;
    }

    function resume() {
      logger.debug(`<${executionId} (${id})> resume`, status, 'definition execution');

      if (completed) return complete('completed');

      activate();
      postponed.splice(0);
      activityQ.consume(onProcessMessage, {prefetch: 1000, consumerTag: `_definition-activity-${executionId}`});

      if (completed) return complete('completed');
      switch (status) {
        case 'init':
          return start();
        case 'executing': {
          if (!postponed.length) return complete('completed');
          break;
        }
      }

      processes.forEach((p) => p.resume());
    }

    function start() {
      if (!processes.length) {
        return publishCompletionMessage('completed');
      }
      if (!executableProcesses.length) {
        deactivate();
        return definition.emitFatal(new Error('No executable process'));
      }

      status = 'start';

      executableProcesses.forEach((p) => p.init());
      executableProcesses.forEach((p) => p.run());

      postponed.splice(0);
      activityQ.assertConsumer(onProcessMessage, {prefetch: 1000, consumerTag: `_definition-activity-${executionId}`});
    }

    function recover(state) {
      if (!state) return definitionExecution;
      executionId = state.executionId;

      stopped = state.stopped;
      completed = state.completed;
      status = state.status;

      logger.debug(`<${executionId} (${id})> recover`, status, 'definition execution');

      state.processes.forEach((processState) => {
        const instance = definition.getProcessById(processState.id);
        if (!instance) return;

        instance.recover(processState);
      });

      return definitionExecution;
    }

    function stop() {
      getApi().stop();
    }

    function activate() {
      broker.subscribeTmp('api', '#', onApiMessage, {noAck: true, consumerTag: '_definition-api-consumer'});

      processes.forEach((p) => {
        p.broker.subscribeTmp('message', 'message.outbound', onMessageOutbound, {noAck: true, consumerTag: '_definition-outbound-message-consumer'});
        p.broker.subscribeTmp('event', 'activity.signal', onDelegateMessage, {noAck: true, consumerTag: '_definition-signal-consumer', priority: 200});
        p.broker.subscribeTmp('event', 'activity.message', onDelegateMessage, {noAck: true, consumerTag: '_definition-message-consumer', priority: 200});
        p.broker.subscribeTmp('event', '#', onEvent, {noAck: true, consumerTag: '_definition-activity-consumer', priority: 100});
      });

      activated = true;

      function onEvent(routingKey, originalMessage) {
        const message = cloneMessage(originalMessage);
        const content = message.content;
        const parent = content.parent = content.parent || {};

        const isDirectChild = processIds.indexOf(content.id) > -1;
        if (isDirectChild) {
          parent.executionId = executionId;
        } else {
          content.parent = pushParent(parent, {id, type, executionId});
        }

        broker.publish('event', routingKey, content, {...message.properties, mandatory: false});
        if (!isDirectChild) return;

        activityQ.queueMessage(message.fields, cloneContent(content), message.properties);
      }
    }

    function deactivate() {
      broker.cancel('_definition-api-consumer');
      broker.cancel(`_definition-activity-${executionId}`);

      processes.forEach((p) => {
        p.broker.cancel('_definition-outbound-message-consumer');
        p.broker.cancel('_definition-activity-consumer');
        p.broker.cancel('_definition-signal-consumer');
        p.broker.cancel('_definition-message-consumer');
      });

      activated = false;
    }

    function onProcessMessage(routingKey, message) {
      const content = message.content;
      const isRedelivered = message.fields.redelivered;
      const {id: childId, type: activityType, executionId: childExecutionId} = content;

      if (isRedelivered && message.properties.persistent === false) return;

      switch (routingKey) {
        case 'execution.stop': {
          if (childExecutionId === executionId) {
            message.ack();
            return onStopped();
          }
          break;
        }
        case 'process.leave': {
          return onChildCompleted();
        }
      }

      stateChangeMessage(true);

      switch (routingKey) {
        case 'process.discard':
        case 'process.enter':
          status = 'executing';
          break;
        case 'process.error': {
          processes.slice().forEach((p) => {
            if (p.id !== childId) p.stop();
          });
          complete('error', {error: content.error});
          break;
        }
      }

      function stateChangeMessage(postponeMessage = true) {
        const previousMsg = popPostponed(childId);
        if (previousMsg) previousMsg.ack();
        if (postponeMessage) postponed.push(message);
      }

      function popPostponed(postponedId) {
        const idx = postponed.findIndex((msg) => msg.content.id === postponedId);
        if (idx > -1) {
          return postponed.splice(idx, 1)[0];
        }
      }

      function onChildCompleted() {
        stateChangeMessage(false);
        if (isRedelivered) return message.ack();

        logger.debug(`<${executionId} (${id})> left <${childId}> (${activityType}), pending runs ${postponed.length}`);

        if (!postponed.length) {
          message.ack();
          complete('completed');
        }
      }

      function onStopped() {
        logger.debug(`<${executionId} (${id})> stop definition execution (stop process executions ${postponed.length})`);
        activityQ.close();
        deactivate();
        processes.slice().forEach((p) => {
          p.stop();
        });
        stopped = true;
        return broker.publish('execution', `execution.stopped.${executionId}`, {
          ...initMessage.content,
          ...content,
        }, {type: 'stopped', persistent: false});
      }
    }

    function onApiMessage(routingKey, message) {
      const messageType = message.properties.type;
      const delegate = message.properties.delegate;

      if (delegate && id === message.content.id) {
        const referenceId = getPropertyValue(message, 'content.message.id');
        for (const bp of processes) {
          if (bp.isRunning) continue;
          if (bp.getStartActivities({referenceId, referenceType: messageType}).length) {
            logger.debug(`<${executionId} (${id})> start <${bp.id}>`);
            bp.run();
          }
        }
      }

      if (message.properties.delegate) {
        for (const bp of processes) {
          bp.broker.publish('api', routingKey, cloneContent(message.content), message.properties);
        }
      }

      if (executionId !== message.content.executionId) return;

      switch (messageType) {
        case 'stop':
          activityQ.queueMessage({routingKey: 'execution.stop'}, cloneContent(message.content), {persistent: false});
          break;
      }
    }

    function getState() {
      return {
        executionId,
        stopped,
        completed,
        status,
        processes: processes.map((p) => p.getState()),
      };
    }

    function getPostponed(...args) {
      return processes.reduce((result, p) => {
        result = result.concat(p.getPostponed(...args));
        return result;
      }, []);
    }

    function complete(completionType, content) {
      deactivate();
      logger.debug(`<${executionId} (${id})> definition execution ${completionType}`);
      if (!content) content = createMessage();
      completed = true;
      if (status !== 'terminated') status = completionType;
      broker.deleteQueue(activityQ.name);

      return broker.publish('execution', `execution.${completionType}.${executionId}`, {
        ...initMessage.content,
        output: environment.output,
        ...content,
        state: completionType,
      }, {type: completionType, mandatory: completionType === 'error'});
    }

    function onMessageOutbound(routingKey, message) {
      const content = message.content;
      const {target, source} = content;

      logger.debug(`<${executionId} (${id})> conveying message from <${source.processId}.${source.id}> to`, target.id ? `<${target.processId}.${target.id}>` : `<${target.processId}>`);

      const targetProcess = getProcessById(target.processId);

      targetProcess.sendMessage(message);
    }

    function onDelegateMessage(routingKey, executeMessage) {
      const content = executeMessage.content;
      const messageType = executeMessage.properties.type;
      const delegateMessage = executeMessage.content.message;

      const reference = definition.getElementById(delegateMessage.id);
      const message = reference && reference.resolve(executeMessage);

      logger.debug(`<${executionId} (${id})>`, reference ? `${messageType} <${delegateMessage.id}>` : `anonymous ${messageType}`, `event received from <${content.parent.id}.${content.id}>. Delegating.`);

      getApi().sendApiMessage(messageType, {
        message: message,
        originalMessage: content.message,
      }, {delegate: true, type: messageType});

      broker.publish('event', `definition.${messageType}`, createMessage({
        message: message && cloneContent(message),
      }), {type: messageType});
    }

    function getProcessById(processId) {
      return processes.find((p) => p.id === processId);
    }

    function publishCompletionMessage(completionType, content) {
      deactivate();
      logger.debug(`<${executionId} (${id})> ${completionType}`);
      if (!content) content = createMessage();
      return broker.publish('execution', `execution.${completionType}.${executionId}`, content, { type: completionType });
    }

    function createMessage(content = {}) {
      return {
        id,
        type,
        executionId,
        status,
        ...content,
      };
    }

    function getApi(apiMessage) {
      if (!apiMessage) apiMessage = initMessage || {content: createMessage()};

      const content = apiMessage.content;
      if (content.executionId !== executionId) {
        return getProcessApi(apiMessage);
      }

      const api = DefinitionApi(broker, apiMessage);

      api.getExecuting = function getExecuting() {
        return postponed.reduce((result, msg) => {
          if (msg.content.executionId === content.executionId) return result;
          result.push(getApi(msg));
          return result;
        }, []);
      };

      return api;
    }

    function getProcessApi(message) {
      const content = message.content;
      let api = getApiByProcessId(content.id);
      if (api) return api;

      if (!content.parent) return;

      api = getApiByProcessId(content.parent.id);
      if (api) return api;

      if (!content.parent.path) return;

      for (let i = 0; i < content.parent.path.length; i++) {
        api = getApiByProcessId(content.parent.path[i].id);
        if (api) return api;
      }

      function getApiByProcessId(parentId) {
        const processInstance = getProcessById(parentId);
        if (!processInstance) return;
        return processInstance.getApi(message);
      }
    }
  }

  function Definition(context, options) {
    if (!context) throw new Error('No context');

    const {id, name, type = 'definition'} = context;
    let environment = context.environment;

    if (options) {
      environment = environment.clone(options);
      context = context.clone(environment);
    }

    const logger = environment.Logger(type.toLowerCase());

    let execution, executionId, processes, executableProcesses, postponedMessage, stateMessage, stopped, consumingRunQ;
    let status;

    let counters = {
      completed: 0,
      discarded: 0,
    };

    const definitionApi = {
      id,
      name,
      type,
      logger,
      context,
      get counters() {
        return {...counters};
      },
      get executionId() {
        return executionId;
      },
      get status() {
        return status;
      },
      get execution() {
        return execution;
      },
      get isRunning() {
        if (!consumingRunQ) return false;
        return !!status;
      },
      get environment() {
        return environment;
      },
      run,
      getApi,
      getState,
      getActivityById,
      getElementById,
      getPostponed,
      getProcesses,
      getExecutableProcesses,
      getProcessById,
      sendMessage,
      recover,
      resume,
      signal,
      stop,
    };

    const {broker, on, once, waitFor, emit, emitFatal} = DefinitionBroker(definitionApi, onBrokerReturn);

    definitionApi.on = on;
    definitionApi.once = once;
    definitionApi.waitFor = waitFor;
    definitionApi.emit = emit;
    definitionApi.emitFatal = emitFatal;

    const runQ = broker.getQueue('run-q');
    const executionQ = broker.getQueue('execution-q');

    Object.defineProperty(definitionApi, 'broker', {
      enumerable: true,
      get: () => broker,
    });

    Object.defineProperty(definitionApi, 'stopped', {
      enumerable: true,
      get: () => execution && execution.stopped,
    });

    return definitionApi;

    function run(callback) {
      if (definitionApi.isRunning) {
        const err = new Error('definition is already running');
        if (callback) return callback(err);
        throw err;
      }

      addConsumerCallbacks(callback);

      executionId = getUniqueId(id);
      const content = createMessage({executionId});

      broker.publish('run', 'run.enter', content);
      broker.publish('run', 'run.start', cloneContent(content));
      broker.publish('run', 'run.execute', cloneContent(content));

      logger.debug(`<${executionId} (${id})> run`);

      activateRunConsumers();
    }

    function resume(callback) {
      if (definitionApi.isRunning) {
        const err = new Error('cannot resume running definition');
        if (callback) return callback(err);
        throw err;
      }

      stopped = false;
      if (!status) return definitionApi;

      addConsumerCallbacks(callback);

      logger.debug(`<${executionId} (${id})> resume`);

      const content = createMessage({executionId});
      broker.publish('run', 'run.resume', content, {persistent: false});
      activateRunConsumers();
      return definitionApi;
    }

    function recover(state) {
      if (definitionApi.isRunning) throw new Error('cannot recover running definition');
      if (!state) return definitionApi;

      stopped = state.stopped;
      status = state.status;

      executionId = state.executionId;
      if (state.counters) {
        counters = {...counters, ...state.counters};
      }

      if (state.environment) {
        environment.recover(state.environment);
      }

      if (state.execution) {
        execution = DefinitionExecution(definitionApi).recover(state.execution);
      }

      broker.recover(state.broker);

      return definitionApi;
    }

    function activateRunConsumers() {
      consumingRunQ = true;
      broker.subscribeTmp('api', `definition.*.${executionId}`, onApiMessage, {noAck: true, consumerTag: '_definition-api'});
      runQ.assertConsumer(onRunMessage, {exclusive: true, consumerTag: '_definition-run'});
    }

    function deactivateRunConsumers() {
      broker.cancel('_definition-api');
      broker.cancel('_definition-run');
      broker.cancel('_definition-execution');
      consumingRunQ = false;
    }

    function stop() {
      if (!definitionApi.isRunning) return;
      getApi().stop();
    }

    function addConsumerCallbacks(callback) {
      if (!callback) return;

      broker.off('return', onBrokerReturn);

      clearConsumers();

      broker.subscribeOnce('event', 'definition.stop', cbLeave, {consumerTag: '_definition-callback-stop'});
      broker.subscribeOnce('event', 'definition.leave', cbLeave, {consumerTag: '_definition-callback-leave'});
      broker.subscribeOnce('event', 'definition.error', cbError, {consumerTag: '_definition-callback-error'});

      function cbLeave(_, message) {
        clearConsumers();
        return callback(null, getApi(message));
      }
      function cbError(_, message) {
        clearConsumers();
        reset();
        const err = makeErrorFromMessage(message);
        return callback(err);
      }

      function clearConsumers() {
        broker.cancel('_definition-callback-stop');
        broker.cancel('_definition-callback-leave');
        broker.cancel('_definition-callback-error');
        broker.on('return', onBrokerReturn);
      }
    }

    function createMessage(override = {}) {
      return {
        id,
        type,
        name,
        ...override,
      };
    }

    function onBrokerReturn(message) {
      if (message.properties.type === 'error') {
        deactivateRunConsumers();
        const err = makeErrorFromMessage(message);
        throw err;
      }
    }

    function onRunMessage(routingKey, message) {
      const {content, ack, fields} = message;
      if (routingKey === 'run.resume') {
        return onResumeMessage();
      }

      stateMessage = message;

      switch (routingKey) {
        case 'run.enter': {
          logger.debug(`<${executionId} (${id})> enter`);

          status = 'entered';
          if (fields.redelivered) break;

          execution = undefined;
          publishEvent('enter', content);
          break;
        }
        case 'run.start': {
          logger.debug(`<${executionId} (${id})> start`);
          status = 'start';
          publishEvent('start', content);
          break;
        }
        case 'run.execute': {
          status = 'executing';
          const executeMessage = cloneMessage(message);
          if (fields.redelivered && !execution) {
            executeMessage.fields.redelivered = undefined;
          }
          postponedMessage = message;
          executionQ.assertConsumer(onExecutionMessage, {exclusive: true, consumerTag: '_definition-execution'});
          execution = execution || DefinitionExecution(definitionApi);
          return execution.execute(executeMessage);
        }
        case 'run.error': {
          publishEvent('error', cloneContent(content, {
            error: fields.redelivered ? makeErrorFromMessage(message) : content.error,
          }));
          break;
        }
        case 'run.end': {
          if (status === 'end') break;

          counters.completed++;

          logger.debug(`<${executionId} (${id})> completed`);
          status = 'end';
          broker.publish('run', 'run.leave', content);
          publishEvent('end', content);
          break;
        }
        case 'run.discarded': {
          if (status === 'discarded') break;

          counters.discarded++;

          status = 'discarded';
          broker.publish('run', 'run.leave', content);
          break;
        }
        case 'run.leave': {
          status = undefined;
          broker.cancel('_definition-api');
          ack();
          publishEvent('leave');
          break;
        }
      }

      ack();

      function onResumeMessage() {
        message.ack();

        switch (stateMessage.fields.routingKey) {
          case 'run.enter':
          case 'run.start':
          case 'run.discarded':
          case 'run.end':
          case 'run.leave':
            break;
          default:
            return;
        }

        if (!stateMessage.fields.redelivered) return;

        logger.debug(`<${id}> resume from ${status}`);

        return broker.publish('run', stateMessage.fields.routingKey, cloneContent(stateMessage.content), stateMessage.properties);
      }
    }

    function onExecutionMessage(routingKey, message) {
      const {content, properties} = message;
      const messageType = properties.type;

      message.ack();

      switch (messageType) {
        case 'stopped': {
          deactivateRunConsumers();
          return publishEvent('stop');
        }
        case 'error': {
          broker.publish('run', 'run.error', content);
          broker.publish('run', 'run.discarded', content);
          break;
        }
        default: {
          broker.publish('run', 'run.end', content);
        }
      }

      if (postponedMessage) {
        const ackMessage = postponedMessage;
        postponedMessage = null;
        ackMessage.ack();
      }
    }

    function publishEvent(action, content = {}) {
      const msgOpts = { type: action, mandatory: action === 'error' };
      broker.publish('event', `definition.${action}`, execution ? execution.createMessage(content) : content, msgOpts);
    }

    function getState() {
      return createMessage({
        executionId,
        status,
        stopped,
        counters: {...counters},
        environment: environment.getState(),
        execution: execution && execution.getState(),
        broker: broker.getState(),
      });
    }

    function getProcesses() {
      if (!processes) loadProcesses();
      return processes;
    }

    function getExecutableProcesses() {
      if (!processes) loadProcesses();
      return executableProcesses;
    }

    function getProcessById(processId) {
      return getProcesses().find((p) => p.id === processId);
    }

    function loadProcesses() {
      if (processes) return processes;
      executableProcesses = context.getExecutableProcesses() || [];
      processes = context.getProcesses() || [];
      logger.debug(`<${id}> found ${processes.length} processes`);
    }

    function getActivityById(childId) {
      let child;
      const siblings = getProcesses();
      for (let i = 0; i < siblings.length; i++) {
        child = siblings[i].getActivityById(childId);
        if (child) return child;
      }
      return child;
    }

    function getElementById(elementId) {
      return context.getActivityById(elementId);
    }

    function getPostponed(...args) {
      if (!execution) return [];
      return execution.getPostponed(...args);
    }

    function getApi(message) {
      if (execution) return execution.getApi(message);
      return DefinitionApi(broker, message || stateMessage);
    }

    function signal(message) {
      return getApi().signal(message, {delegate: true});
    }

    function sendMessage(message) {
      const messageContent = {message};
      let messageType = 'message';
      const reference = message && message.id && getElementById(message.id);
      if (reference && reference.resolve) {
        const resolvedReference = reference.resolve(createMessage({message}));
        messageType = resolvedReference.messageType || messageType;
        messageContent.message = {...message, ...resolvedReference};

      }

      return getApi().sendApiMessage(messageType, messageContent, {delegate: true});
    }

    function onApiMessage(routingKey, message) {
      const messageType = message.properties.type;

      switch (messageType) {
        case 'stop': {
          if (execution && !execution.completed) return;
          onStop();
          break;
        }
      }
    }

    function onStop() {
      stopped = true;
      deactivateRunConsumers();
      return publishEvent('stop');
    }

    function reset() {
      executionId = undefined;
      deactivateRunConsumers();
      runQ.purge();
      executionQ.purge();
    }
  }

  function DummyActivity(activityDef) {
    const {id, type = 'dummy', name, parent: originalParent = {}, behaviour = {}} = activityDef;
    return {
      id,
      type,
      name,
      behaviour: {...behaviour},
      parent: cloneParent(originalParent),
      placeholder: true,
    };
  }

  function EndEvent(activityDef, context) {
    return Activity(EndEventBehaviour, {...activityDef, isThrowing: true}, context);
  }

  function EndEventBehaviour(activity) {
    const {id, type, broker, eventDefinitions} = activity;
    const eventDefinitionExecution = eventDefinitions && EventDefinitionExecution(activity, eventDefinitions);

    const source = {
      id,
      type,
      execute,
    };

    return source;

    function execute(executeMessage) {
      if (eventDefinitionExecution) {
        return eventDefinitionExecution.execute(executeMessage);
      }

      return broker.publish('execution', 'execute.completed', cloneContent(executeMessage.content));
    }
  }

  function ErrorEventDefinition(activity, eventDefinition) {
    const {id, broker, environment, getActivityById, isThrowing} = activity;
    const {type = 'ErrorEventDefinition', behaviour = {}} = eventDefinition;
    const {debug} = environment.Logger(type.toLowerCase());
    const reference = behaviour.errorRef || {name: 'anonymous'};
    const referenceElement = reference.id && getActivityById(reference.id);
    const errorId = referenceElement ? referenceElement.id : 'anonymous';
    const errorQueueName = `error-${brokerSafeId(id)}-${brokerSafeId(errorId)}-q`;

    if (!isThrowing) setupCatch();

    const source = {
      type,
      reference: {...reference, referenceType: 'throw'},
      execute: isThrowing ? executeThrow : executeCatch,
    };

    return source;

    function executeCatch(executeMessage) {
      let completed;

      const messageContent = cloneContent(executeMessage.content);
      const {executionId, parent} = messageContent;
      const parentExecutionId = parent && parent.executionId;

      const {message: referenceMessage, description} = resolveMessage(executeMessage);
      broker.consume(errorQueueName, onThrowApiMessage, {noAck: true, consumerTag: `_onthrow-${executionId}`});

      if (completed) return;

      broker.subscribeTmp('api', `activity.#.${executionId}`, onApiMessage, {noAck: true, consumerTag: `_api-${executionId}`});

      if (!environment.settings.strict) {
        const expectRoutingKey = `execute.throw.${executionId}`;
        broker.publish('execution', 'execute.expect', {...cloneContent(messageContent), expectRoutingKey, expect: {...referenceMessage}});
        broker.subscribeOnce('execution', expectRoutingKey, onErrorMessage, {consumerTag: `_onerror-${executionId}`});
      }

      if (completed) return stop();

      debug(`<${executionId} (${id})> expect ${description}`);

      broker.publish('event', 'activity.wait', {
        ...messageContent,
        executionId: parentExecutionId,
        parent: shiftParent(parent),
        expect: {...referenceMessage},
      });

      function onErrorMessage(routingKey, message) {
        const error = message.content.error;
        if (!referenceElement) return catchError(routingKey, message, error);

        if (!error) return;

        if (('' + error.code) !== ('' + referenceMessage.code)) return;

        return catchError(routingKey, message, error);
      }

      function onThrowApiMessage(routingKey, message) {
        const error = message.content.message;
        if (!referenceElement) return catchError(routingKey, message, error);

        if (referenceMessage.id !== (error && error.id)) return;
        return catchError(routingKey, message, error);
      }

      function catchError(routingKey, message, error) {
        completed = true;

        stop();

        debug(`<${executionId} (${id})> caught ${description}`);
        broker.publish('event', 'activity.catch', {
          ...messageContent,
          source: {
            id: message.content.id,
            type: message.content.type,
            executionId: message.content.executionId,
          },
          error,
          executionId: parentExecutionId,
          parent: shiftParent(executeMessage.content.parent),
        }, {type: 'catch'});

        return broker.publish('execution', 'execute.completed', {...messageContent, output: error, cancelActivity: true, state: 'catch'});
      }

      function onApiMessage(routingKey, message) {
        const messageType = message.properties.type;

        switch (messageType) {
          case 'discard': {
            completed = true;
            stop();
            return broker.publish('execution', 'execute.discard', cloneContent(messageContent));
          }
          case 'stop': {
            stop();
            break;
          }
        }
      }

      function stop() {
        broker.cancel(`_onthrow-${executionId}`);
        broker.cancel(`_onerror-${executionId}`);
        broker.cancel(`_api-${executionId}`);
        broker.purgeQueue(errorQueueName);
      }
    }

    function executeThrow(executeMessage) {
      const messageContent = cloneContent(executeMessage.content);
      const {executionId, parent} = messageContent;
      const parentExecutionId = parent && parent.executionId;

      const {message: referenceMessage, description} = resolveMessage(executeMessage);

      debug(`<${executionId} (${id})> throw ${description}`);

      broker.publish('event', 'activity.throw', {
        ...cloneContent(messageContent),
        executionId: parentExecutionId,
        parent: shiftParent(parent),
        message: {...referenceMessage},
        state: 'throw',
      }, {type: 'throw', delegate: true});

      return broker.publish('execution', 'execute.completed', {...messageContent, message: referenceMessage});
    }

    function resolveMessage(message) {
      if (!referenceElement) {
        return {
          message: {...reference},
          description: 'anonymous error',
        };
      }

      const result = {
        message: referenceElement.resolve(message),
      };

      result.description = `${result.message.name} <${result.message.id}>`;
      if (result.message.code) result.description += ` code ${result.message.code}`;

      return result;
    }

    function setupCatch() {
      broker.assertQueue(errorQueueName, {autoDelete: false, durable: true});
      broker.bindQueue(errorQueueName, 'api', '*.throw.#', {durable: true, priority: 300});
    }
  }

  function Escalation(signalDef, context) {
    const {id, type, name, parent: originalParent} = signalDef;
    const {environment} = context;
    const parent = {...originalParent};

    return {
      id,
      type,
      name,
      parent,
      resolve,
    };

    function resolve(executionMessage) {
      return {
        id,
        type,
        messageType: 'escalation',
        name: name && environment.resolveExpression(name, executionMessage),
        parent: {...parent},
      };
    }
  }

  function EscalationEventDefinition(activity, eventDefinition) {
    const {id, broker, environment, isThrowing, getActivityById} = activity;
    const {type, behaviour = {}} = eventDefinition;
    const {debug} = environment.Logger(type.toLowerCase());
    const reference = behaviour.escalationRef || {name: 'anonymous'};
    const referenceElement = reference.id && getActivityById(reference.id);
    const escalationId = referenceElement ? referenceElement.id : 'anonymous';
    const escalationQueueName = `escalate-${brokerSafeId(id)}-${brokerSafeId(escalationId)}-q`;

    if (!isThrowing) setupCatch();

    const source = {
      id,
      type,
      reference: {...reference, referenceType: 'escalate'},
      execute: isThrowing ? executeThrow : executeCatch,
    };

    return source;

    function executeCatch(executeMessage) {
      let completed;

      const messageContent = cloneContent(executeMessage.content);
      const {executionId, parent} = messageContent;
      const parentExecutionId = parent && parent.executionId;

      const {message: referenceMessage, description} = resolveMessage(executeMessage);
      broker.consume(escalationQueueName, onEscalationApiMessage, {noAck: true, consumerTag: `_onescalate-${executionId}`});

      if (completed) return;

      broker.subscribeTmp('api', `activity.#.${executionId}`, onApiMessage, {noAck: true, consumerTag: `_api-${executionId}`});

      if (completed) return stop();

      debug(`<${executionId} (${id})> expect ${description}`);

      broker.publish('event', 'activity.wait', {
        ...messageContent,
        executionId: parentExecutionId,
        parent: shiftParent(parent),
        escalation: {...referenceMessage},
      });

      function onEscalationApiMessage(routingKey, message) {
        if (getPropertyValue(message, 'content.message.id') !== referenceMessage.id) return;

        const output = message.content.message;
        completed = true;

        stop();

        debug(`<${executionId} (${id})> caught ${description}`);
        broker.publish('event', 'activity.catch', {
          ...messageContent,
          message: {...output},
          executionId: parentExecutionId,
          parent: shiftParent(executeMessage.content.parent),
        }, {type: 'catch'});

        return broker.publish('execution', 'execute.completed', {...messageContent, output, state: 'catch'});
      }

      function onApiMessage(routingKey, message) {
        const messageType = message.properties.type;

        switch (messageType) {
          case 'escalate': {
            return onEscalationApiMessage(routingKey, message);
          }
          case 'discard': {
            completed = true;
            stop();
            return broker.publish('execution', 'execute.discard', {...messageContent});
          }
          case 'stop': {
            stop();
            break;
          }
        }
      }

      function stop() {
        broker.cancel(`_api-${executionId}`);
        broker.cancel(`_onescalate-${executionId}`);
      }
    }

    function executeThrow(executeMessage) {
      const messageContent = cloneContent(executeMessage.content);
      const {executionId, parent} = messageContent;
      const parentExecutionId = parent && parent.executionId;

      const {message: referenceMessage, description} = resolveMessage(executeMessage);

      debug(`<${executionId} (${id})> escalate ${description}`);

      broker.publish('event', 'activity.escalate', {
        ...cloneContent(messageContent),
        executionId: parentExecutionId,
        parent: shiftParent(parent),
        message: {...referenceMessage},
        state: 'throw',
      }, {type: 'escalate', delegate: true});

      return broker.publish('execution', 'execute.completed', {...messageContent});
    }

    function resolveMessage(message) {
      if (!referenceElement) {
        return {
          message: {...reference},
          description: 'anonymous escalation',
        };
      }

      const result = {
        message: referenceElement.resolve(message),
      };

      result.description = `${result.message.name} <${result.message.id}>`;

      return result;
    }

    function setupCatch() {
      broker.assertQueue(escalationQueueName, {autoDelete: false, durable: true});
      broker.bindQueue(escalationQueueName, 'api', '*.escalate.#', {durable: true, priority: 400});
    }
  }

  function EventBasedGateway(activityDef, context) {
    return Activity(EventBasedGatewayBehaviour, {...activityDef}, context);
  }

  function EventBasedGatewayBehaviour(activity, context) {
    const {id, type, broker, logger, outbound: outboundSequenceFlows = []} = activity;

    const source = {
      id,
      type,
      execute,
    };

    return source;

    function execute(executeMessage) {
      const isRedelivered = executeMessage.fields.redelivered;
      const content = executeMessage.content;
      const executionId = content.executionId;
      const outbound = content.outbound = [];

      const targets = [];
      for (let i = 0; i < outboundSequenceFlows.length; i++) {
        const flow = outboundSequenceFlows[i];
        targets.push(context.getActivityById(flow.targetId));
        outbound.push({id: flow.id, action: 'take'});
      }

      const targetConsumerTag = `_gateway-listener-${executionId}`;

      targets.forEach((target) => {
        target.broker.subscribeOnce('event', 'activity.end', onTargetCompleted, {consumerTag: targetConsumerTag});
      });

      broker.subscribeOnce('api', `activity.stop.${executionId}`, stop, {noAck: true, consumerTag: `_api-stop-${executionId}`});

      if (!isRedelivered) return broker.publish('execution', 'execute.outbound.take', cloneContent(content));

      function onTargetCompleted(_, message, owner) {
        logger.debug(`<${executionId} (${id})> <${message.content.executionId}> completed run, discarding the rest`);
        targets.forEach((target) => {
          if (target === owner) return;
          target.broker.cancel(targetConsumerTag);
          target.discard();
        });

        const completedContent = cloneContent(executeMessage.content, {ignoreOutbound: true});
        broker.publish('execution', 'execute.completed', completedContent);
      }

      function stop() {
        targets.forEach((target) => {
          target.broker.cancel(targetConsumerTag);
        });
        broker.cancel(`_api-stop-${executionId}`);
      }
    }
  }

  function ExclusiveGateway(activityDef, context) {
    return Activity(ExclusiveGatewayBehaviour, activityDef, context);
  }

  function ExclusiveGatewayBehaviour(activity) {
    const {id, type, broker, logger, outbound: outboundSequenceFlows = []} = activity;

    const source = {
      id,
      type,
      execute,
    };

    return source;

    function execute(executeMessage) {
      const content = cloneContent(executeMessage.content);
      if (!outboundSequenceFlows.length) return complete();

      let conditionMet, defaultFlow, evaluateError;
      const outbound = content.outbound = [];

      for (let i = 0; i < outboundSequenceFlows.length; i++) {
        const flow = outboundSequenceFlows[i];

        if (conditionMet) {
          outbound.push({id: flow.id, action: 'discard'});
          continue;
        }
        if (flow.isDefault) {
          defaultFlow = flow;
          continue;
        }

        if (flow.evaluateCondition(executeMessage, onEvaluateError)) {
          conditionMet = true;
          outbound.push({id: flow.id, action: 'take'});
        } else {
          if (evaluateError) return broker.publish('execution', 'execute.error', cloneContent(content, {error: evaluateError}));
          outbound.push({id: flow.id, action: 'discard'});
        }
      }

      if (defaultFlow) {
        if (conditionMet) {
          outbound.push({id: defaultFlow.id, action: 'discard'});
        } else {
          logger.debug(`<${id}> take default flow <${defaultFlow.id}>`);
          outbound.push({id: defaultFlow.id, action: 'take'});
        }
      } else if (!conditionMet) {
        const err = new ActivityError(`<${id}> no conditional flow taken`, executeMessage);
        logger.error(`<${id}>`, err);
        return broker.publish('execution', 'execute.error', {...content, error: err});
      }

      return complete();

      function complete() {
        broker.publish('execution', 'execute.completed', cloneContent(content));
      }

      function onEvaluateError(err) {
        evaluateError = err;
      }
    }
  }

  function InclusiveGateway(activityDef, context) {
    return Activity(InclusiveGatewayBehaviour, activityDef, context);
  }

  function InclusiveGatewayBehaviour(activity) {
    const {id, type, broker, logger, outbound: outboundSequenceFlows = []} = activity;

    const source = {
      id,
      type,
      execute,
    };

    return source;

    function execute(executeMessage) {
      const content = cloneContent(executeMessage.content);
      if (!outboundSequenceFlows.length) return complete();

      let conditionMet, defaultFlow, evaluateError;
      const outbound = content.outbound = [];

      for (let i = 0; i < outboundSequenceFlows.length; i++) {
        const flow = outboundSequenceFlows[i];

        if (flow.isDefault) {
          defaultFlow = flow;
          continue;
        }

        if (flow.evaluateCondition(executeMessage, onEvaluateError)) {
          conditionMet = true;
          outbound.push({id: flow.id, action: 'take'});
        } else {
          if (evaluateError) return broker.publish('execution', 'execute.error', cloneContent(content, {error: evaluateError}));
          outbound.push({id: flow.id, action: 'discard'});
        }
      }

      if (defaultFlow) {
        if (conditionMet) {
          outbound.push({id: defaultFlow.id, action: 'discard'});
        } else {
          logger.debug(`<${id}> take default flow`);
          outbound.push({id: defaultFlow.id, action: 'take'});
        }
      } else if (!conditionMet) {
        const err = new ActivityError(`<${id}> no conditional flow taken`, executeMessage);
        logger.error(`<${id}>`, err);
        return broker.publish('execution', 'execute.error', cloneContent(content, {error: err}));
      }

      return complete();

      function complete() {
        broker.publish('execution', 'execute.completed', cloneContent(content));
      }

      function onEvaluateError(err) {
        evaluateError = err;
      }
    }
  }

  function IoSpecification(activity, ioSpecificationDef, context) {
    const {id, type = 'iospecification', behaviour = {}} = ioSpecificationDef;
    const {broker} = activity;

    const safeType = brokerSafeId(type).toLowerCase();
    let activityConsumer;

    const {dataInputs, dataOutputs} = behaviour;

    const ioApi = {
      id,
      type,
      behaviour,
      activate,
      deactivate,
    };

    return ioApi;

    function activate() {
      if (activityConsumer) return;
      activityConsumer = broker.subscribeTmp('event', 'activity.#', onActivityEvent, {noAck: true});
    }

    function deactivate() {
      if (activityConsumer) activityConsumer = activityConsumer.cancel();
    }

    function onActivityEvent(routingKey, message) {
      if ((dataInputs || dataOutputs) && routingKey === 'activity.enter') {
        return formatOnEnter();
      }

      if (dataOutputs && routingKey === 'activity.execution.completed') {
        formatOnComplete(message);
      }
    }

    function formatOnEnter() {
      const startRoutingKey = `run.onstart.${safeType}`;
      if (!dataInputs) {
        return broker.publish('format', startRoutingKey, {
          ioSpecification: {
            dataOutputs: getDataOutputs(),
          },
        });
      }

      const {dataObjects, sources} = dataInputs.reduce((result, ioSource, index) => {
        const source = {
          id: ioSource.id,
          type: ioSource.type,
          name: ioSource.name,
        };
        result.sources.push(source);

        const dataObjectId = getPropertyValue(ioSource, 'behaviour.association.source.dataObject.id');
        if (!dataObjectId) return result;
        const dataObject = context.getDataObjectById(dataObjectId);
        if (!dataObject) return result;
        result.dataObjects.push({index, dataObject});
        return result;
      }, {
        dataObjects: [],
        sources: [],
      });

      if (!dataObjects.length) {
        return broker.publish('format', startRoutingKey, {
          ioSpecification: {
            dataInputs: sources,
            dataOutputs: getDataOutputs(),
          },
        });
      }

      const endRoutingKey = `run.onstart.${safeType}.end`;
      broker.publish('format', `${startRoutingKey}.begin`, {
        endRoutingKey,
        ioSpecification: {
          dataInputs: sources.map((source) => {
            return {...source};
          }),
          dataOutputs: getDataOutputs(),
        },
      });

      return read(broker, dataObjects, (_, responses) => {
        responses.forEach((response) => {
          sources[response.index].value = response.value;
        });

        broker.publish('format', endRoutingKey, {
          ioSpecification: {
            dataInputs: sources,
            dataOutputs: getDataOutputs(),
          },
        });
      });
    }

    function formatOnComplete(message) {
      const messageInputs = getPropertyValue(message, 'content.ioSpecification.dataInputs');
      const messageOutputs = getPropertyValue(message, 'content.output.ioSpecification.dataOutputs') || [];

      const {dataObjects, sources} = dataOutputs.reduce((result, ioSource, index) => {
        const {value} = messageOutputs.find((output) => output.id === ioSource.id) || {};
        const source = {
          id: ioSource.id,
          type: ioSource.type,
          name: ioSource.name,
          value,
        };
        result.sources.push(source);

        const dataObjectId = getPropertyValue(ioSource, 'behaviour.association.target.dataObject.id');
        if (!dataObjectId) return result;
        const dataObject = context.getDataObjectById(dataObjectId);
        if (!dataObject) return result;
        result.dataObjects.push({index, dataObject, value});
        return result;
      }, {
        dataObjects: [],
        sources: [],
      });

      const startRoutingKey = `run.onend.${safeType}`;
      if (!dataObjects.length) {
        return broker.publish('format', startRoutingKey, {
          ioSpecification: {
            dataInputs: messageInputs,
            dataOutputs: sources,
          },
        });
      }

      const endRoutingKey = `run.onend.${safeType}.end`;
      broker.publish('format', `${startRoutingKey}.begin`, {
        endRoutingKey,
        ioSpecification: {
          dataInputs: sources.map((input) => {
            return {...input};
          }),
          dataOutputs: getDataOutputs(),
        },
      });

      return write(broker, dataObjects, (_, responses) => {
        responses.forEach((response) => {
          sources[response.index].value = response.value;
        });

        broker.publish('format', endRoutingKey, {
          ioSpecification: {
            dataInputs: sources,
            dataOutputs: getDataOutputs(),
          },
        });
      });
    }

    function getDataOutputs() {
      if (!dataOutputs) return;
      return dataOutputs.map((dataOutput) => {
        return {
          id: dataOutput.id,
          type: dataOutput.type,
          name: dataOutput.name,
        };
      });
    }
  }

  function read(broker, dataObjectRefs, callback) {
    const responses = [];
    let count = 0;
    const dataReadConsumer = broker.subscribeTmp('data', 'data.read.#', onDataObjectResponse, {noAck: true});

    for (let i = 0; i < dataObjectRefs.length; i++) {
      const {dataObject} = dataObjectRefs[i];
      dataObject.read(broker, 'data', 'data.read.');
    }

    function onDataObjectResponse(routingKey, message) {
      const {index} = dataObjectRefs.find(({dataObject}) => dataObject.id === message.content.id);
      responses.push({...message.content, index});

      ++count;

      if (count < dataObjectRefs.length) return;

      dataReadConsumer.cancel();
      return callback(null, responses);
    }
  }

  function write(broker, dataObjectRefs, callback) {
    const responses = [];
    let count = 0;
    const dataWriteConsumer = broker.subscribeTmp('data', 'data.write.#', onDataObjectResponse, {noAck: true});

    for (let i = 0; i < dataObjectRefs.length; i++) {
      const {dataObject, value} = dataObjectRefs[i];
      dataObject.write(broker, 'data', 'data.write.', value);
    }

    function onDataObjectResponse(routingKey, message) {
      const idx = dataObjectRefs.findIndex((dobj) => dobj.id === message.content.id);
      responses[idx] = message.content;

      ++count;

      if (count < dataObjectRefs.length) return;

      dataWriteConsumer.cancel();
      return callback(null, responses);
    }
  }

  function IntermediateCatchEvent(activityDef, context) {
    return Activity(IntermediateCatchEventBehaviour, activityDef, context);
  }

  function IntermediateCatchEventBehaviour(activity) {
    const {id, type, broker, eventDefinitions} = activity;
    const eventDefinitionExecution = eventDefinitions && EventDefinitionExecution(activity, eventDefinitions);

    const source = {
      id,
      type,
      execute,
    };

    return source;

    function execute(executeMessage) {
      if (eventDefinitionExecution) {
        return eventDefinitionExecution.execute(executeMessage);
      }

      const content = cloneContent(executeMessage.content);
      const {executionId} = content;
      broker.subscribeTmp('api', `activity.#.${executionId}`, onApiMessage, {noAck: true, consumerTag: `_api-${executionId}`});

      return broker.publish('event', 'activity.wait', cloneContent(content));

      function onApiMessage(routingKey, message) {
        const messageType = message.properties.type;
        switch (messageType) {
          case 'message':
          case 'signal': {
            return complete(message.content.message);
          }
          case 'discard': {
            stop();
            return broker.publish('execution', 'execute.discard', cloneContent(content));
          }
          case 'stop': {
            return stop();
          }
        }
      }

      function complete(output) {
        stop();
        return broker.publish('execution', 'execute.completed', cloneContent(content, {output}));
      }

      function stop() {
        broker.cancel(`_api-${executionId}`);
      }
    }
  }

  function IntermediateThrowEvent(activityDef, context) {
    return Activity(IntermediateThrowEventBehaviour, {...activityDef, isThrowing: true}, context);
  }

  function IntermediateThrowEventBehaviour(activity) {
    const {id, type, broker, eventDefinitions} = activity;
    const eventDefinitionExecution = eventDefinitions && EventDefinitionExecution(activity, eventDefinitions);

    const source = {
      id,
      type,
      execute,
    };

    return source;

    function execute(executeMessage) {
      if (eventDefinitionExecution) {
        return eventDefinitionExecution.execute(executeMessage);
      }

      return broker.publish('execution', 'execute.completed', cloneContent(executeMessage.content));
    }
  }

  function LinkEventDefinition(activity, eventDefinition) {
    const {id, broker, environment, isThrowing} = activity;
    const {type} = eventDefinition;
    const {debug} = environment.Logger(type.toLowerCase());
    const reference = {linkName: eventDefinition.behaviour.name};
    const linkQueueName = `link-${brokerSafeId(id)}-${brokerSafeId(reference.linkName)}-q`;

    if (!isThrowing) setupCatch();
    else setupThrow();

    const source = {
      id,
      type,
      reference: {...reference, referenceType: 'link'},
      execute: isThrowing ? executeThrow : executeCatch,
    };

    return source;

    function executeCatch(executeMessage) {
      let completed;

      const messageContent = cloneContent(executeMessage.content);
      const {executionId, parent} = messageContent;
      const parentExecutionId = parent && parent.executionId;

      const description = messageDescription();
      broker.consume(linkQueueName, onCatchLink, {noAck: true, consumerTag: `_api-link-${executionId}`});

      if (completed) return;

      broker.subscribeTmp('api', `activity.stop.${parentExecutionId}`, onApiMessage, {noAck: true, consumerTag: `_api-parent-${parentExecutionId}`});
      broker.subscribeTmp('api', `activity.#.${executionId}`, onApiMessage, {noAck: true, consumerTag: `_api-${executionId}`});

      debug(`<${executionId} (${id})> expect ${description}`);

      broker.publish('event', 'activity.wait', {
        ...messageContent,
        executionId: parentExecutionId,
        parent: shiftParent(parent),
        link: {...reference},
      });

      function onCatchLink(routingKey, message) {
        if (getPropertyValue(message, 'content.message.linkName') !== reference.linkName) return;
        if (message.content.state === 'discard') return discard();
        return complete('caught', message.content.message);
      }

      function onApiMessage(routingKey, message) {
        const messageType = message.properties.type;

        switch (messageType) {
          case 'link': {
            return complete('got link with', message.content.message);
          }
          case 'discard': {
            return discard();
          }
          case 'stop': {
            stop();
            break;
          }
        }
      }

      function complete(verb, output) {
        completed = true;

        stop();

        debug(`<${executionId} (${id})> ${verb} ${description}`);

        broker.publish('event', 'activity.catch', {
          ...messageContent,
          link: {...reference},
          message: {...output},
          executionId: parentExecutionId || executionId,
          parent: shiftParent(executeMessage.content.parent),
        }, {type: 'catch'});

        return broker.publish('execution', 'execute.completed', {...messageContent, output, state: 'catch'});
      }

      function discard() {
        completed = true;
        stop();
        return broker.publish('execution', 'execute.discard', {...messageContent});
      }

      function stop() {
        broker.cancel(`_api-link-${executionId}`);
        broker.cancel(`_api-parent-${parentExecutionId}`);
        broker.cancel(`_api-${executionId}`);
        broker.purgeQueue(linkQueueName);
      }
    }

    function executeThrow(executeMessage) {
      const messageContent = cloneContent(executeMessage.content);
      const {executionId, parent} = messageContent;
      const parentExecutionId = parent && parent.executionId;

      const description = messageDescription();

      debug(`<${executionId} (${id})> throw ${description}`);

      broker.publish('event', 'activity.link', {
        ...cloneContent(messageContent),
        executionId: parentExecutionId,
        parent: shiftParent(parent),
        message: {...reference},
        state: 'throw',
      }, {type: 'link', delegate: true});

      return broker.publish('execution', 'execute.completed', messageContent);
    }

    function messageDescription() {
      return `link ${reference.linkName}`;
    }

    function setupCatch() {
      broker.assertQueue(linkQueueName, {autoDelete: false, durable: true});
      broker.bindQueue(linkQueueName, 'api', '*.link.#', {durable: true});
    }

    function setupThrow() {
      broker.subscribeTmp('event', 'activity.discard', onDiscard, {noAck: true, consumerTag: '_link-parent-discard'});

      function onDiscard(_, message) {
        broker.publish('event', 'activity.link.discard', {
          ...cloneContent(message.content),
          message: {...reference},
          state: 'discard',
        }, {type: 'link', delegate: true});
      }
    }
  }

  function LoopCharacteristics(activity, loopCharacteristics) {
    const {id, broker, environment} = activity;
    const {type = 'LoopCharacteristics', behaviour = {}} = loopCharacteristics;
    const {isSequential = false, collection: collectionExpression, elementVariable = 'item'} = behaviour;

    let completionCondition, startCondition, loopCardinality;
    if ('loopCardinality' in behaviour) loopCardinality = behaviour.loopCardinality;
    if ('loopMaximum' in behaviour) loopCardinality = behaviour.loopMaximum;

    if (behaviour.loopCondition) {
      if (behaviour.testBefore) startCondition = behaviour.loopCondition;
      else completionCondition = behaviour.loopCondition;
    }
    if (behaviour.completionCondition) {
      completionCondition = behaviour.completionCondition;
    }

    const loopType = getLoopType();

    if (!loopType) return;

    const {debug} = environment.Logger(type.toLowerCase());
    const executeConsumerTag = '_execute-q-multi-instance-tag';
    broker.cancel(executeConsumerTag);

    const apiConsumerTag = '_api-multi-instance-tag';
    broker.cancel(apiConsumerTag);

    let loopSettings;

    const characteristicsApi = {
      type,
      loopType,
      collection: collectionExpression,
      elementVariable,
      isSequential,
      loopCardinality,
      execute,
    };

    return characteristicsApi;

    function getLoopType() {
      if (collectionExpression) return 'collection';
      if (completionCondition) return 'complete condition';
      if (startCondition) return 'start condition';
      if (loopCardinality) return 'cardinality';
    }

    function execute(executeMessage) {
      if (!executeMessage) throw new Error('LoopCharacteristics execution requires message');
      const {routingKey: executeRoutingKey, redelivered: isRedelivered} = executeMessage.fields || {};
      const {executionId: parentExecutionId} = executeMessage.content;
      getCharacteristics();

      return isSequential ? executeSequential() : executeParallel();

      function executeSequential() {
        let startIndex = 0;

        if (isRedelivered && executeRoutingKey === 'execute.iteration.next') {
          startIndex = executeMessage.content.index;
        }
        subscribe(onCompleteMessage);

        return startNext(startIndex, isRedelivered);

        function startNext(index, ignoreIfExecuting) {
          const content = next(index);
          if (!content) return;

          const characteristics = getCharacteristics();
          if (startCondition && isConditionMet(startCondition, {content})) {
            debug(`<${parentExecutionId} (${id})> start condition met`);
            return;
          }

          debug(`<${content.executionId} (${id})>`, ignoreIfExecuting ? 'resume' : 'start', `sequential iteration index ${content.index}`);
          broker.publish('execution', 'execute.iteration.next', {
            ...content,
            ...characteristics.getContent(),
            index,
            preventComplete: true,
            output: characteristics.output.slice(),
            state: 'iteration.next',
          });

          broker.publish('execution', 'execute.start', {...content, ignoreIfExecuting});
          return content;
        }

        function onCompleteMessage(_, message) {
          const {content} = message;

          if (content.isRootScope) return;
          if (!content.isMultiInstance) return;

          const loopOutput = getCharacteristics().output;
          if (content.output !== undefined) loopOutput[content.index] = content.output;

          broker.publish('execution', 'execute.iteration.completed', {
            ...message.content,
            ...getCharacteristics().getContent(),
            preventComplete: true,
            output: loopOutput.slice(),
            state: 'iteration.completed',
          });

          if (isConditionMet(completionCondition, message, loopOutput)) {
            debug(`<${parentExecutionId} (${id})> complete condition met`);
          } else if (startNext(content.index + 1)) return;

          debug(`<${parentExecutionId} (${id})> sequential loop completed`);

          stop();
          return broker.publish('execution', 'execute.completed', {
            ...message.content,
            ...getCharacteristics().getContent(),
            output: loopOutput,
          });
        }
      }

      function executeParallel() {
        subscribe(onCompleteMessage);
        if (isRedelivered) return;

        let index = 0, startContent;
        while ((startContent = next(index))) {
          debug(`<${parentExecutionId} (${id})> start parallel iteration index ${index}`);
          broker.publish('execution', 'execute.start', {...startContent, keep: true});
          index++;
        }

        function onCompleteMessage(_, message) {
          const {content} = message;
          if (content.isRootScope) return broker.cancel(executeConsumerTag);
          if (!content.isMultiInstance) return;

          const loopOutput = getCharacteristics().output;
          if (content.output !== undefined) loopOutput[content.index] = content.output;

          broker.publish('execution', 'execute.iteration.completed', {
            ...content,
            ...getCharacteristics().getContent(),
            index: content.index,
            output: loopOutput,
            state: 'iteration.completed',
          });

          if (isConditionMet(completionCondition, message)) {
            stop();

            return broker.publish('execution', 'execute.completed', {
              ...content,
              ...getCharacteristics().getContent(),
              output: getCharacteristics().output,
            });
          }
        }
      }

      function next(index) {
        const executionId = `${parentExecutionId}_${index}`;

        const {cardinality, collection, parent, getContent} = getCharacteristics();
        const content = {
          ...getContent(),
          isRootScope: undefined,
          executionId,
          isMultiInstance: true,
          index,
          parent,
        };

        if (isComplete()) return;

        if (collection) {
          content[elementVariable] = collection[index];
        }

        return content;

        function isComplete() {
          if (cardinality > 0 && index >= cardinality) return true;
          if (collection && index >= collection.length) return true;
        }
      }

      function getCharacteristics() {
        if (loopSettings) return loopSettings;

        const cardinality = getCardinality();
        const collection = getCollection();

        const messageContent = {
          ...cloneContent(executeMessage.content),
          loopCardinality: cardinality,
          isSequential,
          output: undefined,
        };

        const output = executeMessage.content.output || [];

        const parent = unshiftParent(executeMessage.content.parent, executeMessage.content);

        loopSettings = {
          cardinality,
          collection,
          messageContent,
          output,
          parent,
          getContent() {
            return cloneContent(messageContent);
          },
        };

        return loopSettings;
      }

      function getCardinality() {
        if (!loopCardinality) return;
        let value = loopCardinality;
        if (!value) return;

        value = environment.resolveExpression(value, executeMessage);

        const nValue = Number(value);
        if (isNaN(nValue)) return activity.emitFatal(new ActivityError(`<${id}> loopCardinality is not a Number >${value}<`, executeMessage));

        return nValue;
      }

      function getCollection() {
        if (!collectionExpression) return;
        debug(`<${id}> has collection`);
        return environment.resolveExpression(collectionExpression, executeMessage);
      }

      function subscribe(onCompleteMessage) {
        broker.subscribeOnce('api', `activity.*.${parentExecutionId}`, onApiMessage, {consumerTag: apiConsumerTag}, {priority: 400});
        broker.subscribeTmp('execution', 'execute.completed', onCompleteMessage, {noAck: true, consumerTag: executeConsumerTag, priority: 300});
      }
    }

    function onApiMessage(_, message) {
      switch (message.properties.type) {
        case 'stop':
        case 'discard':
          stop();
          break;
      }
    }

    function stop() {
      broker.cancel(executeConsumerTag);
      broker.cancel(apiConsumerTag);
    }


    function isConditionMet(condition, message, loopOutput) {
      if (!condition) return false;
      const testContext = {...cloneMessage(message), loopOutput};
      return environment.resolveExpression(condition, testContext);
    }
  }

  function Message$1(messageDef, context) {
    const {id, type, name, parent: originalParent} = messageDef;
    const {environment} = context;
    const parent = {...originalParent};

    return {
      id,
      type,
      name,
      parent,
      resolve,
    };

    function resolve(executionMessage) {
      return {
        id,
        type,
        messageType: 'message',
        name: name && environment.resolveExpression(name, executionMessage),
        parent: {...parent},
      };
    }
  }

  function MessageEventDefinition(activity, eventDefinition) {
    const {id, broker, environment, isThrowing, getActivityById} = activity;
    const {type = 'MessageEventDefinition', behaviour = {}} = eventDefinition;
    const {debug} = environment.Logger(type.toLowerCase());
    const reference = behaviour.messageRef || {name: 'anonymous'};
    const referenceElement = reference.id && getActivityById(reference.id);
    const messageId = referenceElement ? referenceElement.id : 'anonymous';
    const messageQueueName = `message-${brokerSafeId(id)}-${brokerSafeId(messageId)}-q`;

    if (!isThrowing) setupCatch();

    const source = {
      id,
      type,
      reference: {...reference, referenceType: 'message'},
      execute: isThrowing ? executeThrow : executeCatch,
    };

    return source;

    function executeCatch(executeMessage) {
      let completed;

      const messageContent = cloneContent(executeMessage.content);
      const {executionId, parent} = messageContent;
      const parentExecutionId = parent && parent.executionId;

      const {message: referenceMessage, description} = resolveReference(executeMessage);
      broker.consume(messageQueueName, onCatchMessage, {noAck: true, consumerTag: `_onmessage-${executionId}`});

      if (completed) return;

      broker.subscribeTmp('api', `activity.#.${executionId}`, onApiMessage, {noAck: true, consumerTag: `_api-${executionId}`, priority: 400});
      if (parentExecutionId) broker.subscribeTmp('api', `activity.#.${parentExecutionId}`, onApiMessage, {noAck: true, consumerTag: `_api-parent-${executionId}`, priority: 400});

      debug(`<${executionId} (${id})> expect ${description}`);

      broker.publish('event', 'activity.wait', {
        ...messageContent,
        executionId: parentExecutionId || executionId,
        parent: shiftParent(parent),
        message: {...referenceMessage},
      });

      function onCatchMessage(routingKey, message) {
        if (getPropertyValue(message, 'content.message.id') !== referenceMessage.id) return;
        complete('caught', message.content.message);
      }

      function onApiMessage(routingKey, message) {
        const messageType = message.properties.type;
        switch (messageType) {
          case 'message':
          case 'signal': {
            return complete('got signal with', message.content.message);
          }
          case 'discard': {
            completed = true;
            stop();
            return broker.publish('execution', 'execute.discard', {...messageContent});
          }
          case 'stop': {
            return stop();
          }
        }
      }

      function complete(verb, output) {
        completed = true;

        stop();

        debug(`<${executionId} (${id})> ${verb} ${description}`);
        broker.publish('event', 'activity.catch', {
          ...messageContent,
          message: {...output},
          executionId: parentExecutionId || executionId,
          parent: shiftParent(executeMessage.content.parent),
        }, {type: 'catch'});

        return broker.publish('execution', 'execute.completed', {...messageContent, output, state: 'catch'});
      }

      function stop() {
        broker.cancel(`_onmessage-${executionId}`);
        broker.cancel(`_api-${executionId}`);
        broker.cancel(`_api-parent-${executionId}`);
        broker.purgeQueue(messageQueueName);
      }
    }

    function executeThrow(executeMessage) {
      const messageContent = cloneContent(executeMessage.content);
      const {executionId, parent} = messageContent;
      const parentExecutionId = parent && parent.executionId;

      const {message: referenceMessage, description} = resolveReference(executeMessage);

      debug(`<${executionId} (${id})> message ${description}`);

      broker.publish('event', 'activity.message', {
        ...cloneContent(messageContent),
        executionId: parentExecutionId || executionId,
        parent: shiftParent(parent),
        message: {...referenceMessage},
        state: 'throw',
      }, {type: 'message', delegate: true});

      return broker.publish('execution', 'execute.completed', {...messageContent});
    }

    function resolveReference(message) {
      if (!referenceElement) {
        return {
          message: {...reference},
          description: 'anonymous message',
        };
      }

      const result = {
        message: referenceElement.resolve(message),
      };

      result.description = `${result.message.name} <${result.message.id}>`;

      return result;
    }

    function setupCatch() {
      broker.assertQueue(messageQueueName, {autoDelete: false, durable: true});
      broker.bindQueue(messageQueueName, 'api', '*.message.#', {durable: true});
    }
  }

  function MessageFlow(flowDef, context) {
    const {id, type = 'message', name, target, source, behaviour, parent} = flowDef;
    const sourceActivity = context.getActivityById(source.id);
    const sourceEndConsumerTag = `_message-on-end-${brokerSafeId(id)}`;
    const sourceMessageConsumerTag = `_message-on-message-${brokerSafeId(id)}`;
    const {debug} = context.environment.Logger(type.toLowerCase());

    if (!sourceActivity) return;

    const counters = {
      messages: 0,
      discard: 0,
    };

    const flowApi = {
      id,
      type,
      name,
      target,
      source,
      behaviour,
      get counters() {
        return {...counters};
      },
      activate,
      deactivate,
      getApi,
      getState,
      recover,
      resume,
      stop,
    };

    const {broker, on, once, emit, waitFor} = MessageFlowBroker(flowApi);

    flowApi.on = on;
    flowApi.once = once;
    flowApi.emit = emit;
    flowApi.waitFor = waitFor;

    Object.defineProperty(flowApi, 'broker', {
      enumerable: true,
      get: () => broker,
    });

    return flowApi;

    function onSourceEnd(_, {content}) {
      ++counters.messages;
      debug(`<${id}> sending message from <${source.processId}.${source.id}> to`, target.id ? `<${target.processId}.${target.id}>` : `<${target.processId}>`);
      broker.publish('event', 'message.outbound', createMessage(content.message));
    }

    function onSourceMessage() {
      deactivate();
    }

    function createMessage(message) {
      return {
        id,
        type,
        name,
        source: {...source},
        target: {...target},
        parent: parent && cloneParent(parent),
        message,
      };
    }

    function stop() {
      deactivate();
      broker.stop();
    }

    function getState() {
      return {
        id,
        type,
        counters: {...counters},
      };
    }

    function recover(state) {
      Object.assign(counters, state.counters);
      broker.recover(state.broker);
    }

    function resume() {
      broker.resume();
    }

    function getApi() {
      return flowApi;
    }

    function activate() {
      sourceActivity.broker.subscribeTmp('event', 'activity.message', onSourceMessage, {consumerTag: sourceMessageConsumerTag, noAck: true});
      sourceActivity.broker.subscribeTmp('event', 'activity.end', onSourceEnd, {consumerTag: sourceEndConsumerTag, noAck: true});
    }

    function deactivate() {
      sourceActivity.broker.cancel(sourceMessageConsumerTag);
      sourceActivity.broker.cancel(sourceEndConsumerTag);
    }
  }

  function ParallelGateway(activityDef, context) {
    return Activity(ParallelGatewayBehaviour, {...activityDef, isParallelGateway: true}, context);
  }

  function ParallelGatewayBehaviour(activity) {
    const {id, type, broker} = activity;

    const source = {
      id,
      type,
      execute,
    };

    return source;

    function execute({content}) {
      broker.publish('execution', 'execute.completed', cloneContent(content));
    }
  }

  function ProcessExecution(parentActivity, context) {
    const {id, type, broker, logger, isSubProcess} = parentActivity;
    const {environment} = context;

    const children = context.getActivities(id);
    const flows = context.getSequenceFlows(id);
    const associations = context.getAssociations(id);
    const outboundMessageFlows = context.getMessageFlows(id);

    const startActivities = [];
    const triggeredByEventActivities = [];
    const detachedActivities = [];

    const postponed = [];
    const startSequences = {};
    const exchangeName = isSubProcess ? 'subprocess-execution' : 'execution';
    broker.assertExchange(exchangeName, 'topic', {autoDelete: false, durable: true});

    let activityQ, status = 'init', executionId, stopped, activated, stateMessage, completed = false;

    const processExecution = {
      id,
      type,
      broker,
      get environment() {
        return environment;
      },
      get executionId() {
        return executionId;
      },
      get completed() {
        return completed;
      },
      get status() {
        return status;
      },
      get stopped() {
        return stopped;
      },
      get postponedCount() {
        return postponed.length;
      },
      get isRunning() {
        if (activated) return true;
        return false;
      },
      discard,
      execute,
      getApi,
      getActivityById,
      getActivities,
      getPostponed,
      getSequenceFlows,
      getState,
      recover,
      stop,
    };

    return processExecution;

    function execute(executeMessage) {
      if (!executeMessage) throw new Error('Process execution requires message');
      if (!executeMessage.content || !executeMessage.content.executionId) throw new Error('Process execution requires execution id');

      const isRedelivered = executeMessage.fields.redelivered;
      executionId = executeMessage.content.executionId;

      stateMessage = cloneMessage(executeMessage);
      stateMessage.content = {...stateMessage.content, executionId, state: 'start'};

      stopped = false;

      environment.assignVariables(executeMessage);
      activityQ = broker.assertQueue(`execute-${executionId}-q`, {durable: true, autoDelete: false});

      if (isRedelivered) {
        return resume();
      }

      logger.debug(`<${executionId} (${id})> execute`, isSubProcess ? 'sub process' : 'process');
      activate();
      start();
      return true;
    }

    function resume() {
      logger.debug(`<${executionId} (${id})> resume`, status, 'process execution');

      if (completed) return complete('completed');

      activate();
      postponed.splice(0);
      detachedActivities.splice(0);
      activityQ.consume(onChildMessage, {prefetch: 1000, consumerTag: `_process-activity-${executionId}`});

      if (completed) return complete('completed');
      switch (status) {
        case 'init':
          return start();
        case 'executing': {
          if (!postponed.length) return complete('completed');
          break;
        }
      }

      postponed.slice().forEach(({content}) => {
        const activity = getActivityById(content.id);
        if (!activity) return;
        if (content.placeholder) return;
        activity.resume();
      });
    }

    function start() {
      if (children.length === 0) {
        return complete('completed');
      }

      status = 'start';

      const executeContent = {...stateMessage.content, state: status};

      broker.publish(exchangeName, 'execute.start', cloneContent(executeContent));

      if (startActivities.length > 1) {
        startActivities.forEach((a) => a.shake());
      }

      startActivities.forEach((activity) => activity.init());
      startActivities.forEach((activity) => activity.run());

      postponed.splice(0);
      detachedActivities.splice(0);
      activityQ.assertConsumer(onChildMessage, {prefetch: 1000, consumerTag: `_process-activity-${executionId}`});
    }

    function recover(state) {
      if (!state) return processExecution;
      executionId = state.executionId;

      stopped = state.stopped;
      completed = state.completed;
      status = state.status;

      logger.debug(`<${executionId} (${id})> recover`, status, 'process execution');

      if (state.messageFlows) {
        state.messageFlows.forEach((flowState) => {
          const flow = getMessageFlowById(flowState.id);
          if (!flow) return;
          flow.recover(flowState);
        });
      }

      if (state.associations) {
        state.associations.forEach((associationState) => {
          const association = getAssociationById(associationState.id);
          if (!association) return;
          association.recover(associationState);
        });
      }

      if (state.flows) {
        state.flows.forEach((flowState) => {
          const flow = getFlowById(flowState.id);
          if (!flow) return;
          flow.recover(flowState);
        });
      }

      if (state.children) {
        state.children.forEach((childState) => {
          const child = getActivityById(childState.id);
          if (!child) return;

          child.recover(childState);
        });
      }

      return processExecution;
    }

    function stop() {
      getApi().stop();
    }

    function activate() {
      broker.subscribeTmp('api', '#', onApiMessage, {noAck: true, consumerTag: `_process-api-consumer-${executionId}`, priority: 200});

      outboundMessageFlows.forEach((flow) => {
        flow.activate();
        flow.broker.subscribeTmp('event', '#', onMessageFlowEvent, {consumerTag: '_process-message-consumer', noAck: true, priority: 200});
      });

      flows.forEach((flow) => {
        flow.broker.subscribeTmp('event', '#', onActivityEvent, {consumerTag: '_process-flight-controller', noAck: true, priority: 200});
      });

      associations.forEach((association) => {
        association.broker.subscribeTmp('event', '#', onActivityEvent, {consumerTag: '_process-association-controller', noAck: true, priority: 200});
      });

      startActivities.splice(0);
      triggeredByEventActivities.splice(0);

      children.forEach((activity) => {
        if (activity.placeholder) return;
        activity.activate(processExecution);
        activity.broker.subscribeTmp('event', '#', onActivityEvent, {noAck: true, consumerTag: '_process-activity-consumer', priority: 200});
        if (activity.isStart) startActivities.push(activity);
        if (activity.triggeredByEvent) triggeredByEventActivities.push(activity);
      });

      activated = true;

      function onActivityEvent(routingKey, activityMessage) {
        const message = cloneMessage(activityMessage);
        if (message.fields.redelivered && message.properties.persistent === false) return;

        const content = message.content;
        const parent = content.parent = content.parent || {};
        let delegate = message.properties.delegate;
        const shaking = message.properties.type === 'shake';

        const isDirectChild = content.parent.id === id;
        if (isDirectChild) {
          parent.executionId = executionId;
        } else {
          content.parent = pushParent(parent, {id, type, executionId});
        }

        if (delegate) delegate = onDelegateEvent(message);

        broker.publish('event', routingKey, content, {...message.properties, delegate, mandatory: false});
        if (shaking) return onShookEnd(message);
        if (!isDirectChild) return;
        if (content.isAssociation) return;

        switch (routingKey) {
          case 'process.terminate':
            return activityQ.queueMessage({routingKey: 'execution.terminate'}, cloneContent(content), {type: 'terminate', persistent: true});
          case 'activity.stop':
            return;
        }

        activityQ.queueMessage(message.fields, cloneContent(content), {persistent: true, ...message.properties});
      }
    }

    function deactivate() {
      broker.cancel(`_process-api-consumer-${executionId}`);
      broker.cancel(`_process-activity-${executionId}`);

      children.forEach((activity) => {
        if (activity.placeholder) return;
        activity.broker.cancel('_process-activity-consumer');
        activity.deactivate();
      });

      flows.forEach((flow) => {
        flow.broker.cancel('_process-flight-controller');
      });

      associations.forEach((association) => {
        association.broker.cancel('_process-association-controller');
      });

      outboundMessageFlows.forEach((flow) => {
        flow.deactivate();
        flow.broker.cancel('_process-message-consumer');
      });

      activated = false;
    }

    function onDelegateEvent(message) {
      const eventType = message.properties.type;
      let delegate = true;

      const content = message.content;
      logger.debug(`<${executionId} (${id})> delegate`, eventType, content.message && content.message.id ? `event with id <${content.message.id}>` : 'anonymous event');

      triggeredByEventActivities.forEach((activity) => {
        if (activity.getStartActivities({referenceId: content.message && content.message.id, referenceType: eventType}).length) {
          delegate = false;
          activity.run(content.message);
        }
      });

      getApi().sendApiMessage(eventType, content, {delegate: true});

      return delegate;
    }

    function onMessageFlowEvent(routingKey, message) {
      broker.publish('message', routingKey, cloneContent(message.content), message.properties);
    }

    function onChildMessage(routingKey, message) {
      const content = message.content;
      const isRedelivered = message.fields.redelivered;
      const {id: childId, type: activityType, isEnd} = content;

      if (isRedelivered && message.properties.persistent === false) return message.ack();

      switch (routingKey) {
        case 'execution.stop':
          message.ack();
          return stopExecution();
        case 'execution.terminate':
          message.ack();
          return terminate(message);
        case 'execution.discard':
          message.ack();
          return onDiscard();
        case 'activity.compensation.end':
        case 'flow.looped':
        case 'activity.leave':
          return onChildCompleted();
      }

      stateChangeMessage(true);

      switch (routingKey) {
        case 'activity.detach': {
          detachedActivities.push(cloneMessage(message));
          break;
        }
        case 'activity.discard':
        case 'activity.compensation.start':
        case 'activity.enter': {
          status = 'executing';
          popInbound();
          break;
        }
        case 'activity.end': {
          if (isEnd) discardPostponedIfNecessary();
          break;
        }
        case 'flow.error':
        case 'activity.error': {
          if (isEventCaught()) {
            logger.debug(`<${executionId} (${id})> error was caught`);
            break;
          }
          complete('error', {error: content.error});
          break;
        }
      }

      function stateChangeMessage(postponeMessage = true) {
        const previousMsg = popPostponed(content);
        if (previousMsg) previousMsg.ack();
        if (postponeMessage) postponed.push(message);
      }

      function popInbound() {
        if (!content.inbound) return;

        content.inbound.forEach((trigger) => {
          if (!trigger.isSequenceFlow) return;
          const msg = popPostponed(trigger);
          if (msg) msg.ack();
        });
      }

      function popPostponed(byContent) {
        const postponedIdx = postponed.findIndex((msg) => {
          if (msg.content.isSequenceFlow) return msg.content.sequenceId === byContent.sequenceId;
          return msg.content.executionId === byContent.executionId;
        });

        let postponedMsg;
        if (postponedIdx > -1) {
          postponedMsg = postponed.splice(postponedIdx, 1)[0];
        }

        const detachedIdx = detachedActivities.findIndex((msg) => msg.content.executionId === byContent.executionId);
        if (detachedIdx > -1) detachedActivities.splice(detachedIdx, 1);

        return postponedMsg;
      }

      function onChildCompleted() {
        stateChangeMessage(false);
        if (isRedelivered) return message.ack();

        logger.debug(`<${executionId} (${id})> left <${childId}> (${activityType}), pending runs ${postponed.length}`, postponed.map((a) => a.content.id));

        const postponedLength = postponed.length;
        if (!postponedLength) {
          message.ack();
          return complete('completed');
        } else if (postponedLength === detachedActivities.length) {
          getPostponed().forEach((api) => api.discard());
        }
      }

      function discardPostponedIfNecessary() {
        for (const p of postponed) {
          const postponedId = p.content.id;
          const startSequence = startSequences[postponedId];
          if (startSequence) {
            if (startSequence.content.sequence.some(({id: sid}) => sid === childId)) {
              getApi(p).discard();
            }
          }
        }
      }

      function stopExecution() {
        if (stopped) return;
        logger.debug(`<${executionId} (${id})> stop process execution (stop child executions ${postponed.length})`);
        getPostponed().forEach((api) => {
          api.stop();
        });
        deactivate();
        stopped = true;
        return broker.publish(exchangeName, `execution.stopped.${executionId}`, {
          ...stateMessage.content,
          ...content,
        }, {type: 'stopped', persistent: false});
      }

      function onDiscard() {
        deactivate();
        const running = postponed.splice(0);
        logger.debug(`<${executionId} (${id})> discard process execution (discard child executions ${running.length})`);

        getSequenceFlows().forEach((flow) => {
          flow.stop();
        });

        running.forEach((msg) => {
          getApi(msg).discard();
        });

        activityQ.purge();
        return complete('discard');
      }

      function isEventCaught() {
        return postponed.find((msg) => {
          if (msg.fields.routingKey !== 'activity.catch') return;
          return msg.content.source && msg.content.source.executionId === content.executionId;
        });
      }
    }

    function onApiMessage(routingKey, message) {
      if (message.properties.delegate) {
        for (const child of children) {
          if (child.placeholder) continue;
          child.broker.publish('api', routingKey, cloneContent(message.content), message.properties);
        }
        return;
      }

      if (id !== message.content.id) {
        const child = getActivityById(message.content.id);
        if (!child) return null;
        return child.broker.publish('api', routingKey, message.content, message.properties);
      }

      if (executionId !== message.content.executionId) return;

      switch (message.properties.type) {
        case 'discard':
          return discard();
        case 'stop':
          activityQ.queueMessage({routingKey: 'execution.stop'}, cloneContent(message.content), {persistent: false});
          break;
      }
    }

    function getPostponed(filterFn) {
      return postponed.slice().reduce((result, p) => {
        const api = getApi(p);
        if (api) {
          if (filterFn && !filterFn(api)) return result;
          result.push(api);
        }
        return result;
      }, []);
    }

    function complete(completionType, content = {}) {
      deactivate();
      logger.debug(`<${executionId} (${id})> process execution ${completionType}`);
      completed = true;
      if (status !== 'terminated') status = completionType;
      broker.deleteQueue(activityQ.name);

      return broker.publish(exchangeName, `execution.${completionType}.${executionId}`, {
        ...stateMessage.content,
        output: environment.output,
        ...content,
        state: completionType,
      }, {type: completionType, mandatory: completionType === 'error'});
    }

    function discard() {
      status = 'discard';
      return activityQ.queueMessage({routingKey: 'execution.discard'}, {
        id,
        type,
        executionId,
      }, {type: 'discard'});
    }

    function terminate(message) {
      status = 'terminated';
      logger.debug(`<${executionId} (${id})> terminating process execution`);

      const running = postponed.splice(0);
      getSequenceFlows().forEach((flow) => {
        flow.stop();
      });

      running.forEach((msg) => {
        const {id: postponedId, isSequenceFlow} = msg.content;
        if (postponedId === message.content.id) return;
        if (isSequenceFlow) return;
        getApi(msg).stop();
        msg.ack();
      });

      activityQ.purge();
    }

    function getState() {
      return {
        executionId,
        stopped,
        completed,
        status,
        children: children.reduce((result, activity) => {
          if (activity.placeholder) return result;
          result.push(activity.getState());
          return result;
        }, []),
        flows: flows.map((f) => f.getState()),
        messageFlows: outboundMessageFlows.map((f) => f.getState()),
        associations: associations.map((f) => f.getState()),
      };
    }

    function getActivities() {
      return children.slice();
    }

    function getActivityById(activityId) {
      return children.find((child) => child.id === activityId);
    }

    function getFlowById(flowId) {
      return flows.find((f) => f.id === flowId);
    }

    function getAssociationById(associationId) {
      return associations.find((a) => a.id === associationId);
    }

    function getMessageFlowById(flowId) {
      return outboundMessageFlows.find((f) => f.id === flowId);
    }

    function getChildById(childId) {
      return getActivityById(childId) || getFlowById(childId);
    }

    function getSequenceFlows() {
      return flows.slice();
    }

    function getApi(message) {
      if (!message) return ProcessApi(broker, stateMessage);

      const content = message.content;
      if (content.executionId !== executionId) {
        return getChildApi(message);
      }

      const api = ProcessApi(broker, message);

      api.getExecuting = function getExecuting() {
        return postponed.reduce((result, msg) => {
          if (msg.content.executionId === content.executionId) return result;
          result.push(getApi(msg));
          return result;
        }, []);
      };

      return api;
    }

    function getChildApi(message) {
      const content = message.content;

      let api = getApiByChildId(content.id);
      if (api) return api;

      if (!content.parent) return;

      api = getApiByChildId(content.parent.id);
      if (api) return api;

      if (!content.parent.path) return;

      for (let i = 0; i < content.parent.path.length; i++) {
        api = getApiByChildId(content.parent.path[i].id);
        if (api) return api;
      }

      function getApiByChildId(childId) {
        const child = getChildById(childId);
        if (!child) return;
        return child.getApi(message);
      }
    }

    function onShookEnd(message) {
      const routingKey = message.fields.routingKey;
      if (routingKey !== 'activity.shake.end') return;
      startSequences[message.content.id] = cloneMessage(message);
    }
  }

  function Process(processDef, context) {
    const {id, type = 'process', name, parent, behaviour = {}} = processDef;
    const environment = context.environment;
    const {isExecutable} = behaviour;

    const logger = environment.Logger(type.toLowerCase());

    let execution, initExecutionId, executionId, status, stopped, postponedMessage, stateMessage, consumingRunQ;

    let counters = {
      completed: 0,
      discarded: 0,
      terminated: 0,
    };

    const processApi = {
      id,
      type,
      name,
      isExecutable,
      behaviour,
      get counters() {
        return {...counters};
      },
      get executionId() {
        return executionId;
      },
      get status() {
        return status;
      },
      get stopped() {
        return stopped;
      },
      get execution() {
        return execution;
      },
      get isRunning() {
        if (!consumingRunQ) return false;
        return !!status;
      },
      context,
      environment,
      parent: {...parent},
      logger,
      getApi,
      getActivities,
      getActivityById,
      getSequenceFlows,
      getPostponed,
      getStartActivities,
      getState,
      init,
      recover,
      resume,
      run,
      sendMessage,
      signal,
      stop,
    };

    const {broker, on, once, waitFor} = ProcessBroker(processApi);

    processApi.on = on;
    processApi.once = once;
    processApi.waitFor = waitFor;

    const runQ = broker.getQueue('run-q');
    const executionQ = broker.getQueue('execution-q');

    Object.defineProperty(processApi, 'broker', {
      enumerable: true,
      get: () => broker,
    });

    const extensions = context.loadExtensions(processApi);
    Object.defineProperty(processApi, 'extensions', {
      enumerable: true,
      get: () => extensions,
    });

    return processApi;

    function init() {
      initExecutionId = getUniqueId(id);
      logger.debug(`<${id}> initialized with executionId <${initExecutionId}>`);
      publishEvent('init', createMessage({executionId: initExecutionId}));
    }

    function run(runContent) {
      if (processApi.isRunning) throw new Error(`process <${id}> is already running`);

      executionId = initExecutionId || getUniqueId(id);
      initExecutionId = undefined;

      const content = createMessage({...runContent, executionId});

      broker.publish('run', 'run.enter', content);
      broker.publish('run', 'run.start', cloneContent(content));
      broker.publish('run', 'run.execute', cloneContent(content));

      activateRunConsumers();
    }

    function resume() {
      if (processApi.isRunning) throw new Error(`cannot resume running process <${id}>`);
      if (!status) return processApi;

      stopped = false;

      const content = createMessage({executionId});
      broker.publish('run', 'run.resume', content, {persistent: false});
      activateRunConsumers();
      return processApi;
    }

    function recover(state) {
      if (processApi.isRunning) throw new Error(`cannot recover running process <${id}>`);
      if (!state) return processApi;

      stopped = state.stopped;
      status = state.status;
      executionId = state.executionId;
      if (state.counters) {
        counters = {...counters, ...state.counters};
      }

      if (state.execution) {
        execution = ProcessExecution(processApi, context).recover(state.execution);
      }

      broker.recover(state.broker);

      return processApi;
    }

    function activateRunConsumers() {
      consumingRunQ = true;
      broker.subscribeTmp('api', `process.*.${executionId}`, onApiMessage, {noAck: true, consumerTag: '_process-api', priority: 100});
      runQ.assertConsumer(onRunMessage, {exclusive: true, consumerTag: '_process-run'});
    }

    function deactivateRunConsumers() {
      broker.cancel('_process-api');
      broker.cancel('_process-run');
      broker.cancel('_process-execution');
      consumingRunQ = false;
    }

    function stop() {
      if (!processApi.isRunning) return;
      getApi().stop();
    }

    function getApi(message) {
      if (execution) return execution.getApi(message);
      return ProcessApi(broker, message || stateMessage);
    }

    function signal(message) {
      return getApi().signal(message, {delegate: true});
    }

    function onRunMessage(routingKey, message) {
      const {content, ack, fields} = message;

      if (routingKey === 'run.resume') {
        return onResumeMessage();
      }

      stateMessage = message;

      switch (routingKey) {
        case 'run.enter': {
          logger.debug(`<${id}> enter`);

          status = 'entered';
          if (fields.redelivered) break;

          execution = undefined;
          publishEvent('enter', content);

          break;
        }
        case 'run.start': {
          logger.debug(`<${id}> start`);
          status = 'start';
          publishEvent('start', content);
          break;
        }
        case 'run.execute': {
          status = 'executing';
          const executeMessage = cloneMessage(message);
          if (fields.redelivered && !execution) {
            executeMessage.fields.redelivered = undefined;
          }
          postponedMessage = message;
          executionQ.assertConsumer(onExecutionMessage, {exclusive: true, consumerTag: '_process-execution'});
          execution = execution || ProcessExecution(processApi, context);
          return execution.execute(executeMessage);
        }
        case 'run.error': {
          publishEvent('error', cloneContent(content, {
            error: fields.redelivered ? makeErrorFromMessage(message) : content.error,
          }));
          break;
        }
        case 'run.end': {
          status = 'end';

          if (fields.redelivered) break;
          logger.debug(`<${id}> completed`);

          counters.completed++;

          broker.publish('run', 'run.leave', content);
          publishEvent('end', content);
          break;
        }
        case 'run.discarded': {
          status = 'discarded';
          if (fields.redelivered) break;

          counters.discarded++;

          broker.publish('run', 'run.leave', content);
          break;
        }
        case 'run.leave': {
          status = undefined;
          broker.cancel('_process-api');
          publishEvent('leave');
          break;
        }
      }

      ack();

      function onResumeMessage() {
        message.ack();

        switch (stateMessage.fields.routingKey) {
          case 'run.enter':
          case 'run.start':
          case 'run.discarded':
          case 'run.end':
          case 'run.leave':
            break;
          default:
            return;
        }

        if (!stateMessage.fields.redelivered) return;

        logger.debug(`<${id}> resume from ${status}`);

        return broker.publish('run', stateMessage.fields.routingKey, cloneContent(stateMessage.content), stateMessage.properties);
      }
    }

    function onExecutionMessage(routingKey, message) {
      const content = message.content;
      const messageType = message.properties.type;
      message.ack();

      switch (messageType) {
        case 'stopped': {
          return onStop();
        }
        case 'error': {
          broker.publish('run', 'run.error', content);
          broker.publish('run', 'run.discarded', content);
          break;
        }
        case 'discard':
          broker.publish('run', 'run.discarded', content);
          break;
        default: {
          broker.publish('run', 'run.end', content);
        }
      }

      if (postponedMessage) {
        const ackMessage = postponedMessage;
        postponedMessage = null;
        ackMessage.ack();
      }
    }

    function publishEvent(state, content) {
      if (!content) content = createMessage();
      broker.publish('event', `process.${state}`, {...content, state}, {type: state, mandatory: state === 'error'});
    }

    function sendMessage(message) {
      const messageContent = message.content;
      if (!messageContent) return;

      let targetsFound = false;
      if (messageContent.target && messageContent.target.id && getActivityById(messageContent.target.id)) {
        targetsFound = true;
      } else if (messageContent.message && getStartActivities({referenceId: messageContent.message.id, referenceType: messageContent.message.messageType}).length) {
        targetsFound = true;
      }
      if (!targetsFound) return;

      if (!status) run();
      getApi().sendApiMessage(message.properties.type || 'message', cloneContent(messageContent), {delegate: true});
    }

    function getActivityById(childId) {
      if (execution) return execution.getActivityById(childId);
      return context.getActivityById(childId);
    }

    function getActivities() {
      if (execution) return execution.getActivities();
      return context.getActivities(id);
    }

    function getStartActivities(filterOptions) {
      return context.getStartActivities(filterOptions, id);
    }

    function getSequenceFlows() {
      if (execution) return execution.getSequenceFlows();
      return context.getSequenceFlows();
    }

    function getPostponed(...args) {
      if (execution) return execution.getPostponed(...args);
      return [];
    }

    function onApiMessage(routingKey, message) {
      const messageType = message.properties.type;

      switch (messageType) {
        case 'stop': {
          if (execution && !execution.completed) return;
          onStop();
          break;
        }
      }
    }

    function onStop() {
      stopped = true;
      deactivateRunConsumers();
      return publishEvent('stop');
    }

    function createMessage(override = {}) {
      return {
        id,
        type,
        name,
        parent: {...parent},
        ...override,
      };
    }

    function getState() {
      return createMessage({
        executionId,
        status,
        stopped,
        counters: {...counters},
        broker: broker.getState(),
        execution: execution && execution.getState(),
      });
    }
  }

  function ReceiveTask(activityDef, context) {
    const task = Activity(ReceiveTaskBehaviour, activityDef, context);

    task.broker.assertQueue('message', {autoDelete: false, durable: true});
    task.broker.bindQueue('message', 'api', '*.message.#', {durable: true});

    return task;
  }

  function ReceiveTaskBehaviour(activity) {
    const {id, type, broker, logger, behaviour = {}, getActivityById} = activity;
    const reference = behaviour.messageRef || {name: 'anonymous'};

    const referenceElement = reference.id && getActivityById(reference.id);
    const loopCharacteristics = behaviour.loopCharacteristics && behaviour.loopCharacteristics.Behaviour(activity, behaviour.loopCharacteristics);

    const source = {
      id,
      type,
      reference: {...reference, referenceType: 'message'},
      execute,
    };

    return source;

    function execute(executeMessage) {
      const content = executeMessage.content;
      if (loopCharacteristics && content.isRootScope) {
        return loopCharacteristics.execute(executeMessage);
      }

      let completed;
      const {executionId} = content;

      const {message: referenceMessage, description} = resolveReference(executeMessage);
      broker.consume('message', onCatchMessage, {noAck: true, consumerTag: `_onmessage-${executionId}`});

      if (completed) return;

      broker.subscribeTmp('api', `activity.#.${executionId}`, onApiMessage, {noAck: true, consumerTag: `_api-${executionId}`, priority: 400});

      logger.debug(`<${executionId} (${id})> expect ${description}`);

      broker.publish('event', 'activity.wait', cloneContent(content, {message: {...referenceMessage}}));

      function onCatchMessage(routingKey, message) {
        if (getPropertyValue(message, 'content.message.id') !== referenceMessage.id) return;

        logger.debug(`<${executionId} (${id})> caught ${description}`);
        broker.publish('event', 'activity.catch', cloneContent(content, {message: message.content.message}), {type: 'catch'});

        complete(message.content.message);
      }

      function onApiMessage(routingKey, message) {
        switch (message.properties.type) {
          case 'message':
          case 'signal': {
            return complete(message.content.message);
          }
          case 'discard': {
            completed = true;
            stop();
            return broker.publish('execution', 'execute.discard', cloneContent(content));
          }
          case 'stop': {
            return stop();
          }
        }
      }

      function complete(output) {
        completed = true;
        stop();
        return broker.publish('execution', 'execute.completed', cloneContent(content, {output}));
      }

      function stop() {
        broker.cancel(`_onmessage-${executionId}`);
        broker.cancel(`_api-${executionId}`);
        broker.purgeQueue('message');
      }
    }

    function resolveReference(message) {
      if (!referenceElement) {
        return {
          message: {...reference},
          description: 'anonymous message',
        };
      }

      const result = {
        message: referenceElement.resolve(message),
      };

      result.description = `${result.message.name} <${result.message.id}>`;

      return result;
    }
  }

  function ExecutionScope(activity, initMessage = {}) {
    const {id, type, environment, logger} = activity;

    const {fields, content, properties} = cloneMessage(initMessage);

    const scope = {
      id,
      type,
      fields,
      content,
      properties,
      environment,
      logger,
      resolveExpression,
      ActivityError,
      BpmnError,
    };

    return scope;

    function resolveExpression(expression) {
      return environment.resolveExpression(expression, scope);
    }
  }

  function ScriptTask(activityDef, context) {
    return Activity(ScriptTaskBehaviour, activityDef, context);
  }

  function ScriptTaskBehaviour(activity) {
    const {id, type, behaviour, broker, logger, environment, emitFatal} = activity;

    const {scriptFormat, script: scriptBody} = activity.behaviour;

    const loopCharacteristics = behaviour.loopCharacteristics && behaviour.loopCharacteristics.Behaviour(activity, behaviour.loopCharacteristics);

    environment.registerScript(activity);

    const source = {
      id,
      type,
      loopCharacteristics,
      execute,
    };

    return source;

    function execute(executeMessage) {
      const content = executeMessage.content;
      if (loopCharacteristics && content.isRootScope) {
        return loopCharacteristics.execute(executeMessage);
      }

      if (!scriptBody) return broker.publish('execution', 'execute.completed', cloneContent(content));

      const script = environment.getScript(scriptFormat, activity);
      if (!script) {
        return emitFatal(new ActivityError(`Script format ${scriptFormat} is unsupported or was not registered for <${activity.id}>`, executeMessage), content);
      }

      return script.execute(ExecutionScope(activity, executeMessage), scriptCallback);

      function scriptCallback(err, output) {
        if (err) {
          logger.error(`<${content.executionId} (${id})>`, err);
          return broker.publish('execution', 'execute.error', cloneContent(content, {error: new ActivityError(err.message, executeMessage, err)}));
        }
        return broker.publish('execution', 'execute.completed', cloneContent(content, {output}));
      }
    }
  }

  function SequenceFlow(flowDef, {environment}) {
    const {id, type = 'sequenceflow', name, parent: originalParent, targetId, sourceId, isDefault, behaviour = {}} = flowDef;
    const parent = cloneParent(originalParent);
    const logger = environment.Logger(type.toLowerCase());

    environment.registerScript({id, type, behaviour});

    const counters = {
      looped: 0,
      take: 0,
      discard: 0,
    };

    const flowApi = {
      id,
      type,
      name,
      parent,
      behaviour,
      sourceId,
      targetId,
      isDefault,
      isSequenceFlow: true,
      environment,
      get counters() {
        return {...counters};
      },
      discard,
      evaluateCondition,
      getApi,
      getCondition,
      getState,
      preFlight,
      recover,
      shake,
      stop,
      take,
    };

    const {broker, on, once, waitFor, emitFatal} = EventBroker(flowApi, {prefix: 'flow', durable: true, autoDelete: false});

    flowApi.on = on;
    flowApi.once = once;
    flowApi.waitFor = waitFor;

    Object.defineProperty(flowApi, 'broker', {
      enumerable: true,
      get: () => broker,
    });

    logger.debug(`<${id}> init, <${sourceId}> -> <${targetId}>`);

    return flowApi;

    function take(content = {}) {
      flowApi.looped = undefined;

      const {sequenceId} = content;

      logger.debug(`<${sequenceId} (${id})> take, target <${targetId}>`);
      ++counters.take;

      publishEvent('take', content);

      return true;
    }

    function discard(content = {}) {
      const {sequenceId} = content;
      const discardSequence = content.discardSequence = (content.discardSequence || []).slice();
      if (discardSequence.indexOf(targetId) > -1) {
        ++counters.looped;
        logger.debug(`<${id}> discard loop detected <${sourceId}> -> <${targetId}>. Stop.`);
        return publishEvent('looped', content);
      }

      discardSequence.push(sourceId);

      logger.debug(`<${sequenceId} (${id})> discard, target <${targetId}>`);
      ++counters.discard;
      publishEvent('discard', content);
    }

    function publishEvent(action, content) {
      const eventContent = createMessage({
        action,
        ...content,
      });

      broker.publish('event', `flow.${action}`, eventContent, {type: action});
    }

    function preFlight(action) {
      const sequenceId = getUniqueId(id);
      broker.publish('event', 'flow.pre-flight', createMessage({action, sequenceId, state: 'pre-flight'}), {type: 'pre-flight'});
      return sequenceId;
    }

    function createMessage(override = {}) {
      return {
        ...override,
        id,
        type,
        name,
        sourceId,
        targetId,
        isSequenceFlow: true,
        isDefault,
        parent: cloneParent(parent),
      };
    }

    function getState() {
      const result = {
        id,
        type,
        name,
        sourceId,
        targetId,
        isDefault,
        counters: {...counters},
      };
      result.broker = broker.getState();
      return result;
    }

    function recover(state) {
      Object.assign(counters, state.counters);
      broker.recover(state.broker);
    }

    function getApi(message) {
      return FlowApi(broker, message || {content: createMessage()});
    }

    function stop() {
      broker.stop();
    }

    function shake(message) {
      const content = cloneContent(message.content);
      content.sequence = content.sequence || [];
      content.sequence.push({id, type, isSequenceFlow: true, targetId});

      for (const s of message.content.sequence) {
        if (s.id === id) return broker.publish('event', 'flow.shake.loop', content, {persistent: false, type: 'shake'});
      }

      broker.publish('event', 'flow.shake', content, {persistent: false, type: 'shake'});
    }

    function evaluateCondition(message, onEvaluateError) {
      const condition = getCondition();
      if (!condition) return true;

      const result = condition.execute(message, onEvaluateError);
      logger.debug(`<${id}> condition result evaluated to ${result}`);
      return result;
    }

    function getCondition() {
      const conditionExpression = behaviour.conditionExpression;
      if (!conditionExpression) return null;

      if (!('language' in conditionExpression)) {
        return ExpressionCondition(conditionExpression.body);
      }

      const script = environment.getScript(conditionExpression.language, flowApi);
      return ScriptCondition(script, conditionExpression.language);
    }

    function ScriptCondition(script, language) {
      return {
        language,
        execute: (message, onEvaluateError) => {
          if (!script) {
            const err = new Error(`Script format ${language} is unsupported or was not registered (<${id}>)`);
            logger.error(`<${id}>`, err);
            emitFatal(err, createMessage());
            return onEvaluateError && onEvaluateError(err);
          }

          try {
            return script.execute(ExecutionScope(flowApi, message));
          } catch (err) {
            if (!onEvaluateError) throw err;
            logger.error(`<${id}>`, err);
            onEvaluateError(err);
          }
        },
      };
    }

    function ExpressionCondition(expression) {
      return {
        execute: (message) => {
          return environment.resolveExpression(expression, createMessage(message));
        },
      };
    }
  }

  function ServiceImplementation(activity) {
    const {type: atype, behaviour, environment} = activity;
    const implementation = behaviour.implementation;

    const type = `${atype}:implementation`;

    return {
      type,
      implementation,
      execute,
    };

    function execute(executionMessage, callback) {
      const serviceFn = environment.resolveExpression(implementation, executionMessage);

      if (typeof serviceFn !== 'function') return callback(new Error(`Implementation ${implementation} did not resolve to a function`));

      serviceFn.call(activity, ExecutionScope(activity, executionMessage), (err, ...args) => {
        callback(err, args);
      });
    }
  }

  function ServiceTask(activityDef, context) {
    return Activity(ServiceTaskBehaviour, activityDef, context);
  }

  function ServiceTaskBehaviour(activity) {
    const {id, type, broker, logger, behaviour, environment, emitFatal} = activity;
    const loopCharacteristics = behaviour.loopCharacteristics && behaviour.loopCharacteristics.Behaviour(activity, behaviour.loopCharacteristics);

    const source = {
      id,
      type,
      loopCharacteristics,
      execute,
      getService,
    };

    return source;

    function execute(executeMessage) {
      const content = executeMessage.content;
      if (loopCharacteristics && content.isRootScope) {
        return loopCharacteristics.execute(executeMessage);
      }

      const {executionId} = content;
      const service = getService(executeMessage);
      if (!service) return emitFatal(new ActivityError(`<${id}> service not defined`, executeMessage), content);

      broker.subscribeTmp('api', `activity.#.${content.executionId}`, onApiMessage, {consumerTag: `_api-${executionId}`});

      return service.execute(executeMessage, (err, output) => {
        broker.cancel(`_api-${executionId}`);
        if (err) {
          logger.error(`<${content.executionId} (${id})>`, err);
          return broker.publish('execution', 'execute.error', cloneContent(content, {error: new ActivityError(err.message, executeMessage, err)}));
        }

        return broker.publish('execution', 'execute.completed', cloneContent(content, {output, state: 'complete'}));
      });

      function onApiMessage(_, message) {
        if (message.properties.type === 'discard') {
          broker.cancel(`_api-${executionId}`);
          if (service && service.discard) service.discard(message);
          logger.debug(`<${content.executionId} (${id})> discarded`);
          return broker.publish('execution', 'execute.discard', cloneContent(content, {state: 'discard'}));
        }
        if (message.properties.type === 'stop') {
          broker.cancel(`_api-${executionId}`);
          if (service && service.stop) service.stop(message);
          return logger.debug(`<${content.executionId} (${id})> stopped`);
        }
      }
    }

    function getService(message) {
      const Service = behaviour.Service;
      if (!Service) {
        return environment.settings.enableDummyService ? DummyService() : null;
      }
      return Service(activity, cloneMessage(message));
    }

    function DummyService() {
      logger.debug(`<${id}> returning dummy service`);

      return {
        type: 'dummyservice',
        execute: executeDummyService,
      };

      function executeDummyService(...args) {
        logger.debug(`<${id}> executing dummy service`);
        const next = args.pop();
        next();
      }
    }
  }

  function Signal(signalDef, context) {
    const {id, type, name, parent: originalParent} = signalDef;
    const {environment} = context;
    const parent = {...originalParent};

    return {
      id,
      type,
      name,
      parent,
      resolve,
    };

    function resolve(executionMessage) {
      return {
        id,
        type,
        messageType: 'signal',
        name: name && environment.resolveExpression(name, executionMessage),
        parent: {...parent},
      };
    }
  }

  function SignalEventDefinition(activity, eventDefinition) {
    const {id, broker, environment, isThrowing, getActivityById} = activity;
    const {type, behaviour = {}} = eventDefinition;
    const {debug} = environment.Logger(type.toLowerCase());
    const reference = behaviour.signalRef || {name: 'anonymous'};
    const referenceElement = reference.id && getActivityById(reference.id);
    const signalId = referenceElement ? referenceElement.id : 'anonymous';
    const signalQueueName = `signal-${brokerSafeId(id)}-${brokerSafeId(signalId)}-q`;

    if (!isThrowing) setupCatch();

    const source = {
      id,
      type,
      reference: {...reference, referenceType: 'signal'},
      execute: isThrowing ? executeThrow : executeCatch,
    };

    return source;

    function executeCatch(executeMessage) {
      let completed;

      const messageContent = cloneContent(executeMessage.content);
      const {executionId, parent} = messageContent;
      const parentExecutionId = parent && parent.executionId;

      const {message: referenceMessage, description} = resolveMessage(executeMessage);
      broker.consume(signalQueueName, onCatchSignal, {noAck: true, consumerTag: `_api-signal-${executionId}`});

      if (completed) return;

      broker.subscribeTmp('api', `activity.#.${parentExecutionId}`, onApiMessage, {noAck: true, consumerTag: `_api-parent-${parentExecutionId}`});
      broker.subscribeTmp('api', `activity.#.${executionId}`, onApiMessage, {noAck: true, consumerTag: `_api-${executionId}`});

      debug(`<${executionId} (${id})> expect ${description}`);

      broker.publish('event', 'activity.wait', {
        ...messageContent,
        executionId: parentExecutionId,
        parent: shiftParent(parent),
        signal: {...referenceMessage},
      });

      function onCatchSignal(routingKey, message) {
        if (getPropertyValue(message, 'content.message.id') !== referenceMessage.id) return;
        completed = true;
        stop();
        return complete(message.content.message);
      }

      function onApiMessage(routingKey, message) {
        const messageType = message.properties.type;

        switch (messageType) {
          case 'signal': {
            return complete(message.content.message);
          }
          case 'discard': {
            completed = true;
            stop();
            return broker.publish('execution', 'execute.discard', {...messageContent});
          }
          case 'stop': {
            stop();
            break;
          }
        }
      }

      function complete(output) {
        completed = true;
        stop();
        debug(`<${executionId} (${id})> signaled with`, description);
        return broker.publish('execution', 'execute.completed', {...messageContent, output, state: 'signal'});
      }

      function stop() {
        broker.cancel(`_api-signal-${executionId}`);
        broker.cancel(`_api-parent-${parentExecutionId}`);
        broker.cancel(`_api-${executionId}`);
        broker.purgeQueue(signalQueueName);
      }
    }

    function executeThrow(executeMessage) {
      const messageContent = cloneContent(executeMessage.content);
      const {executionId, parent} = messageContent;
      const parentExecutionId = parent && parent.executionId;

      const {message: referenceMessage, description} = resolveMessage(executeMessage);

      debug(`<${executionId} (${id})> throw ${description}`);

      broker.publish('event', 'activity.signal', {
        ...cloneContent(messageContent),
        executionId: parentExecutionId,
        parent: shiftParent(parent),
        message: {...referenceMessage},
        state: 'throw',
      }, {type: 'signal'});

      return broker.publish('execution', 'execute.completed', messageContent);
    }

    function resolveMessage(message) {
      if (!referenceElement) {
        return {
          message: {...reference},
          description: 'anonymous signal',
        };
      }

      const result = {
        message: referenceElement.resolve(message),
      };

      result.description = `${result.message.name} <${result.message.id}>`;

      return result;
    }

    function setupCatch() {
      broker.assertQueue(signalQueueName, {autoDelete: false, durable: true});
      broker.bindQueue(signalQueueName, 'api', '*.signal.#', {durable: true});
    }
  }

  function SignalTask(activityDef, context) {
    return Activity(SignalTaskBehaviour, activityDef, context);
  }

  function SignalTaskBehaviour(activity) {
    const {id, type, behaviour, broker} = activity;
    const loopCharacteristics = behaviour.loopCharacteristics && behaviour.loopCharacteristics.Behaviour(activity, behaviour.loopCharacteristics);

    const source = {
      id,
      type,
      loopCharacteristics,
      execute,
    };

    return source;

    function execute(executeMessage) {
      const content = executeMessage.content;
      if (loopCharacteristics && content.isRootScope) {
        return loopCharacteristics.execute(executeMessage);
      }

      const {executionId} = content;

      broker.subscribeTmp('api', `activity.#.${executionId}`, onApiMessage, {noAck: true, consumerTag: `_api-${executionId}`});
      broker.publish('event', 'activity.wait', cloneContent(content, {state: 'wait', isRecovered: executeMessage.fields.redelivered}));

      function onApiMessage(routingKey, message) {
        const messageType = message.properties.type;

        switch (messageType) {
          case 'stop':
            return broker.cancel(`_api-${executionId}`);
          case 'signal':
            broker.cancel(`_api-${executionId}`);
            return broker.publish('execution', 'execute.completed', cloneContent(content, {output: message.content.message, state: 'signal'}));
          case 'error':
            broker.cancel(`_api-${executionId}`);
            return broker.publish('execution', 'execute.error', cloneContent(content, {error: new ActivityError(message.content.message, executeMessage, message.content)}));
          case 'discard':
            broker.cancel(`_api-${executionId}`);
            return broker.publish('execution', 'execute.discard', cloneContent(content));
        }
      }
    }
  }

  function StandardLoopCharacteristics(activity, loopCharacteristics) {
    let {behaviour = {}} = loopCharacteristics;
    behaviour = {...behaviour, isSequential: true};
    return LoopCharacteristics(activity, {...loopCharacteristics, behaviour});
  }

  function StartEvent(activityDef, context) {
    return Activity(StartEventBehaviour, activityDef, context);
  }

  function StartEventBehaviour(activity) {
    const {id, type = 'startevent', broker, eventDefinitions} = activity;
    const eventDefinitionExecution = eventDefinitions && EventDefinitionExecution(activity, eventDefinitions);

    const event = {
      id,
      type,
      execute,
    };

    return event;

    function execute(executeMessage) {
      if (eventDefinitionExecution) {
        return eventDefinitionExecution.execute(executeMessage);
      }

      const content = cloneContent(executeMessage.content);
      if (!content.form) {
        return broker.publish('execution', 'execute.completed', content);
      }

      const {executionId} = content;
      broker.subscribeTmp('api', `activity.#.${executionId}`, onApiMessage, {noAck: true, consumerTag: `_api-${executionId}`, priority: 300});
      broker.publish('event', 'activity.wait', {...content, executionId, state: 'wait'});

      function onApiMessage(routingKey, message) {
        const messageType = message.properties.type;

        switch (messageType) {
          case 'stop':
            return broker.cancel(`_api-${executionId}`);
          case 'signal':
            broker.cancel(`_api-${executionId}`);
            return broker.publish('execution', 'execute.completed', cloneContent(content, {output: message.content.message, state: 'signal'}));
          case 'discard':
            broker.cancel(`_api-${executionId}`);
            return broker.publish('execution', 'execute.discard', cloneContent(content));
        }
      }
    }
  }

  function SubProcess(activityDef, context) {
    const triggeredByEvent = activityDef.behaviour && activityDef.behaviour.triggeredByEvent;
    const subProcess = Activity(SubProcessBehaviour, {...activityDef, isSubProcess: true, triggeredByEvent}, context);

    subProcess.getStartActivities = function getStartActivities(filterOptions) {
      return context.getStartActivities(filterOptions, activityDef.id);
    };

    return subProcess;
  }

  function SubProcessBehaviour(activity, context) {
    const {id, type, broker, behaviour, environment, logger} = activity;
    const loopCharacteristics = behaviour.loopCharacteristics && behaviour.loopCharacteristics.Behaviour(activity, behaviour.loopCharacteristics);

    const processExecutions = [];
    let rootExecutionId;

    const source = {
      id,
      type,
      loopCharacteristics,
      get execution() {
        return processExecutions[0];
      },
      get executions() {
        return processExecutions;
      },
      execute,
      getApi,
      getState,
      getPostponed() {
        return this.executions.reduce((result, pe) => {
          result = result.concat(pe.getPostponed());
          return result;
        }, []);
      },
      recover,
    };

    return source;

    function execute(executeMessage) {
      const content = executeMessage.content;

      if (content.isRootScope) {
        rootExecutionId = content.executionId;
      }

      if (loopCharacteristics && content.isRootScope) {
        broker.subscribeTmp('api', `activity.#.${rootExecutionId}`, onApiRootMessage, {noAck: true, consumerTag: `_api-${rootExecutionId}`, priority: 200});
        return loopCharacteristics.execute(executeMessage);
      }

      const processExecution = upsertExecution(executeMessage);
      if (!processExecution) return;

      return processExecution.execute(executeMessage);

      function onApiRootMessage(routingKey, message) {
        const messageType = message.properties.type;
        switch (messageType) {
          case 'stop':
            broker.cancel(`_api-${rootExecutionId}`);
            stop();
            break;
          case 'discard':
            broker.cancel(`_api-${rootExecutionId}`);
            discard();
            break;
        }
      }
    }

    function stop() {
      return processExecutions.forEach((pe) => {
        broker.cancel(`_sub-process-execution-${pe.executionId}`);
        broker.cancel(`_sub-process-api-${pe.executionId}`);
        pe.stop();
      });
    }

    function discard() {
      return processExecutions.forEach((pe) => {
        broker.cancel(`_sub-process-execution-${pe.executionId}`);
        broker.cancel(`_sub-process-api-${pe.executionId}`);
        pe.discard();
      });
    }

    function getState() {
      if (loopCharacteristics) {
        return {
          executions: processExecutions.map(getExecutionState),
        };
      }

      if (processExecutions.length) {
        return getExecutionState(processExecutions[0]);
      }

      function getExecutionState(pe) {
        const state = pe.getState();
        state.environment = pe.environment.getState();
        return state;
      }
    }

    function recover(state) {
      if (!state) return;

      if (loopCharacteristics && state.executions) {
        processExecutions.splice(0);
        return state.executions.forEach(recover);
      } else if (!loopCharacteristics) {
        processExecutions.splice(0);
      }

      const subEnvironment = environment.clone().recover(state.environment);
      const subContext = context.clone(subEnvironment);

      const execution = ProcessExecution(activity, subContext).recover(state);

      processExecutions.push(execution);
      return execution;
    }

    function upsertExecution(executeMessage) {
      const content = executeMessage.content;
      const executionId = content.executionId;

      let execution = getExecutionById(executionId);
      if (execution) {
        if (executeMessage.fields.redelivered) addListeners(execution, executionId);
        return execution;
      }

      const subEnvironment = environment.clone({ output: {} });
      const subContext = context.clone(subEnvironment);

      execution = ProcessExecution(activity, subContext);
      processExecutions.push(execution);

      addListeners(execution, executionId);

      return execution;
    }

    function addListeners(processExecution, executionId) {
      const executionConsumerTag = `_sub-process-execution-${executionId}`;

      broker.subscribeTmp('subprocess-execution', `execution.#.${executionId}`, onExecutionCompleted, {noAck: true, consumerTag: executionConsumerTag});

      function onExecutionCompleted(_, message) {
        const content = message.content;
        const messageType = message.properties.type;

        if (message.fields.redelivered && message.properties.persistent === false) return;

        switch (messageType) {
          case 'stopped': {
            broker.cancel(executionConsumerTag);
            break;
          }
          case 'discard': {
            broker.cancel(executionConsumerTag);
            broker.publish('execution', 'execute.discard', cloneContent(content));
            break;
          }
          case 'completed': {
            broker.cancel(executionConsumerTag);
            broker.publish('execution', 'execute.completed', cloneContent(content));
            break;
          }
          case 'error': {
            broker.cancel(executionConsumerTag);

            const {error} = content;
            logger.error(`<${id}>`, error);
            broker.publish('execution', 'execute.error', cloneContent(content));
            break;
          }
        }
      }
    }

    function getApi(apiMessage) {
      const content = apiMessage.content;

      if (content.id === id) return;

      let execution;
      if ((execution = getExecutionById(content.parent.executionId))) {
        return execution.getApi(apiMessage);
      }

      const parentPath = content.parent.path;

      for (let i = 0; i < parentPath.length; i++) {
        if ((execution = getExecutionById(parentPath[i].executionId))) return execution.getApi(apiMessage);
      }
    }

    function getExecutionById(executionId) {
      return processExecutions.find((pe) => pe.executionId === executionId);
    }
  }

  function Task(activityDef, context) {
    return Activity(TaskBehaviour, activityDef, context);
  }

  function TaskBehaviour(activity) {
    const {id, type, behaviour, broker} = activity;
    const loopCharacteristics = behaviour.loopCharacteristics && behaviour.loopCharacteristics.Behaviour(activity, behaviour.loopCharacteristics);

    const source = {
      id,
      type,
      loopCharacteristics,
      execute,
    };

    return source;

    function execute(executeMessage) {
      const content = executeMessage.content;
      if (loopCharacteristics && content.isRootScope) {
        return loopCharacteristics.execute(executeMessage);
      }

      return broker.publish('execution', 'execute.completed', {...content});
    }
  }

  function TerminateEventDefinition(activity, eventDefinition = {}) {
    const {id, broker, environment} = activity;
    const {type = 'terminateeventdefinition'} = eventDefinition;
    const {debug} = environment.Logger(type.toLowerCase());

    const source = {
      id,
      type,
      execute,
    };

    return source;

    function execute(executeMessage) {
      const content = cloneContent(executeMessage.content);
      const terminateContent = cloneContent(content);
      terminateContent.parent = shiftParent(terminateContent.parent);
      terminateContent.state = 'terminate';

      debug(`<${content.executionId} (${content.id})> terminate`);
      broker.publish('event', 'process.terminate', terminateContent, {type: 'terminate'});
      broker.publish('execution', 'execute.completed', content);
    }
  }

  var lib = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  /**
   * @description A module for parsing ISO8601 durations
   */

  /**
   * The pattern used for parsing ISO8601 duration (PnYnMnDTnHnMnS).
   * This does not cover the week format PnW.
   */

  // PnYnMnDTnHnMnS
  var numbers = '\\d+(?:[\\.,]\\d+)?';
  var weekPattern = '(' + numbers + 'W)';
  var datePattern = '(' + numbers + 'Y)?(' + numbers + 'M)?(' + numbers + 'D)?';
  var timePattern = 'T(' + numbers + 'H)?(' + numbers + 'M)?(' + numbers + 'S)?';

  var iso8601 = 'P(?:' + weekPattern + '|' + datePattern + '(?:' + timePattern + ')?)';
  var objMap = ['weeks', 'years', 'months', 'days', 'hours', 'minutes', 'seconds'];

  /**
   * The ISO8601 regex for matching / testing durations
   */
  var pattern = exports.pattern = new RegExp(iso8601);

  /** Parse PnYnMnDTnHnMnS format to object
   * @param {string} durationString - PnYnMnDTnHnMnS formatted string
   * @return {Object} - With a property for each part of the pattern
   */
  var parse = exports.parse = function parse(durationString) {
    // Slice away first entry in match-array
    return durationString.match(pattern).slice(1).reduce(function (prev, next, idx) {
      prev[objMap[idx]] = parseFloat(next) || 0;
      return prev;
    }, {});
  };

  /**
   * Convert ISO8601 duration object to an end Date.
   *
   * @param {Object} duration - The duration object
   * @param {Date} startDate - The starting Date for calculating the duration
   * @return {Date} - The resulting end Date
   */
  var end = exports.end = function end(duration, startDate) {
    // Create two equal timestamps, add duration to 'then' and return time difference
    var timestamp = startDate ? startDate.getTime() : Date.now();
    var then = new Date(timestamp);

    then.setFullYear(then.getFullYear() + duration.years);
    then.setMonth(then.getMonth() + duration.months);
    then.setDate(then.getDate() + duration.days);
    then.setHours(then.getHours() + duration.hours);
    then.setMinutes(then.getMinutes() + duration.minutes);
    // Then.setSeconds(then.getSeconds() + duration.seconds);
    then.setMilliseconds(then.getMilliseconds() + duration.seconds * 1000);
    // Special case weeks
    then.setDate(then.getDate() + duration.weeks * 7);

    return then;
  };

  /**
   * Convert ISO8601 duration object to seconds
   *
   * @param {Object} duration - The duration object
   * @param {Date} startDate - The starting point for calculating the duration
   * @return {Number}
   */
  var toSeconds = exports.toSeconds = function toSeconds(duration, startDate) {
    var timestamp = startDate ? startDate.getTime() : Date.now();
    var now = new Date(timestamp);
    var then = end(duration, now);

    var seconds = (then.getTime() - now.getTime()) / 1000;
    return seconds;
  };

  exports.default = {
    end: end,
    toSeconds: toSeconds,
    pattern: pattern,
    parse: parse
  };
  });

  unwrapExports(lib);
  var lib_1 = lib.pattern;
  var lib_2 = lib.parse;
  var lib_3 = lib.end;
  var lib_4 = lib.toSeconds;

  function TimerEventDefinition(activity, eventDefinition) {
    const {id, broker, environment} = activity;
    const {type = 'TimerEventDefinition', behaviour = {}} = eventDefinition;
    const {timeDuration} = behaviour;
    const {debug} = environment.Logger(type.toLowerCase());

    let timer;

    const source = {
      type,
      timeDuration,
      execute,
      stop() {
        if (timer) timer = clearTimeout(timer);
      },
    };

    Object.defineProperty(source, 'timer', {
      get() {
        return timer;
      },
    });

    return source;

    function execute(startMessage) {
      if (timer) timer = clearTimeout(timer);

      const messageContent = startMessage.content;
      const {executionId} = messageContent;
      const isResumed = startMessage.fields && startMessage.fields.redelivered;

      if (isResumed && startMessage.fields.routingKey !== 'execute.timer') {
        return debug(`<${executionId} (${id})> resumed, waiting for timer message`);
      }

      broker.subscribeTmp('api', `activity.#.${executionId}`, onApiMessage, {noAck: true, consumerTag: `_api-${executionId}`, priority: 400});

      let timerContent;

      return isResumed ? resumeTimer() : executeTimer();

      function executeTimer() {
        const isoDuration = timeDuration && environment.resolveExpression(timeDuration, startMessage);
        const timeout = isoDuration ? lib_4(lib_2(isoDuration)) * 1000 : 0;

        const startedAt = new Date();
        debug(`<${executionId} (${id})> start timer ${timeout}ms, duration ${isoDuration || 'none'}`);
        timerContent = {...messageContent, isoDuration, timeout, startedAt, state: 'timer'};

        broker.publish('execution', 'execute.timer', cloneContent(timerContent));
        broker.publish('event', 'activity.timer', cloneContent(timerContent));

        timer = setTimeout(completed, timeout);
      }

      function resumeTimer() {
        timerContent = startMessage.content;

        const {startedAt, isoDuration, timeout: originalTimeout} = timerContent;
        const startDate = new Date(startedAt);
        let timeout = originalTimeout - (new Date() - startDate);
        if (timeout < 0) timeout = 0;

        debug(`<${executionId} (${id})> resume timer ${originalTimeout}ms started at ${startDate.toISOString()}, duration ${isoDuration || 'none'}, remaining ${timeout}ms`);

        broker.publish('execution', 'execute.timer', cloneContent(timerContent));
        broker.publish('event', 'activity.timer', cloneContent(timerContent));

        timer = setTimeout(completed, timeout);
      }

      function completed() {
        broker.cancel(`_api-${executionId}`);
        timer = undefined;

        const startedAt = new Date(timerContent.startedAt);
        const stoppedAt = new Date();

        const runningTime = stoppedAt.getTime() - startedAt.getTime();
        debug(`<${executionId} (${id})> completed in ${runningTime}ms, duration ${timerContent.isoDuration || 'none'}`);

        const completedContent = {...timerContent, stoppedAt, runningTime, state: 'timeout'};

        broker.publish('event', 'activity.timeout', cloneContent(completedContent));
        broker.publish('execution', 'execute.completed', cloneContent(completedContent));
      }

      function onApiMessage(routingKey, message) {
        const apiMessageType = message.properties.type;

        switch (apiMessageType) {
          case 'stop': {
            broker.cancel(`_api-${executionId}`);
            timer = clearTimeout(timer);
            return debug(`<${executionId} (${id})> stopped`);
          }
          case 'discard': {
            broker.cancel(`_api-${executionId}`);
            timer = clearTimeout(timer);
            debug(`<${executionId} (${id})> discarded`);

            return broker.publish('execution', 'execute.discard', {...messageContent, state: 'discard'});
          }
        }
      }
    }
  }



  var bpmnElements = /*#__PURE__*/Object.freeze({
    __proto__: null,
    Association: Association,
    Activity: Activity,
    BoundaryEvent: BoundaryEvent,
    BpmnError: BpmnErrorActivity,
    CompensateEventDefinition: CompensationEventDefinition,
    ConditionalEventDefinition: ConditionalEventDefinition,
    Context: Context$1,
    DataObject: EnvironmentDataObject,
    Definition: Definition,
    Dummy: DummyActivity,
    TextAnnotation: DummyActivity,
    EndEvent: EndEvent,
    Environment: Environment,
    ErrorEventDefinition: ErrorEventDefinition,
    Escalation: Escalation,
    EscalationEventDefinition: EscalationEventDefinition,
    EventBasedGateway: EventBasedGateway,
    ExclusiveGateway: ExclusiveGateway,
    InclusiveGateway: InclusiveGateway,
    InputOutputSpecification: IoSpecification,
    IntermediateCatchEvent: IntermediateCatchEvent,
    IntermediateThrowEvent: IntermediateThrowEvent,
    LinkEventDefinition: LinkEventDefinition,
    Message: Message$1,
    MessageEventDefinition: MessageEventDefinition,
    MessageFlow: MessageFlow,
    MultiInstanceLoopCharacteristics: LoopCharacteristics,
    ParallelGateway: ParallelGateway,
    Process: Process,
    ReceiveTask: ReceiveTask,
    ScriptTask: ScriptTask,
    SequenceFlow: SequenceFlow,
    ServiceImplementation: ServiceImplementation,
    SendTask: ServiceTask,
    ServiceTask: ServiceTask,
    Signal: Signal,
    SignalEventDefinition: SignalEventDefinition,
    ManualTask: SignalTask,
    UserTask: SignalTask,
    SignalTask: SignalTask,
    StandardLoopCharacteristics: StandardLoopCharacteristics,
    StartEvent: StartEvent,
    SubProcess: SubProcess,
    Task: Task,
    TerminateEventDefinition: TerminateEventDefinition,
    TimerEventDefinition: TimerEventDefinition
  });

  var getOptionsAndCallback = function getOptionsAndCallback(optionsOrCallback, callback) {
    let options;
    if (typeof optionsOrCallback === 'function') {
      callback = optionsOrCallback;
    } else {
      options = optionsOrCallback;
    }

    return [options, callback];
  };

  const {Script} = vm;

  var JavaScripts = function Scripts() {
    const scripts = {};

    return {
      getScript,
      register,
    };

    function register({id, type, behaviour}) {
      let scriptBody, language = 'javascript';

      switch (type) {
        case 'bpmn:SequenceFlow': {
          if (!behaviour.conditionExpression) return;
          language = behaviour.conditionExpression.language;
          scriptBody = behaviour.conditionExpression.body;
          break;
        }
        default: {
          language = behaviour.scriptFormat;
          scriptBody = behaviour.script;
        }
      }

      if (!/^javascript$/i.test(language)) return;
      scripts[id] = new Script(scriptBody, {filename: `${type}/${id}`});
    }

    function getScript(scriptType, {id}) {
      if (!/^javascript$/i.test(scriptType)) return;
      const script = scripts[id];
      if (!script) return;

      return {
        execute,
      };

      function execute(executionContext, callback) {
        return script.runInNewContext({...executionContext, next: callback});
      }
    }
  };

  var ProcessOutputDataObject = function ProcessOutputDataObject(dataObjectDef, {environment}) {
    const {id, type, name, behaviour, parent} = dataObjectDef;

    const source = {
      id,
      name,
      type,
      behaviour,
      parent,
      read(broker, exchange, routingKeyPrefix, messageProperties) {
        const value = environment.variables.data && environment.variables.data[id];
        return broker.publish(exchange, `${routingKeyPrefix}response`, {id, name, type, value}, messageProperties);
      },
      write(broker, exchange, routingKeyPrefix, value, messageProperties) {
        environment.variables.data = environment.variables.data || {};
        environment.variables.data[id] = value;

        environment.output.data = environment.output.data || {};
        environment.output.data[id] = value;

        return broker.publish(exchange, `${routingKeyPrefix}response`, {id, name, type, value}, messageProperties);
      },
    };

    return source;
  };

  function TypeResolver(types, extender) {
    const {
      BpmnError,
      Definition,
      Dummy,
      ServiceImplementation,
    } = types;

    const typeMapper = {};

    typeMapper['bpmn:DataObjectReference'] = Dummy;
    typeMapper['bpmn:Definitions'] = Definition;
    typeMapper['bpmn:Error'] = BpmnError;

    if (extender) extender(typeMapper);

    return function resolve(entity) {
      const {type, behaviour = {}} = entity;

      switch (type) {
        case 'bpmn:SendTask':
        case 'bpmn:ServiceTask':
          entity.Behaviour = getBehaviourFromType(type);
          if (behaviour.implementation) {
            behaviour.Service = ServiceImplementation;
          }
          break;
        default:
          entity.Behaviour = getBehaviourFromType(type);
      }

      if (behaviour.loopCharacteristics) {
        resolve(behaviour.loopCharacteristics);
      }

      if (behaviour.eventDefinitions) {
        behaviour.eventDefinitions.forEach(resolve);
      }

      if (behaviour.ioSpecification) {
        resolve(behaviour.ioSpecification);
      }
    };

    function getBehaviourFromType(type) {
      let activityType = typeMapper[type];
      if (!activityType && type) {
        const nonPrefixedType = type.split(':').slice(1).join(':');
        activityType = types[nonPrefixedType];
      }

      if (!activityType) {
        throw new Error(`Unknown activity type ${type}`);
      }

      return activityType;
    }
  }

  function context(moddleContext, typeResolver) {
    const mapped = mapModdleContext(moddleContext);
    return contextApi(resolveTypes(mapped, typeResolver));
  }

  function deserialize(deserializedContext, typeResolver) {
    return contextApi(resolveTypes(deserializedContext, typeResolver));
  }

  function contextApi(mapped) {
    const {
      activities,
      associations,
      dataObjects,
      definition,
      messageFlows,
      processes,
      sequenceFlows,
    } = mapped;

    return {
      id: definition.id,
      type: definition.type,
      name: definition.name,
      getActivities,
      getActivityById,
      getAssociationById,
      getAssociations,
      getDataObjects,
      getDataObjectById,
      getExecutableProcesses,
      getInboundAssociations,
      getInboundSequenceFlows,
      getMessageFlows,
      getOutboundAssociations,
      getOutboundSequenceFlows,
      getProcessById,
      getProcesses,
      getSequenceFlowById,
      getSequenceFlows,
      serialize,
    };

    function serialize() {
      return JSON.stringify({
        id: definition.id,
        type: definition.type,
        name: definition.name,
        activities,
        associations,
        dataObjects,
        definition,
        messageFlows,
        processes,
        sequenceFlows,
      });
    }

    function getProcessById(processId) {
      return processes.find(({id}) => id === processId);
    }

    function getProcesses() {
      return processes;
    }

    function getExecutableProcesses() {
      return processes.filter((p) => p.behaviour.isExecutable);
    }

    function getInboundSequenceFlows(activityId) {
      return sequenceFlows.filter((flow) => flow.targetId === activityId);
    }

    function getOutboundSequenceFlows(activityId) {
      return sequenceFlows.filter((flow) => flow.sourceId === activityId);
    }

    function getMessageFlows(scopeId) {
      if (scopeId) return messageFlows.filter((flow) => flow.source.processId === scopeId);
      return messageFlows;
    }

    function getSequenceFlows(scopeId) {
      if (scopeId) return sequenceFlows.filter((flow) => flow.parent.id === scopeId);
      return sequenceFlows;
    }

    function getSequenceFlowById(flowId) {
      return sequenceFlows.find(({id}) => id === flowId);
    }

    function getActivities(scopeId) {
      if (!scopeId) return activities;
      return activities.filter((activity) => activity.parent.id === scopeId);
    }

    function getDataObjects() {
      return dataObjects;
    }

    function getDataObjectById(dataObjectId) {
      return dataObjects.find(({id}) => id === dataObjectId);
    }

    function getActivityById(activityId) {
      return activities.find((activity) => activity.id === activityId);
    }

    function getAssociations(scopeId) {
      if (scopeId) return associations.filter((flow) => flow.parent.id === scopeId);
      return associations;
    }

    function getAssociationById(associationId) {
      return associations.find((association) => association.id === associationId);
    }

    function getInboundAssociations(activityId) {
      return associations.filter((flow) => flow.targetId === activityId);
    }

    function getOutboundAssociations(activityId) {
      return associations.filter((flow) => flow.sourceId === activityId);
    }
  }

  function resolveTypes(mappedContext, typeResolver) {
    const {
      activities,
      associations,
      dataObjects,
      definition,
      messageFlows,
      processes,
      sequenceFlows,
    } = mappedContext;

    definition.Behaviour = typeResolver(definition);
    processes.forEach(typeResolver);
    activities.forEach(typeResolver);
    dataObjects.forEach(typeResolver);
    messageFlows.forEach(typeResolver);
    sequenceFlows.forEach(typeResolver);
    associations.forEach(typeResolver);

    return mappedContext;
  }

  function mapModdleContext(moddleContext) {
    const {elementsById, references, rootHandler} = moddleContext;
    const refKeyPattern = /^(?!\$).+?Ref$/;

    const definition = {
      id: rootHandler.element.id,
      type: rootHandler.element.$type,
      name: rootHandler.element.name,
      targetNamespace: rootHandler.element.targetNamespace,
      exporter: rootHandler.element.exporter,
      exporterVersion: rootHandler.element.exporterVersion,
    };

    const {
      refs,
      dataInputAssociations,
      dataOutputAssociations,
      flowRefs,
      processRefs,
    } = prepareReferences();

    const {
      activities,
      associations,
      dataObjects,
      messageFlows,
      processes,
      sequenceFlows,
    } = prepareElements(definition, rootHandler.element.rootElements);

    return {
      activities,
      associations,
      dataObjects,
      definition,
      messageFlows,
      processes,
      sequenceFlows,
    };

    function prepareReferences() {
      return references.reduce((result, r) => {
        const {property, element} = r;

        switch (property) {
          case 'bpmn:sourceRef': {
            const flow = upsertFlowRef(element.id, {
              id: element.id,
              $type: element.$type,
              sourceId: r.id,
              element: elementsById[element.id],
            });
            const outbound = result.sourceRefs[r.id] = result.sourceRefs[r.id] || [];
            outbound.push(flow);
            break;
          }
          case 'bpmn:targetRef': {
            const flow = upsertFlowRef(element.id, {
              targetId: r.id,
            });
            const inbound = result.targetRefs[r.id] = result.targetRefs[r.id] || [];
            inbound.push(flow);
            break;
          }
          case 'bpmn:default':
            upsertFlowRef(r.id, {isDefault: true});
            break;
          case 'bpmn:dataObjectRef':
            result.refs.push(r);
            break;
          case 'bpmn:processRef': {
            result.processRefs[element.id] = {
              id: r.id,
              $type: element.$type,
            };
            break;
          }
        }

        switch (element.$type) {
          case 'bpmn:OutputSet':
          case 'bpmn:InputSet': {
            break;
          }
          case 'bpmn:DataInputAssociation':
            result.dataInputAssociations.push(r);
            break;
          case 'bpmn:DataOutputAssociation':
            result.dataOutputAssociations.push(r);
            break;
        }

        return result;

        function upsertFlowRef(id, value) {
          const flow = result.flowRefs[id] = result.flowRefs[id] || {};
          Object.assign(flow, value);
          return flow;
        }
      }, {
        refs: [],
        dataInputAssociations: [],
        dataOutputAssociations: [],
        flowRefs: {},
        processRefs: {},
        sourceRefs: {},
        targetRefs: {},
      });
    }

    function prepareElements(parent, elements) {
      if (!elements) return {};

      return elements.reduce((result, element) => {
        const {id, $type: type, name} = element;

        switch (element.$type) {
          case 'bpmn:DataObjectReference':
            break;
          case 'bpmn:Collaboration': {
            if (element.messageFlows) {
              const {messageFlows: flows} = prepareElements(parent, element.messageFlows);
              result.messageFlows = result.messageFlows.concat(flows);
            }
            break;
          }
          case 'bpmn:DataObject': {
            result.dataObjects.push({
              id,
              name,
              type,
              parent: {
                id: parent.id,
                type: parent.type,
              },
              references: prepareDataObjectReferences(),
              behaviour: {...element},
            });
            break;
          }
          case 'bpmn:MessageFlow': {
            const flowRef = flowRefs[element.id];
            result.messageFlows.push({
              ...flowRef,
              id,
              type,
              name,
              parent: {
                id: parent.id,
                type: parent.type,
              },
              source: {
                processId: getElementProcessId(flowRef.sourceId),
                id: flowRef.sourceId,
              },
              target: getElementTargetById(flowRef.targetId),
              behaviour: {...element},
            });
            break;
          }
          case 'bpmn:Association': {
            const flowRef = flowRefs[element.id];
            result.associations.push({
              id,
              name,
              type,
              parent: {
                id: parent.id,
                type: parent.type,
              },
              targetId: flowRef.targetId,
              sourceId: flowRef.sourceId,
              behaviour: {...element},
            });
            break;
          }
          case 'bpmn:SequenceFlow': {
            const flowRef = flowRefs[element.id];
            result.sequenceFlows.push({
              id,
              name,
              type,
              parent: {
                id: parent.id,
                type: parent.type,
              },
              isDefault: flowRef.isDefault,
              targetId: flowRef.targetId,
              sourceId: flowRef.sourceId,
              behaviour: {...element},
            });
            break;
          }
          case 'bpmn:SubProcess':
          case 'bpmn:Process': {
            const bp = {
              id,
              type,
              name,
              parent: {
                id: parent.id,
                type: parent.type,
              },
              behaviour: prepareActivityBehaviour(),
            };
            if (type === 'bpmn:Process') result.processes.push(bp);
            else result.activities.push(bp);

            [prepareElements({id, type}, element.flowElements), prepareElements({id, type}, element.artifacts)].forEach((subElements) => {
              if (subElements.activities) {
                result.activities = result.activities.concat(subElements.activities);
              }
              if (subElements.sequenceFlows) {
                result.sequenceFlows = result.sequenceFlows.concat(subElements.sequenceFlows);
              }
              if (subElements.dataObjects) {
                result.dataObjects = result.dataObjects.concat(subElements.dataObjects);
              }
              if (subElements.associations) {
                result.associations = result.associations.concat(subElements.associations);
              }
            });

            break;
          }
          case 'bpmn:BoundaryEvent': {
            const attachedTo = spreadRef(element.attachedToRef);
            result.activities.push(prepareActivity({attachedTo}));
            break;
          }
          case 'bpmn:ReceiveTask': {
            const messageRef = spreadRef(element.messageRef);
            result.activities.push(prepareActivity({messageRef}));
            break;
          }
          default: {
            result.activities.push(prepareActivity());
          }
        }

        return result;

        function prepareActivity(behaviour) {
          return {
            id,
            type,
            name,
            parent: {
              id: parent.id,
              type: parent.type,
            },
            behaviour: prepareActivityBehaviour(behaviour),
          };
        }

        function prepareActivityBehaviour(behaviour) {
          const resources = element.resources && element.resources.map(mapResource);

          return {
            ...behaviour,
            ...element,
            eventDefinitions: element.eventDefinitions && element.eventDefinitions.map(mapActivityBehaviour),
            loopCharacteristics: element.loopCharacteristics && mapActivityBehaviour(element.loopCharacteristics),
            ioSpecification: element.ioSpecification && mapActivityBehaviour(element.ioSpecification),
            resources,
          };
        }

        function prepareDataObjectReferences() {
          const objectRefs = refs.filter((objectRef) => objectRef.id === element.id);

          return objectRefs.map((objectRef) => {
            return {
              id: objectRef.element.id,
              type: objectRef.element.$type,
              behaviour: {...objectRef.element},
            };
          });
        }
      }, {
        activities: [],
        associations: [],
        dataObjects: [],
        messageFlows: [],
        processes: [],
        sequenceFlows: [],
      });
    }

    function getElementProcessId(elementId) {
      const bp = rootHandler.element.rootElements.find((e) => e.$type === 'bpmn:Process' && e.flowElements.find((ce) => ce.id === elementId));
      return bp.id;
    }

    function getElementTargetById(elementId) {
      const targetElement = elementsById[elementId];
      if (!targetElement) return;

      const result = {};

      switch (targetElement.$type) {
        case 'bpmn:Participant': {
          result.processId = processRefs[elementId].id;
          break;
        }
        default: {
          const bp = rootHandler.element.rootElements.find((e) => e.$type === 'bpmn:Process' && e.flowElements.find((ce) => ce.id === elementId));
          result.processId = bp.id;
          result.id = elementId;
        }
      }

      return result;
    }

    function mapResource(resource) {
      if (!resource) return;

      const {$type: type, resourceAssignmentExpression} = resource;

      return {
        type,
        expression: resourceAssignmentExpression.expression && resourceAssignmentExpression.expression.body,
        behaviour: {...resource},
      };
    }

    function mapActivityBehaviour(ed) {
      if (!ed) return;

      const {$type: type} = ed;
      let behaviour = {...ed};

      const keys = Object.getOwnPropertyNames(ed);
      for (const key of keys) {
        if (refKeyPattern.test(key)) behaviour[key] = spreadRef(ed[key]);
      }

      switch (type) {
        case 'bpmn:ConditionalEventDefinition': {
          behaviour.expression = behaviour.condition && behaviour.condition.body;
          break;
        }
        case 'bpmn:InputOutputSpecification': {
          behaviour = prepareIoSpecificationBehaviour(ed);
          break;
        }
        case 'bpmn:MultiInstanceLoopCharacteristics': {
          behaviour.loopCardinality = ed.loopCardinality && ed.loopCardinality.body;
          behaviour.completionCondition = ed.completionCondition && ed.completionCondition.body;
          break;
        }
        case 'bpmn:StandardLoopCharacteristics': {
          behaviour.loopCondition = ed.loopCondition && ed.loopCondition.body;
          break;
        }
        case 'bpmn:TimerEventDefinition': {
          behaviour.timeDuration = ed.timeDuration && ed.timeDuration.body;
          break;
        }
      }

      return {
        type,
        behaviour,
      };
    }

    function prepareIoSpecificationBehaviour(ioSpecificationDef) {
      const {dataInputs, dataOutputs} = ioSpecificationDef;

      return {
        dataInputs: dataInputs && dataInputs.map((dataDef) => {
          return {
            ...dataDef,
            type: dataDef.$type,
            behaviour: getDataInputBehaviour(dataDef.id),
          };
        }),
        dataOutputs: dataOutputs && dataOutputs.map((dataDef) => {
          return {
            ...dataDef,
            type: dataDef.$type,
            behaviour: getDataOutputBehaviour(dataDef.id),
          };
        }),
      };
    }

    function getDataInputBehaviour(dataInputId) {
      const target = dataInputAssociations.find((assoc) => assoc.property === 'bpmn:targetRef' && assoc.id === dataInputId && assoc.element);
      const source = target && dataInputAssociations.find((assoc) => assoc.property === 'bpmn:sourceRef' && assoc.element && assoc.element.id === target.element.id);

      return {
        association: {
          source: source && {...source, dataObject: getDataObjectRef(source.id)},
          target: target && {...target},
        },
      };
    }

    function getDataObjectRef(dataObjectReferenceId) {
      const dataObjectRef = refs.find((dor) => dor.element && dor.element.id === dataObjectReferenceId);
      if (!dataObjectRef) return;
      return {...dataObjectRef};
    }

    function getDataOutputBehaviour(dataOutputId) {
      const source = dataOutputAssociations.find((assoc) => assoc.property === 'bpmn:sourceRef' && assoc.id === dataOutputId && assoc.element);
      const target = source && dataOutputAssociations.find((assoc) => assoc.property === 'bpmn:targetRef' && assoc.element && assoc.element.id === source.element.id);

      return {
        association: {
          source: source && {...source},
          target: target && {...target, dataObject: getDataObjectRef(target.id)},
        },
      };
    }

    function spreadRef(ref) {
      if (!ref) return;
      const {id, $type: type, name} = ref;
      return {id, type, name};
    }
  }

  var moddleContextSerializer = /*#__PURE__*/Object.freeze({
    __proto__: null,
    'default': context,
    TypeResolver: TypeResolver,
    resolveTypes: resolveTypes,
    map: mapModdleContext,
    deserialize: deserialize
  });

  var name$5 = "bpmn-engine";
  var description = "BPMN 2.0 execution engine. Open source javascript workflow engine.";
  var version = "8.4.0";
  var main = "dist/index.js";
  var source = "index.js";
  var module = "dist/index.esm.js";
  var repository = {
  	type: "git",
  	url: "git://github.com/paed01/bpmn-engine"
  };
  var author = {
  	name: "Pål Edman",
  	url: "https://github.com/paed01"
  };
  var engines = {
  	node: ">=10"
  };
  var files = [
  	"lib/",
  	"index.js"
  ];
  var scripts = {
  	test: "mocha -R dot",
  	posttest: "eslint . --cache && npm run toc",
  	wintest: "node_modules/.bin/mocha",
  	toc: "node scripts/generate-api-toc ./docs/API.md,./docs/Examples.md",
  	"test-md": "node scripts/test-markdown.js ./docs/API.md && node scripts/test-markdown.js ./docs/Examples.md",
  	build: "rollup -c",
  	server: "nodemon -r babel-register -r babel-polyfill  docs/examples/server.js",
  	examples: "node -r babel-register -r babel-polyfill  docs/examples/run.js"
  };
  var keywords = [
  	"workflow",
  	"engine",
  	"process",
  	"automation",
  	"bpmn",
  	"bpmn 2"
  ];
  var license = "MIT";
  var licenses = [
  	{
  		type: "MIT",
  		url: "https://github.com/paed01/bpmn-engine/master/LICENSE"
  	}
  ];
  var nyc = {
  	exclude: [
  		"test"
  	]
  };
  var devDependencies = {
  	"babel-polyfill": "^6.26.0",
  	"babel-preset-es2015": "^6.24.1",
  	"babel-preset-stage-3": "^6.24.1",
  	"babel-register": "^6.26.0",
  	bent: "^7.0.2",
  	"camunda-bpmn-moddle": "^4.2.0",
  	chai: "^4.1.2",
  	coveralls: "^3.0.7",
  	eslint: "^6.5.1",
  	express: "^4.17.1",
  	"markdown-toc": "^1.2.0",
  	mocha: "^6.2.1",
  	"mocha-cakes-2": "^3.3.0",
  	nock: "^11.4.0",
  	nodemon: "^1.19.4",
  	"npm-run-all": "^4.1.5",
  	nyc: "^14.1.1",
  	rollup: "^1.25.2",
  	"rollup-plugin-commonjs": "^10.1.0",
  	"rollup-plugin-json": "^4.0.0",
  	"rollup-plugin-node-resolve": "^5.2.0",
  	"rollup-plugin-terser": "^5.1.2",
  	unnecessary: "^1.3.4"
  };
  var dependencies = {
  	"bpmn-elements": "^0.11.0",
  	"bpmn-moddle": "^6.0.0",
  	debug: "^4.1.1",
  	"moddle-context-serializer": "^0.11.0",
  	smqp: "^1.10.0"
  };
  var _package = {
  	name: name$5,
  	description: description,
  	version: version,
  	main: main,
  	source: source,
  	module: module,
  	"umd:mainDist": "dist/bpmn-moddle.umd.js",
  	repository: repository,
  	author: author,
  	engines: engines,
  	files: files,
  	scripts: scripts,
  	keywords: keywords,
  	license: license,
  	licenses: licenses,
  	nyc: nyc,
  	devDependencies: devDependencies,
  	dependencies: dependencies
  };

  var _package$1 = /*#__PURE__*/Object.freeze({
    __proto__: null,
    name: name$5,
    description: description,
    version: version,
    main: main,
    source: source,
    module: module,
    repository: repository,
    author: author,
    engines: engines,
    files: files,
    scripts: scripts,
    keywords: keywords,
    license: license,
    licenses: licenses,
    nyc: nyc,
    devDependencies: devDependencies,
    dependencies: dependencies,
    'default': _package
  });

  var BpmnModdle$1 = getCjsExportFromNamespace(index_esm);

  var elements = getCjsExportFromNamespace(bpmnElements);

  var require$$0 = getCjsExportFromNamespace(smqp);

  var require$$1 = getCjsExportFromNamespace(moddleContextSerializer);

  var require$$3 = getCjsExportFromNamespace(_package$1);

  const { Broker: Broker$1 } = require$$0;
  const { default: serializer, deserialize: deserialize$1, TypeResolver: TypeResolver$1 } = require$$1;
  const { EventEmitter } = events;
  const { version: engineVersion } = require$$3;

  var bpmnEngine = { Engine };

  function Engine(options = {}) {
    options = { Logger: Logger, scripts: JavaScripts(), ...options };

    let { name, Logger: Logger$1 } = options;

    let loadedDefinitions, execution;
    const logger = Logger$1('engine');
    const typeResolver = TypeResolver$1({
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

    let environment = elements.Environment(options);
    const emitter = new EventEmitter();

    const engine = Object.assign(emitter, {
      execute,
      logger,
      getDefinitionById,
      getDefinitions,
      getState,
      recover,
      resume,
      stop,
      waitFor,
    });

    const broker = Broker$1(engine);
    broker.assertExchange('event', 'topic', { autoDelete: false });

    Object.defineProperty(engine, 'broker', {
      enumerable: true,
      get() {
        return broker;
      }
    });

    Object.defineProperty(engine, 'name', {
      enumerable: true,
      get() {
        return name;
      },
      set(value) {
        name = value;
      },
    });

    Object.defineProperty(engine, 'environment', {
      enumerable: true,
      get() {
        return environment;
      },
    });

    Object.defineProperty(engine, 'state', {
      enumerable: true,
      get() {
        if (execution) return execution.state;
        return 'idle';
      },
    });

    Object.defineProperty(engine, 'stopped', {
      enumerable: true,
      get() {
        if (execution) return execution.stopped;
        return false;
      },
    });

    Object.defineProperty(engine, 'execution', {
      enumerable: true,
      get() {
        return execution;
      },
    });

    return engine;

    async function execute(...args) {
      const [executeOptions, callback] = getOptionsAndCallback(...args);
      let runSources;
      try {
        runSources = await Promise.all(pendingSources);
      } catch (err) {
        if (callback) return callback(err);
        throw err;
      }
      const definitions = runSources.map((source) => loadDefinition(source, executeOptions));
      execution = Execution(engine, definitions, options);
      return execution.execute(executeOptions, callback);
    }

    async function stop() {
      if (!execution) return;
      return execution.stop();
    }

    function recover(savedState, recoverOptions) {
      if (!savedState) return engine;

      logger.debug(`<${name}> recover`);

      if (!name) name = savedState.name;
      if (recoverOptions) environment = elements.Environment(recoverOptions);
      if (savedState.environment) environment = environment.recover(savedState.environment);

      if (!savedState.definitions) return engine;

      loadedDefinitions = savedState.definitions.map((dState) => {
        const source = deserialize$1(JSON.parse(dState.source), typeResolver);

        logger.debug(`<${name}> recover ${dState.type} <${dState.id}>`);

        const definition = loadDefinition(source);
        definition.recover(dState);

        return definition;
      });

      return engine;
    }

    async function resume(...args) {
      const [resumeOptions, callback] = getOptionsAndCallback(...args);

      if (!execution) {
        const definitions = await getDefinitions();
        execution = Execution(engine, definitions, options);
      }
      return execution.resume(resumeOptions, callback);
    }

    async function getDefinitions(executeOptions) {
      if (loadedDefinitions && loadedDefinitions.length) return loadedDefinitions;
      return Promise.all(pendingSources).then((srcs) => srcs.map((src) => loadDefinition(src, executeOptions)));
    }

    async function getDefinitionById(id) {
      return (await getDefinitions()).find((d) => d.id === id);
    }

    async function getState() {
      if (execution) return execution.getState();

      const definitions = await getDefinitions();
      return Execution(engine, definitions, options).getState();
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
      return serialized;
    }

    function getModdleContext(source) {
      return new Promise((resolve, reject) => {
        const bpmnModdle = new BpmnModdle$1(options.moddleOptions);
        bpmnModdle.fromXML(Buffer.isBuffer(source) ? source.toString() : source.trim(), (err, _, moddleContext) => {
          if (err) return reject(err);
          resolve(moddleContext);
        });
      });
    }

    async function waitFor(eventName) {
      return new Promise((resolve, reject) => {
        engine.once(eventName, onEvent);
        engine.once('error', onError);

        function onEvent(api) {
          engine.removeListener('error', onError);
          resolve(api);
        }
        function onError(err) {
          engine.removeListener(eventName, onError);
          reject(err);
        }
      });
    }
  }

  function Execution(engine, definitions, options) {
    const { environment, logger, waitFor, broker } = engine;
    broker.on('return', onBrokerReturn);

    let state = 'idle';
    let stopped;

    return {
      get state() {
        return state;
      },
      get stopped() {
        return stopped;
      },
      execute,
      getState,
      resume,
      stop,
    };

    function execute(executeOptions, callback) {
      setup(executeOptions);
      stopped = false;
      logger.debug(`<${engine.name}> execute`);

      addConsumerCallbacks(callback);
      definitions.forEach((definition) => definition.run());

      return Api();
    }

    function resume(resumeOptions, callback) {
      setup(resumeOptions);

      stopped = false;
      logger.debug(`<${engine.name}> resume`);
      addConsumerCallbacks(callback);

      definitions.forEach((definition) => definition.resume());

      return Api();
    }

    function addConsumerCallbacks(callback) {
      if (!callback) return;

      broker.off('return', onBrokerReturn);

      clearConsumers();

      broker.subscribeOnce('event', 'engine.stop', cbLeave, { consumerTag: 'ctag-cb-stop' });
      broker.subscribeOnce('event', 'engine.end', cbLeave, { consumerTag: 'ctag-cb-end' });
      broker.subscribeOnce('event', 'engine.error', cbError, { consumerTag: 'ctag-cb-error' });

      function cbLeave() {
        clearConsumers();
        return callback(null, Api());
      }
      function cbError(_, message) {
        clearConsumers();
        return callback(message.content);
      }

      function clearConsumers() {
        broker.cancel('ctag-cb-stop');
        broker.cancel('ctag-cb-end');
        broker.cancel('ctag-cb-error');
        broker.on('return', onBrokerReturn);
      }
    }

    function stop() {
      const prom = waitFor('stop');
      definitions.forEach((d) => d.stop());
      return prom;
    }

    function setup(setupOptions = {}) {
      const listener = setupOptions.listener || options.listener;
      if (listener && typeof listener.emit !== 'function') throw new Error('listener.emit is not a function');

      definitions.forEach(setupDefinition);

      function setupDefinition(definition) {
        if (listener) definition.environment.options.listener = listener;

        definition.broker.subscribeTmp('event', 'definition.#', onChildMessage, { noAck: true, consumerTag: '_engine_definition' });
        definition.broker.subscribeTmp('event', 'process.#', onChildMessage, { noAck: true, consumerTag: '_engine_process' });
        definition.broker.subscribeTmp('event', 'activity.#', onChildMessage, { noAck: true, consumerTag: '_engine_activity' });
        definition.broker.subscribeTmp('event', 'flow.#', onChildMessage, { noAck: true, consumerTag: '_engine_flow' });
      }
    }

    function onChildMessage(routingKey, message, owner) {
      const { environment: ownerEnvironment } = owner;
      const listener = ownerEnvironment.options && ownerEnvironment.options.listener;
      state = 'running';

      let executionStopped, executionCompleted, executionErrored;
      const elementApi = owner.getApi && owner.getApi(message);

      switch (routingKey) {
        case 'definition.stop':
          teardownDefinition(owner);
          if (definitions.some((d) => d.isRunning)) break;

          executionStopped = true;
          stopped = true;
          break;
        case 'definition.leave':
          teardownDefinition(owner);
          if (definitions.some((d) => d.isRunning)) break;

          executionCompleted = true;
          break;
        case 'definition.error':
          teardownDefinition(owner);
          executionErrored = true;
          break;
        case 'activity.wait': {
          emitListenerEvent('wait', owner.getApi(message), Api());
          break;
        }
        case 'process.end': {
          if (!message.content.output) break;
          for (const key in message.content.output) {
            switch (key) {
              case 'data': {
                environment.output.data = environment.output.data || {};
                environment.output.data = { ...environment.output.data, ...message.content.output.data };
                break;
              }
              default: {
                environment.output[key] = message.content.output[key];
              }
            }
          }
          break;
        }
      }

      emitListenerEvent(routingKey, elementApi, Api());
      broker.publish('event', routingKey, { ...message.content }, { ...message.properties, mandatory: false });

      if (executionStopped) {
        state = 'stopped';
        logger.debug(`<${engine.name}> stopped`);
        onComplete('stop');
      } else if (executionCompleted) {
        state = 'idle';
        logger.debug(`<${engine.name}> completed`);
        onComplete('end');
      } else if (executionErrored) {
        state = 'error';
        logger.debug(`<${engine.name}> error`);
        onError(message.content.error);
      }

      function onComplete(eventName) {
        broker.publish('event', `engine.${eventName}`, {}, { type: eventName });
        engine.emit(eventName, Api());
      }

      function onError(err) {
        broker.publish('event', 'engine.error', err, { type: 'error', mandatory: true });
      }

      function emitListenerEvent(...args) {
        if (!listener) return;
        listener.emit(...args);
      }
    }

    function teardownDefinition(definition) {
      definition.broker.cancel('_engine_definition');
      definition.broker.cancel('_engine_process');
      definition.broker.cancel('_engine_activity');
      definition.broker.cancel('_engine_flow');
    }

    function getState() {
      return {
        name: engine.name,
        state,
        stopped,
        engineVersion,
        environment: environment.getState(),
        definitions: definitions.map(getDefinitionState),
      };
    }

    function getDefinitionState(definition) {
      return {
        ...definition.getState(),
        source: definition.environment.options.source.serialize(),
      };
    }

    function onBrokerReturn(message) {
      if (message.properties.type === 'error') {
        engine.emit('error', message.content);
      }
    }

    function Api() {
      return {
        name: engine.name,
        get state() {
          return state;
        },
        get stopped() {
          return stopped;
        },
        environment,
        definitions,
        stop,
        getState,
        getPostponed() {
          return definitions.reduce((result, definition) => {
            result = result.concat(definition.getPostponed());
            return result;
          }, []);
        },
        waitFor,
      };
    }
  }
  var bpmnEngine_1 = bpmnEngine.Engine;

  exports.Engine = bpmnEngine_1;
  exports.default = bpmnEngine;

  Object.defineProperty(exports, '__esModule', { value: true });

})));
