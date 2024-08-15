import { Engine } from '../../../src/index.js';
import * as factory from '../../helpers/factory.js';

const source = factory.resource('issue-188.bpmn');

Feature('issue 188 - SubProcess stalls', () => {
  Scenario('service impl', () => {
    let engine;
    Given('amount is greater than 0', () => {
      engine = getEngine188({ amount: 1 });
    });

    let end;
    When('executed', () => {
      end = engine.waitFor('end');
      return engine.execute();
    });

    And('any signal task is signaled', () => {
      const postponed = engine.execution.getPostponed();
      if (postponed.length) {
        engine.execution.signal({ id: postponed[0].id });
      }
    });

    Then('run completes', () => {
      return end;
    });
  });
});

function getEngine188(vars) {
  return new Engine({
    variables: {
      accountInfo: {
        'amount-due': 0,
      },
      additionalPaymentAmount: 0,
      amount: 0,
      amountPrompts: [],
      amountStatus: '',
      amountType: '',
      clientCfg: { options: { supported: 'true' } },
      maxAmount: Number.MAX_SAFE_INTEGER,
      minAmount: 0,
      payment: { paymentHeader: { convenienceFee: 0 } },
      retryCounters: {},
      wizardCfg: {
        ivrDefaultAmountToLiability: 0,
        ivrLiabilityAmountSelect: 0,
        ivrTotalAmountPlayback: 0,
      },
      ...vars,
    },
    name: 'issue-188',
    source,
    services: {
      buildAmountPrompts(...args) {
        args.pop()();
      },
      conditionListVariableCheck(variables, field, operator, compare) {
        switch (operator) {
          case '===':
            return variables[field] === compare;
          case '!==':
            return variables[field] !== compare;
        }
        return false;
      },
      initConvenienceFee(...args) {
        args.pop()();
      },
      processAmount(...args) {
        args.pop()();
      },
      processAmountType(...args) {
        args.pop()();
      },
      setPaymentHeaderAmt(...args) {
        args.pop()();
      },
    },
  });
}
