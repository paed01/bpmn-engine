/**
 * Runs the engine with the raw `source` option — the path that makes the
 * engine itself import and instantiate bpmn-moddle. Launched by the
 * bpmn-moddle backward compatibility feature with `--import ./register.js`,
 * so `bpmn-moddle` resolves to bpmn-moddle@10 in this process.
 *
 * Prints a JSON verdict on stdout and exits non-zero on failure.
 */
import * as bpmnModdle from 'bpmn-moddle';
import { Engine } from 'bpmn-engine';

import * as factory from '../factory.js';

const engine = new Engine({
  name: 'source parsed by the engine on bpmn-moddle@10',
  source: factory.resource('mother-of-all.bpmn').toString(),
  services: {
    serviceFn(...args) {
      args.pop()();
    },
  },
});

const definitions = await engine.getDefinitions();

process.stdout.write(
  JSON.stringify({
    resolvedModdleExports: Object.keys(bpmnModdle),
    definitionId: definitions[0].id,
  })
);
