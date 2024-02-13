import Debug from 'debug';

export default function Logger(scope) {
  return {
    debug: Debug('bpmn-engine:' + scope),
    error: Debug('bpmn-engine:error:' + scope),
    warn: Debug('bpmn-engine:warn:' + scope),
  };
}
