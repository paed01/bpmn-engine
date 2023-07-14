// Author : Saeed Tabrizi
// Refactored by : Pål Edman

import { EventEmitter } from 'events';
import { Definitions as BpmnModdleDefinitions } from 'bpmn-moddle';
import { extendFn, SerializableContext } from 'moddle-context-serializer';
import { ActivityStatus, ElementBroker, EnvironmentOptions, Definition, DefinitionState, Environment, Api, ElementBase, ILogger, EnvironmentState } from 'bpmn-elements';

declare module 'bpmn-engine' {

  /**
   * Engine emits the following events:

      error: An non-recoverable error has occurred
      stop: Executions was stopped
      end: Execution completed
   */
  export type BpmnEngineEvent = 'error' | 'stop' | 'end';
  /**
   * Each activity and flow emits events when changing state.

      activity.enter: An activity is entered
      activity.start: An activity is started
      activity.wait: The activity is postponed for some reason, e.g. a user task is waiting to be signaled or a message is expected
      wait: Same as above
      activity.end: An activity has ended successfully
      activity.leave: The execution left the activity
      activity.stop: Activity run was stopped
      activity.throw: An recoverable error was thrown
      activity.error: An non-recoverable error has occurred
   */
  export type BpmnActivityEvent =
    'activity.enter'
    | 'activity.start'
    | 'activity.wait'
    | 'wait'
    | 'activity.end'
    | 'activity.leave'
    | 'activity.stop'
    | 'activity.throw'
    | 'activity.error';
  /**
   * Sequence flow events
        flow.take: The sequence flow was taken
        flow.discard: The sequence flow was discarded
        flow.looped: The sequence is looped
   */
  export type BpmnSequenceFlowEvent = 'flow.take' | 'flow.discard' | 'flow.looped';
  // export type BpmnEngineVariable = Record<string, any>;
  // export type BpmnEngineSetting = Record<string, any>;

  export interface BpmnMessage {
    id?: string,
    executionId?: string,
    [name: string]: any
  }

  export interface BpmnEngineExecuteOptions extends EnvironmentOptions {
    listener?: EventEmitter;
  }

  export interface BpmnEngineOptions extends BpmnEngineExecuteOptions {
    /**
     * optional name of engine,
     */
    name?: string;
    /**
     * optional BPMN 2.0 definition source as string
     */
    source?: string;
    /**
     * optional serialized context supplied by moddle-context-serializer
     */
    sourceContext?: SerializableContext;
    /**
     * optional override of BPMN Elements behaviors, defaults to bpmn-elements
     */
    elements?: Record<string, any>;
    /**
     * Passed to moddle-context-serializer as extendFn
     */
    typeResolver?: extendFn;
    /**
     * optional bpmn-moddle options to be passed to bpmn-moddle
     */
    moddleOptions?: any;
    moddleContext?: BpmnModdleDefinitions;
  }

  const enum BpmnEngineRunningStatus {
    /**
     * Engine is not executing
     */
    Idle = 'idle',
    /**
     * Engine is executing
     */
    Running = 'running',
    /**
     * Engine execution is stopped
     */
    Stopped = 'stopped',
    /**
     * Engine execution has errored
     */
    Error = 'error',
  }

  export function Engine(options?: BpmnEngineOptions): Engine;
  export class Engine extends EventEmitter {
    constructor(options?: BpmnEngineOptions);
    /**
     * engine name
     */
    readonly name: string;
    /**
     * engine broker
     */
    broker: ElementBroker<Engine>;
    /**
     * engine state
     */
    readonly state: BpmnEngineRunningStatus;
    /**
     * boolean stopped
     */
    readonly stopped: boolean;
    /**
     * current engine execution
     */
    readonly execution: Execution;
    /**
     * engine environment
     */
    readonly environment: Environment;
    /**
     *  engine logger
     */
    readonly logger: ILogger;
    get activityStatus(): ActivityStatus;

