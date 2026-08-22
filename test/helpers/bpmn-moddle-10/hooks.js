/**
 * Module resolve hook that redirects every `bpmn-moddle` specifier to the
 * `bpmn-moddle-10` npm alias (bpmn-moddle@^10), so a child process can run
 * the engine as if bpmn-moddle 10 were the installed peer dependency.
 */
export function resolve(specifier, context, nextResolve) {
  if (specifier === 'bpmn-moddle') return nextResolve('bpmn-moddle-10', context);
  return nextResolve(specifier, context);
}
