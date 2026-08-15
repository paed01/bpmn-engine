declare global {
  const expect: Chai.ExpectStatic;

  // mocha-cakes-2
  const Feature: Mocha.SuiteFunction;
  const Scenario: Mocha.SuiteFunction;
  const Given: Mocha.TestFunction;
  const When: Mocha.TestFunction;
  const Then: Mocha.TestFunction;
  const And: Mocha.TestFunction;
  const But: Mocha.TestFunction;
  const afterEachScenario: Mocha.HookFunction;
  const beforeEachScenario: Mocha.HookFunction;
}

export {};
