Activity
========

Base of almost all bpmn activity types.

<!-- toc -->

- [API](#api)
  - [`execute([message])`](#executemessage)
  - [`signal([output])`](#signaloutput)
  - [`cancel()`](#cancel)
  - [`getState()`](#getstate)
  - [`resume(activityState)`](#resumeactivitystate)
  - [`discard([discardedFlow[,rootFlow]])`](#discarddiscardedflowrootflow)
- [Activity properties](#activity-properties)
  - [`properties`](#properties)
- [Events](#events)
  - [`enter`](#enter)
  - [`cancel`](#cancel)
  - [`leave`](#leave)

<!-- tocstop -->

# API

## `execute([message])`
## `signal([output])`

Signal activity to continue.

- `output`: Optional activity output object

## `cancel()`

Cancels execution and takes all outbound sequence flows.

## `getState()`

Get activity state.

- `id`: Activity id
- `type`: Activity type
- `entered`: The activity is entered, i.e. in a running state
- `taken`: The activity was taken
- `canceled`: The activity was canceled

## `resume(activityState)`

Resume execution. Resumed with data from [`getState()`](#getstate).

## `discard([discardedFlow[,rootFlow]])`

Cancels execution and discards all outbound sequence flows.

- `discardedFlow`: Optional. Sequence flow instance that was discarded
- `rootFlow`: Optional. First sequence flow instance that was discarded

# Activity properties

- `id`: Activity id
- `name`: Activity name
- `entered`: Boolean, indicating that activity has been entered
- `isStart`: Boolean, indicating that the activity has no inbound flows
- `isEnd`: Boolean, indicating that the activity has no outbound flows
- [`properties`](#properties): Activity properties defined in modeler
- `type`: Activity type

## `properties`

Activity properties defined in modeler.

Value expressions are supported. Expressions are resolved when process is instantiated.

# Events

Inherits `require('events').EventEmitter`.

## `enter`

Execution has entered activity.

## `cancel`

Activity execution was canceled.

## `leave`

Execution has left activity. The event is emitted asynchronously to enable the executing process instance to enter next activity.
