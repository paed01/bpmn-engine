import express from 'express';
import {
  serviceTask, userTask, human, serviceBehaviour, extendBehaviour,
  loop, sequence, expressionCall, scriptTask, gateway, listen, simpleExecute,
  startState, resumeState
} from './examples';
import { EventEmitter } from 'events';
import { Engine } from '../../index';
import bodyParser from 'body-parser';
const app = express();
const PORT = 8080;
const engines = [];
const states = [];
const jsonParser = express.json();
const rawParser = bodyParser.text();

app.get('/start', async (req, res) => {
  res.json(await startState(states));
});

app.get('/states', async (req, res) => {
  const list = states.map((s, index) => {
    return {
      name: s.name,
      index
    };
  });
  res.json(list);
});


app.post('/answer/:index', jsonParser, async (req, res) => {
  let state = states[req.params.index];
  state = await resumeState(state, req.body);
  states[req.params.index] = state;
  res.json({
    state
  });
});

app.get('/all', (req, res) => {
  const listener = new EventEmitter();
  engines.push(serviceTask());
  engines.push(userTask(listener));
  engines.push(human(listener));
  engines.push(serviceBehaviour());
  engines.push(extendBehaviour(listener));
  engines.push(loop());
  engines.push(sequence(listener));
  engines.push(expressionCall());
  engines.push(scriptTask());
  engines.push(gateway(listener));
  engines.push(simpleExecute());
  engines.push(listen(listener));

  res.json(engines.length);
});


app.post('/test', rawParser, async (req, res) => {
  const source = req.body;

  const listener = new EventEmitter();
  listener.on('activity.end', (elementApi) => {
    if (elementApi.id === 'end2') throw new Error(`<${elementApi.id}> should not have been taken`);
  });

  const engine = Engine({
    name: 'execution example',
    source,
    variables: {
      // id
    }
  });

  try {
    const api = await engine.execute({
      listener,
      services: {
        isBelow: (input, test) => {
          return input < test;
        },
        serviceFn(scope, callback) {
          callback(null, { data: 1 });
        }
      },
      variables: {
        input: 2
      }
    });
    console.log(api);
    res.json({});
  } catch (e) {
    res.json(e);
  }

});

app.listen(PORT, e => {
  console.log(`Started at ${PORT}`, e);
});
