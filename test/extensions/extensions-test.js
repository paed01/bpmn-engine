'use strict';

const {Engine} = require('../..');
const {EventEmitter} = require('events');

const moddleOptions = require('../resources/js-bpmn-moddle.json');

describe('engine extensions', () => {
  const source = `
  <definitions id="extension-test" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:js="http://paed01.github.io/bpmn-engine/schema/2017/08/bpmn">
    <process id="mainProcess" isExecutable="true">
      <task id="task" js:result="test">
        <extensionElements>
          <js:output id="output" name="returnValue" value="\${result[0]}" />
        </extensionElements>
      </task>
    </process>
  </definitions>`;

  it('passes extensions to definition', (done) => {
    let initExtensions = false;
    const extensions = {
      js: {
        moddleOptions,
        extension: function init() {
          initExtensions = true;
        }
      }
    };

    const engine = Engine({
      source,
      extensions
    });

    engine.execute((err) => {
      if (err) return done(err);
      expect(initExtensions).to.be.true;
      done();
    });
  });

  it('extension can act on element and context', (done) => {
    let extensionArgs = false;
    const extensions = {
      js: {
        moddleOptions,
        extension: function init(...args) {
          extensionArgs = args;
        }
      }
    };

    const engine = Engine({
      source,
      extensions
    });

    engine.execute((err) => {
      if (err) return done(err);
      expect(extensionArgs).to.have.length(2);
      expect(extensionArgs[0].$type).to.equal('bpmn:Task');
      expect(extensionArgs[1].type).to.equal('context');
      done();
    });
  });

  it('is called when activity is initialised', (done) => {
    const extensionArgs = [];
    const extensions = {
      js: {
        moddleOptions,
        extension: function init({id, $type}) {
          extensionArgs.push(`${$type}.${id}`);
        }
      }
    };

    const engine = Engine({
      name: 'extension',
      source,
      extensions
    });

    engine.execute((err) => {
      if (err) return done(err);
      expect(extensionArgs).to.eql(['bpmn:Task.task']);
      done();
    });
  });

  it('is resumable', (done) => {
    const extensionArgs = [];
    const extensions = {
      js: {
        moddleOptions,
        extension: function init({id, $type}) {
          extensionArgs.push(`${$type}.${id}`);
        }
      }
    };

    const engine = Engine({
      name: 'extension',
      source,
      extensions
    });

    const listener = new EventEmitter();
    listener.once('start-task', () => {
      const state = engine.getState();
      engine.stop();
      resume(state);
    });
    engine.execute({listener});

    function resume(state) {
      const resumeEngine = Engine.resume(state, {extensions, name: 'resume-extension'});
      resumeEngine.on('end', () => {
        expect(extensionArgs).to.eql(['bpmn:Task.task', 'bpmn:Task.task']);
        done();
      });
    }
  });
});


