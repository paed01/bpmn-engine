// Author : Saeed Tabrizi

import { EventEmitter } from "events";

declare module "bpmn-engine" {

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
  export type BpmnActivityEvent = 'activity.enter' | 'activity.start' | 'activity.wait' | 'wait' | 'activity.end' | 'activity.leave' | 'activity.stop' | 'activity.throw' | 'activity.error';
  /**
   * Sequence flow events
        flow.take: The sequence flow was taken
        flow.discard: The sequence flow was discarded
        flow.looped: The sequence is looped
   */
  export type BpmnSequenceFlowEvent = 'flow.take' | 'flow.discard' | 'flow.looped';
  export type BpmnEngineVariable = Record<string,any>;
  export interface BpmnMessage{
    id?:string,executionId?: string, [name: string]: any
  }
   export interface BpmnEngineBroker{}

   export interface BpmnEngineExecuteOptions {
    variables?: BpmnEngineVariable;
    listener?: EventEmitter;
    services?: { [name: string]: Function };

     /**
     * optional override expressions handler
     */
    expressions?: Expressions;
   }

   export interface BpmnEngineOptions {
    
    /**
     * optional name of engine,
     */
    name?: string;
    /**
     * optional BPMN 2.0 definition source as string
     */
    source?: string;
    /**
     *  optional serialized context supplied by moddle-context-serializer
     */
    sourceContext?: any;
    variables?: BpmnEngineVariable;
  /**
   * optional Logger factory, defaults to debug logger
   */
    Logger?: BpmnLogger;
  
    /**
     * optional inline script handler, defaults to nodejs vm module handling, i.e. JavaScript
     */
    scripts?: any;
  
    listener?: EventEmitter;
    // tslint:disable-next-line:ban-types
    services?: { [name: string]: Function };
  
    elements?: any;
  
    typeResolver?: <R>(...elements: any) => R;
    /**
     * optional bpmn-moddle options to be passed to bpmn-moddle
     */
    moddleOptions?: any;
  
    extensions?: any;
    /**
     * optional override expressions handler
     */
    expressions?: Expressions;
  }
  
  export interface Expressions {
    resolveExpression<R>(
      expression: string,
      message?: any,
      expressionFnContext?: any,
    ): R;
  }
  export interface BpmnEngine{
    new(options?: BpmnEngineOptions): BpmnEngine;

    /**
     * engine name
     */
    name: string;
    /**
     * engine broker
     */
    broker: BpmnEngineBroker;
    /**
     * engine state
     */
    state: any;
    /**
     * boolean stopped
     */
    stopped: boolean;
    /**
     * current engine execution
     */
    execution: BpmnEngineExecution;
    /**
     * engine environment
     */
    environment: BpmnProcessExecutionEnvironment;
    /**
     *  engine logger
     */
    logger: BpmnLogger;
   /**
    * execute definition 
    * @param options Optional object with options to override the initial engine options
    * @summary Execute options overrides the initial options passed to the engine before executing the definition.
    */
    execute(options?:BpmnEngineExecuteOptions): Promise<BpmnEngineExecutionApi>;
    /**
     * get definition by id
     * @param id id of definition
     */
    getDefinitionById(id: string): Promise<any>;
    
    /**
     * get all definitions
     */
    getDefinitions(): Promise<any[]>;
    /**
     * get execution serialized state
     */
    getState(): Promise<BpmnProcessExecutionState>;

    /**
     * Recover engine from state
     * @param state engine state
     * @param recoverOptions  optional object with options that will completely override the options passed to the engine at init
     */
    recover(state: any,recoverOptions?:BpmnEngineOptions): BpmnEngine;

    /**
     * Resume execution function with previously saved engine state.
     * @param options 
     * @param callback 
     */
    resume(options?: BpmnEngineExecuteOptions, callback?:()=> void): void;

    /**
     * Stop execution. The instance is terminated.
     */
    stop(): void;

    waitFor<R>(eventName: string): Promise<R>;

    /**
    * Add definition source by source context.
    * @param options 
    */
    addSource(options?: {sourceContext: any}): void;

  }

  export function Engine(options?:BpmnEngineOptions): BpmnEngine;

export interface BpmnLogger {
  debug(...args: any[]): void;
  error(...args: any[]): void;
  warn(...args: any[]): void;
}

export interface BpmnEngineExecution {
  definitions: BpmnProcessExecutionDefinition[];
  state: "idle" | "running";
  environment: BpmnProcessExecutionEnvironment;

