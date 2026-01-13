// working perfectly
// src/components/Main.tsx
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  Box, Container, Stack, CircularProgress, Typography, Button, Paper, alpha, useTheme,
  Link as MuiLink, ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import {
  BrowserRouter, useRoutes, Link as RouterLink, Navigate, useNavigate, useParams
} from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AcUnitIcon from '@mui/icons-material/AcUnit'; // ❄ brand snowflake icon
import { useAgentConfig } from '../hooks/useAgentConfig';
import { useChatMessages } from '../hooks/useChatMessages';
import { useAccordionState } from '../hooks/useAccordionState';
import StatusSidebar from './StatusSidebar';
import { useAgentStatus } from '../hooks/useAgentStatus';
import type { Mode, AgentStatusMap, StatusByPhase, PhaseKey } from '../types/agentStatus';
import { LABELS, TABLE_ORDER, FILE_ORDER } from '../types/agentStatus';
import { EmptyState } from './chat/EmptyState';
import { StarterQuestions } from './chat/StarterQuestions';
import { ChatMessage } from './chat/ChatMessage';
import { ChatInput } from './chat/ChatInput';
import { STATUS_TEXT, ERROR_TEXT } from '../constants/textConstants';
import { mapToolToPhaseKey } from '../constants/toolPhaseMap';
import { useDashboardFromMessages } from '../dq/useDashboardFromMessages';
import Dashboard from './dashboard/Dashboard';
import { ThemeToggle } from './ThemeToggle';

// DEBUG FLAG
if (typeof window !== 'undefined') (window as any).DQ_DEBUG = true;

const SIDEBAR_WIDTH_SPACING_UNITS = 35; // 35 * 8px = 280px

const TABLE_PHASES = {
  SCHEMA: 'SCHEMA_DETECTION',
  PATTERN: 'PATTERN_DETECTION',
  SYNTH: 'SYNTHESISER',
  INSPECT: 'DATA_INSPECTOR',
  ANOMALY: 'ANOMALY',
  TRACE: 'TRACEABILITY',
} as const;

const FILE_PHASES = {
  DISCOVERY: 'FILE_DISCOVERY',
  PATTERN: 'FILE_PATTERN',
  SYNTH: 'FILE_SYNTHESISER_AGENT',
  INSPECT: 'DATA_INSPECTOR_FILE_AGENT',
  ANOMALY: 'ANOMALY_AGENT_FILE',
  TRACE: 'TRACEABILITY_AGENT_FILE',
} as const;

const containsPatternHint = (m: any) =>
  !!(m?.patterns?.length) ||
  (typeof m?.text === 'string' && /pattern|regex|format/i.test(m.text));

const containsAnomalyHint = (m: any) =>
  !!m?.metadata?.anomalyDetected ||
  (typeof m?.text === 'string' && /anomal(y|ies)|outlier/i.test(m.text));

/** Brand block: icon + title + powered-by */
const BrandBlock: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const theme = useTheme();
  const size = compact ? 40 : 64;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      <Box
        sx={{
          width: size, height: size, borderRadius: '50%',
          background: alpha(theme.palette.info.main, 0.15),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          mr: compact ? 1.5 : 2,
        }}
      >
        <AcUnitIcon sx={{ fontSize: compact ? 24 : 32, color: theme.palette.info.main }} aria-hidden="true" />
      </Box>
      <Box>
        <Typography variant={compact ? 'h5' : 'h4'} sx={{ fontWeight: 800 }}>Data Quality</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Powered by{' '}
          <MuiLink
            href="https://www.snowflake.com/en/data-cloud/cortex/"
            target="_blank"
            rel="noopener noreferrer"
            underline="hover"
          >
            Snowflake Cortex Agents
          </MuiLink>
        </Typography>
      </Box>
    </Box>
  );
};

/** CompactControls: Theme toggle + Table/File switch
 * Navigates to /dq/<runMode>/<mode> so routes reflect mode and state can be managed per route.
 */
