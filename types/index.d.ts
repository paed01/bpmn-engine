declare module 'bpmn-engine' {
  import type { EventEmitter } from 'node:events';
  import type { Broker } from 'smqp';
  import type { Definitions as BpmnModdleDefinitions } from 'bpmn-moddle';
  import type { ExtendFn, SerializableContext, ResolverFn } from 'moddle-context-serializer';
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

  export type BpmnEngineEvent = 'error' | 'stop' | 'end';

  export type BpmnActivityEvent =
    | 'activity.enter'
    | 'activity.start'
    | 'activity.wait'
    | 'wait'
    | 'activity.end'
    | 'activity.leave'
    | 'activity.stop'
    | 'activity.throw'
    | 'activity.error';

  export type BpmnSequenceFlowEvent = 'flow.take' | 'flow.discard' | 'flow.looped';

  export type BpmnEngineRunningStatus = 'idle' | 'running' | 'stopped' | 'error';

  export interface BpmnMessage {
    id?: string;
    executionId?: string;
    [name: string]: any;
  }

  export interface IListenerEmitter {
    emit(eventName: string, ...args: any[]): void;
  }

  export interface BpmnEngineExecuteOptions extends EnvironmentOptions {
    listener?: EventEmitter | IListenerEmitter;
  }

  export interface BpmnEngineOptions extends BpmnEngineExecuteOptions {
    name?: string;
    source?: string;
    sourceContext?: SerializableContext;
    elements?: Record<string, any>;
    typeResolver?: ResolverFn;
    extendFn?: ExtendFn;
    moddleOptions?: any;
    moddleContext?: BpmnModdleDefinitions;
    Logger?: (scope: string) => ILogger;
    scripts?: IScripts;
    disableDummyScript?: boolean;
    [x: string]: any;
  }

  export interface BpmnEngineDefinitionState {
    state: string;
    source?: string;
    [x: string]: any;
  }

  export interface BpmnEngineExecutionState {
    name: string;
    engineVersion: string;
    state: BpmnEngineRunningStatus;
    stopped: boolean;
    environment: EnvironmentState;
    definitions: BpmnEngineDefinitionState[];
  }

  export function Engine(options?: BpmnEngineOptions): Engine;
  export class Engine extends EventEmitter {
    constructor(options?: BpmnEngineOptions);
    options: BpmnEngineOptions;
    readonly name: string;
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

    recover(savedState: BpmnEngineExecutionState | null, recoverOptions?: BpmnEngineOptions): Engine;

    resume(): Promise<Execution>;
    resume(options: BpmnEngineExecuteOptions): Promise<Execution>;
    resume(options: BpmnEngineExecuteOptions, callback: (err: Error | null, execution?: Execution) => void): Promise<Execution>;
    resume(callback: (err: Error | null, execution?: Execution) => void): Promise<Execution>;

    stop(): Promise<void> | undefined;

    addSource(options?: { sourceContext: SerializableContext }): void;

    waitFor<R>(eventName: BpmnEngineEvent): Promise<R>;
  }

  export function Execution(
    engine: Engine,
    definitions: Definition[],
    options?: BpmnEngineExecuteOptions,
    isRecovered?: boolean
  ): Execution;
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

    waitFor<R>(eventName: BpmnEngineEvent): Promise<R>;
  }

  export class JavaScripts implements IScripts {
    constructor(disableDummy?: boolean);
    register(activity: any): Script | undefined;
    getScript(language: string, identifier: { id: string; [x: string]: any }): Script;
  }

  export default Engine;
}
