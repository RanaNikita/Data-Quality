

// // src/constants/toolPhaseMap.ts
// // Exact tool names -> sidebar phase keys (based on your provided names)

// // TABLE mode tool name -> phase key
// export const TOOL_TO_TABLE_PHASE: Record<string, string> = {
//   'SCHEMA_AGENT_HIL': 'Schema Detection Agent',
//   'PATTERN_AGENT_HIL': 'Pattern Detection Agent',
//   'SYNTHESISER_AGENT_HIL': 'Synthesiser Agent',
//   'DATA_INSPECTOR_HIL': 'Data Inspector Agent',
//   'ANOMALY_AGENT_HIL': 'Anomaly Agent',
//   'TRACEABILITY_AGENT_HIL': 'Traceability Agent',
// };

// // FILE mode tool name -> phase key
// export const TOOL_TO_FILE_PHASE: Record<string, string> = {
//   'FILE_DISCOVERY': 'FILE_DISCOVERY',
//   'FILE_PATTERN': 'FILE_PATTERN',
//   'FILE_SYNTHESISER_AGENT': 'FILE_SYNTHESISER_AGENT',
//   'DATA_INSPECTOR_FILE_AGENT': 'DATA_INSPECTOR_FILE_AGENT',
//   'ANOMALY_AGENT_FILE': 'ANOMALY_AGENT_FILE',
//   'TRACEABILITY_AGENT_FILE': 'TRACEABILITY_AGENT_FILE',
// };

// // Returns the mapped sidebar phase key for a given tool name and mode.
// export const mapToolToPhaseKey = (toolName?: string, mode?: 'table' | 'file') => {
//   if (!toolName) return undefined;
//   const dict = mode === 'file' ? TOOL_TO_FILE_PHASE : TOOL_TO_TABLE_PHASE;
//   return dict[toolName];
// };



// file was not updating so trying below =


// src/constants/toolPhaseMap.ts
//--------------------------------------------------------------------------------------------------------------------------
// Normalize tool names to robustly match variations
// const normalize = (s?: string) =>
//   (s ?? '').toUpperCase().replace(/[^A-Z0-9]+/g, '_');

// // TABLE mode tool name -> phase key
// const TABLE_MAP: Record<string, string> = {
//   'SCHEMA_AGENT_HIL': 'Schema Detection Agent',
//   'PATTERN_AGENT_HIL': 'Pattern Detection Agent',
//   'SYNTHESISER_AGENT_HIL': 'Synthesiser Agent',
//   'SYNTHESIZER_AGENT_HIL': 'Synthesiser Agent', // tolerate -izer
//   'DATA_INSPECTOR_HIL': 'Data Inspector Agent',
//   'ANOMALY_AGENT_HIL': 'Anomaly Agent',
//   'TRACEABILITY_AGENT_HIL': 'Traceability Agent',
// };

// // FILE mode tool name -> phase key
// const FILE_MAP: Record<string, string> = {
//   'FILE_DISCOVERY': 'FILE_DISCOVERY',
//   'FILE_PATTERN': 'FILE_PATTERN',

//   // tolerate both -iser and -izer (some pipelines emit the other)
//   'FILE_SYNTHESISER_AGENT': 'FILE_SYNTHESISER_AGENT',
//   'FILE_SYNTHESIZER_AGENT': 'FILE_SYNTHESISER_AGENT',

//   'DATA_INSPECTOR_FILE_AGENT': 'DATA_INSPECTOR_FILE_AGENT',
//   'ANOMALY_AGENT_FILE': 'ANOMALY_AGENT_FILE',
//   'TRACEABILITY_AGENT_FILE': 'TRACEABILITY_AGENT_FILE',
// };

// // Some backends send slight variants (e.g., spaces, hyphens, extra suffixes).
// // We normalize the incoming tool name and try exact matches first;
// // if none, we do a contains() based on common hints.

// const TABLE_HINTS: Record<string, string> = {
//   'SCHEMA_AGENT_HIL': 'Schema Detection Agent',
//   'PATTERN_AGENT_HIL': 'Pattern Detection Agent',
//   'SYNTHESISER_AGENT_HIL': 'Synthesiser Agent',
//   'SYNTHESIZER_AGENT_HIL': 'Synthesiser Agent',
//   'DATA_INSPECTOR_HIL': 'Data Inspector Agent',
//   'ANOMALY_AGENT_HIL': 'Anomaly Agent',
//   'TRACEABILITY_AGENT_HIL': 'Traceability Agent',
// };

