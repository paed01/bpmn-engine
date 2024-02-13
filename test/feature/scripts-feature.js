import { Engine } from '../../src/index.js';

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

  Scenario('Process with setTimeout in inline scripts task', () => {
    let engine, source;
    Given('a bpmn source with script task with setTimeout', () => {
      source = `
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
          <scriptTask id="scriptTask" scriptFormat="javascript">
            <script>
              <![CDATA[
                setTimeout(next, 1);
              ]]>
            </script>
          </scriptTask>
        </process>
      </definitions>`;
    });

    let end;
    When('source is executed', () => {
      engine = Engine({
        name: 'Script feature',
        source,
        disableDummyScript: true,
      });

      end = engine.waitFor('end');

      engine.execute();
    });

    Then('execution completed', () => {
      return end;
    });
  });

  Scenario('Process with long running timer can be stopped', () => {
    let engine, source;
    Given('a bpmn source with script task with setTimeout', () => {
      source = `
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <process id="theProcess" isExecutable="true">
          <scriptTask id="scriptTask" scriptFormat="javascript">
            <script>
              <![CDATA[
                setTimeout(next, 60000);
              ]]>
            </script>
          </scriptTask>
        </process>
      </definitions>`;
    });

    When('source is executed', () => {
      engine = Engine({
        name: 'Script feature',
        source,
        disableDummyScript: true,
      });

      engine.execute();
    });

    Then('timer is running', () => {
      expect(engine.environment.timers.executing).to.have.length(1);
    });

    When('execution is stopped', () => {
      return engine.stop();
    });

    Then('timer is stopped', () => {
      expect(engine.environment.timers.executing).to.have.length(0);
    });
  });
});
