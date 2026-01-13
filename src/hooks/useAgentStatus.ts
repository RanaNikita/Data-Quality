
// src/hooks/useAgentStatus.ts
import { useCallback, useMemo, useState } from 'react';
import type {
  Mode,
  PhaseKey,
  StatusByPhase,
  AgentPhaseState,
} from '../types/agentStatus';
import { TABLE_ORDER, FILE_ORDER } from '../types/agentStatus';

// ✅ Re-export Mode so files importing from this hook compile
export type { Mode };

const initStatus = (mode: Mode): StatusByPhase => {
  const order = mode === 'file' ? FILE_ORDER : TABLE_ORDER;
  const initial: Partial<StatusByPhase> = {};
  for (const k of order) initial[k] = 'pending';
  return initial as StatusByPhase;
};

const VALID_TRANSITIONS: Record<AgentPhaseState, AgentPhaseState[]> = {
  pending: ['running', 'error'],
  running: ['success', 'error'],
  success: [],
  error: [],
};

export function useAgentStatus(mode: Mode) {
  const [status, setStatus] = useState<StatusByPhase>(() => initStatus(mode));

  // Reset to all 'pending' for the current mode
  const reset = useCallback(() => {
    setStatus(initStatus(mode));
  }, [mode]);

  // Guarded updates: prevent pending -> success leaps
  const setPhase = useCallback((key: PhaseKey, next: AgentPhaseState) => {
    setStatus(prev => {
      const current = prev[key] ?? 'pending';
      const allowed = VALID_TRANSITIONS[current];

      // Block invalid transitions
      if (!allowed.includes(next)) {
        if (current === 'pending' && next === 'success') {
          // downgrade to running instead of jumping to success
          return { ...prev, [key]: 'running' };
        }
        return prev; // ignore
      }

      return { ...prev, [key]: next };
    });
  }, []);

  const order = useMemo(
    () => (mode === 'file' ? FILE_ORDER : TABLE_ORDER),
    [mode]
  );

  return { status, setPhase, reset, order };
}
