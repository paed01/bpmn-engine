# Upgrade

# < v14

Since v14 of the engine output is no longer shared between definition and processes. To upgrade a saved state before version 14 you can run the following script that adds process environment to state.

```javascript
export function upgradeStateToVersion14(state) {
  const stateVersion = getSemverVersion(state.engineVersion);
  if (!stateVersion || stateVersion.major >= 14) return state;

  return polyfillProcessEnvironment(state);
}

function polyfillProcessEnvironment(state) {
  if (!state.definitions && state.definitions.length) return state;

  const polyfilledState = JSON.parse(JSON.stringify(state));
  for (const definition of polyfilledState.definitions) {
    if (!definition.environment) continue;
    if (!definition.execution) continue;
    if (!definition.execution.processes) continue;

    for (const bp of definition.execution.processes) {
      addProcessEnvironment(definition.environment, bp);
    }
  }

  return polyfilledState;
}

function addProcessEnvironment(environment, processState) {
  processState.environment = JSON.parse(JSON.stringify(environment));
}

function getSemverVersion(version) {
  if (typeof version !== 'string') return;
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return;
  const [, major, minor, patch] = match;
  return {
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch),
  };
}
```
