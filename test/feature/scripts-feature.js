'use strict';

const {Engine} = require('../..');

Feature('Scripts', () => {
  Scenario('Process with scripts', () => {
    let engine, source;
    Given('a bpmn source with empty script task', () => {
      source = `
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
          <scriptTask id="task1" />
        </process>
      </definitions>`;
    });

    And('an engine loaded with disabled dummy script', () => {
      engine = Engine({
        name: 'Script feature',
        source,
        disableDummyScript: true,
      });
    });

    let error;
    When('source is executed', async () => {
      error = await engine.execute().catch((err) => err);
    });

    Then('execution errored', () => {
      expect(error).to.match(/not registered/);
    });

    When('ran again falsy disable dummy script', () => {
      engine = Engine({
        name: 'Script feature',
        source,
        disableDummyScript: false,
      });
    });

    let end;
    When('source is executed', async () => {
      end = engine.waitFor('end');
      error = await engine.execute().catch((err) => err);
    });

    Then('execution completed', () => {
      return end;
    });
  });
});
