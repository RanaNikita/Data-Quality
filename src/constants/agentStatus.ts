

// src/constants/agentStatus.ts
import type { AgentStatusMap } from '../types/agentStatus';

export const AGENT_STATUS_TABLE: AgentStatusMap = {
  'Schema Detection Agent': 'pending',
  'Pattern Detection Agent': 'pending',
  'Synthesiser Agent': 'pending', // keep label consistent everywhere
  'Data Inspector Agent': 'pending',
  'Anomaly Agent': 'pending',
  'Traceability Agent': 'pending',
};

export const FILE_AGENT_STATUS: AgentStatusMap = {
  'FILE_DISCOVERY': 'pending',
  'FILE_PATTERN': 'pending',
  'FILE_SYNTHESISER_AGENT': 'pending',
  'DATA_INSPECTOR_FILE_AGENT': 'pending',
  'ANOMALY_AGENT_FILE': 'pending',
  'TRACEABILITY_AGENT_FILE': 'pending',
};
