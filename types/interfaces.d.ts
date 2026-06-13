import type { EventEmitter } from 'node:events';
import type { Definitions as BpmnModdleDefinitions } from 'bpmn-moddle';
import type { ExtendFn, SerializableContext, ResolverFn } from 'moddle-context-serializer';
import type { ActivityStatus, ElementBroker, EnvironmentOptions, EnvironmentState, IScripts, Script, ILogger } from 'bpmn-elements';

export type { SerializableContext };

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

export type {
  ActivityStatus,
  BpmnModdleDefinitions,
  ElementBroker,
  EnvironmentOptions,
  EnvironmentState,
  ExtendFn,
  ILogger,
  IScripts,
  ResolverFn,
  Script,
};