function CompactControls(
  { mode, runMode }: { mode: Mode; runMode: 'hil' | 'autonomous' }
) {
  const navigate = useNavigate();
  const handleModeChange = (_: React.MouseEvent<HTMLElement>, next: Mode | null) => {
    if (!next) return;
    navigate(`/dq/${runMode}/${next}`);
  };
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <ThemeToggle />
      <ToggleButtonGroup aria-label="Working mode" exclusive color="primary" size="small" value={mode} onChange={handleModeChange}>
        <ToggleButton value="table" aria-label="Table mode">Table</ToggleButton>
        <ToggleButton value="file" aria-label="File mode">File</ToggleButton>
      </ToggleButtonGroup>
    </Box>
  );
}

type AnyAgent = {
  displayName?: string;
  starterQuestions?: string[];
  tags?: string[];
  kind?: string;
  type?: string;
  category?: string;
  mode?: string;
  [k: string]: any;
};

const strIncludes = (s: any, needle: string) => typeof s === 'string' && s.toLowerCase().includes(needle);
const hasTag = (tags: any, needle: string) => Array.isArray(tags) && tags.some((t) => strIncludes(t, needle));

const isAutonomousAgent = (a: AnyAgent) =>
  strIncludes(a.kind, 'autonomous') ||
  strIncludes(a.type, 'autonomous') ||
  strIncludes(a.category, 'autonomous') ||
  strIncludes(a.mode, 'autonomous') ||
  hasTag(a.tags, 'autonomous') ||
  strIncludes(a.displayName, 'autonom') ||
  strIncludes(a.displayName, 'auto');

const isHumanLoopAgent = (a: AnyAgent) =>
  strIncludes(a.kind, 'human') ||
  strIncludes(a.type, 'human') ||
  strIncludes(a.category, 'human') ||
  strIncludes(a.mode, 'human') ||
  hasTag(a.tags, 'human') ||
  hasTag(a.tags, 'human-in-loop') ||
  hasTag(a.tags, 'human_in_loop') ||
  hasTag(a.tags, 'hil') ||
  strIncludes(a.displayName, 'human') ||
  strIncludes(a.displayName, 'loop') ||
  strIncludes(a.displayName, 'hil');

const filterAgentsByRunMode = (agentsMap: Record<string, AnyAgent>, runMode?: 'hil' | 'autonomous') => {
  const entries = Object.entries(agentsMap ?? {});
  if (runMode === 'autonomous') return Object.fromEntries(entries.filter(([, a]) => isAutonomousAgent(a)));
  if (runMode === 'hil') return Object.fromEntries(entries.filter(([, a]) => isHumanLoopAgent(a)));
  return agentsMap;
};

const inferPhaseFromToolName = (toolName: string | undefined, mode: Mode): PhaseKey | undefined => {
  const n = String(toolName ?? '').toLowerCase();
  if (!n) return undefined;
  const has = (...parts: string[]) => parts.some((p) => n.includes(p));
  if (mode === 'table') {
    if (has('schema')) return TABLE_PHASES.SCHEMA as PhaseKey;
    if (has('pattern')) return TABLE_PHASES.PATTERN as PhaseKey;
    if (has('synth', 'synthes')) return TABLE_PHASES.SYNTH as PhaseKey;
    if (has('inspect', 'inspector')) return TABLE_PHASES.INSPECT as PhaseKey;
    if (has('anomaly', 'outlier')) return TABLE_PHASES.ANOMALY as PhaseKey;
    if (has('trace')) return TABLE_PHASES.TRACE as PhaseKey;
  } else {
    if (has('discovery', 'file_discovery')) return FILE_PHASES.DISCOVERY as PhaseKey;
    if (has('pattern', 'file_pattern')) return FILE_PHASES.PATTERN as PhaseKey;
    if (has('synth', 'synthes')) return FILE_PHASES.SYNTH as PhaseKey;
    if (has('inspect', 'inspector')) return FILE_PHASES.INSPECT as PhaseKey;
    if (has('anomaly', 'outlier')) return FILE_PHASES.ANOMALY as PhaseKey;
    if (has('trace')) return FILE_PHASES.TRACE as PhaseKey;
  }
  return undefined;
};