  stopped: boolean;
  execute(executeOptions?: any): BpmnEngineExecutionApi;
  getState<R>(): R;

  resume(resumeOptions?: any): void;

  stop(): void;

}

// tslint:disable: max-line-length


export interface BpmnProcess {
  new (processDefinition: any, context: BpmnProcessExecutionContext): BpmnProcess;
  id: string;
  type: string;
  name: string;
  isExecutable: boolean;
  broker: any;

  context: BpmnProcessExecutionContext;
  counters: any;
  environment: BpmnProcessExecutionEnvironment;
  execution: any;
  executionId: string;
  isRunning: boolean;

  logger: BpmnLogger;
  parent: BpmnProcess;
  status: any;

  stopped: boolean;

  getApi(message: any): BpmnEngineExecutionApi;
  getActivities(): BpmnProcessActivity[];
  getActivityById(id: string): BpmnProcessActivity;

  getSequenceFlows(): any[];
  getPostponed(): BpmnProcessActivity[];

  getState(): any;

  recover(state: any): void;
  resume(): void;
  run(): void;
  stop(): void;
  waitFor<R>(eventName: string): Promise<R>;
}

export interface BpmnProcessExecutionContext {
  id: string;
  name: string;
  type: string;
  sid: any;
  definitionContext: any;
  environment: BpmnProcessExecutionEnvironment;

  clone(
    environment?: BpmnProcessExecutionEnvironment,
  ): BpmnProcessExecutionContext;
  getActivities(scopeId?: string): BpmnProcessActivity[];
  getActivityById(id: string): BpmnProcessActivity;
  getExecutableProcesses(): any[];
  getDataObjectById(id: string): any;

  getMessageFlows(): any[];

  getProcessById(id: string): any;

  getProcesses(): any;

  getSequenceFlowById(id: string): any;

  getSequenceFlows(scopeId: string): any[];

  getInboundSequenceFlows(activityId: string): any[];
  getOutboundSequenceFlows(activityId: string): any[];

  loadExtensions(activity: BpmnProcessActivity): void;
}

export interface BpmnProcessActivity extends EventEmitter {
  id: string;
  type: string;
  name: string;

  attachedTo: any;

  Behaviour: any;

  behaviour: any;

  broker: any;

  counters: any;
  environment: BpmnProcessExecutionEnvironment;
  execution: any;
  executionId: string;
  extensions: any[];
  logger: BpmnLogger;
  inbound: any[];
  isRunning: boolean;
  isStart: boolean;
  isSubProcess: boolean;

  outbound: any[];
  parent?: BpmnProcessActivity;
  status: any;
  stopped: boolean;

  activate(): void;

  deactivate(): void;

  discard(): void;

  getApi(message: any): BpmnEngineExecutionApi;

  getActivityById(id: string): BpmnProcessActivity;

  getState(): any;

  message(messageContent: any): void;
  signal: (message?: any, options?: any) => void;
  next(): void;

  recover(state: any): void;

  resume(): void;

  run(runContent?: any): void;

  stop(): void;

  waitFor<R>(eventName: string): Promise<R>;
}

export interface BpmnProcessExecutionEnvironment {
  options: any;
  extensions: any;

  scripts: any;
  output: any;
  variables: BpmnEngineVariable;

  settings: any;

  Logger: BpmnLogger;
  services: any;
  // tslint:disable: ban-types
  addService(name: string, serviceFn: Function): void;
  assignVariables(...vars: any): void;
  clone(overrideOptions?: any): BpmnProcessExecutionEnvironment;
  getScript(scriptType: string, activity: any): any;
  getServiceByName(name: string): any;

  getState(): BpmnProcessExecutionState;

  registerScript(activity: any): void;

  resolveExpression<R>(
    expression: any,
    message?: any,
    expressionFnContext?: any,
  ): R;

  recover(state: any): void;
}
export interface BpmnExecutionEventMessageContent {
  id: string;
  type: string;
  executionId: string;
  parent?: BpmnExecutionEventMessageContent;
  path?: BpmnExecutionEventMessageContent[];
}
export interface BpmnExecutionEventMessageApi {
  id: string;
  type: string;
  name: string;
  executionId: string;
  environment: BpmnProcessExecutionEnvironment;
  fields: any;

