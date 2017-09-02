'use strict';

const Lab = require('lab');
const testHelpers = require('../helpers/testHelpers');

const lab = exports.lab = Lab.script();
const {beforeEach, describe, it} = lab;
const {expect} = Lab.assertions;

describe('DataObjects', () => {
  let context;
  beforeEach((done) => {
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

    testHelpers.getContext(source, (err, result) => {
      if (err) return done(err);
      context = result;
      done();
    });
  });

  describe('getActivityInputValue()', () => {
    it('returns value from environment', (done) => {
      const data = context.getDataObjects();

      context.environment.assignVariables({
        userInfo: 'test'
      });

      expect(data.getActivityInputValue('userInput')).to.equal('test');

      done();
    });

    it('with undefined activity input returns undefined', (done) => {
      const data = context.getDataObjects();
      expect(data.getActivityInputValue('noref')).to.be.undefined();
      done();
    });

    it('with unassociated activity input returns undefined', (done) => {
      const data = context.getDataObjects();
      expect(data.getActivityInputValue('userNoRef')).to.be.undefined();
      done();
    });
  });

  describe('saveActivityOutputValue()', () => {
    it('saves value to environment', (done) => {
      const data = context.getDataObjects();
      const {environment} = context;

      environment.assignVariables({
        userInfo: 'test'
      });

      data.saveActivityOutputValue('userOutput', 'save me');
      expect(environment.variables.userSays).to.equal('save me');
      expect(environment.getOutput()).to.equal({
        userSays: 'save me'
      });

      done();
    });

    it('with undefined activity output ignores', (done) => {
      const data = context.getDataObjects();
      const {environment} = context;

      data.saveActivityOutputValue('noref', 'save me');
      expect(environment.getOutput()).to.equal({});
      done();
    });

    it('with unassociated activity input is ignored', (done) => {
      const data = context.getDataObjects();
      const {environment} = context;

      data.saveActivityOutputValue('userNoRef', 'save me');
      expect(environment.getOutput()).to.equal({});
      done();
    });
  });
});
