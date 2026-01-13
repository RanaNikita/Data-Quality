
// // src/types/dqToolResults.ts
// export type DQDimension =
//   | 'uniqueness'
//   | 'validity'
//   | 'completeness'
//   | 'consistency'
//   | 'accuracy';

// export interface SynthesiserResult {
//   tool: 'SYNTHESISER_AGENT_HIL' | 'FILE_SYNTHESISER_AGENT' | string;
//   rules: Array<{
//     rule_id: string;
//     dimension: DQDimension;
//     description: string;
//     expression?: string;   // SQL/DSL
//     confidence?: number;   // 0..1
//     created_at?: string;
//   }>;
// }

// export interface DataInspectorResult {
//   tool: 'DATA_INSPECTOR_HIL' | 'DATA_INSPECTOR_FILE_AGENT' | string;
//   checks: Array<{
//     rule_id: string;
//     dimension: DQDimension;
//     evaluated_rows?: number;
//     passed_rows?: number;
//     failed_rows?: number;
//     latest_score?: number; // 0..1 pass ratio
//   }>;
//   violations?: Array<{
//     rule_id: string;
//     dimension: DQDimension;
//     description?: string;
//     count: number;
//     last_seen?: string;
//     examples?: Array<Record<string, any>>;
//   }>;
// }

// export interface AnomalyResult {
//   tool: 'ANOMALY_AGENT_HIL' | 'ANOMALY_AGENT_FILE' | string;
//   anomaly_score: number;     // 0..1
//   severity?: 'low' | 'moderate' | 'high' | 'critical';
//   contributors?: string[];
//   metrics?: Record<string, number>;
//   notes?: string[];
// }

// export interface PatternResult {
//   tool: 'PATTERN_AGENT_HIL' | 'FILE_PATTERN' | string;
//   patterns: Array<{ column: string; pattern: string; support?: number }>;
// }

// export interface TraceabilityResult {
//   tool: 'TRACEABILITY_AGENT_HIL' | 'TRACEABILITY_AGENT_FILE' | string;
//   exec_id: string;
//   started_at?: string;
//   finished_at?: string;
//   meta?: Record<string, any>;
// }

// export type ToolResultPayload =
//   | SynthesiserResult
//   | DataInspectorResult
//   | AnomalyResult
//   | PatternResult
//   | TraceabilityResult;


// trying proper format on 5 jan


// src/types/dqToolResults.ts
export type DQDimension =
  | 'uniqueness'
  | 'validity'
  | 'completeness'
  | 'consistency'
  | 'accuracy';

export interface SynthesiserResult {
  tool: 'SYNTHESISER_AGENT_HIL' | 'FILE_SYNTHESISER_AGENT' | string;
  rules: Array<{
    rule_id: string;
    dimension: DQDimension;
    description: string;
    expression?: string;   // SQL/DSL
    confidence?: number;   // 0..1
    created_at?: string;
  }>;
}

export interface DataInspectorResult {
  tool: 'DATA_INSPECTOR_HIL' | 'DATA_INSPECTOR_FILE_AGENT' | string;
  checks: Array<{
    rule_id: string;
    dimension: DQDimension;
    evaluated_rows?: number;
    passed_rows?: number;
    failed_rows?: number;
    latest_score?: number; // 0..1 pass ratio
  }>;
  violations?: Array<{
    rule_id: string;
    dimension: DQDimension;
    description?: string;
    count: number;
    last_seen?: string;
    examples?: Array<Record<string, any>>;
  }>;
}

export interface AnomalyResult {
  tool: 'ANOMALY_AGENT_HIL' | 'ANOMALY_AGENT_FILE' | string;
  anomaly_score: number;     // 0..1
  severity?: 'low' | 'moderate' | 'high' | 'critical';
  contributors?: string[];
  // Metrics can carry nested objects; we expose per-column positive%
  metrics?: {
    perColumnPositive?: Record<string, number>;
    [k: string]: any;
  };
  notes?: string[];
}

export interface PatternResult {
  tool: 'PATTERN_AGENT_HIL' | 'FILE_PATTERN' | string;
  patterns: Array<{ column: string; pattern: string; support?: number }>;
}

export interface TraceabilityResult {
  tool: 'TRACEABILITY_AGENT_HIL' | 'TRACEABILITY_AGENT_FILE' | string;
  exec_id: string;
  started_at?: string;
  finished_at?: string;
  meta?: Record<string, any>;
}

export type ToolResultPayload =
  | SynthesiserResult
  | DataInspectorResult
  | AnomalyResult
  | PatternResult
  | TraceabilityResult;
