// Author : Saeed Tabrizi

declare module "bpmn-engine" {


export interface BpmnLogger {
  debug(...args: any[]): void;
  error(...args: any[]): void;
  warn(...args: any[]): void;
}

export interface BpmnExecution {
  definitions: BpmnProcessExecutionDefinition[];
  state: "idle" | "running";
  environment: BpmnProcessExecutionEnvironment;

  stopped: boolean;
  execute(executeOptions?: any): BpmnProcessExecutionApi;
  getState<R>(): R;

  resume(resumeOptions?: any): void;

  stop(): void;

}

// tslint:disable: max-line-length
export interface BpmnProcessOptions {
  name?: string;
  id?: string;
  source?: string;
  variables?: any;

  Logger?: BpmnLogger;

  scripts?: any;

  listener?: EventEmitter;
  // tslint:disable-next-line:ban-types
  services?: { [name: string]: Function };

  elements?: any;

  typeResolver?: <R>(...elements: any) => R;
  moddleOptions?: any;

  extensions?: any;
}

export interface BpmnProcess {
  new (processDefinition: any, context: BpmnProcessExecutionContext);
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

  getApi(message: any): BpmnProcessExecutionApi;
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
  getActivityById(id): BpmnProcessActivity;
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

  getApi(message: any): BpmnProcessExecutionApi;

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
  variables: any;

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
  signal: (message: any) => void;
  cancelActivity: (message?: any) => void;
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
      variables: any;
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
export interface BpmnProcessExecutionApi {
  /**
   * engine name
   *
   * @type {string}
   * @memberof BpmnProcessExecutionApi
   */
  name: string;
  /**
   * state of execution, i.e running or idle
   *
   * @type {("running"| "idle")}
   * @memberof BpmnProcessExecutionApi
   */
  state: "running" | "idle";
  /**
   * is the execution stopped
   *
   * @type {boolean}
   * @memberof BpmnProcessExecutionApi
   */
  stopped: boolean;
  /**
   * engine environment
   *
   * @type {BpmnProcessExecutionEnvironment}
   * @memberof BpmnProcessExecutionApi
   */
  environment: BpmnProcessExecutionEnvironment;

  /**
   * executing definitions
   *
   * @type {BpmnProcessExecutionDefinition}
   * @memberof BpmnProcessExecutionApi
   */
  definitions: BpmnProcessExecutionDefinition;
  /**
   * get execution serializable state
   *
   * @returns {BpmnProcessExecutionState}
   * @memberof BpmnProcessExecutionApi
   */
  getState(): BpmnProcessExecutionState;

  /**
   * stop execution
   *
   * @memberof BpmnProcessExecutionApi
   */
  stop(): void;

  /**
   * get activities in a postponed state
   *
   * @memberof BpmnProcessExecutionApi
   */
  getPostponed(): void;
}

}
