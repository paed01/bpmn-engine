'use strict';

const testHelpers = require('../helpers/testHelpers');

describe('DataObjects', () => {
  let context;
  beforeEach(async () => {
    const source = `
    <?xml version="1.0" encoding="UTF-8"?>
    <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
      <process id="theProcess" isExecutable="true">
        <dataObjectReference id="inputToUserRef" dataObjectRef="userInfo" />
        <dataObjectReference id="outputToUserRef" dataObjectRef="userSays" />
        <dataObject id="userInfo" />
        <dataObject id="userSays" />
        <userTask id="userTask">
          <dataInputAssociation id="associatedInputWith" sourceRef="userInput" targetRef="inputToUserRef" />
          <dataInputAssociation id="unassociatedInput" sourceRef="userNoRef" />
          <ioSpecification id="inputSpec">
            <dataInput id="userInput" name="info" />
            <dataInput id="userNoRef" name="noref" />
            <dataInput id="userOutput" name="well" />
          </ioSpecification>
          <dataOutputAssociation id="associatedOutputWith" sourceRef="userOutput" targetRef="outputToUserRef" />
          <dataOutputAssociation id="unassociatedOutput" sourceRef="userNoRef" />
        </userTask>
      </process>
    </definitions>`;

    context = await testHelpers.context(source);
  });

  describe('getActivityInputValue()', () => {
    it('returns value from environment', () => {
      const data = context.getDataObjects();

      context.environment.assignVariables({
        userInfo: 'test'
      });

      expect(data.getActivityInputValue('userInput')).to.equal('test');
    });

    it('with undefined activity input returns undefined', () => {
      const data = context.getDataObjects();
      expect(data.getActivityInputValue('noref')).to.be.undefined;
    });

    it('with unassociated activity input returns undefined', () => {
      const data = context.getDataObjects();
      expect(data.getActivityInputValue('userNoRef')).to.be.undefined;
    });
  });

  describe('saveActivityOutputValue()', () => {
    it('saves value to environment', () => {
      const data = context.getDataObjects();
      const {environment} = context;

      environment.assignVariables({
        userInfo: 'test'
      });

      data.saveActivityOutputValue('userOutput', 'save me');
      expect(environment.variables.userSays).to.equal('save me');
      expect(environment.getOutput()).to.eql({
        userSays: 'save me'
      });
    });

    it('with undefined activity output ignores', () => {
      const data = context.getDataObjects();
      const {environment} = context;

      data.saveActivityOutputValue('noref', 'save me');
      expect(environment.getOutput()).to.eql({});
    });

    it('with unassociated activity input is ignored', () => {
      const data = context.getDataObjects();
      const {environment} = context;

      data.saveActivityOutputValue('userNoRef', 'save me');
      expect(environment.getOutput()).to.eql({});
    });
  });
});
