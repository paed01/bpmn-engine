module.exports = {
  env: {
    mocha: true,
  },
  rules: {
    'no-unused-expressions': 0,
    'no-var': 1,
    'prefer-arrow-callback': 1,
  },
  globals: {
    expect: false,
    Feature: false,
    Scenario: false,
    Given: false,
    When: false,
    Then: false,
    And: false,
    But: false,
  },
};
