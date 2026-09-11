import { execFile } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { Engine } from 'bpmn-engine';
// @ts-ignore
import BpmnModdle9 from 'bpmn-moddle';
import { BpmnModdle as BpmnModdle10 } from 'bpmn-moddle-10';

import * as factory from '../helpers/factory.js';

/**
 * bpmn-moddle is a peer dependency with the range `>=9`, so a consumer may run
 * the engine on either v9 or v10. v10 ships the parser as a *named* export
 * (`import { BpmnModdle }`) instead of the v9 default export, but the moddle
 * context it produces is identical. These features pin that compatibility down:
 * state persisted by a deployment on v9 must keep resuming after an upgrade to v10.
 */
Feature('bpmn-moddle 9/10 backward compatibility', () => {
  const source = factory.resource('mother-of-all.bpmn').toString();
  const services = {
    serviceFn(...args) {
      args.pop()();
    },
  };

  Scenario('state saved on bpmn-moddle@9 is resumed on bpmn-moddle@10', () => {
    let state;
    Given('the mother-of-all source parsed with bpmn-moddle@9', () => {
      expect(BpmnModdle9, 'v9 default export').to.be.a('function');
    });

    /** @type {import('bpmn-engine').Engine} */
    let engine;
    /** @type {Promise<any>} */
    let stopped;
    And('an engine started from that v9 moddle context', async () => {
      const moddleContext = await new BpmnModdle9().fromXML(source.trim());
      engine = new Engine({ name: 'saved on v9', moddleContext, services });

      const listener = new EventEmitter();
      listener.once('activity.wait', (_, engineApi) => engineApi.stop());

      stopped = engine.waitFor('stop');
      engine.execute({ listener });
    });

    And('it is stopped at the first user task wait', () => {
      return stopped;
    });

    Then('engine state can be saved', async () => {
      state = await engine.getState();
      expect(state.definitions[0]).to.have.property('id', 'Definitions_1');
      expect(state.definitions[0]).to.have.property('source').that.is.a('string');
    });

    let slimmerState;
    And('the persisted runtime state without the embedded v9 source', () => {
      slimmerState = JSON.parse(JSON.stringify(state));
      slimmerState.definitions[0].source = undefined;
    });

    /** @type {import('bpmn-engine').Engine} */
    let recovered;
    /** @type {Promise<any>} */
    let ended;
    When('a fresh engine parses the same source with bpmn-moddle@10 and recovers the state', async () => {
      expect(BpmnModdle10, 'v10 named export').to.be.a('function');

      const moddleContext = await new BpmnModdle10().fromXML(source.trim());
      recovered = new Engine({ name: 'resumed on v10', moddleContext, services });
      recovered.recover(slimmerState);
    });

    And('the recovered engine is resumed, signalling every wait', () => {
      const listener = new EventEmitter();
      listener.on('activity.wait', (activityApi) => activityApi.signal());

      ended = recovered.waitFor('end');
      recovered.resume({ listener });
    });

    Then('execution completes', async () => {
      await ended;
      expect(recovered).to.have.property('state', 'idle');
    });
  });

  Scenario('bpmn-moddle@9 and bpmn-moddle@10 serialize to the same source context', () => {
    let v9Context, v10Context;
    Given('the source serialized through an engine using bpmn-moddle@9', async () => {
      const moddleContext = await new BpmnModdle9().fromXML(source.trim());
      v9Context = await new Engine({ moddleContext }).getDefinitions().then((defs) => defs[0].environment.options.source);
    });

    And('the source serialized through an engine using bpmn-moddle@10', async () => {
      const moddleContext = await new BpmnModdle10().fromXML(source.trim());
      v10Context = await new Engine({ moddleContext }).getDefinitions().then((defs) => defs[0].environment.options.source);
    });

    Then('both serialized contexts are equal', () => {
      expect(JSON.parse(v9Context.serialize())).to.deep.equal(JSON.parse(v10Context.serialize()));
    });
  });

  Scenario('the engine parses raw source itself regardless of bpmn-moddle version', () => {
    Given('the engine parses the source option with bpmn-moddle@9, the installed peer', async () => {
      const definitions = await new Engine({ source }).getDefinitions();
      expect(definitions[0]).to.have.property('id', 'Definitions_1');
    });

    let v10Run;
    When('a child process where bpmn-moddle resolves to v10 runs the engine with the source option', async function whenSpawned() {
      this.timeout(5000);
      const helperDir = new URL('../helpers/bpmn-moddle-10/', import.meta.url);
      const { stdout } = await promisify(execFile)(process.execPath, [
        '--import',
        new URL('./register.js', helperDir).href,
        fileURLToPath(new URL('./run-engine-source.js', helperDir)),
      ]);
      v10Run = JSON.parse(stdout);
    });

    Then('the child process resolved the v10 named export and the engine parsed the source', () => {
      expect(v10Run.resolvedModdleExports, 'v10 exports').to.deep.equal(['BpmnModdle']);
      expect(v10Run).to.have.property('definitionId', 'Definitions_1');
    });
  });
});
