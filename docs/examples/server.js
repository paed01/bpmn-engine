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

app.get('/start', async (req, res) => {
  const listener = new EventEmitter();
  const engine = listen(listener);
  const state = await engine.getState();
  states.push(state);
  console.log(state);
  res.json(state);
});


app.post('/answer/:index', (req, res) => {
  const listener = new EventEmitter();

  let state = states[req.params.index];

  const engine = Engine();
  engine.recover(state);
  listener.once('wait', (task) => {
    console.log(task);

    // d: 'userInput',
    //       value: req.body.data,
    task.signal({
      ioSpecification: {
        dataOutputs: Object.keys(req.body).map(key => {
          return {
            id: key,
            value: req.body[key]
          };
        })
      }
    });
  });
  console.log(state);

  engine.once('end', (execution) => {
    console.log(execution.environment.variables);
    console.log(`User sirname is ${execution.environment.output.data.inputFromUser}`);
  });

  engine.execute({
    listener
  }, (err) => {
    if (err) {
      console.log(err);
      throw err;
    }

  });

  res.json(state);
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