/** readiness checks for dashboard rendering */
const isDashboardReady = (d: any) => {
  if (!d) return false;
  const hasRuleDist = Object.values(d.ruleDistribution ?? {}).some((n) => Number(n ?? 0) > 0);
  const hasRuleOcc = Object.values(d.ruleOccurrences ?? {}).some((o: any) =>
    Number(o?.rules_defined ?? 0) > 0 ||
    Number(o?.checks_reported ?? 0) > 0 ||
    Number(o?.violations_detected ?? 0) > 0
  );
  const hasTable = (Array.isArray(d.ruleViolationsTable) ? d.ruleViolationsTable : []).length > 0;
  const hasAnomaly = Number(d.anomaly?.score ?? 0) > 0;
  return hasRuleDist && hasRuleOcc && hasTable && hasAnomaly;
};

const isExecutionComplete = (status: StatusByPhase, mode: Mode, strict = false) => {
  const order = mode === 'file' ? FILE_ORDER : TABLE_ORDER;
  return order.every((phaseKey) => {
    const st = (status as StatusByPhase)[phaseKey];
    return strict ? st === 'success' : st === 'success' || st === 'error';
  });
};

/** DQ PAGE: Chat + Dashboard
 * Reads mode from URL (/dq/<runMode>/<mode>) so navigation does not remount the component.
 */