  content: BpmnExecutionEventMessageContent;
  messageProperties: any;
  owner: any;

  cancel(): void;
  discard(): void;
  signal(message: string, options: any): void;
  stop(): void;

  resolveExpression<R>(expression: any): R;
  createMessage(overrideContent?: any): BpmnExecutionEventMessageApi;
}
export interface BpmnProcessExecutionDefinition extends EventEmitter {
  state: "pending" | "running" | "completed";
  run: (callback?: any) => void;
  resume: (callback?: any) => void;

  recover: (state?: any) => void;

  sendMessage: (message: any) => void;

  executionId: string;
  execution: any;
  getProcesses: () => any[];

  getExecutableProcesses: () => any[];
  getApi: <T>(message: any) => T;
  getElementById: (elementId: string) => any;
  getActivityById: (childId: string) => any;
  environment: BpmnProcessExecutionEnvironment;
  status: string;
  stopped: boolean;
  type: string;
  signal: (message: any, options?: any) => void;
  cancelActivity: (message?: any) => void;
  shake: (activityId?: string) => any;
  broker: any;
  id: string;
  isRunning: boolean;
  name: string;
  logger: BpmnLogger;
  waitFor(name: string, fn: Function): void;
}
export interface BpmnProcessExecutionDefinitionState {
  state: "pending" | "running" | "completed";
  processes: {
    [processId: string]: {
      variables: BpmnEngineVariable;
      services: any;
      children: BpmnProcessExecutionState[];
    };
  };
}
export interface BpmnProcessExecutionState {
  name: string;
  state: "idle" | "running";
  stopped: boolean;
  engineVersion: string;
  environment: BpmnProcessExecutionEnvironment;
  definitions: BpmnProcessExecutionDefinitionState[];

  entered: boolean;
}


export interface BpmnEngineEventApi {
   /**
   * engine name
   *
   * @type {string}
   * 
   */
  name: string;
  /**
   * state of execution, i.e running or idle
   *
   * @type {("running"| "idle")}
   * 
   */
  state: "running" | "idle";
  /**
   * is the execution stopped
   *
   * @type {boolean}
   * 
   */
  stopped: boolean;
  /**
   * engine environment
   *
   * @type {BpmnProcessExecutionEnvironment}
   * 
   */
  environment: BpmnProcessExecutionEnvironment;

  /**
   * executing definitions
   *
   * @type {BpmnProcessExecutionDefinition}
   *
   */
  definitions: BpmnProcessExecutionDefinition;
  /**
   * get execution serializable state
   *
   * @returns {BpmnProcessExecutionState}
   * 
   */
  getState(): BpmnProcessExecutionState;

  /**
   * get activities in a postponed state
   *
   * 
   */
  getPostponed(): any[];
}

export interface BpmnEngineExecutionApi {
  /**
   * engine name
   *
   * @type {string}
   * @
   */
  name: string;
  /**
   * state of execution, i.e running or idle
   *
   * @type {("running"| "idle")}
   * 
   */
  state: "running" | "idle";
  /**
   * is the execution stopped
   *
   * @type {boolean}
   *
   */
  stopped: boolean;
  /**
   * engine environment
   *
   * @type {BpmnProcessExecutionEnvironment}
   * 
   */
  environment: BpmnProcessExecutionEnvironment;

  /**
   * executing definitions
   *
   * @type {BpmnProcessExecutionDefinition}
   * 
   */
  definitions: BpmnProcessExecutionDefinition;
  /**
   * get execution serializable state
   *
   * @returns {BpmnProcessExecutionState}
   * 
   */
  getState(): BpmnProcessExecutionState;

  /**
   * stop execution
   *
   * 
   */
  stop(): void;

  /**
   * get activities in a postponed state
   *
   * 
   */
  getPostponed(): any[];
 /**
  * send signal to execution, distributed to all definitions
  * Delegate a signal message to all interested parties, usually MessageEventDefinition, SignalEventDefinition, SignalTask (user, manual), ReceiveTask, or a StartEvent that has a form.
  * @param message {BpmnMessage}
  */
  signal(message?: BpmnMessage,options?: {ignoreSameDefinition?: boolean}): void;
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