// const FILE_HINTS: Record<string, string> = {
//   'FILE_DISCOVERY': 'FILE_DISCOVERY',
//   'FILE_PATTERN': 'FILE_PATTERN',
//   'FILE_SYNTHESISER_AGENT': 'FILE_SYNTHESISER_AGENT',
//   'FILE_SYNTHESIZER_AGENT': 'FILE_SYNTHESISER_AGENT',
//   'DATA_INSPECTOR_FILE_AGENT': 'DATA_INSPECTOR_FILE_AGENT',
//   'ANOMALY_AGENT_FILE': 'ANOMALY_AGENT_FILE',
//   'TRACEABILITY_AGENT_FILE': 'TRACEABILITY_AGENT_FILE',
// };

// export const mapToolToPhaseKey = (toolName?: string, mode?: 'table' | 'file') => {
//   if (!toolName) return undefined;

//   const norm = normalize(toolName);
//   const map = mode === 'file' ? FILE_MAP : TABLE_MAP;
//   const hints = mode === 'file' ? FILE_HINTS : TABLE_HINTS;

//   // 1) exact normalized match
//   if (map[norm]) return map[norm];

//   // 2) substring hints for tolerant matching
//   for (const hint of Object.keys(hints)) {
//     if (norm.includes(hint)) return hints[hint];
//   }

//   return undefined;
// };
//---------------------------------------------------------------------------------------
// new code below


// src/constants/toolPhaseMap.ts

// src/constants/toolPhaseMap.ts
import type { PhaseKey } from '../types/agentStatus';

const normalize = (s?: string) =>
  (s ?? '').toUpperCase().replace(/[^A-Z0-9]+/g, '_');

// TABLE mode tool name -> canonical phase key
const TABLE_MAP: Record<string, PhaseKey> = {
  SCHEMA_AGENT_HIL: 'SCHEMA_DETECTION',
  PATTERN_AGENT_HIL: 'PATTERN_DETECTION',
  SYNTHESISER_AGENT_HIL: 'SYNTHESISER',
  SYNTHESIZER_AGENT_HIL: 'SYNTHESISER', // tolerate -izer
  DATA_INSPECTOR_HIL: 'DATA_INSPECTOR',
  ANOMALY_AGENT_HIL: 'ANOMALY',
  TRACEABILITY_AGENT_HIL: 'TRACEABILITY',
};

// FILE mode tool name -> canonical phase key
const FILE_MAP: Record<string, PhaseKey> = {
  FILE_DISCOVERY: 'FILE_DISCOVERY',
  FILE_PATTERN: 'FILE_PATTERN',
  FILE_SYNTHESISER_AGENT: 'FILE_SYNTHESISER_AGENT',
  FILE_SYNTHESIZER_AGENT: 'FILE_SYNTHESISER_AGENT',
  DATA_INSPECTOR_FILE_AGENT: 'DATA_INSPECTOR_FILE_AGENT',
  ANOMALY_AGENT_FILE: 'ANOMALY_AGENT_FILE',
  TRACEABILITY_AGENT_FILE: 'TRACEABILITY_AGENT_FILE',
};

// Hints for tolerant substring matches
const TABLE_HINTS: Record<string, PhaseKey> = {
  SCHEMA_AGENT_HIL: 'SCHEMA_DETECTION',
  PATTERN_AGENT_HIL: 'PATTERN_DETECTION',
  SYNTHESISER_AGENT_HIL: 'SYNTHESISER',
  SYNTHESIZER_AGENT_HIL: 'SYNTHESISER',
  DATA_INSPECTOR_HIL: 'DATA_INSPECTOR',
  ANOMALY_AGENT_HIL: 'ANOMALY',
  TRACEABILITY_AGENT_HIL: 'TRACEABILITY',
};

const FILE_HINTS: Record<string, PhaseKey> = {
  FILE_DISCOVERY: 'FILE_DISCOVERY',
  FILE_PATTERN: 'FILE_PATTERN',
  FILE_SYNTHESISER_AGENT: 'FILE_SYNTHESISER_AGENT',
  FILE_SYNTHESIZER_AGENT: 'FILE_SYNTHESISER_AGENT',
  DATA_INSPECTOR_FILE_AGENT: 'DATA_INSPECTOR_FILE_AGENT',
  ANOMALY_AGENT_FILE: 'ANOMALY_AGENT_FILE',
  TRACEABILITY_AGENT_FILE: 'TRACEABILITY_AGENT_FILE',
};

export const mapToolToPhaseKey = (
  toolName?: string,
  mode: 'table' | 'file' = 'table'
): PhaseKey | undefined => {
  if (!toolName) return undefined;

  const norm = normalize(toolName);
  const map = mode === 'file' ? FILE_MAP : TABLE_MAP;
  const hints = mode === 'file' ? FILE_HINTS : TABLE_HINTS;

  // 1) exact normalized match
  if (map[norm]) return map[norm];

  // 2) tolerant substring hints
  for (const hint of Object.keys(hints)) {
    if (norm.includes(hint)) return hints[hint];
  }

  return undefined;
};


