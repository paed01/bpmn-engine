// Author : Saeed Tabrizi

import {EventEmitter} from 'events';

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
  export type BpmnEngineVariable = Record<string, any>;

  export interface BpmnLogger {
    debug(...args: any[]): void;
    error(...args: any[]): void;
    warn(...args: any[]): void;
  }

  export interface BpmnMessage {
    id?: string,
    executionId?: string,
    [name: string]: any
  }

  export interface BpmnEngineBrokerExchange {
    name: string;
    type: 'topic' | 'direct';
    options: any;
    bindingCount: number;
    bindings: any[];
    stopped: boolean;
    bind(queue: string, pattern: string, bindOptions?: any): void;
    close(): void;
    emit(eventName: string, content?: any): void;
    getBinding(queueName: string, pattern: string): any;
    getState<S>(): S;
    on(pattern: string, handler: () => void, consumeOptions?: any): void;
    off(pattern: string, handler: () => void): void;
    publish(routingKey: string, content?: any, properties?: any): void;
    recover<S>(state: S, getQueue?: boolean): void;
    stop(): void;
    unbind(queue: string, pattern: string): void;
    unbindQueueByName(queueName: string): void;
  }

  export interface BpmnEngineBrokerQueue {
    name: string;
    options: any;
    messages: any[];
    messageCount: number;
    consumerCount: number;
    stopped: boolean;
    exclusive: boolean;
    maxLength: number;
    readonly capacity: number;
    messageTtl: number;
    ack(message: any): void;
    ackAll(): void;
    assertConsumer(onMessage: () => void, consumeOptions?: any, owner?: any): void;
    cancel(consumerTag: string): void;
    close(): void;
    consume(onMessage: () => void, consumeOptions?: any, owner?: any): void;
    delete(deleteOptions?: any): void;
    dequeueMessage(message: any): void;
    dismiss(onMessage: () => void): void;
    get<T>(consumeOptions?: any): T;
    getState<S>(): S;
    nack(message: any, allUpTo?: boolean, requeue?: boolean): void;
    nackAll(requeue: boolean): void;
    off(eventName: string, handler: () => void): void;

    on(eventName: string, handler: () => void): void;

    peek(ignoreDelivered?: boolean): void;
    purge(): void;

    queueMessage(fields: any[], content?: any, properties?: any, onMessageQueued?: () => void): void;
    recover<S>(state: S): void;
    reject(message: any, requeue?: boolean): void;
    stop(): void;
    unbindConsumer(): void;
  }

  export interface BpmnEngineBrokerConsumer {
    consumerTag: string;
    noAck: any;
    onMessage: () => void;
    options: any;
    priority: number;
    queueName: string;
    ackAll(): void;
    nackAll(requeue: boolean): void;
    cancel(): void;
  }

  export interface BpmnEngineBrokerMessage {
    fields: {routingKey: string, redelivered: boolean, exchange: any, consumerTag: string}[];
    content: any;
    properties: {messageId: string, persistent: boolean, timestamp: Date, expiration: number};
    ack(allUpTo?: boolean): void;
    nack(allUpTo?: boolean, requeue?: boolean): void;
    reject(requeue?: boolean): void;
    getRoutingKeyPattern(pattern: string): (test: string) => boolean;
  }

  export interface BpmnEngineBroker<W> {
    new(owner: W): BpmnEngineBroker<W>;
    readonly owner: W;
    assertExchange(exchangeName: string, type: string, options?: any): void;
    deleteExchange(exchangeName: string, ifUnused?: boolean): void;
    bindExchange(source: string, destination: string, pattern: string, ...args: any[]): void;

    unbindExchange(source: string, destination: string, pattern?: string): void;
    assertQueue(queueName: string, options?: any): void;
    bindQueue(queueName: string, exchangeName: string, pattern: string, options?: any): void;
    unbindQueue(queueName: string, exchangeName: string, pattern: string): void;

    consume(queueName: string, onMessage: () => void, options?: any): void;
    cancel(consumerTag: string): void;
    createQueue<Q>(): Q;
    deleteQueue(queueName: string, options?: {ifUnused: boolean, ifEmpty?: boolean}): void;

    getExchange<T>(exchangeName: string): T;
    getQueue<Q>(queueName: string): Q;
    getConsumers<C>(): C[];
    getConsumer<C>(consumerTag: string): C;
    getState<S>(): S;
    recover<S>(state?: S): void;
    purgeQueue(queueName: string): void;
    sendToQueue(queueName: string, content: any, options?: any): void;
    stop(): void;
    get(queueName: string, options?: any): void;

    ack(message: any, allUpTo?: boolean): void;
    ackAll(): void;
    nack(message: any, allUpTo?: boolean, requeue?: boolean): void;
    nackAll(requeue?: boolean): void;
    reject(message: any, requeue?: boolean): void;

    createShovel<S>(name: string, source: string, destination: string, options?: any): S;
    getShovel<S>(name: string): S;
    closeShovel(name: string): void;
    prefetch(count: number): void;

    reset(): void;
    on(eventName: string, handler: () => void): void;
    off(eventName: string, handler: () => void): void;
    unsubscribe(queueName: string, onMessage: () => void): void;
    cancel(eventName: string): void;
    subscribe(exchangeName: string, pattern: string, queueName: string, onMessage: () => void, options?: any): void;
    subscribeTmp(exchangeName: string, pattern: string, queueName: string, onMessage: () => void, options?: any): void;
    subscribeOnce(exchangeName: string, pattern: string, queueName: string, onMessage: () => void, options?: any): void;
    publish(exchangeName: string, routingKey: string, content?: any, options?: any): void;
    close(): void;

  }

  export interface BpmnEngineExecuteOptions {
    variables?: BpmnEngineVariable;
    listener?: EventEmitter;
    services?: BpmnEngineService;

    /**
     * optional override expressions handler
     */
    expressions?: BpmnEngineExpressions;
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
    services?: BpmnEngineService;

    elements?: any;

    typeResolver?: <R>(...elements: any) => R;
    /**
     * optional bpmn-moddle options to be passed to bpmn-moddle
     */
    moddleOptions?: any;

    extensions?: BpmnEngineExtension;
    /**
     * optional override expressions handler
     */
    expressions?: BpmnEngineExpressions;
  }

  export interface BpmnEngineExtension {
    [name: string]: (activiy?: BpmnEngineActivity, environment?: BpmnEngineExecutionEnvironment) => void;
  }

  export interface BpmnEngineExpressions {
    resolveExpression<R>(
      expression: string,
      message?: any,
      expressionFnContext?: any,
    ): R;
  }

  export interface BpmnEngine {
    new(options?: BpmnEngineOptions): BpmnEngine;

    /**
     * engine name
     */
    readonly name: string;
    /**
     * engine broker
     */
    broker: BpmnEngineBroker<BpmnEngine>;
    /**
     * engine state
     */
    readonly state: any;
    /**
     * boolean stopped
     */
    readonly stopped: boolean;
    /**
     * current engine execution
     */
    readonly  execution: BpmnEngineExecutionApi;
    /**
     * engine environment
     */
    readonly environment: BpmnEngineExecutionEnvironment;
    /**
     *  engine logger
     */
    readonly logger: BpmnLogger;

    /**
     * execute definition
     * @param options Optional object with options to override the initial engine options
     * @summary Execute options overrides the initial options passed to the engine before executing the definition.
     */
    execute(options?: BpmnEngineExecuteOptions): Promise<BpmnEngineExecutionApi>;

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
    getState(): Promise<BpmnEngineExecutionState>;

    /**
     * Recover engine from state
     * @param state engine state
     * @param recoverOptions  optional object with options that will completely override the options passed to the engine at init
     */
    recover(state: any, recoverOptions?: BpmnEngineOptions): BpmnEngine;

    /**
     * Resume execution function with previously saved engine state.
     * @param options
     * @param callback
     */
    resume(options?: BpmnEngineExecuteOptions, callback?: () => void): Promise<BpmnEngineExecutionApi>;

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

  export function Engine(options?: BpmnEngineOptions): BpmnEngine;

  export interface BpmnEngineExecution {
    definitions: BpmnEngineExecutionDefinition[];
    state: 'idle' | 'running';
    environment: BpmnEngineExecutionEnvironment;

    stopped: boolean;
    execute(executeOptions?: any): BpmnEngineExecutionApi;
    getState<R>(): R;

    resume(resumeOptions?: any): void;

    stop(): void;

  }

  export interface BpmnEngineExecutionContext {
    id: string;
    name: string;
    type: string;
    sid: any;
    definitionContext: any;
    environment: BpmnEngineExecutionEnvironment;

    clone(
      environment?: BpmnEngineExecutionEnvironment
    ): BpmnEngineExecutionContext;
    getActivities(scopeId?: string): BpmnEngineActivity[];
    getActivityById(id: string): BpmnEngineActivity;
    getExecutableProcesses(): any[];
    getDataObjectById(id: string): any;

    getMessageFlows(): any[];

    getProcessById(id: string): any;

    getProcesses(): any;

    getSequenceFlowById(id: string): any;

    getSequenceFlows(scopeId: string): any[];

    getInboundSequenceFlows(activityId: string): any[];
    getOutboundSequenceFlows(activityId: string): any[];

    loadExtensions(activity: BpmnEngineActivity): void;
  }

  export interface BpmnProcess {
    new(processDefinition: any, context: BpmnEngineExecutionContext): BpmnProcess;

    readonly id: string;
    readonly type: string;
    readonly name: string;
    readonly isExecutable: boolean;
    readonly broker: BpmnEngineBroker<BpmnEngine>;

    readonly context: BpmnEngineExecutionContext;
    readonly counters: Record<string, number>;
    readonly environment: BpmnEngineExecutionEnvironment;
    readonly execution: BpmnEngineExecutionApi;
    readonly executionId: string;
    readonly isRunning: boolean;

    readonly logger: BpmnLogger;
    readonly parent: BpmnProcess;
    readonly status: any;

    readonly stopped: boolean;

    getApi(message: any): BpmnEngineExecutionApi;
    getActivities(): BpmnEngineActivity[];
    getActivityById(id: string): BpmnEngineActivity;

    getSequenceFlows(): any[];
    getPostponed(): BpmnEngineActivity[];

    getState<S>(): S;

    recover<S>(state: S): void;
    resume(): void;
    run(): void;
    stop(): void;
    waitFor<R>(eventName: string): Promise<R>;
  }

  export interface BpmnEngineActivity extends EventEmitter {
    readonly id: string;
    readonly type: string;
    readonly  name: string;

    readonly attachedTo: any;

    readonly  Behaviour: any;

    readonly  behaviour: any;

    readonly broker: BpmnEngineBroker<BpmnEngine>;

    readonly counters: Record<string, number>;
    readonly environment: BpmnEngineExecutionEnvironment;
    readonly execution: BpmnEngineExecutionApi;
    readonly executionId: string;
    readonly  extensions: BpmnEngineExtension;
    readonly logger: BpmnLogger;
    readonly inbound: any[];
    readonly isRunning: boolean;
    readonly isStart: boolean;
    readonly isSubProcess: boolean;

    readonly  outbound: any[];
    readonly  parent?: BpmnEngineActivity | BpmnProcess;
    readonly  status: any;
    readonly stopped: boolean;

    activate(): void;

    deactivate(): void;

    discard(): void;

    getApi(message?: any): BpmnEngineExecutionApi;

    getActivityById(id: string): BpmnEngineActivity;

    getState<S>(): S;

    message(messageContent: any): void;
    signal: (message?: BpmnMessage, options?: any) => void;
    next(): void;

    recover<S>(state: S): void;

    resume(): void;

    run(runContent?: any): void;

    stop(): void;

    waitFor<R>(eventName: string): Promise<R>;
  }

  export interface BpmnEngineService {
    [name: string]: Function;
  }

  export interface BpmnEngineExecutionEnvironment {
    readonly options: any;
    readonly extensions: BpmnEngineExtension;

    readonly scripts: any;
    readonly output: any;
    readonly variables: BpmnEngineVariable;

    readonly settings: any;

    readonly Logger: BpmnLogger;
    readonly services: BpmnEngineService;

    // tslint:disable: ban-types
    addService(name: string, serviceFn: Function): void;
    assignVariables(...vars: any): void;
    clone(overrideOptions?: any): BpmnEngineExecutionEnvironment;
    getScript(scriptType: string, activity: any): any;
    getServiceByName(name: string): any;

    getState(): BpmnEngineExecutionState;

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
    readonly  id: string;
    readonly type: string;
    readonly  name: string;
    readonly executionId: string;
    readonly  environment: BpmnEngineExecutionEnvironment;
    readonly fields: any;

    readonly content: BpmnExecutionEventMessageContent;
    readonly  messageProperties: any;
    readonly owner: BpmnEngine;

    cancel(): void;
    discard(): void;
    signal(message: string, options: any): void;
    stop(): void;

    resolveExpression<R>(expression: any): R;
    createMessage(overrideContent?: any): BpmnExecutionEventMessageApi;
  }

  export interface BpmnEngineExecutionDefinition extends EventEmitter {
    state: 'pending' | 'running' | 'completed';
    run: (callback?: any) => void;
    resume: (callback?: any) => void;

    recover: (state?: any) => void;

    sendMessage: (message: any) => void;

    executionId: string;
    execution: BpmnEngineExecutionApi;
    getProcesses: () => any[];

    getExecutableProcesses: () => any[];
    getApi: <T>(message: any) => T;
    getElementById: (elementId: string) => any;
    getActivityById: (childId: string) => any;
    environment: BpmnEngineExecutionEnvironment;
    status: string;
    stopped: boolean;
    type: string;
    signal: (message: BpmnMessage, options?: any) => void;
    cancelActivity: (message?: any) => void;
    shake: (activityId?: string) => any;
    broker: BpmnEngineBroker<BpmnEngine>;
    id: string;
    isRunning: boolean;
    name: string;
    logger: BpmnLogger;
    waitFor(name: string, fn: Function): void;
  }

  export interface BpmnEngineExecutionDefinitionState {
    readonly state: 'pending' | 'running' | 'completed';
    readonly  processes: {
      [processId: string]: {
        variables: BpmnEngineVariable;
        services: BpmnEngineService;
        children: BpmnEngineExecutionState[];
      };
    };
  }

  export interface BpmnEngineExecutionState {
    readonly name: string;
    readonly state: 'idle' | 'running';
    readonly stopped: boolean;
    readonly engineVersion: string;
    readonly environment: BpmnEngineExecutionEnvironment;
    readonly  definitions: BpmnEngineExecutionDefinitionState[];

    readonly entered: boolean;
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
    state: 'running' | 'idle';
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
     * @type {BpmnEngineExecutionEnvironment}
     *
     */
    environment: BpmnEngineExecutionEnvironment;

    /**
     * executing definitions
     *
     * @type {BpmnEngineExecutionDefinition}
     *
     */
    definitions: BpmnEngineExecutionDefinition;

    /**
     * get execution serializable state
     *
     * @returns {BpmnEngineExecutionState}
     *
     */
    getState(): BpmnEngineExecutionState;

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
     * @type {BpmnEngineExecutionEnvironment}
     *
     */
    readonly environment: BpmnEngineExecutionEnvironment;

    /**
     * executing definitions
     *
     * @type {BpmnEngineExecutionDefinition}
     *
     */
    readonly definitions: BpmnEngineExecutionDefinition;

    /**
     * Get activity/element by id. Loops the definitions and returns the first found activity with id.
     * @param activityId Activity or element id
     */
    getActivityById(activityId: string): BpmnEngineActivity;

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
    stop(): void;

    /**
     * get activities in a postponed state
     *
     *
     */
    getPostponed(): BpmnEngineActivity[];

    /**
     * send signal to execution, distributed to all definitions
     * Delegate a signal message to all interested parties, usually MessageEventDefinition, SignalEventDefinition, SignalTask (user, manual), ReceiveTask, or a StartEvent that has a form.
     * @param message {BpmnMessage}
     */
    signal(message?: BpmnMessage, options?: {ignoreSameDefinition?: boolean}): void;

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
