import { Engine } from '../../src/index.js';

Feature('Engine output', () => {
  Scenario('Process completes with output', () => {
    let engine;
    Given('a process with output', () => {
      const source = `<?xml version="1.0" encoding="UTF-8"?>
      <definitions id="script-definition" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="my-process" isExecutable="true">
          <scriptTask id="task" scriptFormat="javascript">
            <script><![CDATA[
              environment.output.foo = 'bar';
              next();
            ]]>
            </script>
          </scriptTask>
        </process>
      </definitions>`;

      engine = new Engine({ source });
    });

    let end;
    When('ran', () => {
      end = engine.waitFor('end');
      engine.execute();
    });

    Then('run completes', () => {
      return end;
    });

    And('engine state contain hoisted process output', async () => {
      expect((await engine.getState()).environment.output).to.deep.equal({ foo: 'bar' });
    });

    Given('a process with call activity and a called process', () => {
      const source = `<?xml version="1.0" encoding="UTF-8"?>
      <definitions id="script-definition" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="my-process" isExecutable="true">
          <callActivity id="call-activity" calledElement="called-process" />
          <sequenceFlow id="to-task" sourceRef="call-activity" targetRef="task" />
          <scriptTask id="task" scriptFormat="javascript">
            <script><![CDATA[
              environment.output.foo = 'bar';
              next();
            ]]>
            </script>
          </scriptTask>
        </process>
        <process id="called-process" isExecutable="false">
          <scriptTask id="called-task" scriptFormat="javascript">
            <script><![CDATA[
              environment.output.bar = 'baz';
              next();
            ]]>
            </script>
          </scriptTask>
        </process>
      </definitions>`;

      engine = new Engine({ source });
    });

    When('ran', () => {
      end = engine.waitFor('end');
      engine.execute();
    });

    Then('run completes', () => {
      return end;
    });

    And('engine state contain hoisted main process output', async () => {
      expect((await engine.getState()).environment.output).to.deep.equal({ foo: 'bar' });
    });
  });

  Scenario('process fails', () => {
    let engine;
    Given('a process with output', () => {
      const source = `<?xml version="1.0" encoding="UTF-8"?>
      <definitions id="script-definition" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="my-process" isExecutable="true">
          <scriptTask id="task" scriptFormat="javascript">
            <script><![CDATA[
              environment.output.foo = 'bar';

              baz();

              next();
            ]]>
            </script>
          </scriptTask>
        </process>
      </definitions>`;

      engine = new Engine({ source });
    });

    let errored;
    When('ran', () => {
      errored = engine.waitFor('error');
      engine.execute();
    });

    Then('run fails', () => {
      return errored;
    });

    And('engine state contain hoisted process output', async () => {
      expect((await engine.getState()).environment.output).to.deep.equal({ foo: 'bar' });
    });
  });
});
