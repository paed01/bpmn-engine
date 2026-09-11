declare module 'bpmn-engine' {
  import type { EventEmitter } from 'node:events';
  import type { Broker } from 'smqp';
  import type { Definitions as BpmnModdleDefinitions } from 'bpmn-moddle';
  import type { ExtendFn, SerializableContext, TypeResolverExtender } from 'moddle-context-serializer';
  import type {
    ActivityStatus,
    Definition,
    ElementBase,
    Environment,
    EnvironmentOptions,
    EnvironmentState,
    IApi,
    ILogger,
    IScripts,
    Script,
  } from 'bpmn-elements';

  /**
   * Engine events.
   * - `error`: A non-recoverable error has occurred
   * - `stop`: Execution was stopped
   * - `end`: Execution completed
   */
  export type BpmnEngineEvent = 'error' | 'stop' | 'end';

  /**
   * Activity events emitted to the listener.
   * - `activity.enter`: An activity is entered
   * - `activity.start`: An activity is started
   * - `activity.wait`: The activity is postponed for some reason, e.g. a user task is waiting to be signaled or a message is expected
   * - `wait`: Same as above
   * - `activity.timer`: A timer was started
   * - `activity.timeout`: A timer timed out
   * - `activity.signal`: The activity was signaled
   * - `activity.catch`: The activity caught a message, signal, error, etc
   * - `activity.discard`: The activity was discarded
   * - `activity.cancel`: The activity was cancelled
   * - `activity.end`: An activity has ended successfully
   * - `activity.leave`: The execution left the activity
   * - `activity.stop`: Activity run was stopped
   * - `activity.throw`: A recoverable error was thrown
   * - `activity.error`: A non-recoverable error has occurred
   */
  export type BpmnActivityEvent =
    | 'activity.enter'
    | 'activity.start'
    | 'activity.wait'
    | 'wait'
    | 'activity.timer'
    | 'activity.timeout'
    | 'activity.signal'
    | 'activity.catch'
    | 'activity.discard'
    | 'activity.cancel'
    | 'activity.end'
    | 'activity.leave'
    | 'activity.stop'
    | 'activity.throw'
    | 'activity.error';

  /**
   * Sequence flow events emitted to the listener.
   * - `flow.take`: The sequence flow was taken
   *
   * Since bpmn-elements@18 non-selected sequence flows are no longer discarded, so
   * `flow.discard` and `flow.looped` are never emitted during execution.
   */
  export type BpmnSequenceFlowEvent = 'flow.take';

  /**
   * Process events emitted to the listener.
   */
  export type BpmnProcessEvent =
    'process.enter' | 'process.end' | 'process.leave' | 'process.error' | 'process.terminate' | 'process.discarded';

  /**
   * Definition events emitted to the listener.
   */
  export type BpmnDefinitionEvent = 'definition.leave' | 'definition.stop' | 'definition.error';

  /**
   * All events emitted to the listener. Every `definition.#`, `process.#`, `activity.#`, and `flow.#`
   * routing key published by bpmn-elements is forwarded verbatim, the named unions are the documented ones.
   */
  export type BpmnListenerEvent =
    | BpmnDefinitionEvent
    | BpmnProcessEvent
    | BpmnActivityEvent
    | BpmnSequenceFlowEvent
    | `definition.${string}`
    | `process.${string}`
    | `activity.${string}`
    | `flow.${string}`;

  export type BpmnEngineRunningStatus = 'idle' | 'running' | 'stopped' | 'error';

  export interface BpmnMessage {
    id?: string;
    executionId?: string;
    [name: string]: any;
  }

  export interface IListenerEmitter {
    /**
     * Receive engine execution events
     * @param eventName routing key of the event
     * @param elementApi api of the element that emitted the event
     * @param execution the engine execution
     */
    emit(eventName: BpmnListenerEvent, elementApi: IApi<ElementBase>, execution: Execution): unknown;
    emit(eventName: string, ...args: any[]): unknown;
  }

  export interface BpmnEngineExecuteOptions extends EnvironmentOptions {
    listener?: EventEmitter | IListenerEmitter;
  }

  export interface BpmnEngineOptions extends BpmnEngineExecuteOptions {
    name?: string;
    source?: string | Buffer;
    sourceContext?: SerializableContext;
    elements?: Record<string, any>;
    typeResolver?: TypeResolverExtender;
    extendFn?: ExtendFn;
    moddleOptions?: any;
    moddleContext?: BpmnModdleDefinitions;
    Logger?: (scope: string) => ILogger;
    scripts?: IScripts;
    disableDummyScript?: boolean;
    listener?: EventEmitter | IListenerEmitter;
    [x: string]: any;
  }

  export interface BpmnEngineDefinitionState {
    state: string;
    source?: string;
    [x: string]: any;
  }

  export interface BpmnEngineExecutionState {
    name?: string;
    engineVersion?: string;
    state?: BpmnEngineRunningStatus;
    stopped?: boolean;
    environment?: EnvironmentState;
    definitions?: BpmnEngineDefinitionState[];
  }

  export function Engine(options?: BpmnEngineOptions): Engine;
  export class Engine extends EventEmitter {
    constructor(options?: BpmnEngineOptions);
    options: BpmnEngineOptions;
    name: string;
    readonly broker: Broker;
    readonly logger: ILogger;
    readonly environment: Environment;
    readonly state: BpmnEngineRunningStatus;
    readonly stopped: boolean;
    readonly execution: Execution | null;
    readonly activityStatus: ActivityStatus;

    execute(): Promise<Execution>;
    execute(options: BpmnEngineExecuteOptions): Promise<Execution>;
    execute(options: BpmnEngineExecuteOptions, callback: (err: Error | null, execution?: Execution) => void): Promise<Execution>;
    execute(callback: (err: Error | null, execution?: Execution) => void): Promise<Execution>;

    getDefinitionById(id: string): Promise<Definition | undefined>;
    getDefinitions(executeOptions?: BpmnEngineExecuteOptions): Promise<Definition[]>;
    getState(): Promise<BpmnEngineExecutionState>;

    recover(savedState?: BpmnEngineExecutionState | null, recoverOptions?: BpmnEngineOptions): Engine;

    resume(): Promise<Execution>;
    resume(options: BpmnEngineExecuteOptions): Promise<Execution>;
    resume(options: BpmnEngineExecuteOptions, callback: (err: Error | null, execution?: Execution) => void): Promise<Execution>;
    resume(callback: (err: Error | null, execution?: Execution) => void): Promise<Execution>;

    stop(): Promise<void> | undefined;

    addSource(options?: { sourceContext: SerializableContext }): void;

    waitFor<R>(eventName: BpmnEngineEvent | string): Promise<R>;
  }

  export class Execution {
    constructor(engine: Engine, definitions: Definition[], options?: BpmnEngineExecuteOptions, isRecovered?: boolean);
    options: BpmnEngineExecuteOptions;
    readonly name: string;
    readonly definitions: Definition[];
    readonly broker: Broker;
    readonly environment: Environment;
    readonly state: BpmnEngineRunningStatus;
    readonly stopped: boolean;
    readonly isRunning: boolean;
    readonly activityStatus: ActivityStatus;

    getActivityById(activityId: string): ElementBase | undefined;
    getActivityById<R>(activityId: string): R | undefined;
    getPostponed(): IApi<ElementBase>[];
    getState(): BpmnEngineExecutionState;
    stop(): Promise<void>;

    signal(message?: BpmnMessage, options?: { ignoreSameDefinition?: boolean }): void;
    cancelActivity(message?: BpmnMessage): void;

    waitFor<R>(eventName: BpmnEngineEvent | string): Promise<R>;
  }

  export interface JavaScripts extends IScripts {
    register(activity: any): Script | undefined;
    getScript(language: string, identifier: { id: string; [x: string]: any }): Script | undefined;
  }
  export const JavaScripts: {
    new (disableDummy?: boolean): JavaScripts;
    /** callable without new */
    (disableDummy?: boolean): JavaScripts;
  };

  export default Engine;
}
