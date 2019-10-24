import express from 'express';
import {
  serviceTask, userTask, human, serviceBehaviour, extendBehaviour,
  loop, sequence, expressionCall, scriptTask, gateway, listen, simpleExecute
} from './examples';
import { EventEmitter } from 'events';
import { Engine } from '../../index';
const app = express();
const PORT = 8080;
const engines = [];
const states = [];
const jsonParser = express.json();

const start = async () => {
  const listener = new EventEmitter();
  listener.once('activity.wait', (task) => {
    console.log('activity.wait');
  });
  listener.on('flow.take', (flow) => {
    console.log(`flow <${flow.id}> was taken`);
  });
  const engine = listen(listener);
  const state = await engine.getState();
  states.push(state);
  return state;
};

app.get('/start', async (req, res) => {
  res.json(await start());
});

start();

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
  const listener = new EventEmitter();
  const engine = Engine();
  let state = states[req.params.index];

  engine.recover(state);

  engine.once('end', (execution) => {
    console.log(execution.environment.variables);
    console.log(`User sirname is ${execution.environment.output.data.inputFromUser}`);
  });

  engine.once('error', (error) => {
    console.log(error);
  });

  listener.once('activity.enter', (task) => {
    console.log(task);
  });
  listener.once('activity.start', (task) => {
    console.log(task);
  });
  listener.once('activity.wait', (task) => {
    console.log(task);
  });
  listener.on('flow.take', (flow) => {
    console.log(`flow <${flow.id}> was taken`);
  });

  const api = await engine.resume({
    listener
  });

  const info = {
    ioSpecification: {
      dataOutputs: Object.keys(req.body).map(key => {
        return {
          id: key,
          value: req.body[key]
        };
      })
    }
  };

  const post = api.getPostponed();
  // console.log(api, api.getState(), api.getPostponed(), post);
  const [task] = post;
  if (task) {
    task.signal(info);
  }

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

app.listen(PORT, e => {
  console.log(`Started at ${PORT}`, e);
});
