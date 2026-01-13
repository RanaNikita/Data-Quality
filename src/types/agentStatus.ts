

// src/types/agentStatus.ts
// export type AgentPhaseState = 'pending' | 'running' | 'success' | 'error';
// export type AgentStatusMap = Record<string, AgentPhaseState>;

// /** Display labels for TABLE mode (keys are internal phase keys used in AGENT_STATUS_TABLE). */
// export const TABLE_AGENT_LABELS: Record<string, string> = {
//   'Schema Detection Agent': 'Schema Detection Agent',
//   'Pattern Detection Agent': 'Pattern Detection Agent',
//   'Synthesiser Agent': 'Synthesiser Agent', // keep label consistent
//   'Data Inspector Agent': 'Data Inspector Agent',
//   'Anomaly Agent': 'Anomaly Agent',
//   'Traceability Agent': 'Traceability Agent',
// };

// /** Display labels for FILE mode (keys are internal phase keys used in FILE_AGENT_STATUS). */
// export const FILE_AGENT_LABELS: Record<string, string> = {
//   'FILE_DISCOVERY': 'File Discovery',
//   'FILE_PATTERN': 'File Pattern',
//   'FILE_SYNTHESISER_AGENT': 'File Synthesiser',
//   'DATA_INSPECTOR_FILE_AGENT': 'File Data Inspector',
//   'ANOMALY_AGENT_FILE': 'File Anomaly',
//   'TRACEABILITY_AGENT_FILE': 'File Traceability',
// };
//-----------------------------------------------------------------------------------------

//using below new code


// src/types/agentStatus.ts
export type AgentPhaseState = 'pending' | 'running' | 'success' | 'error';

export type PhaseKey =
  | 'SCHEMA_DETECTION'
  | 'PATTERN_DETECTION'
  | 'SYNTHESISER'
  | 'DATA_INSPECTOR'
  | 'ANOMALY'
  | 'TRACEABILITY'
  | 'FILE_DISCOVERY'
  | 'FILE_PATTERN'
  | 'FILE_SYNTHESISER_AGENT'
  | 'DATA_INSPECTOR_FILE_AGENT'
  | 'ANOMALY_AGENT_FILE'
  | 'TRACEABILITY_AGENT_FILE';

export type StatusByPhase = Record<PhaseKey, AgentPhaseState>;
export type Mode = 'table' | 'file';

// ✅ Canonical → Display labels (single source of truth)
export const LABELS: Record<PhaseKey, string> = {
  SCHEMA_DETECTION: 'Schema Detection Agent',
  PATTERN_DETECTION: 'Pattern Detection Agent',
  SYNTHESISER: 'Synthesiser Agent',
  DATA_INSPECTOR: 'Data Inspector Agent',
  ANOMALY: 'Anomaly Agent',
  TRACEABILITY: 'Traceability Agent',

  FILE_DISCOVERY: 'File Discovery',
  FILE_PATTERN: 'File Pattern',
  FILE_SYNTHESISER_AGENT: 'File Synthesiser',
  DATA_INSPECTOR_FILE_AGENT: 'File Data Inspector',
  ANOMALY_AGENT_FILE: 'File Anomaly',
  TRACEABILITY_AGENT_FILE: 'File Traceability',
};

// ✅ Order for UI progression
export const TABLE_ORDER: PhaseKey[] = [
  'SCHEMA_DETECTION',
  'PATTERN_DETECTION',
  'SYNTHESISER',
  'DATA_INSPECTOR',
  'ANOMALY',
  'TRACEABILITY',
];

export const FILE_ORDER: PhaseKey[] = [
  'FILE_DISCOVERY',
  'FILE_PATTERN',
  'FILE_SYNTHESISER_AGENT',
  'DATA_INSPECTOR_FILE_AGENT',
  'ANOMALY_AGENT_FILE',
  'TRACEABILITY_AGENT_FILE',
];

// (Backward-compatible) Sidebar prop type you already use
export type AgentStatusMap = Record<string, AgentPhaseState>;
