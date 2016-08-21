'use strict';

const Code = require('code');
const Lab = require('lab');
const lab = exports.lab = Lab.script();
const expect = Code.expect;
const Hoek = require('hoek');
const factory = require('./helpers/factory');

const Bpmn = require('..');
const ActivityHelper = Bpmn.ActivityHelper;

lab.describe('activity-execution', () => {
  const transformer = new Bpmn.Transformer();

  lab.test('Bpmn exposes executor module', (done) => {
    expect(Bpmn).to.include('ActivityExecution');
    done();
  });

  lab.test('throws an error if not created with new', (done) => {
    function fn() {
      /* eslint new-cap:0 */
      Bpmn.ActivityExecution();
    }

    expect(fn).to.throw(Error);
    done();
  });

  let activityDefinition, invalidDefinition, validDefinition;
  lab.before((done) => {
    transformer.transform(factory.valid(), true, (err, definition, context) => {
      console.log(context)

      if (err) return done(err);
      validDefinition = context;
      done();
    });
  });

  lab.before((done) => {
    transformer.transform(factory.invalid(), true, (err, definition, context) => {
      if (err) return done(err);
      invalidDefinition = context;
      done();
    });
  });

  lab.beforeEach((done) => {
    activityDefinition = Hoek.clone(validDefinition);
    done();
  });

  lab.describe('#ctor', () => {
    lab.test('returns new instance', (done) => {
      new Bpmn.ActivityExecution(validDefinition, (err) => {
        expect(err).to.not.exist();
        done();
      });
    });

    /* eslint no-new:0 */
    lab.test('returns error in callback if no activity definition', (done) => {
      new Bpmn.ActivityExecution(null, (err) => {
        expect(err).to.exist();
        done();
      });
    });

    lab.test('throws an error if no activityDefinition is passed', (done) => {
      function fn() {
        new Bpmn.ActivityExecution(null);
      }

      expect(fn).to.throw(Error);
      done();
    });

    lab.test('returns error in callback if not validated', (done) => {
      const def = activityDefinition;
      const sequenceFlows = ActivityHelper.getActivitiesByType(def, 'SequenceFlow');

      new Bpmn.ActivityExecution(sequenceFlows[0], (err) => {
        expect(err).to.exist();
        done();
      });
    });

    lab.test('returns error in callback if sequenceFlow without sourceRef is passed', (done) => {
      const def = activityDefinition;
      const sequenceFlows = ActivityHelper.getActivitiesByType(def, 'SequenceFlow');
      delete sequenceFlows[0].sourceRef;

      new Bpmn.ActivityExecution(invalidDefinition, (err) => {
        expect(err).to.exist();
        done();
      });
    });
  });

  lab.describe('#start', () => {

    lab.test('returns activity definition', (done) => {
      const exec = new Bpmn.ActivityExecution(activityDefinition);
      expect(exec.start).to.be.a.function();
      done();
    });

    lab.test('without callback is ok', (done) => {
      const exec = new Bpmn.ActivityExecution(activityDefinition);
      exec.once('start', (e) => {
        expect(e).to.exist();
        expect(e.id).to.equal('theProcess2');
        expect(e.$type).to.equal('bpmn:Process');
        done();
      });

      exec.start();
    });

    lab.test('emits start event when started', (done) => {
      const exec = new Bpmn.ActivityExecution(activityDefinition);
      exec.once('start', (e) => {
        expect(e).to.exist();
        expect(e.id).to.equal('theProcess2');
        expect(e.$type).to.equal('bpmn:Process');
        done();
      });

      exec.start((err) => {
        expect(err).to.not.exist();
      });
    });

    lab.test('emits end event when ended', (done) => {
      const exec = new Bpmn.ActivityExecution(activityDefinition);
      exec.on('end', (e) => {
        expect(e).to.exist();
        if (e.$type === 'bpmn:Process') {
          expect(e.id).to.equal('theProcess2');
          done();
        }
      });

      exec.start((err) => {
        expect(err).to.not.exist();
      });
    });

    lab.test('emits take event when following sequenceFlow', (done) => {
      const exec = new Bpmn.ActivityExecution(activityDefinition);
      exec.once('take', (e) => {
        expect(e).to.exist();
        done();
      });

      exec.start((err) => {
        expect(err).to.not.exist();
      });
    });
  });

  lab.describe('#startAll', () => {
    lab.test('takes an array with activities', (done) => {
      const def = activityDefinition;
      const exec = new Bpmn.ActivityExecution(def);
      const activities = ActivityHelper.getActivitiesByType(def, 'bpmn:StartEvent');

      exec.startAll(activities, (err) => {
        expect(err).to.not.exist();
        done();
      });
    });

    lab.test('returns error in callback if passed activities without type', (done) => {
      const def = activityDefinition;
      const exec = new Bpmn.ActivityExecution(def);
      const activities = ActivityHelper.getActivitiesByType(def, 'bpmn:StartEvent');

      delete activities[0].$type;

      exec.startAll(activities, (err) => {
        expect(err).to.exist();
        done();
      });
    });

    lab.test('takes an array with activities without callback', (done) => {
      const def = activityDefinition;
      const exec = new Bpmn.ActivityExecution(def);
      const activities = ActivityHelper.getActivitiesByType(def, 'bpmn:StartEvent');

      exec.once('start', done.bind(null, null));

      exec.startAll(activities);
    });

    lab.test('emits error event if passed activities without type, no callback', (done) => {
      const def = activityDefinition;
      const exec = new Bpmn.ActivityExecution(def);
      const activities = ActivityHelper.getActivitiesByType(def, 'bpmn:StartEvent');

      delete activities[0].type;

      exec.once('start', done.bind(null, null));

      exec.startAll(activities);
    });
  });

  lab.describe('#executeActivity', () => {
    lab.test('takes an activityDefinition and creates an ActivityExecution', (done) => {
      const def = activityDefinition;
      const exec = new Bpmn.ActivityExecution(def);
      const activity = ActivityHelper.getActivityById(def, 'theStart');

      exec.executeActivity(activity, null, (err, activityExecution) => {
        expect(err).to.not.exist();
        expect(activityExecution).to.exist();
        expect(activityExecution).to.be.instanceof(Bpmn.ActivityExecution);
        done();
      });
    });

    lab.test('creates an ActivityExecution that is not started', (done) => {
      const def = activityDefinition;
      const exec = new Bpmn.ActivityExecution(def);
      const activity = ActivityHelper.getActivityById(def, 'theStart');

      exec.executeActivity(activity, null, (err, activityExecution) => {
        expect(err).to.not.exist();
        expect(activityExecution.startDate).to.not.exist();
        done();
      });
    });

    lab.test('creates an ActivityExecution with current as parent', (done) => {
      const def = activityDefinition;
      const exec = new Bpmn.ActivityExecution(def);
      const activity = ActivityHelper.getActivityById(def, 'theStart');

      exec.executeActivity(activity, null, (err, activityExecution) => {
        expect(err).to.not.exist();
        expect(activityExecution.parent).to.not.equal(exec);
        done();
      });
    });

    lab.test('throws an error if not passed callback', (done) => {
      const fn = function() {
        const def = activityDefinition;
        const exec = new Bpmn.ActivityExecution(def);
        const activity = ActivityHelper.getActivityById(def, 'theStart');
        exec.executeActivity(activity);
      };

      expect(fn).to.throw(Error);
      done();
    });
  });

  lab.describe('#takeAll', () => {
    lab.test('with null sequenceFlows return error in callback', (done) => {
      const def = activityDefinition;
      const exec = new Bpmn.ActivityExecution(def);

      exec.takeAll(null, (err) => {
        expect(err).to.exist();
        done();
      });
    });

    lab.test('with [] sequenceFlows return error in callback', (done) => {
      const def = activityDefinition;
      const exec = new Bpmn.ActivityExecution(def);

      exec.takeAll([], (err) => {
        expect(err).to.exist();
        done();
      });
    });

    lab.test('with [] sequenceFlows return emits error if no callback', (done) => {
      const def = activityDefinition;
      const exec = new Bpmn.ActivityExecution(def);

      exec.once('error', () => {
        done();
      });

      exec.takeAll([]);
    });

    lab.test('on activity with bad sequenceFlow emits error', (done) => {
      const def = activityDefinition;
      const exec = new Bpmn.ActivityExecution(def);

      const activity = ActivityHelper.getActivityById(def, 'theStart');
      const sequenceFlows = ActivityHelper.getSequenceFlows(activity, def);
      sequenceFlows[0].targetRef = 'wrongTurn';

      exec.once('error', done.bind(null, null));

      exec.start();
    });

    lab.test('on activity with sequenceFlow pointing at bad activity emits error', (done) => {
      const def = activityDefinition;
      const exec = new Bpmn.ActivityExecution(def);

      const toActivity = ActivityHelper.getActivityById(def, 'decision');
      delete toActivity.$type;

      exec.once('error', done.bind(null, null));

      exec.start();
    });

  });

  lab.describe('#signal', () => {
    let signalActivityDefinition, osignalActivityDefinition;
    const userTaskXml = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcessSignal" isExecutable="true">
  <startEvent id="theStart" />
  <userTask id="userTask" />
  <endEvent id="theEnd" />
  <sequenceFlow id="flow1" sourceRef="theStart" targetRef="userTask" />
  <sequenceFlow id="flow2" sourceRef="userTask" targetRef="theEnd" />
  </process>
</definitions>
    `;

    lab.before((done) => {
      transformer.transform(userTaskXml, true, (err, bpmnObject) => {
        if (err) return done(err);
        osignalActivityDefinition = bpmnObject.rootElements[0];
        done();
      });
    });
    lab.beforeEach((done) => {
      signalActivityDefinition = Hoek.clone(osignalActivityDefinition);
      done();
    });

    lab.test('parent execution with activity that has ended emits error', (done) => {
      const def = activityDefinition;
      const exec = new Bpmn.ActivityExecution(def);

      exec.once('error', (e) => {
        if (e.activity.activityDefinition.id === 'decision') {
          done();
        }
      });

      exec.on('end', (e) => {
        if (e.id === 'end2') {
          exec.signal('decision');
        }
      });

      exec.start();
    });

    lab.test('parent execution with activity that has ended returns error in callback', (done) => {
      const def = activityDefinition;
      const exec = new Bpmn.ActivityExecution(def);

      exec.on('end', (e) => {
        if (e.id === 'end2') {
          exec.signal('decision', (err) => {
            expect(err).to.exist();
            done();
          });
        }
      });

      exec.start();
    });

    lab.test('can be called with activity id on parent execution', (done) => {
      const def = signalActivityDefinition;
      const exec = new Bpmn.ActivityExecution(def);

      exec.on('end', (e) => {
        if (e.id === 'userTask') {
          done();
        }
      });
      exec.on('start', (e) => {
        if (e.id === 'userTask') {
          exec.signal('userTask');
        }
      });

      exec.start();
    });

    lab.test('can be called with activity id and callback on parent execution', (done) => {
      const def = signalActivityDefinition;
      const exec = new Bpmn.ActivityExecution(def);

      exec.on('end', (e) => {
        if (e.id === 'userTask') {
          done();
        }
      });
      exec.on('start', (e) => {
        if (e.id === 'userTask') {
          exec.signal('userTask', (err) => {
            expect(err).to.not.exist();
          });
        }
      });

      exec.start();
    });

    lab.test('can be called on activityDefinition with callback', (done) => {
      const def = signalActivityDefinition;
      const exec = new Bpmn.ActivityExecution(def);

      exec.on('end', (e) => {
        if (e.id === 'userTask') {
          done();
        }
      });
      exec.on('start', (e) => {
        if (e.id === 'userTask') {
          exec.getActivityExecutionById('userTask', (err1, execution) => {
            if (err1) return done(err1);
            execution.signal((err) => {
              expect(err).to.not.exist();
            });
          });
        }
      });

      exec.start();
    });

    lab.test('returns error in callback if called on ended activity', (done) => {
      const def = signalActivityDefinition;
      const exec = new Bpmn.ActivityExecution(def);

      exec.on('start', (e) => {
        if (e.id === 'userTask') {
          exec.getActivityExecutionById('userTask', (err1, execution) => {
            if (err1) return done(err1);
            execution.once('end', () => {
              execution.signal((err) => {
                expect(err).to.exist();
                done();
              });
            });

            execution.signal((err) => {
              expect(err).to.not.exist();
            });
          });
        }
      });

      exec.start();
    });

    lab.test('emits error if called on ended activity', (done) => {
      const def = signalActivityDefinition;
      const exec = new Bpmn.ActivityExecution(def);

      exec.once('error', (e) => {
        if (e.activity.activityDefinition.id === 'userTask') {
          done();
        }
      });

      exec.on('start', (e) => {
        if (e.id === 'userTask') {
          exec.getActivityExecutionById('userTask', (err, execution) => {
            if (err) return done(err);
            execution.once('end', () => {
              execution.signal();
            });

            execution.signal((signalErr) => {
              expect(signalErr).to.not.exist();
            });
          });
        }
      });

      exec.start();
    });

    lab.test('can be called on activityDefinition without callback', (done) => {
      const def = signalActivityDefinition;
      const exec = new Bpmn.ActivityExecution(def);

      exec.on('end', (e) => {
        if (e.id === 'userTask') {
          done();
        }
      });
      exec.on('start', (e) => {
        if (e.id === 'userTask') {
          exec.getActivityExecutionById('userTask', (err, execution) => {
            execution.signal();
          });
        }
      });

      exec.start();
    });
  });
});