    /**
     * execute definition
     * @param options Optional object with options to override the initial engine options
     * @param cb Callback called before the throw
     * @summary Execute options overrides the initial options passed to the engine before executing the definition.
     */
    execute(): Promise<Execution>;
    execute(options: BpmnEngineExecuteOptions): Promise<Execution>;
    execute(options: BpmnEngineExecuteOptions, cb: (err: Error, execution?: Execution) => void): Promise<Execution>;
    execute(cb: (err: Error) => void): Promise<Execution>;

    /**
     * get definition by id
     * @param id id of definition
     */
    getDefinitionById(id: string): Promise<Definition>;

    /**
     * get all definitions
     */
    getDefinitions(): Promise<Definition[]>;

    /**
     * get execution serialized state
     */
    getState(): Promise<BpmnEngineExecutionState>;

    /**
     * Recover engine from state
     * @param state engine state
     * @param recoverOptions  optional object with options that will completely override the options passed to the engine at init
     */
    recover(state: any, recoverOptions?: BpmnEngineOptions): Engine;

    /**
     * Resume execution function with previously saved engine state.
     * @param options
     * @param callback
     */
    resume(options?: BpmnEngineExecuteOptions, callback?: (err: Error, execution?: Execution) => void): Promise<Execution>;

    /**
     * Stop execution. The instance is terminated.
     */
    stop(): Promise<void>;

    waitFor<R>(eventName: BpmnEngineEvent): Promise<R>;

    /**
     * Add definition source by source context.
     * @param options
     */
    addSource(options?: { sourceContext: any }): void;
  }

  interface BpmnEngineDefinitionState extends DefinitionState {
    /**
     * Serialized moddle-context-serializer context
     */
    source?: string;
  }

  export interface BpmnEngineExecutionState {
    name: string;
    engineVersion: string;
    state: BpmnEngineRunningStatus;
    stopped: boolean;
    environment: EnvironmentState;
    definitions: BpmnEngineDefinitionState[];
  }

  export interface Execution {
    /**
     * engine name
     *
     * @type {string}
     * @
     */
    readonly name: string;
    /**
     * state of execution, i.e running or idle
     *
     * @type {("running"| "idle")}
     *
     */
    readonly state: 'running' | 'idle';
    /**
     * is the execution stopped
     *
     * @type {boolean}
     *
     */
    readonly stopped: boolean;
    /**
     * engine environment
     *
     * @type {Environment}
     *
     */
    readonly environment: Environment;

    /**
     * executing definitions
     *
     * @type {Definition}
     *
     */
    readonly definitions: Definition[];
    get activityStatus(): ActivityStatus;

    /**
     * Get activity/element by id. Loops the definitions and returns the first found activity with id.
     * @param activityId Activity or element id
     */
    getActivityById(activityId: string): ElementBase;
    getActivityById<R>(activityId: string): R;

    /**
     * get execution serializable state
     *
     * @returns {BpmnEngineExecutionState}
     *
     */
    getState(): BpmnEngineExecutionState;

    /**
     * stop execution
     *
     *
     */
    stop(): Promise<void>;

    /**
     * get activities in a postponed state
     *
     *
     */
    getPostponed(): Api<ElementBase>[];

    /**
     * send signal to execution, distributed to all definitions
     * Delegate a signal message to all interested parties, usually MessageEventDefinition, SignalEventDefinition, SignalTask (user, manual), ReceiveTask, or a StartEvent that has a form.
     * @param message {BpmnMessage}
     * @param options
     */
    signal(message?: BpmnMessage, options?: { ignoreSameDefinition?: boolean }): void;

    /**
     * send cancel activity to execution, distributed to all definitions
     * Delegate a cancel message to all interested parties, perhaps a stalled TimerEventDefinition.
     * @param message
     */
    cancelActivity(message?: BpmnMessage): void;

    /**
     *
     * @param event
     */
    waitFor<T>(event: BpmnEngineEvent): Promise<T>;
  }
}