export const SimpleChatInterface: React.FC<{ runMode?: 'hil' | 'autonomous' }> = ({ runMode }) => {
  const theme = useTheme();
  useEffect(() => { (window as any).DQ_DEBUG = true; }, []);

  const dqLeftLabel =
    runMode === 'hil' ? 'Data Quality — Human in Loop' :
    runMode === 'autonomous' ? 'Data Quality — Auto' : 'Data Quality';

  // ========= Mode from route & Status =========
  const { mode: modeParam } = useParams();
  const [mode, setMode] = useState<Mode>('table');

  // Sync mode when URL changes (table/file)
  useEffect(() => {
    setMode(modeParam === 'file' ? 'file' : 'table');
  }, [modeParam]);

  const { status, setPhase, reset } = useAgentStatus(mode);
  // Keep reset on mode change so each mode has its own phase state; messages persist separately by m.mode
  useEffect(() => { reset(); }, [mode, reset]);
  useEffect(() => { reset(); }, [runMode, reset]);

  // ========= Agent configuration =========
  const { config: agentConfig, loading: configLoading, error: configError, getVisibleAgents, refreshAgents } = useAgentConfig();
  const getFilteredVisibleAgents = useCallback(() => {
    const all = getVisibleAgents();
    const filtered = filterAgentsByRunMode(all, runMode);
    return Object.keys(filtered).length > 0 ? filtered : all;
  }, [getVisibleAgents, runMode]);

  // ========= Selected agent =========
  const [selectedAgent, setSelectedAgent] = useState<string>('');

  // ========= Chat messages & streaming =========
  const { messages, isLoading, sendMessage, cancelRequest, clearMessages } = useChatMessages(selectedAgent);

  // ========= Accordions & UI state =========
  const thinkingAccordion = useAccordionState();
  const sqlQueriesAccordion = useAccordionState();
  const chartsAccordion = useAccordionState();
  const annotationsAccordion = useAccordionState();
  const [inputText, setInputText] = useState('');
  const [starterQuestionsExpanded, setStarterQuestionsExpanded] = useState(true);
  const [manuallyToggledCharts, setManuallyToggledCharts] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // init agent
  useEffect(() => {
    if (agentConfig && !selectedAgent) {
      const visibleAgents = getFilteredVisibleAgents();
      const keys = Object.keys(visibleAgents);
      if (keys.length > 0) {
        const sorted = Object.entries(visibleAgents).sort(([, a], [, b]) =>
          String(a.displayName ?? '').toLowerCase().localeCompare(String(b.displayName ?? '').toLowerCase())
        );
        setSelectedAgent(sorted[0][0]);
      }
    }
  }, [agentConfig, selectedAgent, getFilteredVisibleAgents]);

  // handle agent invisibility
  useEffect(() => {
    if (agentConfig && selectedAgent) {
      const visibleAgents = getFilteredVisibleAgents();
      const keys = Object.keys(visibleAgents);
      if (!keys.includes(selectedAgent) && keys.length > 0) {
        const sorted = Object.entries(visibleAgents).sort(([, a], [, b]) =>
          String(a.displayName ?? '').toLowerCase().localeCompare(String(b.displayName ?? '').toLowerCase())
        );
        setSelectedAgent(sorted[0][0]);
      }
    }
  }, [agentConfig, selectedAgent, getFilteredVisibleAgents]);

  // clear chat on agent change
  useEffect(() => {
    clearMessages();
    setInputText('');
    thinkingAccordion.reset();
    sqlQueriesAccordion.reset();
    chartsAccordion.reset();
    annotationsAccordion.reset();
    setManuallyToggledCharts(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAgent]);

  // auto-scroll
  const scrollToBottom = useCallback(() => { if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' }); }, []);
  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  // ========= Messages for CURRENT MODE =========
  // STRICT: only include messages where m.mode === current mode (no fallback)
  const currentModeMessages = useMemo(() => {
    const modeKey = String(mode).toLowerCase();
    return messages.filter((m: any) => String(m?.mode ?? '').toLowerCase() === modeKey);
  }, [messages, mode]);

  // status mapping
  useEffect(() => {
    currentModeMessages.forEach((m: any) => {
      if (m.sender !== 'assistant' || !Array.isArray(m.timeline)) return;
      m.timeline.forEach((t: any) => {
        if (t.type !== 'tool') return;
        let phaseKey = mapToolToPhaseKey(t.toolName, mode) as PhaseKey | undefined;
        if (!phaseKey) phaseKey = inferPhaseFromToolName(t.toolName, mode);
        if (!phaseKey) return;
        const currentState = (status as StatusByPhase)[phaseKey] ?? 'pending';
        if (t.toolEvent === 'start') {
          if (currentState === 'pending') setPhase(phaseKey, 'running');
        }
        if (t.toolEvent === 'result' || t.toolEvent === 'completed' || t.toolEvent === 'finish') {
          if (currentState !== 'success') setPhase(phaseKey, currentState === 'running' ? 'success' : 'running');
        }
        if (t.toolEvent === 'error' || t.toolEvent === 'failed') {
          if (currentState !== 'error') setPhase(phaseKey, 'error');
        }
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentModeMessages, mode]);

  // streaming heuristics
  useEffect(() => {
    const streaming = currentModeMessages.find((m: any) => m.sender === 'assistant' && m.isStreaming);
    if (!streaming) return;
    if (mode === 'table') {
      if ((status as StatusByPhase)[TABLE_PHASES.SCHEMA] === 'pending') setPhase(TABLE_PHASES.SCHEMA, 'running');
      if (streaming.sqlQueries?.length && (status as StatusByPhase)[TABLE_PHASES.SYNTH] === 'pending') setPhase(TABLE_PHASES.SYNTH, 'running');
      if (containsPatternHint(streaming) && (status as StatusByPhase)[TABLE_PHASES.PATTERN] === 'pending') setPhase(TABLE_PHASES.PATTERN, 'running');
      if (containsAnomalyHint(streaming) && (status as StatusByPhase)[TABLE_PHASES.ANOMALY] === 'pending') setPhase(TABLE_PHASES.ANOMALY, 'running');
    } else {
      if ((status as StatusByPhase)[FILE_PHASES.DISCOVERY] === 'pending') setPhase(FILE_PHASES.DISCOVERY, 'running');
      if (streaming.sqlQueries?.length && (status as StatusByPhase)[FILE_PHASES.SYNTH] === 'pending') setPhase(FILE_PHASES.SYNTH, 'running');
      if (containsPatternHint(streaming) && (status as StatusByPhase)[FILE_PHASES.PATTERN] === 'pending') setPhase(FILE_PHASES.PATTERN, 'running');
      if (containsAnomalyHint(streaming) && (status as StatusByPhase)[FILE_PHASES.ANOMALY] === 'pending') setPhase(FILE_PHASES.ANOMALY, 'running');
    }
  }, [currentModeMessages, mode, setPhase, status]);

  // Dashboard
  const dashboard = useDashboardFromMessages(currentModeMessages);
  const [dashVersion, setDashVersion] = useState(0);
  useEffect(() => {
    const d = dashboard;
    const hasData =
      !!d &&
      (Object.values(d.ruleDistribution ?? {}).some((n) => Number(n ?? 0) > 0) ||
        Object.values(d.ruleOccurrences ?? {}).some((o: any) =>
          Number(o?.rules_defined ?? 0) > 0 ||
          Number(o?.checks_reported ?? 0) > 0 ||
          Number(o?.violations_detected ?? 0) > 0
        )) &&
      (Array.isArray(d.ruleViolationsTable) ? d.ruleViolationsTable : []).length > 0 &&
      Number(d.anomaly?.score ?? 0) > 0;
    if (hasData) setDashVersion((v) => v + 1);
  }, [dashboard]);

  // collapse thinking/sql when response completes
  useEffect(() => {
    currentModeMessages.forEach((message: any) => {
      if (message.sender === 'assistant' && message.status === 'sent' && !message.isStreaming) {
        thinkingAccordion.collapse(message.id);
        sqlQueriesAccordion.collapse(message.id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentModeMessages]);

  // expand charts after final response
  useEffect(() => {
    const timeouts: NodeJS.Timeout[] = [];
    currentModeMessages.forEach((message: any) => {
      if (
        message.sender === 'assistant' &&
        message.charts &&
        message.charts.length > 0 &&
        message.status === 'sent' &&
        !message.isStreaming &&
        message.text &&
        message.text.trim().length > 0 &&
        !manuallyToggledCharts.has(message.id)
      ) {
        const timeoutId = setTimeout(() => { chartsAccordion.expand(message.id); }, 300);
        timeouts.push(timeoutId);
      }
    });
    return () => { timeouts.forEach((tid) => clearTimeout(tid)); };
  }, [currentModeMessages, manuallyToggledCharts, chartsAccordion]);

  // submit handlers
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) {
      cancelRequest();
    } else if (inputText.trim()) {
      setStarterQuestionsExpanded(false);
      sendMessage(inputText.trim(), { mode });
      setInputText('');
    }
  }, [inputText, sendMessage, isLoading, cancelRequest, mode]);

  const handleStarterQuestionClick = useCallback((question: string) => {
    if (question.trim()) {
      setStarterQuestionsExpanded(false);
      sendMessage(question, { mode });
    }
  }, [sendMessage, mode]);

  const handleResendMessage = useCallback((text: string) => {
    if (text.trim()) {
      setStarterQuestionsExpanded(false);
      sendMessage(text, { mode });
    }
  }, [sendMessage, mode]);

  const handleAgentChange = useCallback((agent: string) => {
    setSelectedAgent(agent);
    setInputText('');
    setStarterQuestionsExpanded(true);
  }, []);

  const handleNewChat = useCallback(() => {
    clearMessages();
    setInputText('');
    thinkingAccordion.reset();
    sqlQueriesAccordion.reset();
    chartsAccordion.reset();
    annotationsAccordion.reset();
    setManuallyToggledCharts(new Set());
    setStarterQuestionsExpanded(true);
    refreshAgents();
    reset();
  }, [clearMessages, thinkingAccordion, sqlQueriesAccordion, chartsAccordion, annotationsAccordion, refreshAgents, reset]);

  const handleChartToggle = useCallback((messageId: string) => {
    setManuallyToggledCharts((prev) => {
      const newSet = new Set(prev);
      newSet.add(messageId);
      return newSet;
    });
    chartsAccordion.toggle(messageId);
  }, [chartsAccordion]);

  const visibleMessages = useMemo(() => {
    return currentModeMessages.filter((message: any) => {
      const willShowThinking =
        message.sender === 'assistant' &&
        ((message.thinkingTexts && message.thinkingTexts.length > 0 && message.thinkingTexts.some((text: string) => text.trim().length > 0)) ||
         (message.sqlQueries && message.sqlQueries.length > 0));
      const willShowText = message.text && message.text.trim().length > 0;
      const willShowStatus = message.status === 'thinking' && message.isStreaming &&
        ((message.thinkingTexts && message.thinkingTexts.length > 0) ||
         (message.sqlQueries && message.sqlQueries.length > 0) ||
         (message.text && message.text.trim().length > 0));
      const willShowError = message.status === 'error' && message.error && message.error.trim().length > 0;
      return willShowThinking || willShowText || willShowStatus || willShowError;
    });
  }, [currentModeMessages]);

  const displayStatus: AgentStatusMap = useMemo(() => {
    const order = mode === 'file' ? FILE_ORDER : TABLE_ORDER;
    const out: AgentStatusMap = {};
    for (const key of order) {
      const label = LABELS[key];
      const phaseStatus = (status as StatusByPhase)[key] ?? 'pending';
      out[label] = phaseStatus;
    }
    return out;
  }, [status, mode]);

  const dashboardReady = isDashboardReady(dashboard);
  const allDone = isExecutionComplete(status as StatusByPhase, mode, false);

  const gridShell = (content: React.ReactNode, footer: React.ReactNode) => (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', display: 'flex' }}>
      {/* Left status sidebar */}
      <StatusSidebar title={mode === 'table' ? 'Table Agents' : 'File Agents'} status={displayStatus} />
      {/* Right: 3-row layout */}
      <Box flex={1} ml={SIDEBAR_WIDTH_SPACING_UNITS} sx={{ display: 'grid', gridTemplateRows: 'auto 1fr auto', minHeight: '100vh' }}>
        {/* HEADER */}
        <Box sx={{ position: 'sticky', top: 0, zIndex: 10, bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'start', gap: 2, px: { xs: 2, md: 3 }, py: { xs: 1, md: 1.5 } }}>
            <BrandBlock compact />
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
              <Button component={RouterLink} to="/" variant="text" color="primary" startIcon={<ArrowBackIcon />} sx={{ fontWeight: 600 }}>
                Back to Home
              </Button>
              {/* Toggle navigates between /dq/<runMode>/table and /dq/<runMode>/file */}
              <CompactControls mode={mode} runMode={runMode as 'hil' | 'autonomous'} />
            </Box>
          </Box>
        </Box>

        {/* main content */}
        <Box component="main" sx={{ overflowY: 'auto', px: { xs: 2, md: 3 }, py: { xs: 2, md: 3 } }}>{content}</Box>

        {/* sticky footer */}
        <Box component="footer" sx={{
          position: 'sticky', bottom: 0, zIndex: 11, borderTop: '1px solid', borderColor: 'divider',
          bgcolor: 'background.paper', px: { xs: 2, md: 3 }, py: { xs: 1.5, md: 2 }
        }}>
          <Box sx={{ maxWidth: 1200, mx: 'auto' }}>{footer}</Box>
        </Box>
      </Box>
    </Box>
  );

  // Loading / Error / No Agents
  if (configLoading) {
    return gridShell(
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 80px)' }}>
        <Stack spacing={2} alignItems="center">
          <CircularProgress size={40} />
          <Typography variant="body1" color="text.secondary">{STATUS_TEXT.LOADING_CONFIG}</Typography>
        </Stack>
      </Box>,
      <ChatInput
        inputText={inputText} onInputChange={setInputText} onSubmit={handleSubmit}
        isLoading={isLoading} selectedAgent={selectedAgent} agents={getFilteredVisibleAgents()}
        onAgentChange={handleAgentChange} onNewChat={handleNewChat} leftLabel={dqLeftLabel}
      />
    );
  }

  if (configError || !agentConfig) {
    return gridShell(
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 80px)' }}>
        <Stack spacing={3} alignItems="center" sx={{ px: 3, width: { xs: '100%', sm: '98%' }, maxWidth: 1200 }}>
          <Box sx={{
            mt: 2, py: 1.5, px: 2, backgroundColor: alpha('#ffc107', 0.08),
            border: `1px solid ${alpha('#ffc107', 0.3)}`, borderRadius: 1.5, borderLeft: `4px solid ${alpha('#ffc107', 0.7)}`
          }}>
            <Typography sx={{
              fontSize: { xs: '1.1rem', sm: '1.3rem', md: '1.5rem' }, fontWeight: 700,
              color: theme.palette.mode === 'dark' ? '#fff' : '#000', textAlign: 'center'
            }}>
              {configError ?? 'An error occurred'}
            </Typography>
          </Box>
        </Stack>
      </Box>,
      <ChatInput
        inputText={inputText} onInputChange={setInputText} onSubmit={handleSubmit}
        isLoading={isLoading} selectedAgent={selectedAgent} agents={getFilteredVisibleAgents()}
        onAgentChange={handleAgentChange} onNewChat={handleNewChat} leftLabel={dqLeftLabel}
      />
    );
  }

  const visibleAgents = getFilteredVisibleAgents();
  const hasNoAgents = Object.keys(visibleAgents).length === 0;
  if (hasNoAgents) {
    return gridShell(
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 80px)' }}>
        <Stack spacing={3} alignItems="center" maxWidth={600} sx={{ px: 3 }}>
          <Typography variant="h5" color="text.primary" fontWeight={600}>{ERROR_TEXT.NO_AGENTS_TITLE}</Typography>
          <Typography variant="body1" color="text.secondary" textAlign="center">{ERROR_TEXT.NO_AGENTS_MESSAGE}</Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center">{ERROR_TEXT.NO_AGENTS_HELP}</Typography>
          <Button variant="contained" onClick={refreshAgents} size="large" sx={{ mt: 2 }}>{ERROR_TEXT.REFRESH_AGENTS}</Button>
        </Stack>
      </Box>,
      <ChatInput
        inputText={inputText} onInputChange={setInputText} onSubmit={handleSubmit}
        isLoading={isLoading} selectedAgent={selectedAgent} agents={getFilteredVisibleAgents()}
        onAgentChange={handleAgentChange} onNewChat={handleNewChat} leftLabel={dqLeftLabel}
      />
    );
  }

  // normal render
  return gridShell(
    <Container maxWidth="lg" sx={{ display: 'flex', flexDirection: 'column', py: 3, pb: 2 }}>
      {/* Starter questions (if any) */}
      {(() => {
        const currentAgentQuestions = agentConfig?.agents?.[selectedAgent]?.starterQuestions ?? [];
        const currentAgentName = agentConfig?.agents?.[selectedAgent]?.displayName ?? selectedAgent;
        return currentAgentQuestions.length > 0 ? (
          <Box sx={{ width: '100%', mb: 3 }}>
            <StarterQuestions
              expanded={starterQuestionsExpanded}
              onToggle={setStarterQuestionsExpanded}
              agentName={currentAgentName}
              questions={currentAgentQuestions}
              onQuestionClick={handleStarterQuestionClick}
            />
          </Box>
        ) : null;
      })()}

      {/* Messages */}
      <Stack spacing={3}>
        {visibleMessages.length === 0 ? (
          <EmptyState />
        ) : (
          visibleMessages.map((message: any) => (
            <ChatMessage
              key={message.id}
              message={message}
              collapsedThinking={thinkingAccordion.isCollapsed(message.id)}
              collapsedSqlQueries={sqlQueriesAccordion.isCollapsed(message.id)}
              collapsedCharts={chartsAccordion.isCollapsed(message.id)}
              collapsedAnnotations={annotationsAccordion.isCollapsed(message.id)}
              onToggleThinking={thinkingAccordion.toggle}
              onToggleSqlQueries={sqlQueriesAccordion.toggle}
              onToggleCharts={handleChartToggle}
              onToggleAnnotations={annotationsAccordion.toggle}
              onResendMessage={handleResendMessage}
            />
          ))
        )}
      </Stack>
      <div ref={messagesEndRef} />

      {/* Dashboard after execution complete & data ready */}
      {isExecutionComplete(status as StatusByPhase, mode, false) && isDashboardReady(dashboard) ? (
        <Box sx={{ mt: 3 }}>
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>Data Quality Dashboard</Typography>
            <Typography variant="body2" color="text.secondary">
              Side-by-side: Anomaly Gauge & Rule Quality Distribution • Averages • Insights & Violations
            </Typography>
          </Paper>
          <Dashboard key={dashVersion} dashboard={dashboard} />
        </Box>
      ) : null}
    </Container>,
    // Sticky footer
    <ChatInput
      inputText={inputText} onInputChange={setInputText} onSubmit={handleSubmit}
      isLoading={isLoading} selectedAgent={selectedAgent} agents={visibleAgents}
      onAgentChange={handleAgentChange} onNewChat={handleNewChat} leftLabel={dqLeftLabel}
    />
  );
};

/** Home Page */
const HomePage: React.FC = () => {
  const theme = useTheme();
  const getGreeting = (d: Date) => {
    const hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }).format(d));
    if (hour >= 5 && hour < 12) return 'Good Morning';
    if (hour >= 12 && hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };
  const formatDateLine = (d: Date) => {
    const datePart = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(d);
    const timePart = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }).format(d);
    return `${datePart} • ${timePart}`;
  };
  const now = new Date(); const greeting = getGreeting(now); const formatted = formatDateLine(now);
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', display: 'flex', alignItems: 'center', justifyContent: 'center', px: { xs: 2, md: 4 }, py: { xs: 4, md: 6 } }}>
      <Container maxWidth="md">
        <Stack spacing={3} alignItems="center" textAlign="center">
          <Box>
            <Typography variant="h2" sx={{ fontWeight: 900, color: theme.palette.mode === 'dark' ? '#9c5bf5' : '#7E57C2', letterSpacing: 0.2 }}>
              {`Hello, ${greeting}!`}
            </Typography>
            <Typography variant="h6" color="text.secondary" sx={{ mt: 1 }}>{formatted}</Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 2 }}>
            <Button component={RouterLink} to="/dq/hil/table" size="large" variant="contained" color="primary" sx={{ py: 1.5, px: 3, fontWeight: 700 }}>
              Data Quality—Human in Loop
            </Button>
            <Button component={RouterLink} to="/dq/autonomous/table" size="large" variant="outlined" color="primary"
              sx={{ py: 1.5, px: 3, fontWeight: 700, borderWidth: 2, '&:hover': { borderWidth: 2 } }}>
              Data Quality—Autonomous
            </Button>
            {/* Removed: "Table Mode Page" & "File Mode Page" buttons */}
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
};

/** Routes: only HIL and Autonomous, each with :mode child (table/file) and default redirect to table */
const AppRoutes: React.FC = () => {
  const element = useRoutes([
    { path: '/', element: <HomePage /> },

    // Human-in-Loop (default -> table)
    {
      path: '/dq/hil',
      children: [
        { index: true, element: <Navigate to="/dq/hil/table" replace /> },
        { path: ':mode', element: <SimpleChatInterface runMode="hil" /> }, // /dq/hil/table or /dq/hil/file
      ],
    },

    // Autonomous (default -> table)
    {
      path: '/dq/autonomous',
      children: [
        { index: true, element: <Navigate to="/dq/autonomous/table" replace /> },
        { path: ':mode', element: <SimpleChatInterface runMode="autonomous" /> }, // /dq/autonomous/table or /dq/autonomous/file
      ],
    },

    // Fallback
    { path: '*', element: <HomePage /> },
  ]);
  return element;
};

const App: React.FC = () => (
  <BrowserRouter>
    <AppRoutes />
  </BrowserRouter>
);

export default App;
