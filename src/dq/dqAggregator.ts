// // src/dq/dqAggregator.ts
// import type { ChatMessage } from '../types/chat';
// import type {
//   ToolResultPayload,
//   SynthesiserResult,
//   DataInspectorResult,
//   AnomalyResult,
//   DQDimension,
// } from '../types/dqToolResults';

// export type DimensionKey = DQDimension;

// export interface DashboardState {
//   dimensionScores: Record<DimensionKey, number>;
//   ruleDistribution: Record<DimensionKey, number>;
//   ruleOccurrences: Record<
//     DimensionKey,
//     { rules_defined: number; checks_reported: number; violations_detected: number }
//   >;
//   anomaly:
//     | {
//         score: number;
//         severity: 'low' | 'moderate' | 'high' | 'critical';
//         contributors: string[];
//         metrics?: { perColumnPositive?: Record<string, number>; [k: string]: any };
//         notes?: string[];
//       }
//     | null;
//   anomalyInsights: { top_contributors: string[]; notes: string[] };
//   ruleViolationsTable: Array<{
//     rule_id: string;
//     dimension: string;
//     description?: string;
//     violations: number;
//     last_seen?: string;
//   }>;
// }

// /* --------------------------- helpers --------------------------- */
// const DIMS: DimensionKey[] = ['uniqueness', 'validity', 'completeness', 'consistency', 'accuracy'];

// const objFromDims = <T,>(v: T) =>
//   Object.fromEntries(DIMS.map((d) => [d, v])) as Record<DimensionKey, T>;

// const clamp01 = (x: number) => Math.max(0, Math.min(1, x ?? 0));

// const toNum = (v: any) => {
//   if (v === null || v === undefined) return undefined;
//   const n = typeof v === 'string' ? Number(v) : v;
//   return Number.isFinite(n) ? n : undefined;
// };

// const DIM_MAP: Record<string, DQDimension> = {
//   uniqueness: 'uniqueness',
//   unique: 'uniqueness',
//   validity: 'validity',
//   valid: 'validity',
//   completeness: 'completeness',
//   complete: 'completeness',
//   consistency: 'consistency',
//   consistent: 'consistency',
//   accuracy: 'accuracy',
//   accurate: 'accuracy',
// };

// function normDim(s: any): DQDimension {
//   const k = String(s ?? '').toLowerCase().trim();
//   return (DIM_MAP[k] ?? 'accuracy') as DQDimension;
// }

// function prettyDim(d: DQDimension) {
//   return d[0].toUpperCase() + d.slice(1);
// }

// function severityOf(score: number): 'low' | 'moderate' | 'high' | 'critical' {
//   return score >= 0.85 ? 'critical' : score >= 0.65 ? 'high' : score >= 0.35 ? 'moderate' : 'low';
// }

// // parse JSON, also support fenced ```json blocks (returns original value if not JSON)
// function tryParse(value: any): any {
//   if (typeof value !== 'string') return value;
//   const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
//   const s = fenced ? fenced[1] : value;
//   try {
//     return JSON.parse(s);
//   } catch {
//     return value;
//   }
// }

// // Strict variant: returns undefined on failure (used for text-first ingestion)
// function tryParseFromText(value: any): any | undefined {
//   if (typeof value !== 'string') return undefined;
//   const m = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
//   const s = m ? m[1] : value;
//   try {
//     return JSON.parse(s);
//   } catch {
//     return undefined;
//   }
// }

// // Parse an entry inside content[] like: { json: { result: "<json-string>" }, type: "json" } or plain obj/string
// function parseContentEntry(entry: any): any | undefined {
//   try {
//     if (entry?.json) {
//       const j = entry.json;
//       if (typeof j?.result === 'string') return JSON.parse(j.result);
//       if (typeof j === 'object') return j;
//     }
//     if (typeof entry === 'string') return JSON.parse(entry);
//     if (entry && typeof entry === 'object') return entry;
//     return undefined;
//   } catch {
//     return undefined;
//   }
// }

// function dimFromRuleType(typeText?: string): DQDimension | undefined {
//   if (!typeText) return undefined;
//   return normDim(typeText);
// }

// function firstDimFromApplied(applied?: string): DQDimension | undefined {
//   if (!applied) return undefined;
//   const first = applied.split(',')[0]?.trim();
//   return first ? normDim(first) : undefined;
// }

// // Deterministic key so violations aggregate stably across runs when rule_id is missing
// function stableRuleKey(v: any): string {
//   const dim = String(v?.dimension ?? '').toLowerCase();
//   const desc = String(v?.description ?? v?.title ?? v?.text ?? v?.column ?? '').trim();
//   const expr = String(v?.expression ?? '').trim();
//   const key = [dim, desc, expr].filter(Boolean).join('\n');
//   // Fallback only when every part is empty
//   return key || Math.random().toString(36).slice(2);
// }

// /* ----------- recognizers for anomaly arrays ----------- */
// type RawAnomalyItem = {
//   anomaly_count?: number; // count (rows)
//   anomaly_pct?: number | string; // e.g., 12.5 or "12.5%"
//   anomaly_percentage?: number | string;
//   total_rows?: number; // denominator when available
//   anomaly_type?: string;
//   column?: string;
//   confidence_score?: number; // 0..1 anomaly likelihood
//   sql_fix?: string;
//   suggested_remediation?: string;
//   [k: string]: any;
// };

// function isAnomalyArrayShape(obj: any): obj is RawAnomalyItem[] {
//   return (
//     Array.isArray(obj) &&
//     obj.some(
//       (it) =>
//         typeof it === 'object' &&
//         ('anomaly_count' in it ||
//           'confidence_score' in it ||
//           'anomaly_type' in it ||
//           'anomaly_pct' in it),
//     )
//   );
// }

// // Map provider anomaly types to our DQ dimensions
// function inferDimFromAnomalyType(t?: string): DQDimension {
//   const s = String(t ?? '').toLowerCase();
//   if (/duplicate|dup/i.test(s)) return 'uniqueness';
//   if (/null|missing|empty/i.test(s)) return 'completeness';
//   if (/format|regex|pattern|type/i.test(s)) return 'validity';
//   if (/inconsisten|mismatch|drift/i.test(s)) return 'consistency';
//   return 'accuracy';
// }

// // Parse percent strings like "15%" → 0.15 (numbers remain as-is)
// function toNumPercent(v: any): number | undefined {
//   if (v === null || v === undefined) return undefined;
//   if (typeof v === 'string') {
//     const s = v.trim();
//     if (s.endsWith('%')) {
//       const n = Number(s.slice(0, -1));
//       return Number.isFinite(n) ? clamp01(n / 100) : undefined;
//     }
//     const n = Number(s);
//     return Number.isFinite(n) ? n : undefined;
//   }
//   if (typeof v === 'number') return v;
//   return undefined;
// }

// // Strict category → DQ dimension (only when it matches known labels)
// function strictDimFromCategory(cat?: any): DQDimension | undefined {
//   const k = String(cat ?? '').toLowerCase().trim();
//   const m = DIM_MAP[k];
//   return m && DIMS.includes(m) ? m : undefined; // no default to 'accuracy'
// }

// // Case-insensitive + whitespace-insensitive key getter
// function pickCaseInsensitive(obj: any, canonicalNames: string[]): any {
//   if (!obj || typeof obj !== 'object') return undefined;
//   // normalize candidate names like "Rule Applied" -> "rule_applied"
//   const wanted = new Set(
//     canonicalNames.map((n) => n.toLowerCase().replace(/\s+/g, '_').trim()),
//   );
//   for (const [key, val] of Object.entries(obj)) {
//     const lc = key.toLowerCase().replace(/\s+/g, '_').trim();
//     if (wanted.has(lc)) return val;
//   }
//   return undefined;
// }

// // Build anomaly payload + derived violations from the array items
// function buildAnomalyFromItems(items: RawAnomalyItem[]) {
//   const contributors = Array.from(new Set(items.map((it) => it.column).filter(Boolean))) as string[];
//   const notes = Array.from(
//     new Set([
//       ...items.map((it) => it.anomaly_type).filter(Boolean),
//       ...items.map((it) => it.suggested_remediation).filter(Boolean),
//     ]),
//   ) as string[];

//   // Derive per-column anomaly ratio (0..1), then positive = 1 - anomaly
//   const byCol: Record<string, { anomaly: number }> = {};
//   const maxCount = items.reduce((m, it) => Math.max(m, toNum(it.anomaly_count) ?? 0), 0);
//   for (const it of items) {
//     const col = String(it.column ?? '').trim();
//     if (!col) continue;

//     // Preferred anomaly ratio sources:
//     const pct =
//       toNumPercent(it.anomaly_pct) ??
//       toNumPercent(it.anomaly_percentage);
//     const conf = toNum(it.confidence_score); // 0..1 anomaly likelihood
//     const count = toNum(it.anomaly_count);
//     const total = toNum(it.total_rows);

//     let anomalyRatio: number | undefined =
//       pct !== undefined
//         ? clamp01(pct)
//         : conf !== undefined
//         ? clamp01(conf)
//         : count !== undefined && total !== undefined && total > 0
//         ? clamp01(count / total)
//         : count !== undefined && maxCount > 0
//         ? clamp01(count / maxCount)
//         : undefined;

//     if (anomalyRatio === undefined) anomalyRatio = 0; // if unknown, treat as no anomaly
//     byCol[col] = { anomaly: anomalyRatio };
//   }

//   // Overall anomaly score: max of available ratios (conservative)
//   const overallAnomaly = Object.values(byCol).reduce((m, v) => Math.max(m, clamp01(v.anomaly)), 0);
//   const score = clamp01(overallAnomaly);

//   const derivedViolations = items.map((it) => {
//     const dim = inferDimFromAnomalyType(it.anomaly_type);
//     const count = toNum(it.anomaly_count) ?? 0;
//     const desc = `${it.anomaly_type ?? 'Anomaly'}${it.column ? ` on ${it.column}` : ''}`;
//     return {
//       rule_id: stableRuleKey({ dimension: dim, description: desc, expression: it.sql_fix }),
//       dimension: dim,
//       description: desc,
//       count,
//       last_seen: undefined as string | undefined,
//       examples: undefined as any,
//     };
//   });

//   // per-column positive% = 1 - anomalyRatio
//   const perColumnPositive = Object.fromEntries(
//     Object.entries(byCol).map(([col, v]) => [col, +(clamp01(1 - v.anomaly)).toFixed(4)]),
//   );

//   return { score, contributors, notes, derivedViolations, perColumnPositive };
// }

// /* ---------------------- payload recognition ---------------------- */
// function inferToolNameFromObj(obj: any): string | undefined {
//   if (!obj || typeof obj !== 'object') return undefined;

//   if (
//     'rules' in obj ||
//     'generated_rules' in obj ||
//     'ruleset' in obj ||
//     'dq_rules' in obj ||
//     'business_rules' in obj ||
//     'items' in obj
//   )
//     return 'SYNTHESISER_AGENT_HIL';

//   if (
//     'checks' in obj ||
//     'dq_result' in obj ||
//     'results' in obj ||
//     'violations' in obj ||
//     'errors' in obj ||
//     'failures' in obj
//   )
//     return 'DATA_INSPECTOR_HIL';

//   if (
//     'anomaly_score' in obj ||
//     'anomalyScore' in obj ||
//     'likelihood' in obj ||
//     'score' in obj ||
//     'risk' in obj
//   )
//     return 'ANOMALY_AGENT_HIL';

//   if ('patterns' in obj || 'detected_patterns' in obj || 'regexes' in obj)
//     return 'PATTERN_AGENT_HIL';

//   if ('exec_id' in obj || 'executionId' in obj || 'run_id' in obj)
//     return 'TRACEABILITY_AGENT_HIL';

//   const nested =
//     (obj as any).result ??
//     (obj as any).output ??
//     (obj as any).data ??
//     (obj as any).payload ??
//     (obj as any).content;

//   if (nested && typeof nested === 'object') return inferToolNameFromObj(nested);
//   return undefined;
// }

// /** Coerce alternates to canonical form (TS-safe), and handle anomaly arrays + numeric-indexed entries */
// function coerceDQFields(obj: any): any {
//   if (!obj || typeof obj !== 'object') return obj;

//   // If the entire object is the anomaly array, produce a NEW anomaly object
//   if (isAnomalyArrayShape(obj)) {
//     const built = buildAnomalyFromItems(obj as RawAnomalyItem[]);
//     return {
//       anomaly_score: built.score,
//       contributors: built.contributors,
//       notes: built.notes,
//       _derived_violations: built.derivedViolations,
//       metrics: { ...(obj as any).metrics, perColumnPositive: built.perColumnPositive },
//     };
//   }

//   // Else flatten common wrappers
//   const core =
//     (obj as any).result ??
//     (obj as any).output ??
//     (obj as any).data ??
//     (obj as any).payload ??
//     (obj as any).content ??
//     obj;

//   const out: any = { ...core };

//   // ---- fold numeric-indexed entries ("0","1","2",...) into arrays we can recognize ----
//   try {
//     const numericKeys = Object.keys(out).filter((k) => /^\d+$/.test(k));
//     if (numericKeys.length) {
//       const entries = numericKeys
//         .map((k) => out[k])
//         .filter((v) => v !== undefined && v !== null)
//         .map((v) => {
//           if (typeof v === 'string') return tryParse(v);
//           if (v?.json && typeof v.json?.result === 'string') {
//             try {
//               return JSON.parse(v.json.result);
//             } catch {
//               return v;
//             }
//           }
//           return v;
//         });

//       // (A) Anomaly array → build anomaly payload + derived violations
//       if (isAnomalyArrayShape(entries)) {
//         const built = buildAnomalyFromItems(entries as RawAnomalyItem[]);
//         out.anomaly_score = built.score;
//         out.contributors = built.contributors;
//         out.notes = built.notes;
//         out._derived_violations = built.derivedViolations;
//         out.metrics = { ...(out.metrics ?? {}), perColumnPositive: built.perColumnPositive };
//       }

//       // (B) If rules absent but entries look like rules → collect
//       if (!out.rules) {
//         const ruleLike = entries.flatMap((it: any) => {
//           if (Array.isArray(it?.rules)) return it.rules;
//           const looksRule = it && (it.rule_id || it.description || it.expression);
//           return looksRule ? [it] : [];
//         });
//         if (ruleLike.length) out.rules = ruleLike;
//       }

//       // (C) If checks absent but entries look like checks → collect
//       if (!out.checks) {
//         const checkLike = entries.flatMap((it: any) => {
//           if (Array.isArray(it?.checks)) return it.checks;
//           const looksCheck =
//             typeof it?.latest_score !== 'undefined' ||
//             typeof it?.failed_rows !== 'undefined' ||
//             typeof it?.evaluated_rows !== 'undefined';
//           return looksCheck ? [it] : [];
//         });
//         if (checkLike.length) out.checks = checkLike;
//       }

//       // remove numeric keys to avoid confusion downstream
//       numericKeys.forEach((k) => {
//         try {
//           delete out[k];
//         } catch {}
//       });
//     }
//   } catch {}

//   // merge JSON string at key "0" when present (legacy providers)
//   try {
//     const z = out['0'] ?? out[0];
//     if (typeof z === 'string') {
//       const zParsed = tryParse(z);
//       if (zParsed && typeof zParsed === 'object') {
//         for (const [k, v] of Object.entries(zParsed)) {
//           if (typeof (out as any)[k] === 'undefined') (out as any)[k] = v;
//         }
//       }
//     }
//   } catch {}

//   // Synthesiser rules aliases
//   out.rules =
//     out.rules ??
//     out.generated_rules ??
//     out.ruleset ??
//     out.dq_rules ??
//     out.business_rules ??
//     (Array.isArray(out.items) ? out.items : out.rules);

//   // Inspector checks aliases (column-wise table → dq_result)
//   out.checks =
//     out.checks ??
//     out.dq_result ??
//     (Array.isArray(out.results) ? out.results : []) ??
//     out.metrics?.checks ??
//     out.checkResults;

//   // Inspector violations array (if present)
//   const vArr = out.violations ?? out.errors ?? out.failures;
//   if (Array.isArray(vArr)) out.violations = vArr;

//   // Anomaly numeric fields
//   out.anomaly_score =
//     toNum(out.anomaly_score) ??
//     toNum(out.anomalyScore) ??
//     toNum(out.likelihood) ??
//     toNum(out.score) ??
//     toNum(out.risk) ??
//     toNum(out.metrics?.anomaly_score) ??
//     out.anomaly;

//   // Patterns / Traceability
//   out.patterns = out.patterns ?? out.detected_patterns ?? out.regexes;
//   out.exec_id = out.exec_id ?? out.executionId ?? out.run_id ?? out.execId ?? out.runId;

//   return out;
// }

// function normalizePayload(p: any, explicitTool?: string): ToolResultPayload | undefined {
//   if (!p) return undefined;
//   const coerced = coerceDQFields(tryParse(p));
//   if (coerced && typeof coerced === 'object' && !(coerced as any).tool) {
//     (coerced as any).tool = explicitTool ?? inferToolNameFromObj(coerced) ?? 'UNKNOWN_TOOL';
//   }
//   return coerced;
// }

// /**
//  * CONTENT-FIRST extractor:
//  * - assistant.text (fenced/plain JSON)
//  * - response.text (fenced/plain JSON)
//  * - MERGED content from:
//  *   response.content[], timeline[].content[] AND timeline[].payload/result/data/output .content[],
//  *   response.events[].content[]
//  */
// function extractPayloadsFromMessage(msg: any): ToolResultPayload[] {
//   const out: any[] = [];
//   const push = (value: any, path: string, toolHint?: string) => {
//     if (!value) return;
//     const arr = Array.isArray(value) ? value : [value];
//     for (const item of arr) {
//       const normalized = normalizePayload(item, toolHint);
//       if (!normalized) continue;

//       const hasRules = !!(normalized as any).rules;
//       const hasChecks =
//         !!(normalized as any).checks ||
//         !!(normalized as any).dq_result ||
//         !!(normalized as any).results;
//       const hasAnom = typeof (normalized as any).anomaly_score !== 'undefined';

//       const pick = (obj: any, fields: string[]) => {
//         const o: any = {};
//         for (const f of fields) if (typeof (obj as any)[f] !== 'undefined') o[f] = (obj as any)[f];
//         return o;
//       };

//       let emitted = 0;

//       if (hasRules) {
//         const rOnly = pick(normalized, [
//           'rules',
//           'generated_rules',
//           'ruleset',
//           'dq_rules',
//           'business_rules',
//           'items',
//           'tool',
//         ]);
//         rOnly.tool = 'SYNTHESISER_AGENT_HIL';
//         out.push(rOnly);
//         emitted++;
//       }

//       if (hasChecks) {
//         const cOnly = pick(normalized, [
//           'checks',
//           'dq_result',
//           'results',
//           'violations',
//           'errors',
//           'failures',
//           'metrics',
//           'tool',
//           '_derived_violations',
//         ]);
//         cOnly.tool = 'DATA_INSPECTOR_HIL';
//         out.push(cOnly);
//         emitted++;
//       }

//       if (hasAnom) {
//         const aOnly = pick(normalized, [
//           'anomaly_score',
//           'severity',
//           'contributors',
//           'metrics',
//           'notes',
//           'tool',
//           '_derived_violations',
//         ]);
//         aOnly.tool = 'ANOMALY_AGENT_HIL';
//         out.push(aOnly);
//         emitted++;
//       }

//       if (!emitted) out.push(normalized);

//       if (typeof window !== 'undefined' && (window as any).DQ_DEBUG) {
//         console.log(
//           `[DQ] extracted payload from ${path}: ` +
//             JSON.stringify(
//               { tool: (normalized as any).tool, keys: Object.keys(normalized as any), emittedRecords: emitted || 1 },
//               null,
//               2,
//             ),
//         );
//       }
//     }
//   };

//   // assistant & response text
//   const textParsed =
//     tryParseFromText(msg?.text) ??
//     (typeof msg?.text === 'string' ? tryParseFromText(msg.text) : undefined);
//   if (textParsed) push(textParsed, 'assistant.text');

//   const respTextParsed =
//     tryParseFromText(msg?.response?.text) ??
//     (typeof msg?.response?.text === 'string' ? tryParseFromText(msg.response.text) : undefined);
//   if (respTextParsed) push(respTextParsed, 'response.text');

//   // merge content-like payloads
//   const contentLike: any[] = [];
//   if (Array.isArray(msg?.response?.content)) contentLike.push(...msg.response.content);
//   if (Array.isArray(msg?.timeline)) {
//     for (const t of msg.timeline) {
//       if (t?.type === 'tool' || /tool/i.test(String(t?.type))) {
//         const tt = t as any;
//         if (Array.isArray(tt?.content)) contentLike.push(...tt.content);
//         else if (tt?.content) contentLike.push(tt.content);

//         const containers = [tt?.payload, tt?.result, tt?.data, tt?.output].filter(Boolean);
//         for (const box of containers) {
//           if (Array.isArray(box?.content)) contentLike.push(...box.content);
//           else if (box?.content) contentLike.push(box.content);
//           else if (box) contentLike.push(box);
//         }
//       }
//     }
//   }
//   if (Array.isArray(msg?.response?.events)) {
//     for (const e of msg.response.events) {
//       const ce = (e as any)?.content;
//       if (Array.isArray(ce)) contentLike.push(...ce);
//       else if (ce) contentLike.push(ce);
//     }
//   }

//   const parsedContent: any[] = [];
//   for (const part of contentLike) {
//     const parsed = parseContentEntry(part);
//     if (parsed) parsedContent.push(parsed);
//   }
//   if (parsedContent.length) push(parsedContent, 'content:merged');

//   const payloads = out as ToolResultPayload[];
//   if (typeof window !== 'undefined' && (window as any).DQ_DEBUG) {
//     console.log('[DQ][Agg] total extracted payloads for msg', msg?.id, '=>', payloads.length);
//   }
//   return payloads;
// }

// /* -------- NEW helpers for Data Inspector -------- */

// // Split “Rule Applied” strings/arrays into normalized DQ dimensions
// function splitAppliedDims(applied: any): DQDimension[] {
//   if (!applied) return [];
//   const rawList: string[] = Array.isArray(applied)
//     ? applied.map(String)
//     : String(applied)
//         .split(/[\n,]/) // handle "Completeness, Uniqueness" and newline-separated entries
//         .map((s) => s.trim())
//         .filter(Boolean);

//   const dims = rawList.map(normDim).filter((d) => DIMS.includes(d));
//   return Array.from(new Set(dims)); // de-duplicate
// }

// /* -------------------------- Normalizers -------------------------- */
// function deriveViolationsFromChecks(
//   checks: any[],
// ): Array<{ rule_id: string; dimension: DQDimension; description?: string; count: number; last_seen?: string }> {
//   const out: any[] = [];
//   for (const c of checks ?? []) {
//     const count =
//       toNum(c?.count) ??
//       toNum(c?.violations) ??
//       toNum(c?.failures) ??
//       toNum(c?.errors) ??
//       toNum(c?.failed_rows) ??
//       toNum(c?.violations_count) ??
//       toNum(c?.violations_cnt) ??
//       0;

//     if (count && count > 0) {
//       const dim =
//         normDim(c?.dimension ?? c?.dim ?? c?.category) ??
//         firstDimFromApplied(c?.rule_types_applied) ??
//         'accuracy';

//       const v = {
//         rule_id:
//           c?.rule_id ??
//           c?.id ??
//           c?.name ??
//           c?.column ??
//           stableRuleKey({
//             dimension: dim,
//             description: c?.description ?? c?.title ?? c?.text ?? (c?.column ? `Column ${c.column}` : ''),
//           }),
//         dimension: dim,
//         description: c?.description ?? c?.title ?? c?.text ?? (c?.column ? `Column ${c.column}` : undefined),
//         count,
//         last_seen: c?.last_seen ?? c?.checked_at ?? c?.at ?? c?.time ?? c?.timestamp,
//       };
//       out.push(v);
//     }
//   }
//   return out;
// }

// function normalizeSynthesiser(raw: any): SynthesiserResult {
//   const r0 = raw.result ?? raw;
//   const rulesSrc =
//     r0.rules ??
//     r0.generated_rules ??
//     r0.ruleset ??
//     r0.dq_rules ??
//     r0.business_rules ??
//     (Array.isArray(r0.items) ? r0.items : []);

//   const rules = rulesSrc
//     .map((r: any) => {
//       // only accept dimension from CATEGORY (strict), else skip
//       const dimCat = strictDimFromCategory(r.category);
//       if (!dimCat) return null; // prevents phantom 'Accuracy'
//       return {
//         rule_id: r.rule_id ?? r.id ?? r.name ?? stableRuleKey(r),
//         dimension: dimCat,
//         description: r.description ?? r.title ?? r.text ?? '',
//         expression: r.expression ?? r.sql ?? r.rule ?? r.query ?? undefined,
//         confidence: toNum(r.confidence ?? r.score ?? r.weight),
//         created_at: r.created_at ?? r.time ?? r.timestamp,
//       };
//     })
//     .filter(Boolean) as SynthesiserResult['rules'];

//   return { tool: raw.tool ?? 'SYNTHESISER_AGENT_HIL', rules };
// }

// /**
//  * PATCHED: strict dimension resolution for Data Inspector rows.
//  * We DO NOT default to 'accuracy'. If explicit dimension/category is missing,
//  * we rely solely on 'Rule Applied' to split into valid dimensions.
//  */
// function normalizeInspector(raw: any): DataInspectorResult {
//   const r0 = raw.result ?? raw;

//   const checksSrc =
//     r0.checks ??
//     r0.dq_result ??
//     (Array.isArray(r0.results) ? r0.results : []) ??
//     r0.metrics?.checks ??
//     r0.checkResults ??
//     [];

//   const checks: DataInspectorResult['checks'] = [];

//   for (const c of checksSrc) {
//     // Pull DQ Score from several variants (case-insensitive)
//     const dqRaw =
//       pickCaseInsensitive(c, ['dq_score', 'latest_score', 'pass_ratio', 'score', 'rate']) ??
//       (c as any)?.DQ_Score ??
//       (c as any)?.DQ;

//     const latestScore = toNumPercent(dqRaw); // e.g., "86%" -> 0.86

//     const failedRows =
//       toNum(c?.failed_rows) ??
//       toNum(c?.violations) ??
//       toNum(c?.errors) ??
//       (typeof c?.status === 'string' && /fail/i.test(c.status) ? 1 : 0);

//     // STRICT: explicit dimension/category only if recognized, otherwise undefined
//     const explicitDim: DQDimension | undefined =
//       strictDimFromCategory(c?.dimension) ??
//       strictDimFromCategory(c?.dim) ??
//       strictDimFromCategory(c?.category);

//     const appliedRaw =
//       pickCaseInsensitive(c, ['rule_applied', 'rules_applied', 'applied_rules', 'rule_types_applied']) ??
//       (c as any)?.Rule_Applied ??
//       (c as any)?.Applied_Rules;

//     const appliedDims = splitAppliedDims(appliedRaw);

//     // STRICT: if no dim found, do NOT emit this row for averages
//     const dimsToEmit: DQDimension[] =
//       explicitDim && DIMS.includes(explicitDim)
//         ? [explicitDim]
//         : appliedDims.length
//         ? appliedDims
//         : [];

//     for (const dim of dimsToEmit) {
//       checks.push({
//         rule_id: c?.rule_id ?? c?.id ?? c?.name ?? c?.column ?? stableRuleKey(c),
//         dimension: dim,
//         evaluated_rows: toNum(c?.evaluated_rows ?? c?.rows ?? c?.sample_size ?? c?.total_rows),
//         passed_rows: toNum(c?.passed_rows ?? c?.passed ?? c?.ok),
//         failed_rows: failedRows,
//         latest_score: latestScore,
//         ...(c?.column ? { column: c.column } : {}),
//       } as any);
//     }
//   }

//   const violations = Array.isArray(r0.violations)
//     ? r0.violations.map((v: any) => ({
//         rule_id: v.rule_id ?? v.id ?? v.name ?? stableRuleKey(v),
//         dimension: (v?.dimension as DQDimension) ?? normDim(v?.dim ?? v?.category) ?? 'accuracy',
//         description: v.description ?? v.title ?? v.text,
//         count: toNum(v.count ?? v.violations ?? v.failures ?? v.errors) ?? 0,
//         last_seen: v.last_seen ?? v.at ?? v.time ?? v.timestamp,
//         examples: v.examples,
//       }))
//     : deriveViolationsFromChecks(checksSrc);

//   return { tool: raw.tool ?? 'DATA_INSPECTOR_HIL', checks, violations };
// }

// function normalizeAnomaly(raw: any): AnomalyResult & { _derived_violations?: any[] } {
//   const r = raw.result ?? raw;

//   // If this is the anomaly-array shape, build anomaly payload + violations
//   if (Array.isArray(r) && isAnomalyArrayShape(r)) {
//     const built = buildAnomalyFromItems(r);
//     return {
//       tool: raw.tool ?? 'ANOMALY_AGENT_HIL',
//       anomaly_score: built.score,
//       severity: severityOf(built.score),
//       contributors: built.contributors,
//       metrics: { perColumnPositive: built.perColumnPositive },
//       notes: built.notes,
//       _derived_violations: built.derivedViolations,
//     };
//     }

//   // Legacy numeric fields (supported)
//   const score =
//     toNum(r.anomaly_score) ??
//     toNum(r.anomalyScore) ??
//     toNum(r.likelihood) ??
//     toNum(r.score) ??
//     toNum(r.risk) ??
//     toNum(r.metrics?.anomaly_score) ??
//     0;

//   return {
//     tool: raw.tool ?? 'ANOMALY_AGENT_HIL',
//     anomaly_score: score,
//     severity: r.severity ?? r.severityLevel ?? r.level,
//     contributors: r.contributors ?? r.top_contributors ?? r.columns ?? r.suspects ?? [],
//     metrics: r.metrics,
//     notes: r.notes ?? r.comments ?? [],
//   };
// }

// /* ----------------------------- Reducer ----------------------------- */
// export function reduceMessagesToDashboard(messages: ChatMessage[]): DashboardState {
//   const state: DashboardState = {
//     dimensionScores: objFromDims(0),
//     ruleDistribution: objFromDims(0),
//     ruleOccurrences: Object.fromEntries(
//       DIMS.map((d) => [d, { rules_defined: 0, checks_reported: 0, violations_detected: 0 }]),
//     ) as DashboardState['ruleOccurrences'],
//     anomaly: null,
//     anomalyInsights: { top_contributors: [], notes: [] },
//     ruleViolationsTable: [],
//   };

//   const sum = objFromDims(0);
//   const cnt = objFromDims(0);
//   const violationsByRule = new Map<string, { dim: DimensionKey; desc?: string; count: number; last?: string }>();

//   // Track column names observed in Inspector to fill 100% positive for non-anomalous columns
//   const inspectorColumns = new Set<string>();

//   if (typeof window !== 'undefined' && (window as any).DQ_DEBUG) {
//     console.log('[DQ][Agg] messages passed to reducer:', messages.length);
//   }

//   for (const msg of messages) {
//     const toolPayloads: ToolResultPayload[] = extractPayloadsFromMessage(msg);

//     for (const raw of toolPayloads) {
//       const tool = ((raw as any)?.tool ?? '').toString().toUpperCase();

//       // Synthesiser → rules & distribution (skip unknown dims)
//       if (tool.includes('SYNTHESISER')) {
//         const r = normalizeSynthesiser(raw);
//         for (const rule of r.rules) {
//           const dim = rule.dimension as DQDimension;
//           if (DIMS.includes(dim)) {
//             state.ruleDistribution[dim] += 1;
//             state.ruleOccurrences[dim].rules_defined += 1;
//           }
//         }
//       }

//       // Inspector → checks & derived violations (collect columns)
//       if (tool.includes('DATA_INSPECTOR')) {
//         const r = normalizeInspector(raw);

//         for (const check of r.checks) {
//           const dim = check.dimension as DQDimension;
//           const colName = (check as any)?.column;
//           if (typeof colName === 'string' && colName.trim()) inspectorColumns.add(colName.trim());

//           if (DIMS.includes(dim)) {
//             if (typeof check.latest_score === 'number') {
//               sum[dim] += clamp01(check.latest_score);
//               cnt[dim] += 1;
//             }
//             state.ruleOccurrences[dim].checks_reported += 1;
//           }
//         }

//         for (const v of r.violations ?? []) {
//           const dim = v.dimension as DQDimension;
//           if (DIMS.includes(dim)) {
//             state.ruleOccurrences[dim].violations_detected += v.count ?? 0;
//           }
//           const key = v.rule_id ?? stableRuleKey(v);
//           const prev =
//             violationsByRule.get(key) ?? { dim, desc: undefined, count: 0, last: undefined };
//           violationsByRule.set(key, {
//             dim,
//             desc: prev.desc ?? v.description,
//             count: prev.count + (v.count ?? 0),
//             last: v.last_seen ?? prev.last,
//           });
//         }
//       }

//       // Anomaly → score & contributors (+ derived violations)
//       if (tool.includes('ANOMALY')) {
//         const a = normalizeAnomaly(raw);
//         const score = clamp01(a.anomaly_score ?? 0);
//         const sev = (a.severity as any) ?? severityOf(score);

//         if (!state.anomaly) {
//           state.anomaly = {
//             score,
//             severity: sev,
//             contributors: a.contributors ?? [],
//             metrics: a.metrics,
//             notes: a.notes,
//           };
//           state.anomalyInsights.top_contributors = a.contributors ?? [];
//           state.anomalyInsights.notes = a.notes ?? [];
//         } else {
//           if (score > (state.anomaly.score ?? 0)) {
//             state.anomaly = {
//               score,
//               severity: sev,
//               contributors: a.contributors ?? [],
//               metrics: a.metrics,
//               notes: a.notes,
//             };
//             state.anomalyInsights.top_contributors = a.contributors ?? [];
//             state.anomalyInsights.notes = a.notes ?? [];
//           } else if (score === state.anomaly.score) {
//             const mergedNotes = Array.from(
//               new Set([...(state.anomaly.notes ?? []), ...(a.notes ?? [])]),
//             );
//             state.anomaly.notes = mergedNotes;
//             state.anomalyInsights.notes = mergedNotes;

//             const mergedContribs = Array.from(
//               new Set([...(state.anomaly.contributors ?? []), ...(a.contributors ?? [])]),
//             );
//             state.anomaly.contributors = mergedContribs;
//             state.anomalyInsights.top_contributors = mergedContribs;

//             const incomingPos = (a.metrics as any)?.perColumnPositive;
//             if (incomingPos && !state.anomaly.metrics?.perColumnPositive) {
//               state.anomaly.metrics = { ...(state.anomaly.metrics ?? {}), perColumnPositive: incomingPos };
//             }
//           }
//         }

//         // Merge derived violations if present
//         const derived = (a as any)._derived_violations as any[] | undefined;
//         if (Array.isArray(derived)) {
//           for (const v of derived) {
//             const dim = v.dimension as DQDimension;
//             if (DIMS.includes(dim)) {
//               state.ruleOccurrences[dim].violations_detected += v.count ?? 0;
//             }
//             const key = v.rule_id ?? stableRuleKey(v);
//             const prev =
//               violationsByRule.get(key) ?? { dim, desc: undefined, count: 0, last: undefined };
//             violationsByRule.set(key, {
//               dim,
//               desc: prev.desc ?? v.description,
//               count: prev.count + (v.count ?? 0),
//               last: v.last_seen ?? prev.last,
//             });
//           }
//         }
//       }
//     }
//   }

//   // Finalize dimensionScores as averages
//   for (const d of DIMS) {
//     state.dimensionScores[d] = cnt[d] ? +((sum[d] / cnt[d]).toFixed(4)) : 0;
//   }

//   // Fill perColumnPositive with 100% for inspector columns not present in anomaly map
//   if (state.anomaly) {
//     const pos = (state.anomaly.metrics?.perColumnPositive ?? {}) as Record<string, number>;
//     inspectorColumns.forEach((col) => {
//       if (typeof pos[col] === 'undefined') pos[col] = 1; // 100% positive when no anomaly present
//     });
//     state.anomaly.metrics = { ...(state.anomaly.metrics ?? {}), perColumnPositive: pos };
//   }

//   // Build violations table
//   state.ruleViolationsTable = Array.from(violationsByRule.entries())
//     .map(([k, v]) => ({
//       rule_id: k,
//       dimension: prettyDim(v.dim),
//       description: v.desc,
//       violations: v.count,
//       last_seen: v.last,
//     }))
//     .sort((a, b) => b.violations - a.violations);

//   if (typeof window !== 'undefined' && (window as any).DQ_DEBUG) {
//     const totals = {
//       rules: Object.values(state.ruleDistribution).reduce((a, b) => a + b, 0),
//       checks: Object.values(state.ruleOccurrences).reduce((a, b: any) => a + b.checks_reported, 0),
//       violations: Object.values(state.ruleOccurrences).reduce((a, b: any) => a + b.violations_detected, 0),
//       anomalyScore: state.anomaly?.score ?? 0,
//       anomalySeverity: state.anomaly?.severity ?? 'low',
//     };
//     console.log('[DQ] Aggregated totals:\n' + JSON.stringify(totals, null, 2));
//     console.log(
//       `[DQ] Health: rules=${totals.rules}, checks=${totals.checks}, violations=${totals.violations}, ` +
//         `anomaly=${Math.round((totals.anomalyScore ?? 0) * 100)}% (${totals.anomalySeverity})`,
//     );
//   }

//   return state;
// }
// // ----------------------------- END OF FILE -----------------------------


// 6 jan


// // src/dq/dqAggregator.ts
// import type { ChatMessage } from '../types/chat';
// import type {
//   ToolResultPayload,
//   SynthesiserResult,
//   DataInspectorResult,
//   AnomalyResult,
//   DQDimension,
// } from '../types/dqToolResults';

// export type DimensionKey = DQDimension;
// export interface DashboardState {
//   dimensionScores: Record<DimensionKey, number>;
//   ruleDistribution: Record<DimensionKey, number>;
//   ruleOccurrences: Record<
//     DimensionKey,
//     { rules_defined: number; checks_reported: number; violations_detected: number }
//   >;
//   anomaly:
//     | {
//         score: number;
//         severity: 'low' | 'moderate' | 'high' | 'critical';
//         contributors: string[];
//         metrics?: { perColumnPositive?: Record<string, number>; [k: string]: any };
//         notes?: string[];
//       }
//     | null;
//   anomalyInsights: { top_contributors: string[]; notes: string[] };
//   ruleViolationsTable: Array<{
//     rule_id: string;
//     dimension: string;
//     description?: string;
//     violations: number;
//     last_seen?: string;
//   }>;
// }

// /* ------------------------- helpers ------------------------- */
// const DIMS: DimensionKey[] = ['uniqueness', 'validity', 'completeness', 'consistency', 'accuracy'];
// const objFromDims = <T,>(v: T) =>
//   Object.fromEntries(DIMS.map((d) => [d, v])) as Record<DimensionKey, T>;
// const clamp01 = (x: number) => Math.max(0, Math.min(1, x ?? 0));
// const toNum = (v: any) => {
//   if (v === null || v === undefined) return undefined;
//   const n = typeof v === 'string' ? Number(v) : v;
//   return Number.isFinite(n) ? n : undefined;
// };
// const DIM_MAP: Record<string, DQDimension> = {
//   uniqueness: 'uniqueness',
//   unique: 'uniqueness',
//   validity: 'validity',
//   valid: 'validity',
//   completeness: 'completeness',
//   complete: 'completeness',
//   consistency: 'consistency',
//   consistent: 'consistency',
//   accuracy: 'accuracy',
//   accurate: 'accuracy',
// };
// function normDim(s: any): DQDimension {
//   const k = String(s ?? '').toLowerCase().trim();
//   return (DIM_MAP[k] ?? 'accuracy') as DQDimension;
// }
// function prettyDim(d: DQDimension) {
//   return d[0].toUpperCase() + d.slice(1);
// }
// function severityOf(score: number): 'low' | 'moderate' | 'high' | 'critical' {
//   return score >= 0.85 ? 'critical' : score >= 0.65 ? 'high' : score >= 0.35 ? 'moderate' : 'low';
// }
// // parse JSON, also support fenced ```json blocks (returns original value if not JSON)
// function tryParse(value: any): any {
//   if (typeof value !== 'string') return value;
//   const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
//   const s = fenced ? fenced[1] : value;
//   try {
//     return JSON.parse(s);
//   } catch {
//     return value;
//   }
// }
// // Strict variant: returns undefined on failure (used for text-first ingestion)
// function tryParseFromText(value: any): any | undefined {
//   if (typeof value !== 'string') return undefined;
//   const m = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
//   const s = m ? m[1] : value;
//   try {
//     return JSON.parse(s);
//   } catch {
//     return undefined;
//   }
// }
// // Parse an entry inside content[] like: { json: { result: "<json-string>" }, type: "json" } or plain obj/string
// function parseContentEntry(entry: any): any | undefined {
//   try {
//     if (entry?.json) {
//       const j = entry.json;
//       if (typeof j?.result === 'string') return JSON.parse(j.result);
//       if (typeof j === 'object') return j;
//     }
//     if (typeof entry === 'string') return JSON.parse(entry);
//     if (entry && typeof entry === 'object') return entry;
//     return undefined;
//   } catch {
//     return undefined;
//   }
// }
// function dimFromRuleType(typeText?: string): DQDimension | undefined {
//   if (!typeText) return undefined;
//   return normDim(typeText);
// }
// function firstDimFromApplied(applied?: string): DQDimension | undefined {
//   if (!applied) return undefined;
//   const first = applied.split(',')[0]?.trim();
//   return first ? normDim(first) : undefined;
// }
// // Deterministic key so violations aggregate stably across runs when rule_id is missing
// function stableRuleKey(v: any): string {
//   const dim = String(v?.dimension ?? '').toLowerCase();
//   const desc = String(v?.description ?? v?.title ?? v?.text ?? v?.column ?? '').trim();
//   const expr = String(v?.expression ?? '').trim();
//   const key = [dim, desc, expr].filter(Boolean).join('\n');
//   // Fallback only when every part is empty
//   return key || Math.random().toString(36).slice(2);
// }

// /* -------- recognizers for anomaly arrays -------- */
// type RawAnomalyItem = {
//   anomaly_count?: number;            // count (rows)
//   anomaly_pct?: number | string;     // e.g., 12.5 or "12.5%"
//   anomaly_percentage?: number | string;
//   total_rows?: number;               // denominator when available
//   anomaly_type?: string;
//   column?: string;
//   confidence_score?: number;         // 0..1 anomaly likelihood
//   sql_fix?: string;
//   suggested_remediation?: string;
//   [k: string]: any;
// };
// function isAnomalyArrayShape(obj: any): obj is RawAnomalyItem[] {
//   return (
//     Array.isArray(obj) &&
//     obj.some(
//       (it) =>
//         typeof it === 'object' &&
//         ('anomaly_count' in it ||
//          'confidence_score' in it ||
//          'anomaly_type' in it ||
//          'anomaly_pct' in it)
//     )
//   );
// }
// // Map provider anomaly types to our DQ dimensions
// function inferDimFromAnomalyType(t?: string): DQDimension {
//   const s = String(t ?? '').toLowerCase();
//   if (/duplicate|dup/i.test(s)) return 'uniqueness';
//   if (/null|missing|empty/i.test(s)) return 'completeness';
//   if (/format|regex|pattern|type/i.test(s)) return 'validity';
//   if (/inconsisten|mismatch|drift/i.test(s)) return 'consistency';
//   return 'accuracy';
// }
// // Parse percent strings like "15%" → 0.15 (numbers remain as-is)
// function toNumPercent(v: any): number | undefined {
//   if (v === null || v === undefined) return undefined;
//   if (typeof v === 'string') {
//     const s = v.trim();
//     if (s.endsWith('%')) {
//       const n = Number(s.slice(0, -1));
//       return Number.isFinite(n) ? clamp01(n / 100) : undefined;
//     }
//     const n = Number(s);
//     return Number.isFinite(n) ? n : undefined;
//   }
//   if (typeof v === 'number') return v;
//   return undefined;
// }
// // Strict category → DQ dimension (only when it matches known labels)
// function strictDimFromCategory(cat?: any): DQDimension | undefined {
//   const k = String(cat ?? '').toLowerCase().trim();
//   const m = DIM_MAP[k];
//   return m && DIMS.includes(m) ? m : undefined; // no default to 'accuracy'
// }
// // Case-insensitive + whitespace-insensitive key getter
// function pickCaseInsensitive(obj: any, canonicalNames: string[]): any {
//   if (!obj || typeof obj !== 'object') return undefined;
//   // normalize candidate names like "Rule Applied" -> "rule_applied"
//   const wanted = new Set(
//     canonicalNames.map((n) => n.toLowerCase().replace(/\s+/g, '_').trim()),
//   );
//   for (const [key, val] of Object.entries(obj)) {
//     const lc = key.toLowerCase().replace(/\s+/g, '_').trim();
//     if (wanted.has(lc)) return val;
//   }
//   return undefined;
// }

// /** Build anomaly payload + derived violations from the array items (enhanced with perDimensionPositive) */
// function buildAnomalyFromItems(items: RawAnomalyItem[]) {
//   const contributors = Array.from(new Set(items.map((it) => it.column).filter(Boolean))) as string[];
//   const notes = Array.from(
//     new Set([
//       ...items.map((it) => it.anomaly_type).filter(Boolean),
//       ...items.map((it) => it.suggested_remediation).filter(Boolean),
//     ]),
//   ) as string[];

//   // Derive per-column anomaly ratio (0..1), then positive = 1 − anomaly
//   const byCol: Record<string, { anomaly: number }> = {};
//   const maxCount = items.reduce((m, it) => Math.max(m, toNum(it.anomaly_count) ?? 0), 0);

//   // Aggregate per-dimension anomaly (to backfill averages when checks are absent)
//   const dimAgg: Record<DQDimension, { sum: number; n: number }> = {
//     uniqueness: { sum: 0, n: 0 },
//     validity: { sum: 0, n: 0 },
//     completeness: { sum: 0, n: 0 },
//     consistency: { sum: 0, n: 0 },
//     accuracy: { sum: 0, n: 0 },
//   };

//   for (const it of items) {
//     const col = String(it.column ?? '').trim();
//     // Preferred anomaly ratio sources:
//     const pct =
//       toNumPercent(it.anomaly_pct) ??
//       toNumPercent(it.anomaly_percentage);
//     const conf = toNum(it.confidence_score); // 0..1 anomaly likelihood
//     const count = toNum(it.anomaly_count);
//     const total = toNum(it.total_rows);
//     let anomalyRatio: number | undefined =
//       pct !== undefined
//         ? clamp01(pct)
//         : conf !== undefined
//         ? clamp01(conf)
//         : count !== undefined && total !== undefined && total > 0
//         ? clamp01(count / total)
//         : count !== undefined && maxCount > 0
//         ? clamp01(count / maxCount)
//         : undefined;

//     if (anomalyRatio === undefined) anomalyRatio = 0; // treat unknown as no anomaly

//     if (col) byCol[col] = { anomaly: anomalyRatio };

//     const dim = inferDimFromAnomalyType(it.anomaly_type);
//     dimAgg[dim].sum += clamp01(anomalyRatio);
//     dimAgg[dim].n += 1;
//   }

//   // Overall anomaly score: max of available ratios (conservative)
//   const overallAnomaly = Object.values(byCol).reduce((m, v) => Math.max(m, clamp01(v.anomaly)), 0);
//   const score = clamp01(overallAnomaly);

//   const derivedViolations = items.map((it) => {
//     const dim = inferDimFromAnomalyType(it.anomaly_type);
//     const count = toNum(it.anomaly_count) ?? 0;
//     const desc = `${it.anomaly_type ?? 'Anomaly'}${it.column ? ` on ${it.column}` : ''}`;
//     return {
//       rule_id: stableRuleKey({ dimension: dim, description: desc, expression: it.sql_fix }),
//       dimension: dim,
//       description: desc,
//       count,
//       last_seen: undefined as string | undefined,
//       examples: undefined as any,
//     };
//   });

//   // per-column positive% = 1 − anomalyRatio
//   const perColumnPositive = Object.fromEntries(
//     Object.entries(byCol).map(([col, v]) => [col, +(clamp01(1 - v.anomaly)).toFixed(4)]),
//   );

//   // per-dimension positive% = 1 − avg(anomalyRatio per dimension)
//   const perDimensionPositive = Object.fromEntries(
//     (Object.keys(dimAgg) as DQDimension[]).map((d) => {
//       const avgAnom = dimAgg[d].n ? dimAgg[d].sum / dimAgg[d].n : 0;
//       return [d, +(clamp01(1 - avgAnom)).toFixed(4)];
//     }),
//   );

//   return { score, contributors, notes, derivedViolations, perColumnPositive, perDimensionPositive };
// }

// /* ------------------- payload recognition ------------------- */
// function inferToolNameFromObj(obj: any): string | undefined {
//   if (!obj || typeof obj !== 'object') return undefined;
//   if (
//     'rules' in obj ||
//     'generated_rules' in obj ||
//     'ruleset' in obj ||
//     'dq_rules' in obj ||
//     'business_rules' in obj ||
//     'items' in obj
//   )
//     return 'SYNTHESISER_AGENT_HIL';
//   if (
//     'checks' in obj ||
//     'dq_result' in obj ||
//     'results' in obj ||
//     'violations' in obj ||
//     'errors' in obj ||
//     'failures' in obj
//   )
//     return 'DATA_INSPECTOR_HIL';
//   if (
//     'anomaly_score' in obj ||
//     'anomalyScore' in obj ||
//     'likelihood' in obj ||
//     'score' in obj ||
//     'risk' in obj
//   )
//     return 'ANOMALY_AGENT_HIL';
//   // NEW: anomalies array present → anomaly tool
//   if ('anomalies' in obj && Array.isArray(obj.anomalies)) return 'ANOMALY_AGENT_HIL';
//   if ('patterns' in obj || 'detected_patterns' in obj || 'regexes' in obj)
//     return 'PATTERN_AGENT_HIL';
//   if ('exec_id' in obj || 'executionId' in obj || 'run_id' in obj) return 'TRACEABILITY_AGENT_HIL';
//   const nested =
//     (obj as any).result ??
//     (obj as any).output ??
//     (obj as any).data ??
//     (obj as any).payload ??
//     (obj as any).content;
//   if (nested && typeof nested === 'object') return inferToolNameFromObj(nested);
//   return undefined;
// }

// /** Coerce alternates to canonical form (TS-safe), and handle anomaly arrays + numeric-indexed entries */
// function coerceDQFields(obj: any): any {
//   if (!obj || typeof obj !== 'object') return obj;

//   // If the entire object is the anomaly array, produce a NEW anomaly object
//   if (isAnomalyArrayShape(obj)) {
//     const built = buildAnomalyFromItems(obj as RawAnomalyItem[]);
//     return {
//       anomaly_score: built.score,
//       contributors: built.contributors,
//       notes: built.notes,
//       _derived_violations: built.derivedViolations,
//       metrics: { ...(obj as any).metrics, perColumnPositive: built.perColumnPositive, perDimensionPositive: built.perDimensionPositive },
//     };
//   }

//   // Else flatten common wrappers
//   const core =
//     (obj as any).result ??
//     (obj as any).output ??
//     (obj as any).data ??
//     (obj as any).payload ??
//     (obj as any).content ??
//     obj;

//   const out: any = { ...core };

//   // --- fold numeric-indexed entries ("0","1","2",...) into arrays we can recognize ---
//   try {
//     const numericKeys = Object.keys(out).filter((k) => /^\d+$/.test(k));
//     if (numericKeys.length) {
//       const entries = numericKeys
//         .map((k) => out[k])
//         .filter((v) => v !== undefined && v !== null)
//         .map((v) => {
//           if (typeof v === 'string') return tryParse(v);
//           if (v?.json && typeof v.json?.result === 'string') {
//             try {
//               return JSON.parse(v.json.result);
//             } catch {
//               return v;
//             }
//           }
//           return v;
//         });

//       // (A) Anomaly array → build anomaly payload + derived violations
//       if (isAnomalyArrayShape(entries)) {
//         const built = buildAnomalyFromItems(entries as RawAnomalyItem[]);
//         out.anomaly_score = built.score;
//         out.contributors = built.contributors;
//         out.notes = built.notes;
//         out._derived_violations = built.derivedViolations;
//         out.metrics = { ...(out.metrics ?? {}), perColumnPositive: built.perColumnPositive, perDimensionPositive: built.perDimensionPositive };
//       }

//       // (B) If rules absent but entries look like rules → collect
//       if (!out.rules) {
//         const ruleLike = entries.flatMap((it: any) => {
//           if (Array.isArray(it?.rules)) return it.rules;
//           const looksRule = it && (it.rule_id || it.description || it.expression);
//           return looksRule ? [it] : [];
//         });
//         if (ruleLike.length) out.rules = ruleLike;
//       }

//       // (C) If checks absent but entries look like checks → collect
//       if (!out.checks) {
//         const checkLike = entries.flatMap((it: any) => {
//           if (Array.isArray(it?.checks)) return it.checks;
//           const looksCheck =
//             typeof it?.latest_score !== 'undefined' ||
//             typeof it?.failed_rows !== 'undefined' ||
//             typeof it?.evaluated_rows !== 'undefined';
//           return looksCheck ? [it] : [];
//         });
//         if (checkLike.length) out.checks = checkLike;
//       }

//       // remove numeric keys to avoid confusion downstream
//       numericKeys.forEach((k) => {
//         try {
//           delete out[k];
//         } catch {}
//       });
//     }
//   } catch {}

//   // merge JSON string at key "0" when present (legacy providers)
//   try {
//     const z = out['0'] ?? out[0];
//     if (typeof z === 'string') {
//       const zParsed = tryParse(z);
//       if (zParsed && typeof zParsed === 'object') {
//         for (const [k, v] of Object.entries(zParsed)) {
//           if (typeof (out as any)[k] === 'undefined') (out as any)[k] = v;
//         }
//       }
//     }
//   } catch {}

//   // Treat anomalies[] at the root (file mode) as anomaly source
//   try {
//     if (Array.isArray(out.anomalies)) {
//       const built = buildAnomalyFromItems(out.anomalies as RawAnomalyItem[]);
//       out.anomaly_score = built.score;
//       out.contributors = built.contributors;
//       out.notes = built.notes;
//       out._derived_violations = built.derivedViolations;
//       out.metrics = { ...(out.metrics ?? {}), perColumnPositive: built.perColumnPositive, perDimensionPositive: built.perDimensionPositive };
//     }
//   } catch {}

//   // Synthesiser rules aliases
//   out.rules =
//     out.rules ??
//     out.generated_rules ??
//     out.ruleset ??
//     out.dq_rules ??
//     out.business_rules ??
//     (Array.isArray(out.items) ? out.items : out.rules);

//   // Inspector checks aliases (column-wise table → dq_result)
//   out.checks =
//     out.checks ??
//     out.dq_result ??
//     (Array.isArray(out.results) ? out.results : []) ??
//     out.metrics?.checks ??
//     out.checkResults;

//   // Inspector violations array (if present)
//   const vArr = out.violations ?? out.errors ?? out.failures;
//   if (Array.isArray(vArr)) out.violations = vArr;

//   // Anomaly numeric fields
//   out.anomaly_score =
//     toNum(out.anomaly_score) ??
//     toNum(out.anomalyScore) ??
//     toNum(out.likelihood) ??
//     toNum(out.score) ??
//     toNum(out.risk) ??
//     toNum(out.metrics?.anomaly_score) ??
//     out.anomaly;

//   // Patterns / Traceability
//   out.patterns = out.patterns ?? out.detected_patterns ?? out.regexes;
//   out.exec_id = out.exec_id ?? out.executionId ?? out.run_id ?? out.execId ?? out.runId;

//   return out;
// }

// function normalizePayload(p: any, explicitTool?: string): ToolResultPayload | undefined {
//   if (!p) return undefined;
//   const coerced = coerceDQFields(tryParse(p));
//   if (coerced && typeof coerced === 'object' && !(coerced as any).tool) {
//     (coerced as any).tool = explicitTool ?? inferToolNameFromObj(coerced) ?? 'UNKNOWN_TOOL';
//   }
//   return coerced;
// }

// /**
//  * CONTENT-FIRST extractor:
//  * - assistant.text (fenced/plain JSON)
//  * - response.text (fenced/plain JSON)
//  * - MERGED content from:
//  *   response.content[], timeline[].content[] AND timeline[].payload/result/data/output .content[],
//  *   response.events[].content[]
//  */
// function extractPayloadsFromMessage(msg: any): ToolResultPayload[] {
//   const out: any[] = [];
//   const push = (value: any, path: string, toolHint?: string) => {
//     if (!value) return;
//     const arr = Array.isArray(value) ? value : [value];
//     for (const item of arr) {
//       const normalized = normalizePayload(item, toolHint);
//       if (!normalized) continue;

//       const hasRules = !!(normalized as any).rules;
//       const hasChecks =
//         !!(normalized as any).checks ||
//         !!(normalized as any).dq_result ||
//         !!(normalized as any).results;
//       const hasAnom = typeof (normalized as any).anomaly_score !== 'undefined' ||
//                       Array.isArray((normalized as any).anomalies);

//       const pick = (obj: any, fields: string[]) => {
//         const o: any = {};
//         for (const f of fields) if (typeof (obj as any)[f] !== 'undefined') o[f] = (obj as any)[f];
//         return o;
//       };

//       let emitted = 0;
//       if (hasRules) {
//         const rOnly = pick(normalized, [
//           'rules', 'generated_rules', 'ruleset', 'dq_rules', 'business_rules', 'items', 'tool',
//         ]);
//         rOnly.tool = 'SYNTHESISER_AGENT_HIL';
//         out.push(rOnly);
//         emitted++;
//       }
//       if (hasChecks) {
//         const cOnly = pick(normalized, [
//           'checks', 'dq_result', 'results', 'violations', 'errors', 'failures', 'metrics', 'tool', '_derived_violations',
//         ]);
//         cOnly.tool = 'DATA_INSPECTOR_HIL';
//         out.push(cOnly);
//         emitted++;
//       }
//       if (hasAnom) {
//         const aOnly = pick(normalized, [
//           'anomaly_score', 'severity', 'contributors', 'metrics', 'notes', 'tool', '_derived_violations', 'anomalies',
//         ]);
//         aOnly.tool = 'ANOMALY_AGENT_HIL';
//         out.push(aOnly);
//         emitted++;
//       }

//       if (!emitted) out.push(normalized);

//       if (typeof window !== 'undefined' && (window as any).DQ_DEBUG) {
//         console.log(
//           `[DQ] extracted payload from ${path}: ` +
//             JSON.stringify(
//               { tool: (normalized as any).tool, keys: Object.keys(normalized as any), emittedRecords: emitted || 1 },
//               null,
//               2,
//             ),
//         );
//       }
//     }
//   };

//   // assistant & response text
//   const textParsed =
//     tryParseFromText(msg?.text) ??
//     (typeof msg?.text === 'string' ? tryParseFromText(msg.text) : undefined);
//   if (textParsed) push(textParsed, 'assistant.text');

//   const respTextParsed =
//     tryParseFromText(msg?.response?.text) ??
//     (typeof msg?.response?.text === 'string' ? tryParseFromText(msg.response.text) : undefined);
//   if (respTextParsed) push(respTextParsed, 'response.text');

//   // merge content-like payloads
//   const contentLike: any[] = [];
//   if (Array.isArray(msg?.response?.content)) contentLike.push(...msg.response.content);

//   if (Array.isArray(msg?.timeline)) {
//     for (const t of msg.timeline) {
//       if (t?.type === 'tool' || /tool/i.test(String(t?.type))) {
//         const tt = t as any;
//         if (Array.isArray(tt?.content)) contentLike.push(...tt.content);
//         else if (tt?.content) contentLike.push(tt.content);
//         const containers = [tt?.payload, tt?.result, tt?.data, tt?.output].filter(Boolean);
//         for (const box of containers) {
//           if (Array.isArray(box?.content)) contentLike.push(...box.content);
//           else if (box?.content) contentLike.push(box.content);
//           else if (box) contentLike.push(box);
//         }
//       }
//     }
//   }

//   if (Array.isArray(msg?.response?.events)) {
//     for (const e of msg.response.events) {
//       const ce = (e as any)?.content;
//       if (Array.isArray(ce)) contentLike.push(...ce);
//       else if (ce) contentLike.push(ce);
//     }
//   }

//   const parsedContent: any[] = [];
//   for (const part of contentLike) {
//     const parsed = parseContentEntry(part);
//     if (parsed) parsedContent.push(parsed);
//   }
//   if (parsedContent.length) push(parsedContent, 'content:merged');

//   const payloads = out as ToolResultPayload[];
//   if (typeof window !== 'undefined' && (window as any).DQ_DEBUG) {
//     console.log('[DQ][Agg] total extracted payloads for msg', msg?.id, '=>', payloads.length);
//   }
//   return payloads;
// }

// /* -------- NEW helpers for Data Inspector -------- */
// // Split “Rule Applied” strings/arrays into normalized DQ dimensions
// function splitAppliedDims(applied: any): DQDimension[] {
//   if (!applied) return [];
//   const rawList: string[] = Array.isArray(applied)
//     ? applied.map(String)
//     : String(applied)
//         .split(/[,\n]/) // handle "Completeness, Uniqueness" and newline-separated entries
//         .map((s) => s.trim())
//         .filter(Boolean);
//   const dims = rawList.map(normDim).filter((d) => DIMS.includes(d));
//   return Array.from(new Set(dims)); // de-duplicate
// }

// /* ----------------------- Normalizers ----------------------- */
// function deriveViolationsFromChecks(
//   checks: any[],
// ): Array<{ rule_id: string; dimension: DQDimension; description?: string; count: number; last_seen?: string }> {
//   const out: any[] = [];
//   for (const c of checks ?? []) {
//     const count =
//       toNum(c?.count) ??
//       toNum(c?.violations) ??
//       toNum(c?.failures) ??
//       toNum(c?.errors) ??
//       toNum(c?.failed_rows) ??
//       toNum(c?.violations_count) ??
//       toNum(c?.violations_cnt) ??
//       0;
//     if (count && count > 0) {
//       const dim =
//         normDim(c?.dimension ?? c?.dim ?? c?.category) ??
//         firstDimFromApplied(c?.rule_types_applied) ??
//         'accuracy';
//       const v = {
//         rule_id:
//           c?.rule_id ??
//           c?.id ??
//           c?.name ??
//           c?.column ??
//           stableRuleKey({
//             dimension: dim,
//             description: c?.description ?? c?.title ?? c?.text ?? (c?.column ? `Column ${c.column}` : ''),
//           }),
//         dimension: dim,
//         description: c?.description ?? c?.title ?? c?.text ?? (c?.column ? `Column ${c.column}` : undefined),
//         count,
//         last_seen: c?.last_seen ?? c?.checked_at ?? c?.at ?? c?.time ?? c?.timestamp,
//       };
//       out.push(v);
//     }
//   }
//   return out;
// }

// function normalizeSynthesiser(raw: any): SynthesiserResult {
//   const r0 = raw.result ?? raw;
//   const rulesSrc =
//     r0.rules ??
//     r0.generated_rules ??
//     r0.ruleset ??
//     r0.dq_rules ??
//     r0.business_rules ??
//     (Array.isArray(r0.items) ? r0.items : []);
//   const rules = rulesSrc
//     .map((r: any) => {
//       // only accept dimension from CATEGORY (strict), else skip
//       const dimCat = strictDimFromCategory(r.category);
//       if (!dimCat) return null; // prevents phantom 'Accuracy'
//       return {
//         rule_id: r.rule_id ?? r.id ?? r.name ?? stableRuleKey(r),
//         dimension: dimCat,
//         description: r.description ?? r.title ?? r.text ?? '',
//         expression: r.expression ?? r.sql ?? r.rule ?? r.query ?? undefined,
//         confidence: toNum(r.confidence ?? r.score ?? r.weight),
//         created_at: r.created_at ?? r.time ?? r.timestamp,
//       };
//     })
//     .filter(Boolean) as SynthesiserResult['rules'];
//   return { tool: raw.tool ?? 'SYNTHESISER_AGENT_HIL', rules };
// }

// /**
//  * PATCHED: strict dimension resolution for Data Inspector rows.
//  * We DO NOT default to 'accuracy'. If explicit dimension/category is missing,
//  * we rely solely on 'Rule Applied' to split into valid dimensions.
//  */
// function normalizeInspector(raw: any): DataInspectorResult {
//   const r0 = raw.result ?? raw;
//   const checksSrc =
//     r0.checks ??
//     r0.dq_result ??
//     (Array.isArray(r0.results) ? r0.results : []) ??
//     r0.metrics?.checks ??
//     r0.checkResults ??
//     [];
//   const checks: DataInspectorResult['checks'] = [];
//   for (const c of checksSrc) {
//     // Pull DQ Score from several variants (case-insensitive)
//     const dqRaw =
//       pickCaseInsensitive(c, ['dq_score', 'latest_score', 'pass_ratio', 'score', 'rate']) ??
//       (c as any)?.DQ_Score ??
//       (c as any)?.DQ;
//     const latestScore = toNumPercent(dqRaw); // e.g., "86%" -> 0.86

//     const failedRows =
//       toNum(c?.failed_rows) ??
//       toNum(c?.violations) ??
//       toNum(c?.errors) ??
//       (typeof c?.status === 'string' && /fail/i.test(c.status) ? 1 : 0);

//     // STRICT: explicit dimension/category only if recognized, otherwise undefined
//     const explicitDim: DQDimension | undefined =
//       strictDimFromCategory(c?.dimension) ??
//       strictDimFromCategory(c?.dim) ??
//       strictDimFromCategory(c?.category);

//     const appliedRaw =
//       pickCaseInsensitive(c, ['rule_applied', 'rules_applied', 'applied_rules', 'rule_types_applied']) ??
//       (c as any)?.Rule_Applied ??
//       (c as any)?.Applied_Rules;

//     const appliedDims = splitAppliedDims(appliedRaw);

//     // STRICT: if no dim found, do NOT emit this row for averages
//     const dimsToEmit: DQDimension[] =
//       explicitDim && DIMS.includes(explicitDim)
//         ? [explicitDim]
//         : appliedDims.length
//         ? appliedDims
//         : [];

//     for (const dim of dimsToEmit) {
//       checks.push({
//         rule_id: c?.rule_id ?? c?.id ?? c?.name ?? c?.column ?? stableRuleKey(c),
//         dimension: dim,
//         evaluated_rows: toNum(c?.evaluated_rows ?? c?.rows ?? c?.sample_size ?? c?.total_rows),
//         passed_rows: toNum(c?.passed_rows ?? c?.passed ?? c?.ok),
//         failed_rows: failedRows,
//         latest_score: latestScore,
//         ...(c?.column ? { column: c.column } : {}),
//       } as any);
//     }
//   }

//   const violations = Array.isArray(r0.violations)
//     ? r0.violations.map((v: any) => ({
//         rule_id: v.rule_id ?? v.id ?? v.name ?? stableRuleKey(v),
//         dimension: (v?.dimension as DQDimension) ?? normDim(v?.dim ?? v?.category) ?? 'accuracy',
//         description: v.description ?? v.title ?? v.text,
//         count: toNum(v.count ?? v.violations ?? v.failures ?? v.errors) ?? 0,
//         last_seen: v.last_seen ?? v.at ?? v.time ?? v.timestamp,
//         examples: v.examples,
//       }))
//     : deriveViolationsFromChecks(checksSrc);

//   return { tool: raw.tool ?? 'DATA_INSPECTOR_HIL', checks, violations };
// }

// function normalizeAnomaly(raw: any): AnomalyResult & { _derived_violations?: any[] } {
//   const r = raw.result ?? raw;

//   // NEW: anomalies array at r.anomalies
//   if (Array.isArray(r.anomalies) && isAnomalyArrayShape(r.anomalies)) {
//     const built = buildAnomalyFromItems(r.anomalies);
//     return {
//       tool: raw.tool ?? 'ANOMALY_AGENT_HIL',
//       anomaly_score: built.score,
//       severity: severityOf(built.score),
//       contributors: built.contributors,
//       metrics: { perColumnPositive: built.perColumnPositive, perDimensionPositive: built.perDimensionPositive },
//       notes: built.notes,
//       _derived_violations: built.derivedViolations,
//     };
//   }

//   // If this is the anomaly-array shape directly, build anomaly payload + violations
//   if (Array.isArray(r) && isAnomalyArrayShape(r)) {
//     const built = buildAnomalyFromItems(r);
//     return {
//       tool: raw.tool ?? 'ANOMALY_AGENT_HIL',
//       anomaly_score: built.score,
//       severity: severityOf(built.score),
//       contributors: built.contributors,
//       metrics: { perColumnPositive: built.perColumnPositive, perDimensionPositive: built.perDimensionPositive },
//       notes: built.notes,
//       _derived_violations: built.derivedViolations,
//     };
//   }

//   // Legacy numeric fields (supported)
//   const score =
//     toNum(r.anomaly_score) ??
//     toNum(r.anomalyScore) ??
//     toNum(r.likelihood) ??
//     toNum(r.score) ??
//     toNum(r.risk) ??
//     toNum(r.metrics?.anomaly_score) ??
//     0;

//   return {
//     tool: raw.tool ?? 'ANOMALY_AGENT_HIL',
//     anomaly_score: score,
//     severity: r.severity ?? r.severityLevel ?? r.level,
//     contributors: r.contributors ?? r.top_contributors ?? r.columns ?? r.suspects ?? [],
//     metrics: r.metrics,
//     notes: r.notes ?? r.comments ?? [],
//   };
// }

// /* -------------------------- Reducer -------------------------- */
// export function reduceMessagesToDashboard(messages: ChatMessage[]): DashboardState {
//   const state: DashboardState = {
//     dimensionScores: objFromDims(0),
//     ruleDistribution: objFromDims(0),
//     ruleOccurrences: Object.fromEntries(
//       DIMS.map((d) => [d, { rules_defined: 0, checks_reported: 0, violations_detected: 0 }]),
//     ) as DashboardState['ruleOccurrences'],
//     anomaly: null,
//     anomalyInsights: { top_contributors: [], notes: [] },
//     ruleViolationsTable: [],
//   };

//   const sum = objFromDims(0);
//   const cnt = objFromDims(0);
//   const violationsByRule = new Map<string, { dim: DimensionKey; desc?: string; count: number; last?: string }>();
//   const inspectorColumns = new Set<string>();

//   if (typeof window !== 'undefined' && (window as any).DQ_DEBUG) {
//     console.log('[DQ][Agg] messages passed to reducer:', messages.length);
//   }

//   for (const msg of messages) {
//     const toolPayloads: ToolResultPayload[] = extractPayloadsFromMessage(msg);

//     for (const raw of toolPayloads) {
//       const tool = ((raw as any)?.tool ?? '').toString().toUpperCase();

//       // Synthesiser → rules & distribution (skip unknown dims)
//       if (tool.includes('SYNTHESISER')) {
//         const r = normalizeSynthesiser(raw);
//         for (const rule of r.rules) {
//           const dim = rule.dimension as DQDimension;
//           if (DIMS.includes(dim)) {
//             state.ruleDistribution[dim] += 1;
//             state.ruleOccurrences[dim].rules_defined += 1;
//           }
//         }
//       }

//       // Inspector → checks & derived violations (collect columns)
//       if (tool.includes('DATA_INSPECTOR')) {
//         const r = normalizeInspector(raw);
//         for (const check of r.checks) {
//           const dim = check.dimension as DQDimension;
//           const colName = (check as any)?.column;
//           if (typeof colName === 'string' && colName.trim()) inspectorColumns.add(colName.trim());
//           if (DIMS.includes(dim)) {
//             if (typeof check.latest_score === 'number') {
//               sum[dim] += clamp01(check.latest_score);
//               cnt[dim] += 1;
//             }
//             state.ruleOccurrences[dim].checks_reported += 1;
//           }
//         }
//         for (const v of r.violations ?? []) {
//           const dim = v.dimension as DQDimension;
//           if (DIMS.includes(dim)) {
//             state.ruleOccurrences[dim].violations_detected += v.count ?? 0;
//           }
//           const key = v.rule_id ?? stableRuleKey(v);
//           const prev = violationsByRule.get(key) ?? { dim, desc: undefined, count: 0, last: undefined };
//           violationsByRule.set(key, {
//             dim,
//             desc: prev.desc ?? v.description,
//             count: prev.count + (v.count ?? 0),
//             last: v.last_seen ?? prev.last,
//           });
//         }
//       }

//       // Anomaly → score & contributors (+ derived violations)
//       if (tool.includes('ANOMALY')) {
//         const a = normalizeAnomaly(raw);
//         const score = clamp01(a.anomaly_score ?? 0);
//         const sev = (a.severity as any) ?? severityOf(score);

//         if (!state.anomaly) {
//           state.anomaly = {
//             score,
//             severity: sev,
//             contributors: a.contributors ?? [],
//             metrics: a.metrics,
//             notes: a.notes,
//           };
//           state.anomalyInsights.top_contributors = a.contributors ?? [];
//           state.anomalyInsights.notes = a.notes ?? [];
//         } else {
//           if (score > (state.anomaly.score ?? 0)) {
//             state.anomaly = {
//               score,
//               severity: sev,
//               contributors: a.contributors ?? [],
//               metrics: a.metrics,
//               notes: a.notes,
//             };
//             state.anomalyInsights.top_contributors = a.contributors ?? [];
//             state.anomalyInsights.notes = a.notes ?? [];
//           } else if (score === state.anomaly.score) {
//             const mergedNotes = Array.from(
//               new Set([...(state.anomaly.notes ?? []), ...(a.notes ?? [])]),
//             );
//             state.anomaly.notes = mergedNotes;
//             state.anomalyInsights.notes = mergedNotes;
//             const mergedContribs = Array.from(
//               new Set([...(state.anomaly.contributors ?? []), ...(a.contributors ?? [])]),
//             );
//             state.anomaly.contributors = mergedContribs;
//             state.anomalyInsights.top_contributors = mergedContribs;
//             const incomingPos = (a.metrics as any)?.perColumnPositive;
//             if (incomingPos && !state.anomaly.metrics?.perColumnPositive) {
//               state.anomaly.metrics = { ...(state.anomaly.metrics ?? {}), perColumnPositive: incomingPos };
//             }
//             const incomingDimPos = (a.metrics as any)?.perDimensionPositive;
//             if (incomingDimPos && !state.anomaly.metrics?.perDimensionPositive) {
//               state.anomaly.metrics = { ...(state.anomaly.metrics ?? {}), perDimensionPositive: incomingDimPos };
//             }
//           }
//         }

//         // Merge derived violations if present
//         const derived = (a as any)._derived_violations as any[] | undefined;
//         if (Array.isArray(derived)) {
//           for (const v of derived) {
//             const dim = v.dimension as DQDimension;
//             if (DIMS.includes(dim)) {
//               state.ruleOccurrences[dim].violations_detected += v.count ?? 0;
//             }
//             const key = v.rule_id ?? stableRuleKey(v);
//             const prev = violationsByRule.get(key) ?? { dim, desc: undefined, count: 0, last: undefined };
//             violationsByRule.set(key, {
//               dim,
//               desc: prev.desc ?? v.description,
//               count: prev.count + (v.count ?? 0),
//               last: v.last_seen ?? prev.last,
//             });
//           }
//         }
//       }
//     }
//   }

//   // Finalize dimensionScores as averages
//   for (const d of DIMS) {
//     state.dimensionScores[d] = cnt[d] ? +((sum[d] / cnt[d]).toFixed(4)) : 0;
//   }

//   // If no checks but anomaly supplied per-dimension positives, backfill
//   if (state.anomaly?.metrics?.perDimensionPositive) {
//     const pd = state.anomaly.metrics.perDimensionPositive as Record<DQDimension, number>;
//     for (const d of DIMS) {
//       if (!cnt[d] && typeof pd[d] === 'number') {
//         state.dimensionScores[d] = +pd[d].toFixed(4);
//       }
//     }
//   }

//   // Fill perColumnPositive with 100% for inspector columns not present in anomaly map
//   if (state.anomaly) {
//     const pos = (state.anomaly.metrics?.perColumnPositive ?? {}) as Record<string, number>;
//     inspectorColumns.forEach((col) => {
//       if (typeof pos[col] === 'undefined') pos[col] = 1; // 100% positive when no anomaly present
//     });
//     state.anomaly.metrics = { ...(state.anomaly.metrics ?? {}), perColumnPositive: pos };
//   }

//   // Build violations table
//   state.ruleViolationsTable = Array.from(violationsByRule.entries())
//     .map(([k, v]) => ({
//       rule_id: k,
//       dimension: prettyDim(v.dim),
//       description: v.desc,
//       violations: v.count,
//       last_seen: v.last,
//     }))
//     .sort((a, b) => b.violations - a.violations);

//   if (typeof window !== 'undefined' && (window as any).DQ_DEBUG) {
//     const totals = {
//       rules: Object.values(state.ruleDistribution).reduce((a, b) => a + b, 0),
//       checks: Object.values(state.ruleOccurrences).reduce((a, b: any) => a + b.checks_reported, 0),
//       violations: Object.values(state.ruleOccurrences).reduce((a, b: any) => a + b.violations_detected, 0),
//       anomalyScore: state.anomaly?.score ?? 0,
//       anomalySeverity: state.anomaly?.severity ?? 'low',
//     };
//     console.log('[DQ] Aggregated totals:\n' + JSON.stringify(totals, null, 2));
//     console.log(
//       `[DQ] Health: rules=${totals.rules}, checks=${totals.checks}, violations=${totals.violations}, ` +
//         `anomaly=${Math.round((totals.anomalyScore ?? 0) * 100)}% (${totals.anomalySeverity})`,
//     );
//   }

//   return state;
// }
// // ----------------------- END OF FILE -----------------------



// 7 jan


// // src/dq/dqAggregator.ts
// import type { ChatMessage } from '../types/chat';
// import type {
//   ToolResultPayload,
//   SynthesiserResult,
//   DataInspectorResult,
//   AnomalyResult,
//   DQDimension,
// } from '../types/dqToolResults';

// export type DimensionKey = DQDimension;
// export interface DashboardState {
//   dimensionScores: Record<DimensionKey, number>;
//   ruleDistribution: Record<DimensionKey, number>;
//   ruleOccurrences: Record<
//     DimensionKey,
//     { rules_defined: number; checks_reported: number; violations_detected: number }
//   >;
//   anomaly:
//     | {
//         score: number;
//         severity: 'low' | 'moderate' | 'high' | 'critical';
//         contributors: string[];
//         metrics?: { perColumnPositive?: Record<string, number>; [k: string]: any };
//         notes?: string[];
//       }
//     | null;
//   anomalyInsights: { top_contributors: string[]; notes: string[] };
//   ruleViolationsTable: Array<{
//     rule_id: string;
//     dimension: string;
//     description?: string;
//     violations: number;
//     last_seen?: string;
//   }>;
// }

// /* ------------------------- helpers ------------------------- */
// const DIMS: DimensionKey[] = ['uniqueness', 'validity', 'completeness', 'consistency', 'accuracy'];
// const objFromDims = <T,>(v: T) =>
//   Object.fromEntries(DIMS.map((d) => [d, v])) as Record<DimensionKey, T>;
// const clamp01 = (x: number) => Math.max(0, Math.min(1, x ?? 0));
// const toNum = (v: any) => {
//   if (v === null || v === undefined) return undefined;
//   const n = typeof v === 'string' ? Number(v) : v;
//   return Number.isFinite(n) ? n : undefined;
// };
// const DIM_MAP: Record<string, DQDimension> = {
//   uniqueness: 'uniqueness',
//   unique: 'uniqueness',
//   validity: 'validity',
//   valid: 'validity',
//   completeness: 'completeness',
//   complete: 'completeness',
//   consistency: 'consistency',
//   consistent: 'consistency',
//   accuracy: 'accuracy',
//   accurate: 'accuracy',
// };
// function normDim(s: any): DQDimension {
//   const k = String(s ?? '').toLowerCase().trim();
//   return (DIM_MAP[k] ?? 'accuracy') as DQDimension;
// }
// function prettyDim(d: DQDimension) {
//   return d[0].toUpperCase() + d.slice(1);
// }
// function severityOf(score: number): 'low' | 'moderate' | 'high' | 'critical' {
//   return score >= 0.85 ? 'critical' : score >= 0.65 ? 'high' : score >= 0.35 ? 'moderate' : 'low';
// }
// // parse JSON, also support fenced ```json blocks (returns original value if not JSON)
// function tryParse(value: any): any {
//   if (typeof value !== 'string') return value;
//   const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
//   const s = fenced ? fenced[1] : value;
//   try {
//     return JSON.parse(s);
//   } catch {
//     return value;
//   }
// }
// // Strict variant: returns undefined on failure (used for text-first ingestion)
// function tryParseFromText(value: any): any | undefined {
//   if (typeof value !== 'string') return undefined;
//   const m = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
//   const s = m ? m[1] : value;
//   try {
//     return JSON.parse(s);
//   } catch {
//     return undefined;
//   }
// }
// // Parse an entry inside content[] like: { json: { result: "<json-string>" }, type: "json" } or plain obj/string
// function parseContentEntry(entry: any): any | undefined {
//   try {
//     if (entry?.json) {
//       const j = entry.json;
//       if (typeof j?.result === 'string') return JSON.parse(j.result);
//       if (typeof j === 'object') return j;
//     }
//     if (typeof entry === 'string') return JSON.parse(entry);
//     if (entry && typeof entry === 'object') return entry;
//     return undefined;
//   } catch {
//     return undefined;
//   }
// }
// function firstDimFromApplied(applied?: string): DQDimension | undefined {
//   if (!applied) return undefined;
//   const first = applied.split(',')[0]?.trim();
//   return first ? normDim(first) : undefined;
// }
// // Deterministic key so violations aggregate stably across runs when rule_id is missing
// function stableRuleKey(v: any): string {
//   const dim = String(v?.dimension ?? '').toLowerCase();
//   const desc = String(v?.description ?? v?.title ?? v?.text ?? v?.column ?? '').trim();
//   const expr = String(v?.expression ?? '').trim();
//   const key = [dim, desc, expr].filter(Boolean).join('\n');
//   // Fallback only when every part is empty
//   return key || Math.random().toString(36).slice(2);
// }

// /* -------- recognizers for anomaly arrays -------- */
// type RawAnomalyItem = {
//   anomaly_count?: number;            // count (rows)
//   anomaly_pct?: number | string;     // e.g., 12.5 or "12.5%"
//   anomaly_percentage?: number | string;
//   total_rows?: number;               // denominator when available
//   anomaly_type?: string;
//   column?: string;
//   confidence_score?: number;         // 0..1 anomaly likelihood
//   sql_fix?: string;
//   suggested_remediation?: string;
//   [k: string]: any;
// };
// function isAnomalyArrayShape(obj: any): obj is RawAnomalyItem[] {
//   return (
//     Array.isArray(obj) &&
//     obj.some(
//       (it) =>
//         typeof it === 'object' &&
//         ('anomaly_count' in it ||
//          'confidence_score' in it ||
//          'anomaly_type' in it ||
//          'anomaly_pct' in it)
//     )
//   );
// }
// // Map provider anomaly types to our DQ dimensions
// function inferDimFromAnomalyType(t?: string): DQDimension {
//   const s = String(t ?? '').toLowerCase();
//   if (/duplicate|dup/i.test(s)) return 'uniqueness';
//   if (/null|missing|empty/i.test(s)) return 'completeness';
//   if (/format|regex|pattern|type/i.test(s)) return 'validity';
//   if (/inconsisten|mismatch|drift/i.test(s)) return 'consistency';
//   return 'accuracy';
// }
// // Parse percent strings like "15%" → 0.15 (numbers remain as-is)
// function toNumPercent(v: any): number | undefined {
//   if (v === null || v === undefined) return undefined;
//   if (typeof v === 'string') {
//     const s = v.trim();
//     if (s.endsWith('%')) {
//       const n = Number(s.slice(0, -1));
//       return Number.isFinite(n) ? clamp01(n / 100) : undefined;
//     }
//     const n = Number(s);
//     return Number.isFinite(n) ? n : undefined;
//   }
//   if (typeof v === 'number') return v;
//   return undefined;
// }

// /* ------------------- payload recognition ------------------- */
// function inferToolNameFromObj(obj: any): string | undefined {
//   if (!obj || typeof obj !== 'object') return undefined;
//   if (
//     'rules' in obj ||
//     'generated_rules' in obj ||
//     'ruleset' in obj ||
//     'dq_rules' in obj ||
//     'business_rules' in obj ||
//     'items' in obj
//   )
//     return 'SYNTHESISER_AGENT_HIL';
//   if (
//     'checks' in obj ||
//     'dq_result' in obj ||
//     'results' in obj ||
//     'violations' in obj ||
//     'errors' in obj ||
//     'failures' in obj
//   )
//     return 'DATA_INSPECTOR_HIL';
//   if (
//     'anomaly_score' in obj ||
//     'anomalyScore' in obj ||
//     'likelihood' in obj ||
//     'score' in obj ||
//     'risk' in obj
//   )
//     return 'ANOMALY_AGENT_HIL';
//   // NEW: anomalies array present → anomaly tool
//   if ('anomalies' in obj && Array.isArray(obj.anomalies)) return 'ANOMALY_AGENT_HIL';
//   if ('patterns' in obj || 'detected_patterns' in obj || 'regexes' in obj)
//     return 'PATTERN_AGENT_HIL';
//   if ('exec_id' in obj || 'executionId' in obj || 'run_id' in obj) return 'TRACEABILITY_AGENT_HIL';
//   const nested =
//     (obj as any).result ??
//     (obj as any).output ??
//     (obj as any).data ??
//     (obj as any).payload ??
//     (obj as any).content;
//   if (nested && typeof nested === 'object') return inferToolNameFromObj(nested);
//   return undefined;
// }

// /** Coerce alternates to canonical form (TS-safe), and handle anomaly arrays */
// function coerceDQFields(obj: any): any {
//   if (!obj || typeof obj !== 'object') return obj;

//   // If the entire object is the anomaly array, produce a NEW anomaly object
//   if (isAnomalyArrayShape(obj)) {
//     const built = buildAnomalyFromItems(obj as RawAnomalyItem[]);
//     return {
//       anomaly_score: built.score,
//       contributors: built.contributors,
//       notes: built.notes,
//       _derived_violations: built.derivedViolations,
//       metrics: { ...(obj as any).metrics, perColumnPositive: built.perColumnPositive, perDimensionPositive: built.perDimensionPositive },
//     };
//   }

//   // Else flatten common wrappers
//   const core =
//     (obj as any).result ??
//     (obj as any).output ??
//     (obj as any).data ??
//     (obj as any).payload ??
//     (obj as any).content ??
//     obj;

//   const out: any = { ...core };

//   // Treat anomalies[] at the root (file mode) as anomaly source (minimal)
//   try {
//     if (Array.isArray(out.anomalies)) {
//       const built = buildAnomalyFromItems(out.anomalies as RawAnomalyItem[]);
//       out.anomaly_score = built.score;
//       out.contributors = built.contributors;
//       out.notes = built.notes;
//       out._derived_violations = built.derivedViolations;
//       out.metrics = { ...(out.metrics ?? {}), perColumnPositive: built.perColumnPositive, perDimensionPositive: built.perDimensionPositive };
//     }
//   } catch {}

//   // Synthesiser rules aliases
//   out.rules =
//     out.rules ??
//     out.generated_rules ??
//     out.ruleset ??
//     out.dq_rules ??
//     out.business_rules ??
//     (Array.isArray(out.items) ? out.items : out.rules);

//   // Inspector checks aliases (column-wise table → dq_result)
//   out.checks =
//     out.checks ??
//     out.dq_result ??
//     (Array.isArray(out.results) ? out.results : []) ??
//     out.metrics?.checks ??
//     out.checkResults;

//   // Inspector violations array (if present)
//   const vArr = out.violations ?? out.errors ?? out.failures;
//   if (Array.isArray(vArr)) out.violations = vArr;

//   // Anomaly numeric fields
//   out.anomaly_score =
//     toNum(out.anomaly_score) ??
//     toNum(out.anomalyScore) ??
//     toNum(out.likelihood) ??
//     toNum(out.score) ??
//     toNum(out.risk) ??
//     toNum(out.metrics?.anomaly_score) ??
//     out.anomaly;

//   // Patterns / Traceability
//   out.patterns = out.patterns ?? out.detected_patterns ?? out.regexes;
//   out.exec_id = out.exec_id ?? out.executionId ?? out.run_id ?? out.execId ?? out.runId;

//   return out;
// }

// function normalizePayload(p: any, explicitTool?: string): ToolResultPayload | undefined {
//   if (!p) return undefined;
//   const coerced = coerceDQFields(tryParse(p));
//   if (coerced && typeof coerced === 'object' && !(coerced as any).tool) {
//     (coerced as any).tool = explicitTool ?? inferToolNameFromObj(coerced) ?? 'UNKNOWN_TOOL';
//   }
//   return coerced;
// }

// /**
//  * CONTENT-FIRST extractor
//  * - assistant/response text
//  * - merged content from response.content[], timeline tool containers, response.events[].content[]
//  */
// function extractPayloadsFromMessage(msg: any): ToolResultPayload[] {
//   const out: any[] = [];
//   const push = (value: any, path: string, toolHint?: string) => {
//     if (!value) return;
//     const arr = Array.isArray(value) ? value : [value];
//     for (const item of arr) {
//       const normalized = normalizePayload(item, toolHint);
//       if (!normalized) continue;

//       const hasRules = !!(normalized as any).rules;
//       const hasChecks =
//         !!(normalized as any).checks ||
//         !!(normalized as any).dq_result ||
//         !!(normalized as any).results;
//       const hasAnom = typeof (normalized as any).anomaly_score !== 'undefined' ||
//                       Array.isArray((normalized as any).anomalies);

//       const pick = (obj: any, fields: string[]) => {
//         const o: any = {};
//         for (const f of fields) if (typeof (obj as any)[f] !== 'undefined') o[f] = (obj as any)[f];
//         return o;
//       };

//       let emitted = 0;
//       if (hasRules) {
//         const rOnly = pick(normalized, [
//           'rules', 'generated_rules', 'ruleset', 'dq_rules', 'business_rules', 'items', 'tool',
//         ]);
//         rOnly.tool = 'SYNTHESISER_AGENT_HIL';
//         out.push(rOnly);
//         emitted++;
//       }
//       if (hasChecks) {
//         const cOnly = pick(normalized, [
//           'checks', 'dq_result', 'results', 'violations', 'errors', 'failures', 'metrics', 'tool', '_derived_violations',
//         ]);
//         cOnly.tool = 'DATA_INSPECTOR_HIL';
//         out.push(cOnly);
//         emitted++;
//       }
//       if (hasAnom) {
//         const aOnly = pick(normalized, [
//           'anomaly_score', 'severity', 'contributors', 'metrics', 'notes', 'tool', '_derived_violations', 'anomalies',
//         ]);
//         aOnly.tool = 'ANOMALY_AGENT_HIL';
//         out.push(aOnly);
//         emitted++;
//       }

//       if (!emitted) out.push(normalized);
//     }
//   };

//   // assistant & response text
//   const textParsed =
//     tryParseFromText(msg?.text) ??
//     (typeof msg?.text === 'string' ? tryParseFromText(msg.text) : undefined);
//   if (textParsed) push(textParsed, 'assistant.text');

//   const respTextParsed =
//     tryParseFromText(msg?.response?.text) ??
//     (typeof msg?.response?.text === 'string' ? tryParseFromText(msg.response.text) : undefined);
//   if (respTextParsed) push(respTextParsed, 'response.text');

//   // merge content-like payloads
//   const contentLike: any[] = [];
//   if (Array.isArray(msg?.response?.content)) contentLike.push(...msg.response.content);

//   if (Array.isArray(msg?.timeline)) {
//     for (const t of msg.timeline) {
//       if (t?.type === 'tool' || /tool/i.test(String(t?.type))) {
//         const tt = t as any;
//         if (Array.isArray(tt?.content)) contentLike.push(...tt.content);
//         else if (tt?.content) contentLike.push(tt.content);
//         const containers = [tt?.payload, tt?.result, tt?.data, tt?.output].filter(Boolean);
//         for (const box of containers) {
//           if (Array.isArray(box?.content)) contentLike.push(...box.content);
//           else if (box?.content) contentLike.push(box.content);
//           else if (box) contentLike.push(box);
//         }
//       }
//     }
//   }

//   if (Array.isArray(msg?.response?.events)) {
//     for (const e of msg.response.events) {
//       const ce = (e as any)?.content;
//       if (Array.isArray(ce)) contentLike.push(...ce);
//       else if (ce) contentLike.push(ce);
//     }
//   }

//   const parsedContent: any[] = [];
//   for (const part of contentLike) {
//     const parsed = parseContentEntry(part);
//     if (parsed) parsedContent.push(parsed);
//   }
//   if (parsedContent.length) push(parsedContent, 'content:merged');

//   return out as ToolResultPayload[];
// }

// /* ----------------------- Normalizers ----------------------- */
// function deriveViolationsFromChecks(
//   checks: any[],
// ): Array<{ rule_id: string; dimension: DQDimension; description?: string; count: number; last_seen?: string }> {
//   const out: any[] = [];
//   for (const c of checks ?? []) {
//     const count =
//       toNum(c?.count) ??
//       toNum(c?.violations) ??
//       toNum(c?.failures) ??
//       toNum(c?.errors) ??
//       toNum(c?.failed_rows) ??
//       toNum(c?.violations_count) ??
//       toNum(c?.violations_cnt) ??
//       0;
//     if (count && count > 0) {
//       const dim =
//         normDim(c?.dimension ?? c?.dim ?? c?.category) ??
//         firstDimFromApplied(c?.rule_types_applied) ??
//         'accuracy';
//       const v = {
//         rule_id:
//           c?.rule_id ??
//           c?.id ??
//           c?.name ??
//           c?.column ??
//           stableRuleKey({
//             dimension: dim,
//             description: c?.description ?? c?.title ?? c?.text ?? (c?.column ? `Column ${c.column}` : ''),
//           }),
//         dimension: dim,
//         description: c?.description ?? c?.title ?? c?.text ?? (c?.column ? `Column ${c.column}` : undefined),
//         count,
//         last_seen: c?.last_seen ?? c?.checked_at ?? c?.at ?? c?.time ?? c?.timestamp,
//       };
//       out.push(v);
//     }
//   }
//   return out;
// }

// function normalizeSynthesiser(raw: any): SynthesiserResult {
//   const r0 = raw.result ?? raw;
//   const rulesSrc =
//     r0.rules ??
//     r0.generated_rules ??
//     r0.ruleset ??
//     r0.dq_rules ??
//     r0.business_rules ??
//     (Array.isArray(r0.items) ? r0.items : []);
//   const rules = rulesSrc
//     .map((r: any) => {
//       // strict dimension from CATEGORY
//       const dimCat = DIM_MAP[String(r.category ?? '').toLowerCase().trim()];
//       if (!dimCat) return null;
//       return {
//         rule_id: r.rule_id ?? r.id ?? r.name ?? stableRuleKey(r),
//         dimension: dimCat,
//         description: r.description ?? r.title ?? r.text ?? '',
//         expression: r.expression ?? r.sql ?? r.rule ?? r.query ?? undefined,
//         confidence: toNum(r.confidence ?? r.score ?? r.weight),
//         created_at: r.created_at ?? r.time ?? r.timestamp,
//       };
//     })
//     .filter(Boolean) as SynthesiserResult['rules'];
//   return { tool: raw.tool ?? 'SYNTHESISER_AGENT_HIL', rules };
// }

// function normalizeInspector(raw: any): DataInspectorResult {
//   const r0 = raw.result ?? raw;
//   const checksSrc =
//     r0.checks ??
//     r0.dq_result ??
//     (Array.isArray(r0.results) ? r0.results : []) ??
//     r0.metrics?.checks ??
//     r0.checkResults ??
//     [];
//   const checks: DataInspectorResult['checks'] = [];
//   for (const c of checksSrc) {
//     const latestScore = toNumPercent(
//       (c?.dq_score ?? c?.latest_score ?? c?.pass_ratio ?? c?.score ?? c?.rate) as any,
//     );
//     const failedRows =
//       toNum(c?.failed_rows) ??
//       toNum(c?.violations) ??
//       toNum(c?.errors) ??
//       (typeof c?.status === 'string' && /fail/i.test(c.status) ? 1 : 0);

//     const explicitDim = DIM_MAP[String(c?.dimension ?? c?.dim ?? c?.category ?? '').toLowerCase().trim()];
//     const ruleApplied = (c?.rule_applied ?? c?.rules_applied ?? c?.applied_rules ?? c?.rule_types_applied) as string | string[] | undefined;
//     const appliedList: string[] = Array.isArray(ruleApplied)
//       ? ruleApplied.map(String)
//       : String(ruleApplied ?? '')
//           .split(/[,\n]/)
//           .map((s) => s.trim())
//           .filter(Boolean);
//     const appliedDims = Array.from(new Set(appliedList.map((x) => DIM_MAP[String(x).toLowerCase().trim()]).filter(Boolean)));

//     const dimsToEmit: DQDimension[] =
//       explicitDim && DIMS.includes(explicitDim)
//         ? [explicitDim]
//         : appliedDims.length
//         ? appliedDims as DQDimension[]
//         : [];

//     for (const dim of dimsToEmit) {
//       checks.push({
//         rule_id: c?.rule_id ?? c?.id ?? c?.name ?? c?.column ?? stableRuleKey(c),
//         dimension: dim,
//         evaluated_rows: toNum(c?.evaluated_rows ?? c?.rows ?? c?.sample_size ?? c?.total_rows),
//         passed_rows: toNum(c?.passed_rows ?? c?.passed ?? c?.ok),
//         failed_rows: failedRows,
//         latest_score: latestScore,
//         ...(c?.column ? { column: c.column } : {}),
//       } as any);
//     }
//   }

//   const violations = Array.isArray(r0.violations)
//     ? r0.violations.map((v: any) => ({
//         rule_id: v.rule_id ?? v.id ?? v.name ?? stableRuleKey(v),
//         dimension: (v?.dimension as DQDimension) ?? normDim(v?.dim ?? v?.category) ?? 'accuracy',
//         description: v.description ?? v.title ?? v.text,
//         count: toNum(v.count ?? v.violations ?? v.failures ?? v.errors) ?? 0,
//         last_seen: v.last_seen ?? v.at ?? v.time ?? v.timestamp,
//         examples: v.examples,
//       }))
//     : deriveViolationsFromChecks(checksSrc);

//   return { tool: raw.tool ?? 'DATA_INSPECTOR_HIL', checks, violations };
// }

// function buildAnomalyFromItems(items: RawAnomalyItem[]) {
//   const contributors = Array.from(new Set(items.map((it) => it.column).filter(Boolean))) as string[];
//   const notes = Array.from(
//     new Set([
//       ...items.map((it) => it.anomaly_type).filter(Boolean),
//       ...items.map((it) => it.suggested_remediation).filter(Boolean),
//     ]),
//   ) as string[];

//   const byCol: Record<string, { anomaly: number }> = {};
//   const maxCount = items.reduce((m, it) => Math.max(m, toNum(it.anomaly_count) ?? 0), 0);

//   // per-dimension aggregation (for average backfill)
//   const dimAgg: Record<DQDimension, { sum: number; n: number }> = {
//     uniqueness: { sum: 0, n: 0 },
//     validity:   { sum: 0, n: 0 },
//     completeness:{ sum: 0, n: 0 },
//     consistency:{ sum: 0, n: 0 },
//     accuracy:   { sum: 0, n: 0 },
//   };

//   for (const it of items) {
//     const pct =
//       toNumPercent(it.anomaly_pct) ??
//       toNumPercent(it.anomaly_percentage);
//     const conf = toNum(it.confidence_score);
//     const count = toNum(it.anomaly_count);
//     const total = toNum(it.total_rows);

//     let anomalyRatio: number | undefined =
//       pct !== undefined ? clamp01(pct)
//       : conf !== undefined ? clamp01(conf)
//       : count !== undefined && total !== undefined && total > 0 ? clamp01(count / total)
//       : count !== undefined && maxCount > 0 ? clamp01(count / maxCount)
//       : undefined;

//     if (anomalyRatio === undefined) anomalyRatio = 0;

//     const col = String(it.column ?? '').trim();
//     if (col) byCol[col] = { anomaly: anomalyRatio };

//     const dim = inferDimFromAnomalyType(it.anomaly_type);
//     dimAgg[dim].sum += clamp01(anomalyRatio);
//     dimAgg[dim].n += 1;
//   }

//   const overallAnomaly = Object.values(byCol).reduce((m, v) => Math.max(m, clamp01(v.anomaly)), 0);
//   const score = clamp01(overallAnomaly);

//   const derivedViolations = items.map((it) => {
//     const dim = inferDimFromAnomalyType(it.anomaly_type);
//     const count = toNum(it.anomaly_count) ?? 0;
//     const desc = `${it.anomaly_type ?? 'Anomaly'}${it.column ? ` on ${it.column}` : ''}`;
//     return {
//       rule_id: stableRuleKey({ dimension: dim, description: desc, expression: it.sql_fix }),
//       dimension: dim,
//       description: desc,
//       count,
//       last_seen: undefined as string | undefined,
//       examples: undefined as any,
//     };
//   });

//   const perColumnPositive = Object.fromEntries(
//     Object.entries(byCol).map(([col, v]) => [col, +(clamp01(1 - v.anomaly)).toFixed(4)]),
//   );

//   const perDimensionPositive = Object.fromEntries(
//     (Object.keys(dimAgg) as DQDimension[]).map((d) => {
//       const avgAnom = dimAgg[d].n ? dimAgg[d].sum / dimAgg[d].n : 0;
//       return [d, +(clamp01(1 - avgAnom)).toFixed(4)];
//     }),
//   );

//   return { score, contributors, notes, derivedViolations, perColumnPositive, perDimensionPositive };
// }

// function normalizeAnomaly(raw: any): AnomalyResult & { _derived_violations?: any[] } {
//   const r = raw.result ?? raw;

//   // anomalies array at r.anomalies (file mode)
//   if (Array.isArray(r.anomalies) && isAnomalyArrayShape(r.anomalies)) {
//     const built = buildAnomalyFromItems(r.anomalies);
//     return {
//       tool: raw.tool ?? 'ANOMALY_AGENT_HIL',
//       anomaly_score: built.score,
//       severity: severityOf(built.score),
//       contributors: built.contributors,
//       metrics: { perColumnPositive: built.perColumnPositive, perDimensionPositive: built.perDimensionPositive },
//       notes: built.notes,
//       _derived_violations: built.derivedViolations,
//     };
//   }

//   // raw is anomaly array
//   if (Array.isArray(r) && isAnomalyArrayShape(r)) {
//     const built = buildAnomalyFromItems(r);
//     return {
//       tool: raw.tool ?? 'ANOMALY_AGENT_HIL',
//       anomaly_score: built.score,
//       severity: severityOf(built.score),
//       contributors: built.contributors,
//       metrics: { perColumnPositive: built.perColumnPositive, perDimensionPositive: built.perDimensionPositive },
//       notes: built.notes,
//       _derived_violations: built.derivedViolations,
//     };
//   }

//   // Legacy numeric fields
//   const score =
//     toNum(r.anomaly_score) ??
//     toNum(r.anomalyScore) ??
//     toNum(r.likelihood) ??
//     toNum(r.score) ??
//     toNum(r.risk) ??
//     toNum(r.metrics?.anomaly_score) ??
//     0;

//   return {
//     tool: raw.tool ?? 'ANOMALY_AGENT_HIL',
//     anomaly_score: score,
//     severity: r.severity ?? r.severityLevel ?? r.level,
//     contributors: r.contributors ?? r.top_contributors ?? r.columns ?? r.suspects ?? [],
//     metrics: r.metrics,
//     notes: r.notes ?? r.comments ?? [],
//   };
// }

// /* -------------------------- Reducer -------------------------- */
// export function reduceMessagesToDashboard(messages: ChatMessage[]): DashboardState {
//   const state: DashboardState = {
//     dimensionScores: objFromDims(0),
//     ruleDistribution: objFromDims(0),
//     ruleOccurrences: Object.fromEntries(
//       DIMS.map((d) => [d, { rules_defined: 0, checks_reported: 0, violations_detected: 0 }]),
//     ) as DashboardState['ruleOccurrences'],
//     anomaly: null,
//     anomalyInsights: { top_contributors: [], notes: [] },
//     ruleViolationsTable: [],
//   };

//   const sum = objFromDims(0);
//   const cnt = objFromDims(0);
//   const violationsByRule = new Map<string, { dim: DimensionKey; desc?: string; count: number; last?: string }>();
//   const inspectorColumns = new Set<string>();

//   for (const msg of messages) {
//     const toolPayloads: ToolResultPayload[] = extractPayloadsFromMessage(msg);

//     for (const raw of toolPayloads) {
//       const tool = (((raw as any)?.tool ?? '') as string).toUpperCase();

//       // Synthesiser → rules & distribution
//       if (tool.includes('SYNTHESISER')) {
//         const r = normalizeSynthesiser(raw);
//         for (const rule of r.rules) {
//           const dim = rule.dimension as DQDimension;
//           if (DIMS.includes(dim)) {
//             state.ruleDistribution[dim] += 1;
//             state.ruleOccurrences[dim].rules_defined += 1;
//           }
//         }
//       }

//       // Inspector → checks & violations
//       if (tool.includes('DATA_INSPECTOR')) {
//         const r = normalizeInspector(raw);
//         for (const check of r.checks) {
//           const dim = check.dimension as DQDimension;
//           const colName = (check as any)?.column;
//           if (typeof colName === 'string' && colName.trim()) inspectorColumns.add(colName.trim());
//           if (DIMS.includes(dim)) {
//             if (typeof check.latest_score === 'number') {
//               sum[dim] += clamp01(check.latest_score);
//               cnt[dim] += 1;
//             }
//             state.ruleOccurrences[dim].checks_reported += 1;
//           }
//         }
//         for (const v of r.violations ?? []) {
//           const dim = v.dimension as DQDimension;
//           if (DIMS.includes(dim)) {
//             state.ruleOccurrences[dim].violations_detected += v.count ?? 0;
//           }
//           const key = v.rule_id ?? stableRuleKey(v);
//           const prev = violationsByRule.get(key) ?? { dim, desc: undefined, count: 0, last: undefined };
//           violationsByRule.set(key, {
//             dim,
//             desc: prev.desc ?? v.description,
//             count: prev.count + (v.count ?? 0),
//             last: v.last_seen ?? prev.last,
//           });
//         }
//       }

//       // Anomaly → score & contributors (+ derived violations)
//       if (tool.includes('ANOMALY')) {
//         const a = normalizeAnomaly(raw);
//         const score = clamp01(a.anomaly_score ?? 0);
//         const sev = (a.severity as any) ?? severityOf(score);

//         if (!state.anomaly) {
//           state.anomaly = {
//             score,
//             severity: sev,
//             contributors: a.contributors ?? [],
//             metrics: a.metrics,
//             notes: a.notes,
//           };
//           state.anomalyInsights.top_contributors = a.contributors ?? [];
//           state.anomalyInsights.notes = a.notes ?? [];
//         } else {
//           if (score > (state.anomaly.score ?? 0)) {
//             state.anomaly = {
//               score,
//               severity: sev,
//               contributors: a.contributors ?? [],
//               metrics: a.metrics,
//               notes: a.notes,
//             };
//             state.anomalyInsights.top_contributors = a.contributors ?? [];
//             state.anomalyInsights.notes = a.notes ?? [];
//           } else if (score === state.anomaly.score) {
//             const mergedNotes = Array.from(new Set([...(state.anomaly.notes ?? []), ...(a.notes ?? [])]));
//             state.anomaly.notes = mergedNotes;
//             state.anomalyInsights.notes = mergedNotes;
//             const mergedContribs = Array.from(new Set([...(state.anomaly.contributors ?? []), ...(a.contributors ?? [])]));
//             state.anomaly.contributors = mergedContribs;
//             state.anomalyInsights.top_contributors = mergedContribs;

//             const incomingPos = (a.metrics as any)?.perColumnPositive;
//             if (incomingPos && !state.anomaly.metrics?.perColumnPositive) {
//               state.anomaly.metrics = { ...(state.anomaly.metrics ?? {}), perColumnPositive: incomingPos };
//             }
//             const incomingDimPos = (a.metrics as any)?.perDimensionPositive;
//             if (incomingDimPos && !state.anomaly.metrics?.perDimensionPositive) {
//               state.anomaly.metrics = { ...(state.anomaly.metrics ?? {}), perDimensionPositive: incomingDimPos };
//             }
//           }
//         }

//         const derived = (a as any)._derived_violations as any[] | undefined;
//         if (Array.isArray(derived)) {
//           for (const v of derived) {
//             const dim = v.dimension as DQDimension;
//             if (DIMS.includes(dim)) {
//               state.ruleOccurrences[dim].violations_detected += v.count ?? 0;
//             }
//             const key = v.rule_id ?? stableRuleKey(v);
//             const prev = violationsByRule.get(key) ?? { dim, desc: undefined, count: 0, last: undefined };
//             violationsByRule.set(key, {
//               dim,
//               desc: prev.desc ?? v.description,
//               count: prev.count + (v.count ?? 0),
//               last: v.last_seen ?? prev.last,
//             });
//           }
//         }
//       }
//     }
//   }

//   // Finalize dimensionScores as averages (from checks)
//   for (const d of DIMS) {
//     state.dimensionScores[d] = cnt[d] ? +((sum[d] / cnt[d]).toFixed(4)) : 0;
//   }

//   // Backfill from anomaly perDimensionPositive when checks are absent
//   if (state.anomaly?.metrics?.perDimensionPositive) {
//     const pd = state.anomaly.metrics.perDimensionPositive as Record<DQDimension, number>;
//     for (const d of DIMS) {
//       if (!cnt[d] && typeof pd[d] === 'number') {
//         state.dimensionScores[d] = +pd[d].toFixed(4);
//       }
//     }
//   }

//   // Fill perColumnPositive with 100% for inspector columns not present in anomaly map
//   if (state.anomaly) {
//     const pos = (state.anomaly.metrics?.perColumnPositive ?? {}) as Record<string, number>;
//     inspectorColumns.forEach((col) => {
//       if (typeof pos[col] === 'undefined') pos[col] = 1; // 100% positive when no anomaly present
//     });
//     state.anomaly.metrics = { ...(state.anomaly.metrics ?? {}), perColumnPositive: pos };
//   }

//   // Build violations table
//   state.ruleViolationsTable = Array.from(violationsByRule.entries())
//     .map(([k, v]) => ({
//       rule_id: k,
//       dimension: prettyDim(v.dim),
//       description: v.desc,
//       violations: v.count,
//       last_seen: v.last,
//     }))
//     .sort((a, b) => b.violations - a.violations);

//   return state;
// }


// trying again -working 7jan


// // src/dq/dqAggregator.ts
// import type { ChatMessage } from '../types/chat';
// import type {
//   ToolResultPayload,
//   SynthesiserResult,
//   DataInspectorResult,
//   AnomalyResult,
//   DQDimension,
// } from '../types/dqToolResults';

// export type DimensionKey = DQDimension;

// export interface DashboardState {
//   dimensionScores: Record<DimensionKey, number>;
//   ruleDistribution: Record<DimensionKey, number>;
//   ruleOccurrences: Record<
//     DimensionKey,
//     { rules_defined: number; checks_reported: number; violations_detected: number }
//   >;
//   anomaly:
//     | {
//         score: number;
//         severity: 'low' | 'moderate' | 'high' | 'critical';
//         contributors: string[];
//         metrics?: { perColumnPositive?: Record<string, number>; [k: string]: any };
//         notes?: string[];
//       }
//     | null;
//   anomalyInsights: { top_contributors: string[]; notes: string[] };
//   ruleViolationsTable: Array<{
//     rule_id: string;
//     display_rule_id?: string; // clean label for UI
//     dimension: string;
//     description?: string;
//     violations: number;
//     last_seen?: string;
//   }>;
// }

// /* ------------------------- helpers ------------------------- */
// const DIMS: DimensionKey[] = ['uniqueness', 'validity', 'completeness', 'consistency', 'accuracy'];
// const objFromDims = <T,>(v: T) =>
//   Object.fromEntries(DIMS.map((d) => [d, v])) as Record<DimensionKey, T>;

// const clamp01 = (x: number) => Math.max(0, Math.min(1, x ?? 0));
// const toNum = (v: any) => {
//   if (v === null || v === undefined) return undefined;
//   const n = typeof v === 'string' ? Number(v) : v;
//   return Number.isFinite(n) ? n : undefined;
// };

// const DIM_MAP: Record<string, DQDimension> = {
//   uniqueness: 'uniqueness',
//   unique: 'uniqueness',
//   validity: 'validity',
//   valid: 'validity',
//   completeness: 'completeness',
//   complete: 'completeness',
//   consistency: 'consistency',
//   consistent: 'consistency',
//   accuracy: 'accuracy',
//   accurate: 'accuracy',
// };

// function normDim(s: any): DQDimension {
//   const k = String(s ?? '').toLowerCase().trim();
//   return (DIM_MAP[k] ?? 'accuracy') as DQDimension;
// }
// function prettyDim(d: DQDimension) {
//   return d[0].toUpperCase() + d.slice(1);
// }
// function severityOf(score: number): 'low' | 'moderate' | 'high' | 'critical' {
//   return score >= 0.85 ? 'critical' : score >= 0.65 ? 'high' : score >= 0.35 ? 'moderate' : 'low';
// }

// // parse JSON, also support fenced ```json blocks (returns original value if not JSON)
// function tryParse(value: any): any {
//   if (typeof value !== 'string') return value;
//   const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
//   const s = fenced ? fenced[1] : value;
//   try {
//     return JSON.parse(s);
//   } catch {
//     return value;
//   }
// }
// // Strict variant: returns undefined on failure (used for text-first ingestion)
// function tryParseFromText(value: any): any | undefined {
//   if (typeof value !== 'string') return undefined;
//   const m = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
//   const s = m ? m[1] : value;
//   try {
//     return JSON.parse(s);
//   } catch {
//     return undefined;
//   }
// }

// // Parse an entry inside content[] like: { json: { result: "<json-string>" }, type: "json" } or plain obj/string
// function parseContentEntry(entry: any): any | undefined {
//   try {
//     if (entry?.json) {
//       const j = entry.json;
//       if (typeof j?.result === 'string') return JSON.parse(j.result);
//       if (typeof j === 'object') return j;
//     }
//     if (typeof entry === 'string') return JSON.parse(entry);
//     if (entry && typeof entry === 'object') return entry;
//     return undefined;
//   } catch {
//     return undefined;
//   }
// }

// // Deterministic key so violations aggregate stably across runs when rule_id is missing
// function stableRuleKey(v: any): string {
//   const dim = String(v?.dimension ?? '').toLowerCase();
//   const desc = String(v?.description ?? v?.title ?? v?.text ?? v?.column ?? '').trim();
//   const expr = String(v?.expression ?? '').trim();
//   const key = [dim, desc, expr].filter(Boolean).join('\n');
//   // Fallback only when every part is empty
//   return key || Math.random().toString(36).slice(2);
// }

// function strictDimFromCategory(cat?: any): DQDimension | undefined {
//   const k = String(cat ?? '').toLowerCase().trim();
//   const m = DIM_MAP[k];
//   return m && DIMS.includes(m) ? m : undefined; // no default to 'accuracy' here
// }

// function pickCaseInsensitive(obj: any, canonicalNames: string[]): any {
//   if (!obj || typeof obj !== 'object') return undefined;
//   const wanted = new Set(
//     canonicalNames.map((n) => n.toLowerCase().replace(/\s+/g, '_').trim()),
//   );
//   for (const [key, val] of Object.entries(obj)) {
//     const lc = key.toLowerCase().replace(/\s+/g, '_').trim();
//     if (wanted.has(lc)) return val;
//   }
//   return undefined;
// }

// function firstDimFromApplied(applied?: string): DQDimension | undefined {
//   if (!applied) return undefined;
//   const first = applied.split(',')[0]?.trim();
//   return first ? normDim(first) : undefined;
// }

// // Optional helpers to clean IDs for UI
// function tokenishId(s?: string): boolean {
//   if (!s) return false;
//   return /^[A-Za-z0-9_.:\-#]{1,40}$/.test(s);
// }
// function shortHash(s: string): string {
//   let h = 0;
//   for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
//   return (h >>> 0).toString(16).slice(0, 6);
// }
// function prettyRuleId(ruleId?: string, description?: string): string {
//   if (tokenishId(ruleId)) return ruleId!;
//   const hasSQLish = !!ruleId?.match(/\b(select|update|insert|delete|create|alter|merge)\b/i);
//   if (!ruleId || hasSQLish || ruleId.length > 40 || /\s/.test(ruleId)) {
//     if (description && description.trim()) {
//       const trimmed = description.trim();
//       return trimmed.length > 60 ? trimmed.slice(0, 57) + '…' : trimmed;
//     }
//     return `Rule-${shortHash(ruleId || 'unknown')}`;
//   }
//   return ruleId;
// }

// /* -------- recognizers for anomaly arrays -------- */
// type RawAnomalyItem = {
//   anomaly_count?: number;            // count (rows)
//   anomaly_pct?: number | string;     // e.g., 12.5 or "12.5%"
//   anomaly_percentage?: number | string;
//   total_rows?: number;               // denominator when available
//   anomaly_type?: string;
//   column?: string;
//   confidence_score?: number;         // 0..1 anomaly likelihood
//   sql_fix?: string;
//   suggested_remediation?: string;
//   [k: string]: any;
// };
// function isAnomalyArrayShape(obj: any): obj is RawAnomalyItem[] {
//   return (
//     Array.isArray(obj) &&
//     obj.some(
//       (it) =>
//         typeof it === 'object' &&
//         ('anomaly_count' in it ||
//          'confidence_score' in it ||
//          'anomaly_type' in it ||
//          'anomaly_pct' in it)
//     )
//   );
// }

// // Map provider anomaly types to our DQ dimensions
// function inferDimFromAnomalyType(t?: string): DQDimension {
//   const s = String(t ?? '').toLowerCase();
//   if (/duplicate|dup/i.test(s)) return 'uniqueness';
//   if (/null|missing|empty/i.test(s)) return 'completeness';
//   if (/format|regex|pattern|type/i.test(s)) return 'validity';
//   if (/inconsisten|mismatch|drift/i.test(s)) return 'consistency';
//   return 'accuracy';
// }

// // Parse percent strings like "15%" → 0.15 (numbers remain as-is)
// function toNumPercent(v: any): number | undefined {
//   if (v === null || v === undefined) return undefined;
//   if (typeof v === 'string') {
//     const s = v.trim();
//     if (s.endsWith('%')) {
//       const n = Number(s.slice(0, -1));
//       return Number.isFinite(n) ? clamp01(n / 100) : undefined;
//     }
//     const n = Number(s);
//     return Number.isFinite(n) ? n : undefined;
//   }
//   if (typeof v === 'number') return v;
//   return undefined;
// }

// /* ------------------- payload recognition ------------------- */
// function inferToolNameFromObj(obj: any): string | undefined {
//   if (!obj || typeof obj !== 'object') return undefined;
//   if (
//     'rules' in obj ||
//     'generated_rules' in obj ||
//     'ruleset' in obj ||
//     'dq_rules' in obj ||
//     'business_rules' in obj ||
//     'items' in obj
//   )
//     return 'SYNTHESISER_AGENT_HIL';
//   if (
//     'checks' in obj ||
//     'dq_result' in obj ||
//     'results' in obj ||
//     'violations' in obj ||
//     'errors' in obj ||
//     'failures' in obj
//   )
//     return 'DATA_INSPECTOR_HIL';
//   if (
//     'anomaly_score' in obj ||
//     'anomalyScore' in obj ||
//     'likelihood' in obj ||
//     'score' in obj ||
//     'risk' in obj
//   )
//     return 'ANOMALY_AGENT_HIL';
//   // NEW: anomalies array present → anomaly tool
//   if ('anomalies' in obj && Array.isArray(obj.anomalies)) return 'ANOMALY_AGENT_HIL';
//   if ('patterns' in obj || 'detected_patterns' in obj || 'regexes' in obj)
//     return 'PATTERN_AGENT_HIL';
//   if ('exec_id' in obj || 'executionId' in obj || 'run_id' in obj) return 'TRACEABILITY_AGENT_HIL';
//   const nested =
//     (obj as any).result ??
//     (obj as any).output ??
//     (obj as any).data ??
//     (obj as any).payload ??
//     (obj as any).content;
//   if (nested && typeof nested === 'object') return inferToolNameFromObj(nested);
//   return undefined;
// }

// /** Coerce alternates to canonical form (TS-safe), and handle anomaly arrays */
// function coerceDQFields(obj: any): any {
//   if (!obj || typeof obj !== 'object') return obj;

//   // If the entire object is the anomaly array, produce a NEW anomaly object
//   if (isAnomalyArrayShape(obj)) {
//     const built = buildAnomalyFromItems(obj as RawAnomalyItem[]);
//     return {
//       anomaly_score: built.score,
//       contributors: built.contributors,
//       notes: built.notes,
//       _derived_violations: built.derivedViolations,
//       metrics: {
//         ...(obj as any).metrics,
//         perColumnPositive: built.perColumnPositive,
//         perDimensionPositive: built.perDimensionPositive,
//       },
//     };
//   }

//   // Else flatten common wrappers
//   const core =
//     (obj as any).result ??
//     (obj as any).output ??
//     (obj as any).data ??
//     (obj as any).payload ??
//     (obj as any).content ??
//     obj;

//   const out: any = { ...core };

//   // Treat anomalies[] at the root (file mode) as anomaly source
//   try {
//     if (Array.isArray(out.anomalies)) {
//       const built = buildAnomalyFromItems(out.anomalies as RawAnomalyItem[]);
//       out.anomaly_score = built.score;
//       out.contributors = built.contributors;
//       out.notes = built.notes;
//       out._derived_violations = built.derivedViolations;
//       out.metrics = {
//         ...(out.metrics ?? {}),
//         perColumnPositive: built.perColumnPositive,
//         perDimensionPositive: built.perDimensionPositive,
//       };
//     }
//   } catch {}

//   // Synthesiser rules aliases
//   out.rules =
//     out.rules ??
//     out.generated_rules ??
//     out.ruleset ??
//     out.dq_rules ??
//     out.business_rules ??
//     (Array.isArray(out.items) ? out.items : out.rules);

//   // Inspector checks aliases (column-wise table → dq_result)
//   out.checks =
//     out.checks ??
//     out.dq_result ??
//     (Array.isArray(out.results) ? out.results : []) ??
//     out.metrics?.checks ??
//     out.checkResults;

//   // Inspector violations array (if present)
//   const vArr = out.violations ?? out.errors ?? out.failures;
//   if (Array.isArray(vArr)) out.violations = vArr;

//   // Anomaly numeric fields
//   out.anomaly_score =
//     toNum(out.anomaly_score) ??
//     toNum(out.anomalyScore) ??
//     toNum(out.likelihood) ??
//     toNum(out.score) ??
//     toNum(out.risk) ??
//     toNum(out.metrics?.anomaly_score) ??
//     out.anomaly;

//   // Patterns / Traceability
//   out.patterns = out.patterns ?? out.detected_patterns ?? out.regexes;
//   out.exec_id = out.exec_id ?? out.executionId ?? out.run_id ?? out.execId ?? out.runId;

//   return out;
// }

// function normalizePayload(p: any, explicitTool?: string): ToolResultPayload | undefined {
//   if (!p) return undefined;
//   const coerced = coerceDQFields(tryParse(p));
//   if (coerced && typeof coerced === 'object' && !(coerced as any).tool) {
//     (coerced as any).tool = explicitTool ?? inferToolNameFromObj(coerced) ?? 'UNKNOWN_TOOL';
//   }
//   return coerced;
// }

// /**
//  * CONTENT-FIRST extractor:
//  * - assistant.text (fenced/plain JSON)
//  * - response.text (fenced/plain JSON)
//  * - MERGED content from response.content[], timeline tool containers, response.events[].content[]
//  */
// function extractPayloadsFromMessage(msg: any): ToolResultPayload[] {
//   const out: any[] = [];
//   const push = (value: any, path: string, toolHint?: string) => {
//     if (!value) return;
//     const arr = Array.isArray(value) ? value : [value];
//     for (const item of arr) {
//       const normalized = normalizePayload(item, toolHint);
//       if (!normalized) continue;

//       const hasRules = !!(normalized as any).rules;
//       const hasChecks =
//         !!(normalized as any).checks ||
//         !!(normalized as any).dq_result ||
//         !!(normalized as any).results;
//       const hasAnom =
//         typeof (normalized as any).anomaly_score !== 'undefined' ||
//         Array.isArray((normalized as any).anomalies);

//       const pick = (obj: any, fields: string[]) => {
//         const o: any = {};
//         for (const f of fields) if (typeof (obj as any)[f] !== 'undefined') o[f] = (obj as any)[f];
//         return o;
//       };

//       let emitted = 0;
//       if (hasRules) {
//         const rOnly = pick(normalized, [
//           'rules', 'generated_rules', 'ruleset', 'dq_rules', 'business_rules', 'items', 'tool',
//         ]);
//         rOnly.tool = 'SYNTHESISER_AGENT_HIL';
//         out.push(rOnly);
//         emitted++;
//       }
//       if (hasChecks) {
//         const cOnly = pick(normalized, [
//           'checks', 'dq_result', 'results', 'violations', 'errors', 'failures', 'metrics', 'tool', '_derived_violations',
//         ]);
//         cOnly.tool = 'DATA_INSPECTOR_HIL';
//         out.push(cOnly);
//         emitted++;
//       }
//       if (hasAnom) {
//         const aOnly = pick(normalized, [
//           'anomaly_score', 'severity', 'contributors', 'metrics', 'notes', 'tool', '_derived_violations', 'anomalies',
//         ]);
//         aOnly.tool = 'ANOMALY_AGENT_HIL';
//         out.push(aOnly);
//         emitted++;
//       }

//       if (!emitted) out.push(normalized);

//       if (typeof window !== 'undefined' && (window as any).DQ_DEBUG) {
//         console.log(
//           `[DQ] extracted payload from ${path}: ` +
//             JSON.stringify(
//               { tool: (normalized as any).tool, keys: Object.keys(normalized as any), emittedRecords: emitted || 1 },
//               null,
//               2,
//             ),
//         );
//       }
//     }
//   };

//   // assistant & response text
//   const textParsed =
//     tryParseFromText(msg?.text) ??
//     (typeof msg?.text === 'string' ? tryParseFromText(msg.text) : undefined);
//   if (textParsed) push(textParsed, 'assistant.text');

//   const respTextParsed =
//     tryParseFromText(msg?.response?.text) ??
//     (typeof msg?.response?.text === 'string' ? tryParseFromText(msg.response.text) : undefined);
//   if (respTextParsed) push(respTextParsed, 'response.text');

//   // merge content-like payloads
//   const contentLike: any[] = [];
//   if (Array.isArray(msg?.response?.content)) contentLike.push(...msg.response.content);

//   if (Array.isArray(msg?.timeline)) {
//     for (const t of msg.timeline) {
//       if (t?.type === 'tool' || /tool/i.test(String(t?.type))) {
//         const tt = t as any;
//         if (Array.isArray(tt?.content)) contentLike.push(...tt.content);
//         else if (tt?.content) contentLike.push(tt.content);
//         const containers = [tt?.payload, tt?.result, tt?.data, tt?.output].filter(Boolean);
//         for (const box of containers) {
//           if (Array.isArray(box?.content)) contentLike.push(...box.content);
//           else if (box?.content) contentLike.push(box.content);
//           else if (box) contentLike.push(box);
//         }
//       }
//     }
//   }

//   if (Array.isArray(msg?.response?.events)) {
//     for (const e of msg.response.events) {
//       const ce = (e as any)?.content;
//       if (Array.isArray(ce)) contentLike.push(...ce);
//       else if (ce) contentLike.push(ce);
//     }
//   }

//   const parsedContent: any[] = [];
//   for (const part of contentLike) {
//     const parsed = parseContentEntry(part);
//     if (parsed) parsedContent.push(parsed);
//   }
//   if (parsedContent.length) push(parsedContent, 'content:merged');

//   const payloads = out as ToolResultPayload[];
//   if (typeof window !== 'undefined' && (window as any).DQ_DEBUG) {
//     console.log('[DQ][Agg] total extracted payloads for msg', msg?.id, '=>', payloads.length);
//   }
//   return payloads;
// }

// /* -------- NEW helpers for Data Inspector -------- */
// // Split “Rule Applied” strings/arrays into normalized DQ dimensions
// function splitAppliedDims(applied: any): DQDimension[] {
//   if (!applied) return [];
//   const rawList: string[] = Array.isArray(applied)
//     ? applied.map(String)
//     : String(applied)
//         .split(/[,\n]/) // handle "Completeness, Uniqueness" and newline-separated entries
//         .map((s) => s.trim())
//         .filter(Boolean);
//   const dims = rawList.map(normDim).filter((d) => DIMS.includes(d));
//   return Array.from(new Set(dims)); // de-duplicate
// }

// /* ----------------------- Normalizers ----------------------- */
// function deriveViolationsFromChecks(
//   checks: any[],
// ): Array<{ rule_id: string; dimension: DQDimension; description?: string; count: number; last_seen?: string }> {
//   const out: any[] = [];
//   for (const c of checks ?? []) {
//     const count =
//       toNum(c?.count) ??
//       toNum(c?.violations) ??
//       toNum(c?.failures) ??
//       toNum(c?.errors) ??
//       toNum(c?.failed_rows) ??
//       toNum(c?.violations_count) ??
//       toNum(c?.violations_cnt) ??
//       0;
//     if (count && count > 0) {
//       const dim =
//         normDim(c?.dimension ?? c?.dim ?? c?.category) ??
//         firstDimFromApplied(c?.rule_types_applied) ??
//         'accuracy';
//       const v = {
//         rule_id:
//           c?.rule_id ??
//           c?.id ??
//           c?.name ??
//           c?.column ??
//           stableRuleKey({
//             dimension: dim,
//             description: c?.description ?? c?.title ?? c?.text ?? (c?.column ? `Column ${c.column}` : ''),
//           }),
//         dimension: dim,
//         description: c?.description ?? c?.title ?? c?.text ?? (c?.column ? `Column ${c.column}` : undefined),
//         count,
//         last_seen: c?.last_seen ?? c?.checked_at ?? c?.at ?? c?.time ?? c?.timestamp,
//       };
//       out.push(v);
//     }
//   }
//   return out;
// }

// function normalizeSynthesiser(raw: any): SynthesiserResult {
//   const r0 = raw.result ?? raw;
//   const rulesSrc =
//     r0.rules ??
//     r0.generated_rules ??
//     r0.ruleset ??
//     r0.dq_rules ??
//     r0.business_rules ??
//     (Array.isArray(r0.items) ? r0.items : []);
//   const rules = rulesSrc
//     .map((r: any) => {
//       const dimCat = strictDimFromCategory(r.category);
//       if (!dimCat) return null; // prevents phantom 'Accuracy'
//       return {
//         rule_id: r.rule_id ?? r.id ?? r.name ?? stableRuleKey(r),
//         dimension: dimCat,
//         description: r.description ?? r.title ?? r.text ?? '',
//         expression: r.expression ?? r.sql ?? r.rule ?? r.query ?? undefined,
//         confidence: toNum(r.confidence ?? r.score ?? r.weight),
//         created_at: r.created_at ?? r.time ?? r.timestamp,
//       };
//     })
//     .filter(Boolean) as SynthesiserResult['rules'];
//   return { tool: raw.tool ?? 'SYNTHESISER_AGENT_HIL', rules };
// }

// /**
//  * STRICT: Inspector rows—no default to 'accuracy' for averages.
//  * Dimensions are taken from explicit category or Rule Applied.
//  * Column captured case-insensitively.
//  */
// function normalizeInspector(raw: any): DataInspectorResult {
//   const r0 = raw.result ?? raw;
//   const checksSrc =
//     r0.checks ??
//     r0.dq_result ??
//     (Array.isArray(r0.results) ? r0.results : []) ??
//     r0.metrics?.checks ??
//     r0.checkResults ??
//     [];

//   const checks: DataInspectorResult['checks'] = [];
//   for (const c of checksSrc) {
//     // DQ score variants
//     const dqRaw =
//       pickCaseInsensitive(c, ['dq_score', 'latest_score', 'pass_ratio', 'score', 'rate']) ??
//       (c as any)?.DQ_Score ??
//       (c as any)?.DQ;
//     const latestScore = toNumPercent(dqRaw);

//     const failedRows =
//       toNum(c?.failed_rows) ??
//       toNum(c?.violations) ??
//       toNum(c?.errors) ??
//       (typeof c?.status === 'string' && /fail/i.test(c.status) ? 1 : 0);

//     const explicitDim: DQDimension | undefined =
//       strictDimFromCategory(c?.dimension) ??
//       strictDimFromCategory(c?.dim) ??
//       strictDimFromCategory(c?.category);

//     const appliedRaw =
//       pickCaseInsensitive(c, ['rule_applied', 'rules_applied', 'applied_rules', 'rule_types_applied']) ??
//       (c as any)?.Rule_Applied ??
//       (c as any)?.Applied_Rules;
//     const appliedDims = splitAppliedDims(appliedRaw);

//     const dimsToEmit: DQDimension[] =
//       explicitDim && DIMS.includes(explicitDim)
//         ? [explicitDim]
//         : appliedDims.length
//         ? appliedDims
//         : [];

//     // Case-insensitive column capture
//     const colRaw =
//       pickCaseInsensitive(c, ['column', 'col', 'field', 'name']) ??
//       (c as any)?.Column;
//     const colName = typeof colRaw === 'string' && colRaw.trim() ? colRaw.trim() : undefined;

//     for (const dim of dimsToEmit) {
//       checks.push({
//         rule_id: c?.rule_id ?? c?.id ?? c?.name ?? (colName || stableRuleKey(c)),
//         dimension: dim,
//         evaluated_rows: toNum(c?.evaluated_rows ?? c?.rows ?? c?.sample_size ?? c?.total_rows),
//         passed_rows: toNum(c?.passed_rows ?? c?.passed ?? c?.ok),
//         failed_rows: failedRows,
//         latest_score: latestScore,
//         ...(colName ? { column: colName } : {}),
//       } as any);
//     }
//   }

//   const violations = Array.isArray(r0.violations)
//     ? r0.violations.map((v: any) => ({
//         rule_id: v.rule_id ?? v.id ?? v.name ?? stableRuleKey(v),
//         dimension: (v?.dimension as DQDimension) ?? normDim(v?.dim ?? v?.category) ?? 'accuracy',
//         description: v.description ?? v.title ?? v.text,
//         count: toNum(v.count ?? v.violations ?? v.failures ?? v.errors) ?? 0,
//         last_seen: v.last_seen ?? v.at ?? v.time ?? v.timestamp,
//         examples: v.examples,
//       }))
//     : deriveViolationsFromChecks(checksSrc);

//   return { tool: raw.tool ?? 'DATA_INSPECTOR_HIL', checks, violations };
// }

// function buildAnomalyFromItems(items: RawAnomalyItem[]) {
//   const contributors = Array.from(new Set(items.map((it) => it.column).filter(Boolean))) as string[];
//   const notes = Array.from(
//     new Set([
//       ...items.map((it) => it.anomaly_type).filter(Boolean),
//       ...items.map((it) => it.suggested_remediation).filter(Boolean),
//     ]),
//   ) as string[];

//   const byCol: Record<string, { anomaly: number }> = {};
//   const maxCount = items.reduce((m, it) => Math.max(m, toNum(it.anomaly_count) ?? 0), 0);

//   // per-dimension aggregation (for average backfill)
//   const dimAgg: Record<DQDimension, { sum: number; n: number }> = {
//     uniqueness: { sum: 0, n: 0 },
//     validity:   { sum: 0, n: 0 },
//     completeness:{ sum: 0, n: 0 },
//     consistency:{ sum: 0, n: 0 },
//     accuracy:   { sum: 0, n: 0 },
//   };

//   for (const it of items) {
//     const pct =
//       toNumPercent(it.anomaly_pct) ??
//       toNumPercent(it.anomaly_percentage);
//     const conf = toNum(it.confidence_score);
//     const count = toNum(it.anomaly_count);
//     const total = toNum(it.total_rows);

//     let anomalyRatio: number | undefined =
//       pct !== undefined ? clamp01(pct)
//       : conf !== undefined ? clamp01(conf)
//       : count !== undefined && total !== undefined && total > 0 ? clamp01(count / total)
//       : count !== undefined && maxCount > 0 ? clamp01(count / maxCount)
//       : undefined;

//     if (anomalyRatio === undefined) anomalyRatio = 0;

//     const col = String(it.column ?? '').trim();
//     if (col) byCol[col] = { anomaly: anomalyRatio };

//     const dim = inferDimFromAnomalyType(it.anomaly_type);
//     dimAgg[dim].sum += clamp01(anomalyRatio);
//     dimAgg[dim].n += 1;
//   }

//   const overallAnomaly = Object.values(byCol).reduce((m, v) => Math.max(m, clamp01(v.anomaly)), 0);
//   const score = clamp01(overallAnomaly);

//   const derivedViolations = items.map((it) => {
//     const dim = inferDimFromAnomalyType(it.anomaly_type);
//     const count = toNum(it.anomaly_count) ?? 0;
//     const desc = `${it.anomaly_type ?? 'Anomaly'}${it.column ? ` on ${it.column}` : ''}`;
//     return {
//       rule_id: stableRuleKey({ dimension: dim, description: desc, expression: it.sql_fix }),
//       dimension: dim,
//       description: desc,
//       count,
//       last_seen: undefined as string | undefined,
//       examples: undefined as any,
//     };
//   });

//   const perColumnPositive = Object.fromEntries(
//     Object.entries(byCol).map(([col, v]) => [col, +(clamp01(1 - v.anomaly)).toFixed(4)]),
//   );

//   const perDimensionPositive = Object.fromEntries(
//     (Object.keys(dimAgg) as DQDimension[]).map((d) => {
//       const avgAnom = dimAgg[d].n ? dimAgg[d].sum / dimAgg[d].n : 0;
//       return [d, +(clamp01(1 - avgAnom)).toFixed(4)];
//     }),
//   );

//   return { score, contributors, notes, derivedViolations, perColumnPositive, perDimensionPositive };
// }

// function normalizeAnomaly(raw: any): AnomalyResult & { _derived_violations?: any[] } {
//   const r = raw.result ?? raw;

//   // anomalies array at r.anomalies (file mode)
//   if (Array.isArray(r.anomalies) && isAnomalyArrayShape(r.anomalies)) {
//     const built = buildAnomalyFromItems(r.anomalies);
//     return {
//       tool: raw.tool ?? 'ANOMALY_AGENT_HIL',
//       anomaly_score: built.score,
//       severity: severityOf(built.score),
//       contributors: built.contributors,
//       metrics: { perColumnPositive: built.perColumnPositive, perDimensionPositive: built.perDimensionPositive },
//       notes: built.notes,
//       _derived_violations: built.derivedViolations,
//     };
//   }

//   // raw is anomaly array
//   if (Array.isArray(r) && isAnomalyArrayShape(r)) {
//     const built = buildAnomalyFromItems(r);
//     return {
//       tool: raw.tool ?? 'ANOMALY_AGENT_HIL',
//       anomaly_score: built.score,
//       severity: severityOf(built.score),
//       contributors: built.contributors,
//       metrics: { perColumnPositive: built.perColumnPositive, perDimensionPositive: built.perDimensionPositive },
//       notes: built.notes,
//       _derived_violations: built.derivedViolations,
//     };
//   }

//   // Legacy numeric fields
//   const score =
//     toNum(r.anomaly_score) ??
//     toNum(r.anomalyScore) ??
//     toNum(r.likelihood) ??
//     toNum(r.score) ??
//     toNum(r.risk) ??
//     toNum(r.metrics?.anomaly_score) ??
//     0;

//   return {
//     tool: raw.tool ?? 'ANOMALY_AGENT_HIL',
//     anomaly_score: score,
//     severity: r.severity ?? r.severityLevel ?? r.level,
//     contributors: r.contributors ?? r.top_contributors ?? r.columns ?? r.suspects ?? [],
//     metrics: r.metrics,
//     notes: r.notes ?? r.comments ?? [],
//   };
// }

// /* -------------------------- Reducer -------------------------- */
// export function reduceMessagesToDashboard(messages: ChatMessage[]): DashboardState {
//   const state: DashboardState = {
//     dimensionScores: objFromDims(0),
//     ruleDistribution: objFromDims(0),
//     ruleOccurrences: Object.fromEntries(
//       DIMS.map((d) => [d, { rules_defined: 0, checks_reported: 0, violations_detected: 0 }]),
//     ) as DashboardState['ruleOccurrences'],
//     anomaly: null,
//     anomalyInsights: { top_contributors: [], notes: [] },
//     ruleViolationsTable: [],
//   };

//   const sum = objFromDims(0);
//   const cnt = objFromDims(0);
//   const violationsByRule = new Map<string, { dim: DimensionKey; desc?: string; count: number; last?: string }>();
//   const inspectorColumns = new Set<string>();

//   if (typeof window !== 'undefined' && (window as any).DQ_DEBUG) {
//     console.log('[DQ][Agg] messages passed to reducer:', messages.length);
//   }

//   for (const msg of messages) {
//     const toolPayloads: ToolResultPayload[] = extractPayloadsFromMessage(msg);

//     for (const raw of toolPayloads) {
//       const tool = (((raw as any)?.tool ?? '') as string).toUpperCase();

//       // Synthesiser → rules & distribution
//       if (tool.includes('SYNTHESISER')) {
//         const r = normalizeSynthesiser(raw);
//         for (const rule of r.rules) {
//           const dim = rule.dimension as DQDimension;
//           if (DIMS.includes(dim)) {
//             state.ruleDistribution[dim] += 1;
//             state.ruleOccurrences[dim].rules_defined += 1;
//           }
//         }
//       }

//       // Inspector → checks & violations
//       if (tool.includes('DATA_INSPECTOR')) {
//         const r = normalizeInspector(raw);
//         for (const check of r.checks) {
//           const dim = check.dimension as DQDimension;
//           const colName = (check as any)?.column;
//           if (typeof colName === 'string' && colName.trim()) inspectorColumns.add(colName.trim());
//           if (DIMS.includes(dim)) {
//             if (typeof check.latest_score === 'number') {
//               sum[dim] += clamp01(check.latest_score);
//               cnt[dim] += 1;
//             }
//             state.ruleOccurrences[dim].checks_reported += 1;
//           }
//         }
//         for (const v of r.violations ?? []) {
//           const dim = v.dimension as DQDimension;
//           if (DIMS.includes(dim)) {
//             state.ruleOccurrences[dim].violations_detected += v.count ?? 0;
//           }
//           const key = v.rule_id ?? stableRuleKey(v);
//           const prev = violationsByRule.get(key) ?? { dim, desc: undefined, count: 0, last: undefined };
//           violationsByRule.set(key, {
//             dim,
//             desc: prev.desc ?? v.description,
//             count: prev.count + (v.count ?? 0),
//             last: v.last_seen ?? prev.last,
//           });
//         }
//       }

//       // Anomaly → score & contributors (+ derived violations)
//       if (tool.includes('ANOMALY')) {
//         const a = normalizeAnomaly(raw);
//         const score = clamp01(a.anomaly_score ?? 0);
//         const sev = (a.severity as any) ?? severityOf(score);

//         if (!state.anomaly) {
//           state.anomaly = {
//             score,
//             severity: sev,
//             contributors: a.contributors ?? [],
//             metrics: a.metrics,
//             notes: a.notes,
//           };
//           state.anomalyInsights.top_contributors = a.contributors ?? [];
//           state.anomalyInsights.notes = a.notes ?? [];
//         } else {
//           if (score > (state.anomaly.score ?? 0)) {
//             state.anomaly = {
//               score,
//               severity: sev,
//               contributors: a.contributors ?? [],
//               metrics: a.metrics,
//               notes: a.notes,
//             };
//             state.anomalyInsights.top_contributors = a.contributors ?? [];
//             state.anomalyInsights.notes = a.notes ?? [];
//           } else if (score === state.anomaly.score) {
//             const mergedNotes = Array.from(new Set([...(state.anomaly.notes ?? []), ...(a.notes ?? [])]));
//             state.anomaly.notes = mergedNotes;
//             state.anomalyInsights.notes = mergedNotes;
//             const mergedContribs = Array.from(new Set([...(state.anomaly.contributors ?? []), ...(a.contributors ?? [])]));
//             state.anomaly.contributors = mergedContribs;
//             state.anomalyInsights.top_contributors = mergedContribs;

//             const incomingPos = (a.metrics as any)?.perColumnPositive;
//             if (incomingPos && !state.anomaly.metrics?.perColumnPositive) {
//               state.anomaly.metrics = { ...(state.anomaly.metrics ?? {}), perColumnPositive: incomingPos };
//             }
//             const incomingDimPos = (a.metrics as any)?.perDimensionPositive;
//             if (incomingDimPos && !state.anomaly.metrics?.perDimensionPositive) {
//               state.anomaly.metrics = { ...(state.anomaly.metrics ?? {}), perDimensionPositive: incomingDimPos };
//             }
//           }
//         }

//         const derived = (a as any)._derived_violations as any[] | undefined;
//         if (Array.isArray(derived)) {
//           for (const v of derived) {
//             const dim = v.dimension as DQDimension;
//             if (DIMS.includes(dim)) {
//               state.ruleOccurrences[dim].violations_detected += v.count ?? 0;
//             }
//             const key = v.rule_id ?? stableRuleKey(v);
//             const prev = violationsByRule.get(key) ?? { dim, desc: undefined, count: 0, last: undefined };
//             violationsByRule.set(key, {
//               dim,
//               desc: prev.desc ?? v.description,
//               count: prev.count + (v.count ?? 0),
//               last: v.last_seen ?? prev.last,
//             });
//           }
//         }
//       }
//     }
//   }

//   // Finalize dimensionScores as averages (from checks)
//   for (const d of DIMS) {
//     state.dimensionScores[d] = cnt[d] ? +((sum[d] / cnt[d]).toFixed(4)) : 0;
//   }

//   // Backfill from anomaly perDimensionPositive when checks are absent
//   if (state.anomaly?.metrics?.perDimensionPositive) {
//     const pd = state.anomaly.metrics.perDimensionPositive as Record<DQDimension, number>;
//     for (const d of DIMS) {
//       if (!cnt[d] && typeof pd[d] === 'number') {
//         state.dimensionScores[d] = +pd[d].toFixed(4);
//       }
//     }
//   }

//   // Fill perColumnPositive with 100% for inspector columns not present in anomaly map
//   if (state.anomaly) {
//     const pos = (state.anomaly.metrics?.perColumnPositive ?? {}) as Record<string, number>;
//     inspectorColumns.forEach((col) => {
//       if (typeof pos[col] === 'undefined') pos[col] = 1; // 100% positive when no anomaly present
//     });
//     state.anomaly.metrics = { ...(state.anomaly.metrics ?? {}), perColumnPositive: pos };
//   }

//   // Build violations table with clean display IDs
//   state.ruleViolationsTable = Array.from(violationsByRule.entries())
//     .map(([k, v]) => ({
//       rule_id: k,
//       display_rule_id: prettyRuleId(k, v.desc), // clean label for UI
//       dimension: prettyDim(v.dim),
//       description: v.desc,
//       violations: v.count,
//       last_seen: v.last,
//     }))
//     .sort((a, b) => b.violations - a.violations);

//   if (typeof window !== 'undefined' && (window as any).DQ_DEBUG) {
//     const totals = {
//       rules: Object.values(state.ruleDistribution).reduce((a, b) => a + b, 0),
//       checks: Object.values(state.ruleOccurrences).reduce((a, b: any) => a + b.checks_reported, 0),
//       violations: Object.values(state.ruleOccurrences).reduce((a, b: any) => a + b.violations_detected, 0),
//       anomalyScore: state.anomaly?.score ?? 0,
//       anomalySeverity: state.anomaly?.severity ?? 'low',
//     };
//     console.log('[DQ] Aggregated totals:\n' + JSON.stringify(totals, null, 2));
//     console.log(
//       `[DQ] Health: rules=${totals.rules}, checks=${totals.checks}, violations=${totals.violations}, ` +
//         `anomaly=${Math.round((totals.anomalyScore ?? 0) * 100)}% (${totals.anomalySeverity})`,
//     );
//   }

//   return state;
// }
// // ----------------------- END OF FILE -----------------------



// trying 

// working for file partial for table

// // src/dq/dqAggregator.ts
// import type { ChatMessage } from '../types/chat';
// import type {
//   ToolResultPayload,
//   SynthesiserResult,
//   DataInspectorResult,
//   AnomalyResult,
//   DQDimension,
// } from '../types/dqToolResults';

// export type DimensionKey = DQDimension;

// export interface DashboardState {
//   dimensionScores: Record<DimensionKey, number>;
//   ruleDistribution: Record<DimensionKey, number>;
//   ruleOccurrences: Record<
//     DimensionKey,
//     { rules_defined: number; checks_reported: number; violations_detected: number }
//   >;
//   anomaly:
//     | {
//         score: number;
//         severity: 'low' | 'moderate' | 'high' | 'critical';
//         contributors: string[];
//         metrics?: { perColumnPositive?: Record<string, number>; [k: string]: any };
//         notes?: string[];
//       }
//     | null;
//   anomalyInsights: { top_contributors: string[]; notes: string[] };
//   ruleViolationsTable: Array<{
//     rule_id: string;
//     display_rule_id?: string; // clean label for UI
//     dimension: string;
//     description?: string;
//     violations: number;
//     last_seen?: string;
//   }>;
// }

// /* ------------------------- helpers ------------------------- */
// const DIMS: DimensionKey[] = ['uniqueness', 'validity', 'completeness', 'consistency', 'accuracy'];
// const objFromDims = <T,>(v: T) =>
//   Object.fromEntries(DIMS.map((d) => [d, v])) as Record<DimensionKey, T>;

// const clamp01 = (x: number) => Math.max(0, Math.min(1, x ?? 0));
// const toNum = (v: any) => {
//   if (v === null || v === undefined) return undefined;
//   const n = typeof v === 'string' ? Number(v) : v;
//   return Number.isFinite(n) ? n : undefined;
// };

// const DIM_MAP: Record<string, DQDimension> = {
//   uniqueness: 'uniqueness',
//   unique: 'uniqueness',
//   validity: 'validity',
//   valid: 'validity',
//   completeness: 'completeness',
//   complete: 'completeness',
//   consistency: 'consistency',
//   consistent: 'consistency',
//   accuracy: 'accuracy',
//   accurate: 'accuracy',
// };

// function normDim(s: any): DQDimension {
//   const k = String(s ?? '').toLowerCase().trim();
//   return (DIM_MAP[k] ?? 'accuracy') as DQDimension;
// }
// function prettyDim(d: DQDimension) {
//   return d[0].toUpperCase() + d.slice(1);
// }
// function severityOf(score: number): 'low' | 'moderate' | 'high' | 'critical' {
//   return score >= 0.85 ? 'critical' : score >= 0.65 ? 'high' : score >= 0.35 ? 'moderate' : 'low';
// }

// // parse JSON, also support fenced ```json blocks (returns original value if not JSON)
// function tryParse(value: any): any {
//   if (typeof value !== 'string') return value;
//   const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
//   const s = fenced ? fenced[1] : value;
//   try {
//     return JSON.parse(s);
//   } catch {
//     return value;
//   }
// }
// // Strict variant: returns undefined on failure (used for text-first ingestion)
// function tryParseFromText(value: any): any | undefined {
//   if (typeof value !== 'string') return undefined;
//   const m = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
//   const s = m ? m[1] : value;
//   try {
//     return JSON.parse(s);
//   } catch {
//     return undefined;
//   }
// }

// // Parse an entry inside content[] like: { json: { result: "<json-string>" }, type: "json" } or plain obj/string
// function parseContentEntry(entry: any): any | undefined {
//   try {
//     if (entry?.json) {
//       const j = entry.json;
//       if (typeof j?.result === 'string') return JSON.parse(j.result);
//       if (typeof j === 'object') return j;
//     }
//     if (typeof entry === 'string') return JSON.parse(entry);
//     if (entry && typeof entry === 'object') return entry;
//     return undefined;
//   } catch {
//     return undefined;
//   }
// }

// // Deterministic key so violations aggregate stably across runs when rule_id is missing
// function stableRuleKey(v: any): string {
//   const dim = String(v?.dimension ?? '').toLowerCase();
//   const desc = String(v?.description ?? v?.title ?? v?.text ?? v?.column ?? '').trim();
//   const expr = String(v?.expression ?? '').trim();
//   const key = [dim, desc, expr].filter(Boolean).join('\n');
//   // Fallback only when every part is empty
//   return key || Math.random().toString(36).slice(2);
// }

// function strictDimFromCategory(cat?: any): DQDimension | undefined {
//   const k = String(cat ?? '').toLowerCase().trim();
//   const m = DIM_MAP[k];
//   return m && DIMS.includes(m) ? m : undefined; // no default to 'accuracy' here
// }

// function pickCaseInsensitive(obj: any, canonicalNames: string[]): any {
//   if (!obj || typeof obj !== 'object') return undefined;
//   const wanted = new Set(
//     canonicalNames.map((n) => n.toLowerCase().replace(/\s+/g, '_').trim()),
//   );
//   for (const [key, val] of Object.entries(obj)) {
//     const lc = key.toLowerCase().replace(/\s+/g, '_').trim();
//     if (wanted.has(lc)) return val;
//   }
//   return undefined;
// }

// function firstDimFromApplied(applied?: string): DQDimension | undefined {
//   if (!applied) return undefined;
//   const first = applied.split(',')[0]?.trim();
//   return first ? normDim(first) : undefined;
// }

// // Optional helpers to clean IDs for UI
// function tokenishId(s?: string): boolean {
//   if (!s) return false;
//   return /^[A-Za-z0-9_.:\-#]{1,40}$/.test(s);
// }
// function shortHash(s: string): string {
//   let h = 0;
//   for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
//   return (h >>> 0).toString(16).slice(0, 6);
// }
// function prettyRuleId(ruleId?: string, description?: string): string {
//   if (tokenishId(ruleId)) return ruleId!;
//   const hasSQLish = !!ruleId?.match(/\b(select|update|insert|delete|create|alter|merge)\b/i);
//   if (!ruleId || hasSQLish || ruleId.length > 40 || /\s/.test(ruleId)) {
//     if (description && description.trim()) {
//       const trimmed = description.trim();
//       return trimmed.length > 60 ? trimmed.slice(0, 57) + '…' : trimmed;
//     }
//     return `Rule-${shortHash(ruleId || 'unknown')}`;
//   }
//   return ruleId;
// }

// /* -------- recognizers for anomaly arrays -------- */
// type RawAnomalyItem = {
//   anomaly_count?: number;            // count (rows)
//   anomaly_pct?: number | string;     // e.g., 12.5 or "12.5%"
//   anomaly_percentage?: number | string;
//   total_rows?: number;               // denominator when available
//   anomaly_type?: string;
//   column?: string;
//   confidence_score?: number;         // 0..1 anomaly likelihood
//   sql_fix?: string;
//   suggested_remediation?: string;
//   [k: string]: any;
// };
// function isAnomalyArrayShape(obj: any): obj is RawAnomalyItem[] {
//   return (
//     Array.isArray(obj) &&
//     obj.some(
//       (it) =>
//         typeof it === 'object' &&
//         ('anomaly_count' in it ||
//          'confidence_score' in it ||
//          'anomaly_type' in it ||
//          'anomaly_pct' in it)
//     )
//   );
// }

// // Map provider anomaly types to our DQ dimensions
// function inferDimFromAnomalyType(t?: string): DQDimension {
//   const s = String(t ?? '').toLowerCase();
//   if (/duplicate|dup/i.test(s)) return 'uniqueness';
//   if (/null|missing|empty/i.test(s)) return 'completeness';
//   if (/format|regex|pattern|type/i.test(s)) return 'validity';
//   if (/inconsisten|mismatch|drift/i.test(s)) return 'consistency';
//   return 'accuracy';
// }

// // Parse percent strings like "15%" → 0.15 (numbers remain as-is)
// function toNumPercent(v: any): number | undefined {
//   if (v === null || v === undefined) return undefined;
//   if (typeof v === 'string') {
//     const s = v.trim();
//     if (s.endsWith('%')) {
//       const n = Number(s.slice(0, -1));
//       return Number.isFinite(n) ? clamp01(n / 100) : undefined;
//     }
//     const n = Number(s);
//     return Number.isFinite(n) ? n : undefined;
//   }
//   if (typeof v === 'number') return v;
//   return undefined;
// }

// /* ------------------- payload recognition ------------------- */
// function inferToolNameFromObj(obj: any): string | undefined {
//   if (!obj || typeof obj !== 'object') return undefined;
//   if (
//     'rules' in obj ||
//     'generated_rules' in obj ||
//     'ruleset' in obj ||
//     'dq_rules' in obj ||
//     'business_rules' in obj ||
//     'items' in obj
//   )
//     return 'SYNTHESISER_AGENT_HIL';
//   if (
//     'checks' in obj ||
//     'dq_result' in obj ||
//     'results' in obj ||
//     'violations' in obj ||
//     'errors' in obj ||
//     'failures' in obj
//   )
//     return 'DATA_INSPECTOR_HIL';
//   if (
//     'anomaly_score' in obj ||
//     'anomalyScore' in obj ||
//     'likelihood' in obj ||
//     'score' in obj ||
//     'risk' in obj
//   )
//     return 'ANOMALY_AGENT_HIL';
//   // anomalies array present → anomaly tool
//   if ('anomalies' in obj && Array.isArray(obj.anomalies)) return 'ANOMALY_AGENT_HIL';
//   if ('patterns' in obj || 'detected_patterns' in obj || 'regexes' in obj)
//     return 'PATTERN_AGENT_HIL';
//   if ('exec_id' in obj || 'executionId' in obj || 'run_id' in obj) return 'TRACEABILITY_AGENT_HIL';
//   const nested =
//     (obj as any).result ??
//     (obj as any).output ??
//     (obj as any).data ??
//     (obj as any).payload ??
//     (obj as any).content;
//   if (nested && typeof nested === 'object') return inferToolNameFromObj(nested);
//   return undefined;
// }

// /** Coerce alternates to canonical form (TS-safe), and handle anomaly arrays */
// function coerceDQFields(obj: any): any {
//   if (!obj || typeof obj !== 'object') return obj;

//   // If the entire object is the anomaly array, produce a NEW anomaly object
//   if (isAnomalyArrayShape(obj)) {
//     const built = buildAnomalyFromItems(obj as RawAnomalyItem[]);
//     return {
//       anomaly_score: built.score,
//       contributors: built.contributors,
//       notes: built.notes,
//       _derived_violations: built.derivedViolations,
//       metrics: {
//         ...(obj as any).metrics,
//         perColumnPositive: built.perColumnPositive,
//         perDimensionPositive: built.perDimensionPositive,
//       },
//     };
//   }

//   // Else flatten common wrappers
//   const core =
//     (obj as any).result ??
//     (obj as any).output ??
//     (obj as any).data ??
//     (obj as any).payload ??
//     (obj as any).content ??
//     obj;

//   const out: any = { ...core };

//   // Treat anomalies[] at the root (file mode) as anomaly source
//   try {
//     if (Array.isArray(out.anomalies)) {
//       const built = buildAnomalyFromItems(out.anomalies as RawAnomalyItem[]);
//       out.anomaly_score = built.score;
//       out.contributors = built.contributors;
//       out.notes = built.notes;
//       out._derived_violations = built.derivedViolations;
//       out.metrics = {
//         ...(out.metrics ?? {}),
//         perColumnPositive: built.perColumnPositive,
//         perDimensionPositive: built.perDimensionPositive,
//       };
//     }
//   } catch {}

//   // Synthesiser rules aliases
//   out.rules =
//     out.rules ??
//     out.generated_rules ??
//     out.ruleset ??
//     out.dq_rules ??
//     out.business_rules ??
//     (Array.isArray(out.items) ? out.items : out.rules);

//   // Inspector checks aliases (column-wise table → dq_result)
//   out.checks =
//     out.checks ??
//     out.dq_result ??
//     (Array.isArray(out.results) ? out.results : []) ??
//     out.metrics?.checks ??
//     out.checkResults;

//   // Inspector violations array (if present)
//   const vArr = out.violations ?? out.errors ?? out.failures;
//   if (Array.isArray(vArr)) out.violations = vArr;

//   // Anomaly numeric fields
//   out.anomaly_score =
//     toNum(out.anomaly_score) ??
//     toNum(out.anomalyScore) ??
//     toNum(out.likelihood) ??
//     toNum(out.score) ??
//     toNum(out.risk) ??
//     toNum(out.metrics?.anomaly_score) ??
//     out.anomaly;

//   // Patterns / Traceability
//   out.patterns = out.patterns ?? out.detected_patterns ?? out.regexes;
//   out.exec_id = out.exec_id ?? out.executionId ?? out.run_id ?? out.execId ?? out.runId;

//   return out;
// }

// function normalizePayload(p: any, explicitTool?: string): ToolResultPayload | undefined {
//   if (!p) return undefined;
//   const coerced = coerceDQFields(tryParse(p));
//   if (coerced && typeof coerced === 'object' && !(coerced as any).tool) {
//     (coerced as any).tool = explicitTool ?? inferToolNameFromObj(coerced) ?? 'UNKNOWN_TOOL';
//   }
//   return coerced;
// }

// /**
//  * CONTENT-FIRST extractor:
//  * - assistant.text (fenced/plain JSON)
//  * - response.text (fenced/plain JSON)
//  * - MERGED content from response.content[], timeline tool containers, response.events[].content[]
//  */
// function extractPayloadsFromMessage(msg: any): ToolResultPayload[] {
//   const out: any[] = [];
//   const push = (value: any, path: string, toolHint?: string) => {
//     if (!value) return;
//     const arr = Array.isArray(value) ? value : [value];
//     for (const item of arr) {
//       const normalized = normalizePayload(item, toolHint);
//       if (!normalized) continue;

//       const hasRules = !!(normalized as any).rules;
//       const hasChecks =
//         !!(normalized as any).checks ||
//         !!(normalized as any).dq_result ||
//         !!(normalized as any).results;
//       const hasAnom =
//         typeof (normalized as any).anomaly_score !== 'undefined' ||
//         Array.isArray((normalized as any).anomalies);

//       const pick = (obj: any, fields: string[]) => {
//         const o: any = {};
//         for (const f of fields) if (typeof (obj as any)[f] !== 'undefined') o[f] = (obj as any)[f];
//         return o;
//       };

//       let emitted = 0;
//       if (hasRules) {
//         const rOnly = pick(normalized, [
//           'rules', 'generated_rules', 'ruleset', 'dq_rules', 'business_rules', 'items', 'tool',
//         ]);
//         rOnly.tool = 'SYNTHESISER_AGENT_HIL';
//         out.push(rOnly);
//         emitted++;
//       }
//       if (hasChecks) {
//         const cOnly = pick(normalized, [
//           'checks', 'dq_result', 'results', 'violations', 'errors', 'failures', 'metrics', 'tool', '_derived_violations',
//         ]);
//         cOnly.tool = 'DATA_INSPECTOR_HIL';
//         out.push(cOnly);
//         emitted++;
//       }
//       if (hasAnom) {
//         // include 'columns' so reducer can see full dataset columns in file mode
//         const aOnly = pick(normalized, [
//           'anomaly_score', 'severity', 'contributors', 'metrics', 'notes', 'tool', '_derived_violations', 'anomalies', 'columns',
//         ]);
//         aOnly.tool = 'ANOMALY_AGENT_HIL';
//         out.push(aOnly);
//         emitted++;
//       }

//       if (!emitted) out.push(normalized);

//       if (typeof window !== 'undefined' && (window as any).DQ_DEBUG) {
//         console.log(
//           `[DQ] extracted payload from ${path}: ` +
//             JSON.stringify(
//               { tool: (normalized as any).tool, keys: Object.keys(normalized as any), emittedRecords: emitted || 1 },
//               null,
//               2,
//             ),
//         );
//       }
//     }
//   };

//   // assistant & response text
//   const textParsed =
//     tryParseFromText(msg?.text) ??
//     (typeof msg?.text === 'string' ? tryParseFromText(msg.text) : undefined);
//   if (textParsed) push(textParsed, 'assistant.text');

//   const respTextParsed =
//     tryParseFromText(msg?.response?.text) ??
//     (typeof msg?.response?.text === 'string' ? tryParseFromText(msg.response.text) : undefined);
//   if (respTextParsed) push(respTextParsed, 'response.text');

//   // merge content-like payloads
//   const contentLike: any[] = [];
//   if (Array.isArray(msg?.response?.content)) contentLike.push(...msg.response.content);

//   if (Array.isArray(msg?.timeline)) {
//     for (const t of msg.timeline) {
//       if (t?.type === 'tool' || /tool/i.test(String(t?.type))) {
//         const tt = t as any;
//         if (Array.isArray(tt?.content)) contentLike.push(...tt.content);
//         else if (tt?.content) contentLike.push(tt.content);
//         const containers = [tt?.payload, tt?.result, tt?.data, tt?.output].filter(Boolean);
//         for (const box of containers) {
//           if (Array.isArray(box?.content)) contentLike.push(...box.content);
//           else if (box?.content) contentLike.push(box.content);
//           else if (box) contentLike.push(box);
//         }
//       }
//     }
//   }

//   if (Array.isArray(msg?.response?.events)) {
//     for (const e of msg.response.events) {
//       const ce = (e as any)?.content;
//       if (Array.isArray(ce)) contentLike.push(...ce);
//       else if (ce) contentLike.push(ce);
//     }
//   }

//   const parsedContent: any[] = [];
//   for (const part of contentLike) {
//     const parsed = parseContentEntry(part);
//     if (parsed) parsedContent.push(parsed);
//   }
//   if (parsedContent.length) push(parsedContent, 'content:merged');

//   const payloads = out as ToolResultPayload[];
//   if (typeof window !== 'undefined' && (window as any).DQ_DEBUG) {
//     console.log('[DQ][Agg] total extracted payloads for msg', msg?.id, '=>', payloads.length);
//   }
//   return payloads;
// }

// /* -------- NEW helpers for Data Inspector -------- */
// // Split “Rule Applied” strings/arrays into normalized DQ dimensions
// function splitAppliedDims(applied: any): DQDimension[] {
//   if (!applied) return [];
//   const rawList: string[] = Array.isArray(applied)
//     ? applied.map(String)
//     : String(applied)
//         .split(/[,\n]/) // handle "Completeness, Uniqueness" and newline-separated entries
//         .map((s) => s.trim())
//         .filter(Boolean);
//   const dims = rawList.map(normDim).filter((d) => DIMS.includes(d));
//   return Array.from(new Set(dims)); // de-duplicate
// }

// /* ----------------------- Normalizers ----------------------- */
// function deriveViolationsFromChecks(
//   checks: any[],
// ): Array<{ rule_id: string; dimension: DQDimension; description?: string; count: number; last_seen?: string }> {
//   const out: any[] = [];
//   for (const c of checks ?? []) {
//     const count =
//       toNum(c?.count) ??
//       toNum(c?.violations) ??
//       toNum(c?.failures) ??
//       toNum(c?.errors) ??
//       toNum(c?.failed_rows) ??
//       toNum(c?.violations_count) ??
//       toNum(c?.violations_cnt) ??
//       0;
//     if (count && count > 0) {
//       const dim =
//         normDim(c?.dimension ?? c?.dim ?? c?.category) ??
//         firstDimFromApplied(c?.rule_types_applied) ??
//         'accuracy';
//       const v = {
//         rule_id:
//           c?.rule_id ??
//           c?.id ??
//           c?.name ??
//           c?.column ??
//           stableRuleKey({
//             dimension: dim,
//             description: c?.description ?? c?.title ?? c?.text ?? (c?.column ? `Column ${c.column}` : ''),
//           }),
//         dimension: dim,
//         description: c?.description ?? c?.title ?? c?.text ?? (c?.column ? `Column ${c.column}` : undefined),
//         count,
//         last_seen: c?.last_seen ?? c?.checked_at ?? c?.at ?? c?.time ?? c?.timestamp,
//       };
//       out.push(v);
//     }
//   }
//   return out;
// }

// function normalizeSynthesiser(raw: any): SynthesiserResult {
//   const r0 = raw.result ?? raw;
//   const rulesSrc =
//     r0.rules ??
//     r0.generated_rules ??
//     r0.ruleset ??
//     r0.dq_rules ??
//     r0.business_rules ??
//     (Array.isArray(r0.items) ? r0.items : []);
//   const rules = rulesSrc
//     .map((r: any) => {
//       const dimCat = strictDimFromCategory(r.category);
//       if (!dimCat) return null; // prevents phantom 'Accuracy'
//       return {
//         rule_id: r.rule_id ?? r.id ?? r.name ?? stableRuleKey(r),
//         dimension: dimCat,
//         description: r.description ?? r.title ?? r.text ?? '',
//         expression: r.expression ?? r.sql ?? r.rule ?? r.query ?? undefined,
//         confidence: toNum(r.confidence ?? r.score ?? r.weight),
//         created_at: r.created_at ?? r.time ?? r.timestamp,
//       };
//     })
//     .filter(Boolean) as SynthesiserResult['rules'];
//   return { tool: raw.tool ?? 'SYNTHESISER_AGENT_HIL', rules };
// }

// /**
//  * STRICT: Inspector rows—no default to 'accuracy' for averages.
//  * Dimensions are taken from explicit category or Rule Applied.
//  * Column captured case-insensitively.
//  */
// function normalizeInspector(raw: any): DataInspectorResult {
//   const r0 = raw.result ?? raw;
//   const checksSrc =
//     r0.checks ??
//     r0.dq_result ??
//     (Array.isArray(r0.results) ? r0.results : []) ??
//     r0.metrics?.checks ??
//     r0.checkResults ??
//     [];

//   const checks: DataInspectorResult['checks'] = [];
//   for (const c of checksSrc) {
//     // DQ score variants
//     const dqRaw =
//       pickCaseInsensitive(c, ['dq_score', 'latest_score', 'pass_ratio', 'score', 'rate']) ??
//       (c as any)?.DQ_Score ??
//       (c as any)?.DQ;
//     const latestScore = toNumPercent(dqRaw);

//     const failedRows =
//       toNum(c?.failed_rows) ??
//       toNum(c?.violations) ??
//       toNum(c?.errors) ??
//       (typeof c?.status === 'string' && /fail/i.test(c.status) ? 1 : 0);

//     const explicitDim: DQDimension | undefined =
//       strictDimFromCategory(c?.dimension) ??
//       strictDimFromCategory(c?.dim) ??
//       strictDimFromCategory(c?.category);

//     const appliedRaw =
//       pickCaseInsensitive(c, ['rule_applied', 'rules_applied', 'applied_rules', 'rule_types_applied']) ??
//       (c as any)?.Rule_Applied ??
//       (c as any)?.Applied_Rules;
//     const appliedDims = splitAppliedDims(appliedRaw);

//     const dimsToEmit: DQDimension[] =
//       explicitDim && DIMS.includes(explicitDim)
//         ? [explicitDim]
//         : appliedDims.length
//         ? appliedDims
//         : [];

//     // Case-insensitive column capture
//     const colRaw =
//       pickCaseInsensitive(c, ['column', 'col', 'field', 'name']) ??
//       (c as any)?.Column;
//     const colName = typeof colRaw === 'string' && colRaw.trim() ? colRaw.trim() : undefined;

//     for (const dim of dimsToEmit) {
//       checks.push({
//         rule_id: c?.rule_id ?? c?.id ?? c?.name ?? (colName || stableRuleKey(c)),
//         dimension: dim,
//         evaluated_rows: toNum(c?.evaluated_rows ?? c?.rows ?? c?.sample_size ?? c?.total_rows),
//         passed_rows: toNum(c?.passed_rows ?? c?.passed ?? c?.ok),
//         failed_rows: failedRows,
//         latest_score: latestScore,
//         ...(colName ? { column: colName } : {}),
//       } as any);
//     }
//   }

//   const violations = Array.isArray(r0.violations)
//     ? r0.violations.map((v: any) => ({
//         rule_id: v.rule_id ?? v.id ?? v.name ?? stableRuleKey(v),
//         dimension: (v?.dimension as DQDimension) ?? normDim(v?.dim ?? v?.category) ?? 'accuracy',
//         description: v.description ?? v.title ?? v.text,
//         count: toNum(v.count ?? v.violations ?? v.failures ?? v.errors) ?? 0,
//         last_seen: v.last_seen ?? v.at ?? v.time ?? v.timestamp,
//         examples: v.examples,
//       }))
//     : deriveViolationsFromChecks(checksSrc);

//   return { tool: raw.tool ?? 'DATA_INSPECTOR_HIL', checks, violations };
// }

// function buildAnomalyFromItems(items: RawAnomalyItem[]) {
//   const contributors = Array.from(new Set(items.map((it) => it.column).filter(Boolean))) as string[];
//   const notes = Array.from(
//     new Set([
//       ...items.map((it) => it.anomaly_type).filter(Boolean),
//       ...items.map((it) => it.suggested_remediation).filter(Boolean),
//     ]),
//   ) as string[];

//   const byCol: Record<string, { anomaly: number }> = {};
//   const maxCount = items.reduce((m, it) => Math.max(m, toNum(it.anomaly_count) ?? 0), 0);

//   // per-dimension aggregation (for average backfill)
//   const dimAgg: Record<DQDimension, { sum: number; n: number }> = {
//     uniqueness: { sum: 0, n: 0 },
//     validity:   { sum: 0, n: 0 },
//     completeness:{ sum: 0, n: 0 },
//     consistency:{ sum: 0, n: 0 },
//     accuracy:   { sum: 0, n: 0 },
//   };

//   for (const it of items) {
//     const pct =
//       toNumPercent(it.anomaly_pct) ??
//       toNumPercent(it.anomaly_percentage);
//     const conf = toNum(it.confidence_score);
//     const count = toNum(it.anomaly_count);
//     const total = toNum(it.total_rows);

//     let anomalyRatio: number | undefined =
//       pct !== undefined ? clamp01(pct)
//       : conf !== undefined ? clamp01(conf)
//       : count !== undefined && total !== undefined && total > 0 ? clamp01(count / total)
//       : count !== undefined && maxCount > 0 ? clamp01(count / maxCount)
//       : undefined;

//     if (anomalyRatio === undefined) anomalyRatio = 0;

//     const col = String(it.column ?? '').trim();
//     if (col) byCol[col] = { anomaly: anomalyRatio };

//     const dim = inferDimFromAnomalyType(it.anomaly_type);
//     dimAgg[dim].sum += clamp01(anomalyRatio);
//     dimAgg[dim].n += 1;
//   }

//   const overallAnomaly = Object.values(byCol).reduce((m, v) => Math.max(m, clamp01(v.anomaly)), 0);
//   const score = clamp01(overallAnomaly);

//   const derivedViolations = items.map((it) => {
//     const dim = inferDimFromAnomalyType(it.anomaly_type);
//     const count = toNum(it.anomaly_count) ?? 0;
//     const desc = `${it.anomaly_type ?? 'Anomaly'}${it.column ? ` on ${it.column}` : ''}`;
//     return {
//       rule_id: stableRuleKey({ dimension: dim, description: desc, expression: it.sql_fix }),
//       dimension: dim,
//       description: desc,
//       count,
//       last_seen: undefined as string | undefined,
//       examples: undefined as any,
//     };
//   });

//   const perColumnPositive = Object.fromEntries(
//     Object.entries(byCol).map(([col, v]) => [col, +(clamp01(1 - v.anomaly)).toFixed(4)]),
//   );

//   const perDimensionPositive = Object.fromEntries(
//     (Object.keys(dimAgg) as DQDimension[]).map((d) => {
//       const avgAnom = dimAgg[d].n ? dimAgg[d].sum / dimAgg[d].n : 0;
//       return [d, +(clamp01(1 - avgAnom)).toFixed(4)];
//     }),
//   );

//   return { score, contributors, notes, derivedViolations, perColumnPositive, perDimensionPositive };
// }

// function normalizeAnomaly(raw: any): AnomalyResult & { _derived_violations?: any[] } {
//   const r = raw.result ?? raw;

//   // anomalies array at r.anomalies (file mode)
//   if (Array.isArray(r.anomalies) && isAnomalyArrayShape(r.anomalies)) {
//     const built = buildAnomalyFromItems(r.anomalies);
//     return {
//       tool: raw.tool ?? 'ANOMALY_AGENT_HIL',
//       anomaly_score: built.score,
//       severity: severityOf(built.score),
//       contributors: built.contributors,
//       metrics: { perColumnPositive: built.perColumnPositive, perDimensionPositive: built.perDimensionPositive },
//       notes: built.notes,
//       _derived_violations: built.derivedViolations,
//     };
//   }

//   // raw is anomaly array
//   if (Array.isArray(r) && isAnomalyArrayShape(r)) {
//     const built = buildAnomalyFromItems(r);
//     return {
//       tool: raw.tool ?? 'ANOMALY_AGENT_HIL',
//       anomaly_score: built.score,
//       severity: severityOf(built.score),
//       contributors: built.contributors,
//       metrics: { perColumnPositive: built.perColumnPositive, perDimensionPositive: built.perDimensionPositive },
//       notes: built.notes,
//       _derived_violations: built.derivedViolations,
//     };
//   }

//   // Legacy numeric fields
//   const score =
//     toNum(r.anomaly_score) ??
//     toNum(r.anomalyScore) ??
//     toNum(r.likelihood) ??
//     toNum(r.score) ??
//     toNum(r.risk) ??
//     toNum(r.metrics?.anomaly_score) ??
//     0;

//   return {
//     tool: raw.tool ?? 'ANOMALY_AGENT_HIL',
//     anomaly_score: score,
//     severity: r.severity ?? r.severityLevel ?? r.level,
//     contributors: r.contributors ?? r.top_contributors ?? r.columns ?? r.suspects ?? [],
//     metrics: r.metrics,
//     notes: r.notes ?? r.comments ?? [],
//   };
// }

// /* -------------------------- Reducer -------------------------- */
// export function reduceMessagesToDashboard(messages: ChatMessage[]): DashboardState {
//   const state: DashboardState = {
//     dimensionScores: objFromDims(0),
//     ruleDistribution: objFromDims(0),
//     ruleOccurrences: Object.fromEntries(
//       DIMS.map((d) => [d, { rules_defined: 0, checks_reported: 0, violations_detected: 0 }]),
//     ) as DashboardState['ruleOccurrences'],
//     anomaly: null,
//     anomalyInsights: { top_contributors: [], notes: [] },
//     ruleViolationsTable: [],
//   };

//   const sum = objFromDims(0);
//   const cnt = objFromDims(0);
//   const violationsByRule = new Map<string, { dim: DimensionKey; desc?: string; count: number; last?: string }>();
//   const inspectorColumns = new Set<string>();
//   const payloadColumns = new Set<string>(); // columns from file payload

//   if (typeof window !== 'undefined' && (window as any).DQ_DEBUG) {
//     console.log('[DQ][Agg] messages passed to reducer:', messages.length);
//   }

//   for (const msg of messages) {
//     const toolPayloads: ToolResultPayload[] = extractPayloadsFromMessage(msg);

//     for (const raw of toolPayloads) {
//       const tool = (((raw as any)?.tool ?? '') as string).toUpperCase();

//       // Synthesiser → rules & distribution
//       if (tool.includes('SYNTHESISER')) {
//         const r = normalizeSynthesiser(raw);
//         for (const rule of r.rules) {
//           const dim = rule.dimension as DQDimension;
//           if (DIMS.includes(dim)) {
//             state.ruleDistribution[dim] += 1;
//             state.ruleOccurrences[dim].rules_defined += 1;
//           }
//         }
//       }

//       // Inspector → checks & violations
//       if (tool.includes('DATA_INSPECTOR')) {
//         const r = normalizeInspector(raw);
//         for (const check of r.checks) {
//           const dim = check.dimension as DQDimension;
//           const colName = (check as any)?.column;
//           if (typeof colName === 'string' && colName.trim()) inspectorColumns.add(colName.trim());
//           if (DIMS.includes(dim)) {
//             if (typeof check.latest_score === 'number') {
//               sum[dim] += clamp01(check.latest_score);
//               cnt[dim] += 1;
//             }
//             state.ruleOccurrences[dim].checks_reported += 1;
//           }
//         }
//         for (const v of r.violations ?? []) {
//           const dim = v.dimension as DQDimension;
//           if (DIMS.includes(dim)) {
//             state.ruleOccurrences[dim].violations_detected += v.count ?? 0;
//           }
//           const key = v.rule_id ?? stableRuleKey(v);
//           const prev = violationsByRule.get(key) ?? { dim, desc: undefined, count: 0, last: undefined };
//           violationsByRule.set(key, {
//             dim,
//             desc: prev.desc ?? v.description,
//             count: prev.count + (v.count ?? 0),
//             last: v.last_seen ?? prev.last,
//           });
//         }
//       }

//       // Anomaly → score & contributors (+ derived violations)
//       if (tool.includes('ANOMALY')) {
//         const a = normalizeAnomaly(raw);
//         const score = clamp01(a.anomaly_score ?? 0);
//         const sev = (a.severity as any) ?? severityOf(score);

//         if (!state.anomaly) {
//           state.anomaly = {
//             score,
//             severity: sev,
//             contributors: a.contributors ?? [],
//             metrics: a.metrics,
//             notes: a.notes,
//           };
//           state.anomalyInsights.top_contributors = a.contributors ?? [];
//           state.anomalyInsights.notes = a.notes ?? [];
//         } else {
//           if (score > (state.anomaly.score ?? 0)) {
//             state.anomaly = {
//               score,
//               severity: sev,
//               contributors: a.contributors ?? [],
//               metrics: a.metrics,
//               notes: a.notes,
//             };
//             state.anomalyInsights.top_contributors = a.contributors ?? [];
//             state.anomalyInsights.notes = a.notes ?? [];
//           } else if (score === state.anomaly.score) {
//             const mergedNotes = Array.from(new Set([...(state.anomaly.notes ?? []), ...(a.notes ?? [])]));
//             state.anomaly.notes = mergedNotes;
//             state.anomalyInsights.notes = mergedNotes;
//             const mergedContribs = Array.from(new Set([...(state.anomaly.contributors ?? []), ...(a.contributors ?? [])]));
//             state.anomaly.contributors = mergedContribs;
//             state.anomalyInsights.top_contributors = mergedContribs;

//             const incomingPos = (a.metrics as any)?.perColumnPositive;
//             if (incomingPos && !state.anomaly.metrics?.perColumnPositive) {
//               state.anomaly.metrics = { ...(state.anomaly.metrics ?? {}), perColumnPositive: incomingPos };
//             }
//             const incomingDimPos = (a.metrics as any)?.perDimensionPositive;
//             if (incomingDimPos && !state.anomaly.metrics?.perDimensionPositive) {
//               state.anomaly.metrics = { ...(state.anomaly.metrics ?? {}), perDimensionPositive: incomingDimPos };
//             }
//           }
//         }

//         // capture full dataset column list coming from anomaly payload in file mode
//         const cols = (raw as any)?.columns;
//         if (Array.isArray(cols)) {
//           for (const c of cols) {
//             const name = typeof c === 'string' ? c : (c?.name ?? c?.column ?? '');
//             if (typeof name === 'string' && name.trim()) payloadColumns.add(name.trim());
//           }
//         }

//         const derived = (a as any)._derived_violations as any[] | undefined;
//         if (Array.isArray(derived)) {
//           for (const v of derived) {
//             const dim = v.dimension as DQDimension;
//             if (DIMS.includes(dim)) {
//               state.ruleOccurrences[dim].violations_detected += v.count ?? 0;
//             }
//             const key = v.rule_id ?? stableRuleKey(v);
//             const prev = violationsByRule.get(key) ?? { dim, desc: undefined, count: 0, last: undefined };
//             violationsByRule.set(key, {
//               dim,
//               desc: prev.desc ?? v.description,
//               count: prev.count + (v.count ?? 0),
//               last: v.last_seen ?? prev.last,
//             });
//           }
//         }
//       }
//     }
//   }

//   // Finalize dimensionScores as averages (from checks)
//   for (const d of DIMS) {
//     state.dimensionScores[d] = cnt[d] ? +((sum[d] / cnt[d]).toFixed(4)) : 0;
//   }

//   // Backfill from anomaly perDimensionPositive when checks are absent
//   if (state.anomaly?.metrics?.perDimensionPositive) {
//     const pd = state.anomaly.metrics.perDimensionPositive as Record<DQDimension, number>;
//     for (const d of DIMS) {
//       if (!cnt[d] && typeof pd[d] === 'number') {
//         state.dimensionScores[d] = +pd[d].toFixed(4);
//       }
//     }
//   }

//   // Fill perColumnPositive with 100% for:
//   // - Inspector columns not present in anomaly map
//   // - File payload columns not present in anomaly map
//   if (state.anomaly) {
//     const pos = (state.anomaly.metrics?.perColumnPositive ?? {}) as Record<string, number>;

//     // ES5-safe union of observed columns (no Set spread)
//     const allObserved = new Set<string>();
//     inspectorColumns.forEach((c) => allObserved.add(c));
//     payloadColumns.forEach((c) => allObserved.add(c));

//     allObserved.forEach((col) => {
//       if (typeof pos[col] === 'undefined') pos[col] = 1; // 100% positive when no anomaly present
//     });

//     state.anomaly.metrics = { ...(state.anomaly.metrics ?? {}), perColumnPositive: pos };
//   }

//   // Build violations table with clean display IDs
//   state.ruleViolationsTable = Array.from(violationsByRule.entries())
//     .map(([k, v]) => ({
//       rule_id: k,
//       display_rule_id: prettyRuleId(k, v.desc), // clean label for UI
//       dimension: prettyDim(v.dim),
//       description: v.desc,
//       violations: v.count,
//       last_seen: v.last,
//     }))
//     .sort((a, b) => b.violations - a.violations);

//   if (typeof window !== 'undefined' && (window as any).DQ_DEBUG) {
//     const totals = {
//       rules: Object.values(state.ruleDistribution).reduce((a, b) => a + b, 0),
//       checks: Object.values(state.ruleOccurrences).reduce((a, b: any) => a + b.checks_reported, 0),
//       violations: Object.values(state.ruleOccurrences).reduce((a, b: any) => a + b.violations_detected, 0),
//       anomalyScore: state.anomaly?.score ?? 0,
//       anomalySeverity: state.anomaly?.severity ?? 'low',
//     };
//     console.log('[DQ] Aggregated totals:\n' + JSON.stringify(totals, null, 2));
//     console.log(
//       `[DQ] Health: rules=${totals.rules}, checks=${totals.checks}, violations=${totals.violations}, ` +
//         `anomaly=${Math.round((totals.anomalyScore ?? 0) * 100)}% (${totals.anomalySeverity})`,
//     );
//   }

//   return state;
// }
// // ----------------------- END OF FILE -----------------------


// trying


// // src/dq/dqAggregator.ts
// import type { ChatMessage } from '../types/chat';
// import type {
//   ToolResultPayload,
//   SynthesiserResult,
//   DataInspectorResult,
//   AnomalyResult,
//   DQDimension,
// } from '../types/dqToolResults';

// export type DimensionKey = DQDimension;

// export interface DashboardState {
//   dimensionScores: Record<DimensionKey, number>;
//   ruleDistribution: Record<DimensionKey, number>;
//   ruleOccurrences: Record<
//     DimensionKey,
//     { rules_defined: number; checks_reported: number; violations_detected: number }
//   >;
//   anomaly:
//     | {
//         score: number;
//         severity: 'low' | 'moderate' | 'high' | 'critical';
//         contributors: string[];
//         metrics?: { perColumnPositive?: Record<string, number>; [k: string]: any };
//         notes?: string[];
//       }
//     | null;
//   anomalyInsights: { top_contributors: string[]; notes: string[] };
//   ruleViolationsTable: Array<{
//     rule_id: string;
//     display_rule_id?: string;
//     dimension: string;
//     description?: string;
//     violations: number;
//     last_seen?: string;
//   }>;
// }

// /* ------------------------- helpers ------------------------- */
// const DIMS: DimensionKey[] = ['uniqueness', 'validity', 'completeness', 'consistency', 'accuracy'];
// const objFromDims = <T,>(v: T) =>
//   Object.fromEntries(DIMS.map((d) => [d, v])) as Record<DimensionKey, T>;

// const clamp01 = (x: number) => Math.max(0, Math.min(1, x ?? 0));
// const toNum = (v: any) => {
//   if (v === null || v === undefined) return undefined;
//   const n = typeof v === 'string' ? Number(v) : v;
//   return Number.isFinite(n) ? n : undefined;
// };

// const DIM_MAP: Record<string, DQDimension> = {
//   uniqueness: 'uniqueness',
//   unique: 'uniqueness',
//   validity: 'validity',
//   valid: 'validity',
//   completeness: 'completeness',
//   complete: 'completeness',
//   consistency: 'consistency',
//   consistent: 'consistency',
//   accuracy: 'accuracy',
//   accurate: 'accuracy',
// };

// function normDim(s: any): DQDimension {
//   const k = String(s ?? '').toLowerCase().trim();
//   return (DIM_MAP[k] ?? 'accuracy') as DQDimension;
// }
// function prettyDim(d: DQDimension) {
//   return d[0].toUpperCase() + d.slice(1);
// }
// function severityOf(score: number): 'low' | 'moderate' | 'high' | 'critical' {
//   return score >= 0.85 ? 'critical' : score >= 0.65 ? 'high' : score >= 0.35 ? 'moderate' : 'low';
// }

// // parse JSON, also support fenced ```json blocks
// function tryParse(value: any): any {
//   if (typeof value !== 'string') return value;
//   const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
//   const s = fenced ? fenced[1] : value;
//   try {
//     return JSON.parse(s);
//   } catch {
//     return value;
//   }
// }
// function tryParseFromText(value: any): any | undefined {
//   if (typeof value !== 'string') return undefined;
//   const m = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
//   const s = m ? m[1] : value;
//   try {
//     return JSON.parse(s);
//   } catch {
//     return undefined;
//   }
// }
// function parseContentEntry(entry: any): any | undefined {
//   try {
//     if (entry?.json) {
//       const j = entry.json;
//       if (typeof j?.result === 'string') return JSON.parse(j.result);
//       if (typeof j === 'object') return j;
//     }
//     if (typeof entry === 'string') return JSON.parse(entry);
//     if (entry && typeof entry === 'object') return entry;
//     return undefined;
//   } catch {
//     return undefined;
//   }
// }

// // Deterministic key for violations aggregation
// function stableRuleKey(v: any): string {
//   const dim = String(v?.dimension ?? '').toLowerCase();
//   const desc = String(v?.description ?? v?.title ?? v?.text ?? v?.column ?? '').trim();
//   const expr = String(v?.expression ?? '').trim();
//   const key = [dim, desc, expr].filter(Boolean).join('\n');
//   return key || Math.random().toString(36).slice(2);
// }

// function strictDimFromCategory(cat?: any): DQDimension | undefined {
//   const k = String(cat ?? '').toLowerCase().trim();
//   const m = DIM_MAP[k];
//   return m && DIMS.includes(m) ? m : undefined;
// }

// function pickCaseInsensitive(obj: any, canonicalNames: string[]): any {
//   if (!obj || typeof obj !== 'object') return undefined;
//   const wanted = new Set(
//     canonicalNames.map((n) => n.toLowerCase().replace(/\s+/g, '_').trim()),
//   );
//   for (const [key, val] of Object.entries(obj)) {
//     const lc = key.toLowerCase().replace(/\s+/g, '_').trim();
//     if (wanted.has(lc)) return val;
//   }
//   return undefined;
// }

// function firstDimFromApplied(applied?: string): DQDimension | undefined {
//   if (!applied) return undefined;
//   const first = applied.split(',')[0]?.trim();
//   return first ? normDim(first) : undefined;
// }

// // pretty Rule ID for UI
// function tokenishId(s?: string): boolean {
//   if (!s) return false;
//   return /^[A-Za-z0-9_.:\-#]{1,40}$/.test(s);
// }
// function shortHash(s: string): string {
//   let h = 0;
//   for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
//   return (h >>> 0).toString(16).slice(0, 6);
// }
// function prettyRuleId(ruleId?: string, description?: string): string {
//   if (tokenishId(ruleId)) return ruleId!;
//   const hasSQLish = !!ruleId?.match(/\b(select|update|insert|delete|create|alter|merge)\b/i);
//   if (!ruleId || hasSQLish || ruleId.length > 40 || /\s/.test(ruleId)) {
//     if (description && description.trim()) {
//       const trimmed = description.trim();
//       return trimmed.length > 60 ? trimmed.slice(0, 57) + '…' : trimmed;
//     }
//     return `Rule-${shortHash(ruleId || 'unknown')}`;
//   }
//   return ruleId;
// }

// /* -------- anomaly array recognizers -------- */
// type RawAnomalyItem = {
//   anomaly_count?: number;
//   anomaly_pct?: number | string;
//   anomaly_percentage?: number | string;
//   total_rows?: number;
//   anomaly_type?: string;
//   column?: string;
//   confidence_score?: number;
//   sql_fix?: string;
//   suggested_remediation?: string;
//   [k: string]: any;
// };
// function isAnomalyArrayShape(obj: any): obj is RawAnomalyItem[] {
//   return Array.isArray(obj) &&
//     obj.some((it) =>
//       typeof it === 'object' &&
//       ('anomaly_count' in it ||
//        'confidence_score' in it ||
//        'anomaly_type' in it ||
//        'anomaly_pct' in it)
//     );
// }
// function inferDimFromAnomalyType(t?: string): DQDimension {
//   const s = String(t ?? '').toLowerCase();
//   if (/duplicate|dup/i.test(s)) return 'uniqueness';
//   if (/null|missing|empty/i.test(s)) return 'completeness';
//   if (/format|regex|pattern|type/i.test(s)) return 'validity';
//   if (/inconsisten|mismatch|drift/i.test(s)) return 'consistency';
//   return 'accuracy';
// }
// function toNumPercent(v: any): number | undefined {
//   if (v === null || v === undefined) return undefined;
//   if (typeof v === 'string') {
//     const s = v.trim();
//     if (s.endsWith('%')) {
//       const n = Number(s.slice(0, -1));
//       return Number.isFinite(n) ? clamp01(n / 100) : undefined;
//     }
//     const n = Number(s);
//     return Number.isFinite(n) ? n : undefined;
//   }
//   if (typeof v === 'number') return v;
//   return undefined;
// }

// /* ------------------- payload recognition ------------------- */
// function inferToolNameFromObj(obj: any): string | undefined {
//   if (!obj || typeof obj !== 'object') return undefined;
//   if ('rules' in obj || 'generated_rules' in obj || 'ruleset' in obj || 'dq_rules' in obj || 'business_rules' in obj || 'items' in obj)
//     return 'SYNTHESISER_AGENT_HIL';
//   if ('checks' in obj || 'dq_result' in obj || 'results' in obj || 'violations' in obj || 'errors' in obj || 'failures' in obj)
//     return 'DATA_INSPECTOR_HIL';
//   if ('anomaly_score' in obj || 'anomalyScore' in obj || 'likelihood' in obj || 'score' in obj || 'risk' in obj)
//     return 'ANOMALY_AGENT_HIL';
//   if ('anomalies' in obj && Array.isArray(obj.anomalies)) return 'ANOMALY_AGENT_HIL';
//   if ('patterns' in obj || 'detected_patterns' in obj || 'regexes' in obj) return 'PATTERN_AGENT_HIL';
//   if ('exec_id' in obj || 'executionId' in obj || 'run_id' in obj) return 'TRACEABILITY_AGENT_HIL';
//   const nested =
//     (obj as any).result ??
//     (obj as any).output ??
//     (obj as any).data ??
//     (obj as any).payload ??
//     (obj as any).content;
//   if (nested && typeof nested === 'object') return inferToolNameFromObj(nested);
//   return undefined;
// }

// function coerceDQFields(obj: any): any {
//   if (!obj || typeof obj !== 'object') return obj;

//   if (isAnomalyArrayShape(obj)) {
//     const built = buildAnomalyFromItems(obj as RawAnomalyItem[]);
//     return {
//       anomaly_score: built.score,
//       contributors: built.contributors,
//       notes: built.notes,
//       _derived_violations: built.derivedViolations,
//       metrics: {
//         ...(obj as any).metrics,
//         perColumnPositive: built.perColumnPositive,
//         perDimensionPositive: built.perDimensionPositive,
//       },
//     };
//   }

//   const core =
//     (obj as any).result ??
//     (obj as any).output ??
//     (obj as any).data ??
//     (obj as any).payload ??
//     (obj as any).content ??
//     obj;

//   const out: any = { ...core };

//   try {
//     if (Array.isArray(out.anomalies)) {
//       const built = buildAnomalyFromItems(out.anomalies as RawAnomalyItem[]);
//       out.anomaly_score = built.score;
//       out.contributors = built.contributors;
//       out.notes = built.notes;
//       out._derived_violations = built.derivedViolations;
//       out.metrics = {
//         ...(out.metrics ?? {}),
//         perColumnPositive: built.perColumnPositive,
//         perDimensionPositive: built.perDimensionPositive,
//       };
//     }
//   } catch {}

//   out.rules =
//     out.rules ??
//     out.generated_rules ??
//     out.ruleset ??
//     out.dq_rules ??
//     out.business_rules ??
//     (Array.isArray(out.items) ? out.items : out.rules);

//   out.checks =
//     out.checks ??
//     out.dq_result ??
//     (Array.isArray(out.results) ? out.results : []) ??
//     out.metrics?.checks ??
//     out.checkResults;

//   const vArr = out.violations ?? out.errors ?? out.failures;
//   if (Array.isArray(vArr)) out.violations = vArr;

//   out.anomaly_score =
//     toNum(out.anomaly_score) ??
//     toNum(out.anomalyScore) ??
//     toNum(out.likelihood) ??
//     toNum(out.score) ??
//     toNum(out.risk) ??
//     toNum(out.metrics?.anomaly_score) ??
//     out.anomaly;

//   out.patterns = out.patterns ?? out.detected_patterns ?? out.regexes;
//   out.exec_id = out.exec_id ?? out.executionId ?? out.run_id ?? out.execId ?? out.runId;

//   return out;
// }

// function normalizePayload(p: any, explicitTool?: string): ToolResultPayload | undefined {
//   if (!p) return undefined;
//   const coerced = coerceDQFields(tryParse(p));
//   if (coerced && typeof coerced === 'object' && !(coerced as any).tool) {
//     (coerced as any).tool = explicitTool ?? inferToolNameFromObj(coerced) ?? 'UNKNOWN_TOOL';
//   }
//   return coerced;
// }

// function extractPayloadsFromMessage(msg: any): ToolResultPayload[] {
//   const out: any[] = [];
//   const push = (value: any, path: string, toolHint?: string) => {
//     if (!value) return;
//     const arr = Array.isArray(value) ? value : [value];
//     for (const item of arr) {
//       const normalized = normalizePayload(item, toolHint);
//       if (!normalized) continue;

//       const hasRules = !!(normalized as any).rules;
//       const hasChecks =
//         !!(normalized as any).checks ||
//         !!(normalized as any).dq_result ||
//         !!(normalized as any).results;
//       const hasAnom =
//         typeof (normalized as any).anomaly_score !== 'undefined' ||
//         Array.isArray((normalized as any).anomalies);

//       const pick = (obj: any, fields: string[]) => {
//         const o: any = {};
//         for (const f of fields) if (typeof (obj as any)[f] !== 'undefined') o[f] = (obj as any)[f];
//         return o;
//       };

//       let emitted = 0;
//       if (hasRules) {
//         const rOnly = pick(normalized, [
//           'rules', 'generated_rules', 'ruleset', 'dq_rules', 'business_rules', 'items', 'tool',
//         ]);
//         rOnly.tool = 'SYNTHESISER_AGENT_HIL';
//         out.push(rOnly);
//         emitted++;
//       }
//       if (hasChecks) {
//         const cOnly = pick(normalized, [
//           'checks', 'dq_result', 'results', 'violations', 'errors', 'failures', 'metrics', 'tool', '_derived_violations',
//         ]);
//         cOnly.tool = 'DATA_INSPECTOR_HIL';
//         out.push(cOnly);
//         emitted++;
//       }
//       if (hasAnom) {
//         const aOnly = pick(normalized, [
//           'anomaly_score', 'severity', 'contributors', 'metrics', 'notes', 'tool', '_derived_violations', 'anomalies', 'columns',
//         ]);
//         aOnly.tool = 'ANOMALY_AGENT_HIL';
//         out.push(aOnly);
//         emitted++;
//       }

//       if (!emitted) out.push(normalized);

//       if (typeof window !== 'undefined' && (window as any).DQ_DEBUG) {
//         console.log(
//           `[DQ] extracted payload from ${path}: ` +
//             JSON.stringify(
//               { tool: (normalized as any).tool, keys: Object.keys(normalized as any), emittedRecords: emitted || 1 },
//               null,
//               2,
//             ),
//         );
//       }
//     }
//   };

//   const textParsed =
//     tryParseFromText(msg?.text) ??
//     (typeof msg?.text === 'string' ? tryParseFromText(msg.text) : undefined);
//   if (textParsed) push(textParsed, 'assistant.text');

//   const respTextParsed =
//     tryParseFromText(msg?.response?.text) ??
//     (typeof msg?.response?.text === 'string' ? tryParseFromText(msg.response.text) : undefined);
//   if (respTextParsed) push(respTextParsed, 'response.text');

//   const contentLike: any[] = [];
//   if (Array.isArray(msg?.response?.content)) contentLike.push(...msg.response.content);

//   if (Array.isArray(msg?.timeline)) {
//     for (const t of msg.timeline) {
//       if (t?.type === 'tool' || /tool/i.test(String(t?.type))) {
//         const tt = t as any;
//         if (Array.isArray(tt?.content)) contentLike.push(...tt.content);
//         else if (tt?.content) contentLike.push(tt.content);
//         const containers = [tt?.payload, tt?.result, tt?.data, tt?.output].filter(Boolean);
//         for (const box of containers) {
//           if (Array.isArray(box?.content)) contentLike.push(...box.content);
//           else if (box?.content) contentLike.push(box.content);
//           else if (box) contentLike.push(box);
//         }
//       }
//     }
//   }

//   if (Array.isArray(msg?.response?.events)) {
//     for (const e of msg.response.events) {
//       const ce = (e as any)?.content;
//       if (Array.isArray(ce)) contentLike.push(...ce);
//       else if (ce) contentLike.push(ce);
//     }
//   }

//   const parsedContent: any[] = [];
//   for (const part of contentLike) {
//     const parsed = parseContentEntry(part);
//     if (parsed) parsedContent.push(parsed);
//   }
//   if (parsedContent.length) push(parsedContent, 'content:merged');

//   const payloads = out as ToolResultPayload[];
//   if (typeof window !== 'undefined' && (window as any).DQ_DEBUG) {
//     console.log('[DQ][Agg] total extracted payloads for msg', msg?.id, '=>', payloads.length);
//   }
//   return payloads;
// }

// /* -------- Data Inspector helpers -------- */
// function splitAppliedDims(applied: any): DQDimension[] {
//   if (!applied) return [];
//   const rawList: string[] = Array.isArray(applied)
//     ? applied.map(String)
//     : String(applied)
//         .split(/[,\n]/)
//         .map((s) => s.trim())
//         .filter(Boolean);
//   const dims = rawList.map(normDim).filter((d) => DIMS.includes(d));
//   return Array.from(new Set(dims));
// }

// /* ----------------------- Normalizers ----------------------- */
// function deriveViolationsFromChecks(
//   checks: any[],
// ): Array<{ rule_id: string; dimension?: DQDimension; description?: string; count: number; last_seen?: string }> {
//   const out: any[] = [];
//   for (const c of checks ?? []) {
//     const count =
//       toNum(c?.count) ??
//       toNum(c?.violations) ??
//       toNum(c?.failures) ??
//       toNum(c?.errors) ??
//       toNum(c?.failed_rows) ??
//       toNum(c?.violations_count) ??
//       toNum(c?.violations_cnt) ??
//       0;

//     // derive dimension from explicit or Rule Applied; DO NOT default to accuracy
//     const dimExplicit =
//       strictDimFromCategory(c?.dimension) ??
//       strictDimFromCategory(c?.dim) ??
//       strictDimFromCategory(c?.category);
//     const appliedRaw =
//       pickCaseInsensitive(c, ['rule_applied', 'rules_applied', 'applied_rules', 'rule_types_applied']) ??
//       (c as any)?.Rule_Applied ??
//       (c as any)?.Applied_Rules;
//     const appliedDims = splitAppliedDims(appliedRaw);
//     const dimFinal = dimExplicit ?? appliedDims[0];

//     if (count && count > 0 && dimFinal) {
//       const v = {
//         rule_id:
//           c?.rule_id ??
//           c?.id ??
//           c?.name ??
//           c?.column ??
//           stableRuleKey({
//             dimension: dimFinal,
//             description: c?.description ?? c?.title ?? c?.text ?? (c?.column ? `Column ${c.column}` : ''),
//           }),
//         dimension: dimFinal,
//         description: c?.description ?? c?.title ?? c?.text ?? (c?.column ? `Column ${c.column}` : undefined),
//         count,
//         last_seen: c?.last_seen ?? c?.checked_at ?? c?.at ?? c?.time ?? c?.timestamp,
//       };
//       out.push(v);
//     }
//     // if no dimension known, skip (prevents phantom Accuracy)
//   }
//   return out;
// }

// function normalizeSynthesiser(raw: any): SynthesiserResult {
//   const r0 = raw.result ?? raw;
//   const rulesSrc =
//     r0.rules ??
//     r0.generated_rules ??
//     r0.ruleset ??
//     r0.dq_rules ??
//     r0.business_rules ??
//     (Array.isArray(r0.items) ? r0.items : []);
//   const rules = rulesSrc
//     .map((r: any) => {
//       const dimCat = strictDimFromCategory(r.category);
//       if (!dimCat) return null;
//       return {
//         rule_id: r.rule_id ?? r.id ?? r.name ?? stableRuleKey(r),
//         dimension: dimCat,
//         description: r.description ?? r.title ?? r.text ?? '',
//         expression: r.expression ?? r.sql ?? r.rule ?? r.query ?? undefined,
//         confidence: toNum(r.confidence ?? r.score ?? r.weight),
//         created_at: r.created_at ?? r.time ?? r.timestamp,
//       };
//     })
//     .filter(Boolean) as SynthesiserResult['rules'];
//   return { tool: raw.tool ?? 'SYNTHESISER_AGENT_HIL', rules };
// }

// function normalizeInspector(raw: any): DataInspectorResult {
//   const r0 = raw.result ?? raw;
//   const checksSrc =
//     r0.checks ??
//     r0.dq_result ??
//     (Array.isArray(r0.results) ? r0.results : []) ??
//     r0.metrics?.checks ??
//     r0.checkResults ??
//     [];

//   const checks: DataInspectorResult['checks'] = [];
//   for (const c of checksSrc) {
//     const dqRaw =
//       pickCaseInsensitive(c, ['dq_score', 'latest_score', 'pass_ratio', 'score', 'rate']) ??
//       (c as any)?.DQ_Score ??
//       (c as any)?.DQ;
//     const latestScore = toNumPercent(dqRaw);

//     const failedRows =
//       toNum(c?.failed_rows) ??
//       toNum(c?.violations) ??
//       toNum(c?.errors) ??
//       (typeof c?.status === 'string' && /fail/i.test(c.status) ? 1 : 0);

//     const explicitDim: DQDimension | undefined =
//       strictDimFromCategory(c?.dimension) ??
//       strictDimFromCategory(c?.dim) ??
//       strictDimFromCategory(c?.category);

//     const appliedRaw =
//       pickCaseInsensitive(c, ['rule_applied', 'rules_applied', 'applied_rules', 'rule_types_applied']) ??
//       (c as any)?.Rule_Applied ??
//       (c as any)?.Applied_Rules;
//     const appliedDims = splitAppliedDims(appliedRaw);

//     const dimsToEmit: DQDimension[] =
//       explicitDim && DIMS.includes(explicitDim)
//         ? [explicitDim]
//         : appliedDims.length
//         ? appliedDims
//         : [];

//     const colRaw =
//       pickCaseInsensitive(c, ['column', 'col', 'field', 'name']) ??
//       (c as any)?.Column;
//     const colName = typeof colRaw === 'string' && colRaw.trim() ? colRaw.trim() : undefined;

//     for (const dim of dimsToEmit) {
//       checks.push({
//         rule_id: c?.rule_id ?? c?.id ?? c?.name ?? (colName || stableRuleKey(c)),
//         dimension: dim,
//         evaluated_rows: toNum(c?.evaluated_rows ?? c?.rows ?? c?.sample_size ?? c?.total_rows),
//         passed_rows: toNum(c?.passed_rows ?? c?.passed ?? c?.ok),
//         failed_rows: failedRows,
//         latest_score: latestScore,
//         ...(colName ? { column: colName } : {}),
//       } as any);
//     }
//   }

//   const violations = Array.isArray(r0.violations)
//     ? r0.violations.map((v: any) => ({
//         rule_id: v.rule_id ?? v.id ?? v.name ?? stableRuleKey(v),
//         dimension: (v?.dimension as DQDimension) ?? normDim(v?.dim ?? v?.category) ?? 'accuracy',
//         description: v.description ?? v.title ?? v.text,
//         count: toNum(v.count ?? v.violations ?? v.failures ?? v.errors) ?? 0,
//         last_seen: v.last_seen ?? v.at ?? v.time ?? v.timestamp,
//         examples: v.examples,
//       }))
//     : deriveViolationsFromChecks(checksSrc);

//   return { tool: raw.tool ?? 'DATA_INSPECTOR_HIL', checks, violations };
// }

// function buildAnomalyFromItems(items: RawAnomalyItem[]) {
//   const contributors = Array.from(new Set(items.map((it) => it.column).filter(Boolean))) as string[];
//   const notes = Array.from(
//     new Set([
//       ...items.map((it) => it.anomaly_type).filter(Boolean),
//       ...items.map((it) => it.suggested_remediation).filter(Boolean),
//     ]),
//   ) as string[];

//   const byCol: Record<string, { anomaly: number }> = {};
//   const maxCount = items.reduce((m, it) => Math.max(m, toNum(it.anomaly_count) ?? 0), 0);

//   const dimAgg: Record<DQDimension, { sum: number; n: number }> = {
//     uniqueness: { sum: 0, n: 0 },
//     validity:   { sum: 0, n: 0 },
//     completeness:{ sum: 0, n: 0 },
//     consistency:{ sum: 0, n: 0 },
//     accuracy:   { sum: 0, n: 0 },
//   };

//   for (const it of items) {
//     const pct =
//       toNumPercent(it.anomaly_pct) ??
//       toNumPercent(it.anomaly_percentage);
//     const conf = toNum(it.confidence_score);
//     const count = toNum(it.anomaly_count);
//     const total = toNum(it.total_rows);

//     let anomalyRatio: number | undefined =
//       pct !== undefined ? clamp01(pct)
//       : conf !== undefined ? clamp01(conf)
//       : count !== undefined && total !== undefined && total > 0 ? clamp01(count / total)
//       : count !== undefined && maxCount > 0 ? clamp01(count / maxCount)
//       : undefined;

//     if (anomalyRatio === undefined) anomalyRatio = 0;

//     const col = String(it.column ?? '').trim();
//     if (col) byCol[col] = { anomaly: anomalyRatio };

//     const dim = inferDimFromAnomalyType(it.anomaly_type);
//     dimAgg[dim].sum += clamp01(anomalyRatio);
//     dimAgg[dim].n += 1;
//   }

//   const overallAnomaly = Object.values(byCol).reduce((m, v) => Math.max(m, clamp01(v.anomaly)), 0);
//   const score = clamp01(overallAnomaly);

//   const derivedViolations = items.map((it) => {
//     const dim = inferDimFromAnomalyType(it.anomaly_type);
//     const count = toNum(it.anomaly_count) ?? 0;
//     const desc = `${it.anomaly_type ?? 'Anomaly'}${it.column ? ` on ${it.column}` : ''}`;
//     return {
//       rule_id: stableRuleKey({ dimension: dim, description: desc, expression: it.sql_fix }),
//       dimension: dim,
//       description: desc,
//       count,
//       last_seen: undefined as string | undefined,
//       examples: undefined as any,
//     };
//   });

//   const perColumnPositive = Object.fromEntries(
//     Object.entries(byCol).map(([col, v]) => [col, +(clamp01(1 - v.anomaly)).toFixed(4)]),
//   );

//   const perDimensionPositive = Object.fromEntries(
//     (Object.keys(dimAgg) as DQDimension[]).map((d) => {
//       const avgAnom = dimAgg[d].n ? dimAgg[d].sum / dimAgg[d].n : 0;
//       return [d, +(clamp01(1 - avgAnom)).toFixed(4)];
//     }),
//   );

//   return { score, contributors, notes, derivedViolations, perColumnPositive, perDimensionPositive };
// }

// function normalizeAnomaly(raw: any): AnomalyResult & { _derived_violations?: any[] } {
//   const r = raw.result ?? raw;

//   if (Array.isArray(r.anomalies) && isAnomalyArrayShape(r.anomalies)) {
//     const built = buildAnomalyFromItems(r.anomalies);
//     return {
//       tool: raw.tool ?? 'ANOMALY_AGENT_HIL',
//       anomaly_score: built.score,
//       severity: severityOf(built.score),
//       contributors: built.contributors,
//       metrics: { perColumnPositive: built.perColumnPositive, perDimensionPositive: built.perDimensionPositive },
//       notes: built.notes,
//       _derived_violations: built.derivedViolations,
//     };
//   }

//   if (Array.isArray(r) && isAnomalyArrayShape(r)) {
//     const built = buildAnomalyFromItems(r);
//     return {
//       tool: raw.tool ?? 'ANOMALY_AGENT_HIL',
//       anomaly_score: built.score,
//       severity: severityOf(built.score),
//       contributors: built.contributors,
//       metrics: { perColumnPositive: built.perColumnPositive, perDimensionPositive: built.perDimensionPositive },
//       notes: built.notes,
//       _derived_violations: built.derivedViolations,
//     };
//   }

//   const score =
//     toNum(r.anomaly_score) ??
//     toNum(r.anomalyScore) ??
//     toNum(r.likelihood) ??
//     toNum(r.score) ??
//     toNum(r.risk) ??
//     toNum(r.metrics?.anomaly_score) ??
//     0;

//   return {
//     tool: raw.tool ?? 'ANOMALY_AGENT_HIL',
//     anomaly_score: score,
//     severity: r.severity ?? r.severityLevel ?? r.level,
//     contributors: r.contributors ?? r.top_contributors ?? r.columns ?? r.suspects ?? [],
//     metrics: r.metrics,
//     notes: r.notes ?? r.comments ?? [],
//   };
// }

// /* -------------------------- Reducer -------------------------- */
// export function reduceMessagesToDashboard(messages: ChatMessage[]): DashboardState {
//   const state: DashboardState = {
//     dimensionScores: objFromDims(0),
//     ruleDistribution: objFromDims(0),
//     ruleOccurrences: Object.fromEntries(
//       DIMS.map((d) => [d, { rules_defined: 0, checks_reported: 0, violations_detected: 0 }]),
//     ) as DashboardState['ruleOccurrences'],
//     anomaly: null,
//     anomalyInsights: { top_contributors: [], notes: [] },
//     ruleViolationsTable: [],
//   };

//   const sum = objFromDims(0);
//   const cnt = objFromDims(0);
//   const violationsByRule = new Map<string, { dim: DimensionKey; desc?: string; count: number; last?: string }>();
//   const inspectorColumns = new Set<string>();
//   const payloadColumns = new Set<string>();
//   const inspectorStatsByCol = new Map<string, { evaluated?: number }>(); // NEW

//   if (typeof window !== 'undefined' && (window as any).DQ_DEBUG) {
//     console.log('[DQ][Agg] messages passed to reducer:', messages.length);
//   }

//   for (const msg of messages) {
//     const toolPayloads: ToolResultPayload[] = extractPayloadsFromMessage(msg);

//     for (const raw of toolPayloads) {
//       const tool = (((raw as any)?.tool ?? '') as string).toUpperCase();

//       if (tool.includes('SYNTHESISER')) {
//         const r = normalizeSynthesiser(raw);
//         for (const rule of r.rules) {
//           const dim = rule.dimension as DQDimension;
//           if (DIMS.includes(dim)) {
//             state.ruleDistribution[dim] += 1;
//             state.ruleOccurrences[dim].rules_defined += 1;
//           }
//         }
//       }

//       if (tool.includes('DATA_INSPECTOR')) {
//         const r = normalizeInspector(raw);
//         for (const check of r.checks) {
//           const dim = check.dimension as DQDimension;
//           const colName = (check as any)?.column;
//           if (typeof colName === 'string' && colName.trim()) {
//             const key = colName.trim();
//             inspectorColumns.add(key);
//             if (!inspectorStatsByCol.has(key)) inspectorStatsByCol.set(key, {});
//             const st = inspectorStatsByCol.get(key)!;
//             const evalRows = toNum((check as any).evaluated_rows);
//             if (typeof evalRows === 'number' && evalRows > 0) st.evaluated = evalRows;
//           }
//           if (DIMS.includes(dim)) {
//             if (typeof check.latest_score === 'number') {
//               sum[dim] += clamp01(check.latest_score);
//               cnt[dim] += 1;
//             }
//             state.ruleOccurrences[dim].checks_reported += 1;
//           }
//         }
//         for (const v of r.violations ?? []) {
//           const dim = v.dimension as DQDimension;
//           if (DIMS.includes(dim)) {
//             state.ruleOccurrences[dim].violations_detected += v.count ?? 0;
//           }
//           const key = v.rule_id ?? stableRuleKey(v);
//           const prev = violationsByRule.get(key) ?? { dim, desc: undefined, count: 0, last: undefined };
//           violationsByRule.set(key, {
//             dim,
//             desc: prev.desc ?? v.description,
//             count: prev.count + (v.count ?? 0),
//             last: v.last_seen ?? prev.last,
//           });
//         }
//       }

//       if (tool.includes('ANOMALY')) {
//         const a = normalizeAnomaly(raw);
//         const score = clamp01(a.anomaly_score ?? 0);
//         const sev = (a.severity as any) ?? severityOf(score);

//         if (!state.anomaly) {
//           state.anomaly = {
//             score,
//             severity: sev,
//             contributors: a.contributors ?? [],
//             metrics: a.metrics,
//             notes: a.notes,
//           };
//           state.anomalyInsights.top_contributors = a.contributors ?? [];
//           state.anomalyInsights.notes = a.notes ?? [];
//         } else {
//           if (score > (state.anomaly.score ?? 0)) {
//             state.anomaly = {
//               score,
//               severity: sev,
//               contributors: a.contributors ?? [],
//               metrics: a.metrics,
//               notes: a.notes,
//             };
//             state.anomalyInsights.top_contributors = a.contributors ?? [];
//             state.anomalyInsights.notes = a.notes ?? [];
//           } else if (score === state.anomaly.score) {
//             const mergedNotes = Array.from(new Set([...(state.anomaly.notes ?? []), ...(a.notes ?? [])]));
//             state.anomaly.notes = mergedNotes;
//             state.anomalyInsights.notes = mergedNotes;
//             const mergedContribs = Array.from(new Set([...(state.anomaly.contributors ?? []), ...(a.contributors ?? [])]));
//             state.anomaly.contributors = mergedContribs;
//             state.anomalyInsights.top_contributors = mergedContribs;

//             const incomingPos = (a.metrics as any)?.perColumnPositive;
//             if (incomingPos && !state.anomaly.metrics?.perColumnPositive) {
//               state.anomaly.metrics = { ...(state.anomaly.metrics ?? {}), perColumnPositive: incomingPos };
//             }
//             const incomingDimPos = (a.metrics as any)?.perDimensionPositive;
//             if (incomingDimPos && !state.anomaly.metrics?.perDimensionPositive) {
//               state.anomaly.metrics = { ...(state.anomaly.metrics ?? {}), perDimensionPositive: incomingDimPos };
//             }
//           }
//         }

//         const cols = (raw as any)?.columns;
//         if (Array.isArray(cols)) {
//           for (const c of cols) {
//             const name = typeof c === 'string' ? c : (c?.name ?? c?.column ?? '');
//             if (typeof name === 'string' && name.trim()) payloadColumns.add(name.trim());
//           }
//         }

//         const derived = (a as any)._derived_violations as any[] | undefined;
//         if (Array.isArray(derived)) {
//           for (const v of derived) {
//             const dim = v.dimension as DQDimension;
//             if (DIMS.includes(dim)) {
//               state.ruleOccurrences[dim].violations_detected += v.count ?? 0;
//             }
//             const key = v.rule_id ?? stableRuleKey(v);
//             const prev = violationsByRule.get(key) ?? { dim, desc: undefined, count: 0, last: undefined };
//             violationsByRule.set(key, {
//               dim,
//               desc: prev.desc ?? v.description,
//               count: prev.count + (v.count ?? 0),
//               last: v.last_seen ?? prev.last,
//             });
//           }
//         }
//       }
//     }
//   }

//   // Finalize dimensionScores as averages (checks)
//   for (const d of DIMS) {
//     state.dimensionScores[d] = cnt[d] ? +((sum[d] / cnt[d]).toFixed(4)) : 0;
//   }

//   // Backfill averages from anomaly perDimensionPositive when checks are absent
//   if (state.anomaly?.metrics?.perDimensionPositive) {
//     const pd = state.anomaly.metrics.perDimensionPositive as Record<DQDimension, number>;
//     for (const d of DIMS) {
//       if (!cnt[d] && typeof pd[d] === 'number') {
//         state.dimensionScores[d] = +pd[d].toFixed(4);
//       }
//     }
//   }

//   // Per-column positives:
//   // 1) mark all observed columns (inspector/payload) as 100% if not present in anomaly map
//   // 2) for anomaly columns with missing total_rows, compute ratio using inspector evaluated_rows (table mode)
//   if (state.anomaly) {
//     const pos = (state.anomaly.metrics?.perColumnPositive ?? {}) as Record<string, number>;

//     const allObserved = new Set<string>();
//     inspectorColumns.forEach((c) => allObserved.add(c));
//     payloadColumns.forEach((c) => allObserved.add(c));

//     // fill missing → 100%
//     allObserved.forEach((col) => {
//       if (typeof pos[col] === 'undefined') pos[col] = 1;
//     });

//     // adjust anomaly columns stuck at 0% (because total_rows missing):
//     // if we can find evaluated_rows from inspector, recompute: pos = 1 - (anomaly_count / evaluated_rows)
//     const anomalies = (state.anomaly as any)?.metrics?.anomalies as RawAnomalyItem[] | undefined;
//     // NOTE: some providers don't keep anomalies array in metrics; we rely on contributors + derivedViolations for counts
//     const derived = (state.anomaly as any)?._derived_violations as any[] | undefined;

//     const countsByCol = new Map<string, number>();
//     if (Array.isArray(anomalies)) {
//       for (const it of anomalies) {
//         const c = String(it.column ?? '').trim();
//         const count = toNum(it.anomaly_count) ?? 0;
//         if (c) countsByCol.set(c, (countsByCol.get(c) ?? 0) + count);
//       }
//     }
//     if (Array.isArray(derived)) {
//       for (const v of derived) {
//         const cText = String(v?.description ?? '').toUpperCase();
//         // Extract column name from "xxx on COLUMN" pattern (robust-ish)
//         const m = cText.match(/\bON\s+([A-Z0-9_]+)/);
//         const c = m?.[1];
//         const count = toNum(v?.count) ?? 0;
//         if (c) countsByCol.set(c, (countsByCol.get(c) ?? 0) + count);
//       }
//     }

//     countsByCol.forEach((count, col) => {
//       const st = inspectorStatsByCol.get(col);
//       if (st?.evaluated && st.evaluated > 0) {
//         const ratio = clamp01(count / st.evaluated);
//         const positive = +(clamp01(1 - ratio)).toFixed(4);
//         // only override if existing is 0 or undefined
//         if (typeof pos[col] === 'undefined' || pos[col] === 0) pos[col] = positive;
//       }
//     });

//     state.anomaly.metrics = { ...(state.anomaly.metrics ?? {}), perColumnPositive: pos };
//   }

//   // Build violations table with clean display IDs
//   state.ruleViolationsTable = Array.from(violationsByRule.entries())
//     .map(([k, v]) => ({
//       rule_id: k,
//       display_rule_id: prettyRuleId(k, v.desc),
//       dimension: prettyDim(v.dim),
//       description: v.desc,
//       violations: v.count,
//       last_seen: v.last,
//     }))
//     .sort((a, b) => b.violations - a.violations);

//   if (typeof window !== 'undefined' && (window as any).DQ_DEBUG) {
//     const totals = {
//       rules: Object.values(state.ruleDistribution).reduce((a, b) => a + b, 0),
//       checks: Object.values(state.ruleOccurrences).reduce((a, b: any) => a + b.checks_reported, 0),
//       violations: Object.values(state.ruleOccurrences).reduce((a, b: any) => a + b.violations_detected, 0),
//       anomalyScore: state.anomaly?.score ?? 0,
//       anomalySeverity: state.anomaly?.severity ?? 'low',
//     };
//     console.log('[DQ] Aggregated totals:\n' + JSON.stringify(totals, null, 2));
//     console.log(
//       `[DQ] Health: rules=${totals.rules}, checks=${totals.checks}, violations=${totals.violations}, ` +
//         `anomaly=${Math.round((totals.anomalyScore ?? 0) * 100)}% (${totals.anomalySeverity})`,
//     );
//   }

//   return state;
// }


// trying after main.tsx


// // src/dq/dqAggregator.ts
// import type { ChatMessage } from '../types/chat';
// import type {
//   ToolResultPayload,
//   SynthesiserResult,
//   DataInspectorResult,
//   AnomalyResult,
//   DQDimension,
// } from '../types/dqToolResults';

// export type DimensionKey = DQDimension;

// export interface DashboardState {
//   dimensionScores: Record<DimensionKey, number>;
//   ruleDistribution: Record<DimensionKey, number>;
//   ruleOccurrences: Record<
//     DimensionKey,
//     { rules_defined: number; checks_reported: number; violations_detected: number }
//   >;
//   anomaly:
//     | {
//         score: number;
//         severity: 'low' | 'moderate' | 'high' | 'critical';
//         contributors: string[];
//         metrics?: { perColumnPositive?: Record<string, number>; [k: string]: any };
//         notes?: string[];
//       }
//     | null;
//   anomalyInsights: { top_contributors: string[]; notes: string[] };
//   ruleViolationsTable: Array<{
//     rule_id: string;
//     display_rule_id?: string;
//     dimension: string;
//     description?: string;
//     violations: number;
//     last_seen?: string;
//   }>;
//   /** NEW: strict set of dimensions applied in Inspector (Rule Applied or explicit) */
//   appliedDims: Set<DQDimension>;
// }

// /* ------------------------- helpers ------------------------- */
// const DIMS: DimensionKey[] = ['uniqueness', 'validity', 'completeness', 'consistency', 'accuracy'];
// const objFromDims = <T,>(v: T) =>
//   Object.fromEntries(DIMS.map((d) => [d, v])) as Record<DimensionKey, T>;

// const clamp01 = (x: number) => Math.max(0, Math.min(1, x ?? 0));
// const toNum = (v: any) => {
//   if (v === null || v === undefined) return undefined;
//   const n = typeof v === 'string' ? Number(v) : v;
//   return Number.isFinite(n) ? n : undefined;
// };

// const DIM_MAP: Record<string, DQDimension> = {
//   uniqueness: 'uniqueness',
//   unique: 'uniqueness',
//   validity: 'validity',
//   valid: 'validity',
//   completeness: 'completeness',
//   complete: 'completeness',
//   consistency: 'consistency',
//   consistent: 'consistency',
//   accuracy: 'accuracy',
//   accurate: 'accuracy',
// };

// function normDim(s: any): DQDimension {
//   const k = String(s ?? '').toLowerCase().trim();
//   return (DIM_MAP[k] ?? 'accuracy') as DQDimension;
// }
// function prettyDim(d: DQDimension) {
//   return d[0].toUpperCase() + d.slice(1);
// }
// function severityOf(score: number): 'low' | 'moderate' | 'high' | 'critical' {
//   return score >= 0.85 ? 'critical' : score >= 0.65 ? 'high' : score >= 0.35 ? 'moderate' : 'low';
// }

// // parse JSON (supports fenced blocks)
// function tryParse(value: any): any {
//   if (typeof value !== 'string') return value;
//   const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
//   const s = fenced ? fenced[1] : value;
//   try { return JSON.parse(s); } catch { return value; }
// }
// function tryParseFromText(value: any): any | undefined {
//   if (typeof value !== 'string') return undefined;
//   const m = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
//   const s = m ? m[1] : value;
//   try { return JSON.parse(s); } catch { return undefined; }
// }
// function parseContentEntry(entry: any): any | undefined {
//   try {
//     if (entry?.json) {
//       const j = entry.json;
//       if (typeof j?.result === 'string') return JSON.parse(j.result);
//       if (typeof j === 'object') return j;
//     }
//     if (typeof entry === 'string') return JSON.parse(entry);
//     if (entry && typeof entry === 'object') return entry;
//     return undefined;
//   } catch { return undefined; }
// }

// // Deterministic key for violations aggregation
// function stableRuleKey(v: any): string {
//   const dim = String(v?.dimension ?? '').toLowerCase();
//   const desc = String(v?.description ?? v?.title ?? v?.text ?? v?.column ?? '').trim();
//   const expr = String(v?.expression ?? '').trim();
//   const key = [dim, desc, expr].filter(Boolean).join('\n');
//   return key || Math.random().toString(36).slice(2);
// }

// function strictDimFromCategory(cat?: any): DQDimension | undefined {
//   const k = String(cat ?? '').toLowerCase().trim();
//   const m = DIM_MAP[k];
//   return m && DIMS.includes(m) ? m : undefined;
// }

// function pickCaseInsensitive(obj: any, canonicalNames: string[]): any {
//   if (!obj || typeof obj !== 'object') return undefined;
//   const wanted = new Set(canonicalNames.map((n) => n.toLowerCase().replace(/\s+/g, '_').trim()));
//   for (const [key, val] of Object.entries(obj)) {
//     const lc = key.toLowerCase().replace(/\s+/g, '_').trim();
//     if (wanted.has(lc)) return val;
//   }
//   return undefined;
// }

// function firstDimFromApplied(applied?: string): DQDimension | undefined {
//   if (!applied) return undefined;
//   const first = applied.split(',')[0]?.trim();
//   return first ? normDim(first) : undefined;
// }

// // Pretty Rule ID for UI
// function tokenishId(s?: string): boolean {
//   if (!s) return false;
//   return /^[A-Za-z0-9_.:\-#]{1,40}$/.test(s);
// }
// function shortHash(s: string): string {
//   let h = 0;
//   for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
//   return (h >>> 0).toString(16).slice(0, 6);
// }
// function prettyRuleId(ruleId?: string, description?: string): string {
//   if (tokenishId(ruleId)) return ruleId!;
//   const hasSQLish = !!ruleId?.match(/\b(select|update|insert|delete|create|alter|merge)\b/i);
//   if (!ruleId || hasSQLish || ruleId.length > 40 || /\s/.test(ruleId)) {
//     if (description && description.trim()) {
//       const trimmed = description.trim();
//       return trimmed.length > 60 ? trimmed.slice(0, 57) + '…' : trimmed;
//     }
//     return `Rule-${shortHash(ruleId || 'unknown')}`;
//   }
//   return ruleId;
// }

// /* -------- anomaly array recognizers -------- */
// type RawAnomalyItem = {
//   anomaly_count?: number;
//   anomaly_pct?: number | string;
//   anomaly_percentage?: number | string;
//   total_rows?: number;
//   anomaly_type?: string;
//   column?: string;
//   confidence_score?: number;
//   sql_fix?: string;
//   suggested_remediation?: string;
//   [k: string]: any;
// };
// function isAnomalyArrayShape(obj: any): obj is RawAnomalyItem[] {
//   return Array.isArray(obj) &&
//     obj.some((it) =>
//       typeof it === 'object' &&
//       ('anomaly_count' in it || 'confidence_score' in it || 'anomaly_type' in it || 'anomaly_pct' in it)
//     );
// }
// function inferDimFromAnomalyType(t?: string): DQDimension {
//   const s = String(t ?? '').toLowerCase();
//   if (/duplicate|dup/i.test(s)) return 'uniqueness';
//   if (/null|missing|empty/i.test(s)) return 'completeness';
//   if (/format|regex|pattern|type/i.test(s)) return 'validity';
//   if (/inconsisten|mismatch|drift/i.test(s)) return 'consistency';
//   return 'accuracy';
// }
// function toNumPercent(v: any): number | undefined {
//   if (v === null || v === undefined) return undefined;
//   if (typeof v === 'string') {
//     const s = v.trim();
//     if (s.endsWith('%')) {
//       const n = Number(s.slice(0, -1));
//       return Number.isFinite(n) ? clamp01(n / 100) : undefined;
//     }
//     const n = Number(s);
//     return Number.isFinite(n) ? n : undefined;
//   }
//   if (typeof v === 'number') return v;
//   return undefined;
// }

// /* ------------------- payload recognition ------------------- */
// function inferToolNameFromObj(obj: any): string | undefined {
//   if (!obj || typeof obj !== 'object') return undefined;
//   if ('rules' in obj || 'generated_rules' in obj || 'ruleset' in obj || 'dq_rules' in obj || 'business_rules' in obj || 'items' in obj)
//     return 'SYNTHESISER_AGENT_HIL';
//   if ('checks' in obj || 'dq_result' in obj || 'results' in obj || 'violations' in obj || 'errors' in obj || 'failures' in obj)
//     return 'DATA_INSPECTOR_HIL';
//   if ('anomaly_score' in obj || 'anomalyScore' in obj || 'likelihood' in obj || 'score' in obj || 'risk' in obj)
//     return 'ANOMALY_AGENT_HIL';
//   if ('anomalies' in obj && Array.isArray(obj.anomalies)) return 'ANOMALY_AGENT_HIL';
//   if ('patterns' in obj || 'detected_patterns' in obj || 'regexes' in obj) return 'PATTERN_AGENT_HIL';
//   if ('exec_id' in obj || 'executionId' in obj || 'run_id' in obj) return 'TRACEABILITY_AGENT_HIL';
//   const nested =
//     (obj as any).result ??
//     (obj as any).output ??
//     (obj as any).data ??
//     (obj as any).payload ??
//     (obj as any).content;
//   if (nested && typeof nested === 'object') return inferToolNameFromObj(nested);
//   return undefined;
// }

// function coerceDQFields(obj: any): any {
//   if (!obj || typeof obj !== 'object') return obj;

//   if (isAnomalyArrayShape(obj)) {
//     const built = buildAnomalyFromItems(obj as RawAnomalyItem[]);
//     return {
//       anomaly_score: built.score,
//       contributors: built.contributors,
//       notes: built.notes,
//       _derived_violations: built.derivedViolations,
//       metrics: {
//         ...(obj as any).metrics,
//         perColumnPositive: built.perColumnPositive,
//         perDimensionPositive: built.perDimensionPositive,
//       },
//     };
//   }

//   const core =
//     (obj as any).result ??
//     (obj as any).output ??
//     (obj as any).data ??
//     (obj as any).payload ??
//     (obj as any).content ??
//     obj;

//   const out: any = { ...core };

//   try {
//     if (Array.isArray(out.anomalies)) {
//       const built = buildAnomalyFromItems(out.anomalies as RawAnomalyItem[]);
//       out.anomaly_score = built.score;
//       out.contributors = built.contributors;
//       out.notes = built.notes;
//       out._derived_violations = built.derivedViolations;
//       out.metrics = {
//         ...(out.metrics ?? {}),
//         perColumnPositive: built.perColumnPositive,
//         perDimensionPositive: built.perDimensionPositive,
//       };
//     }
//   } catch {}

//   out.rules =
//     out.rules ??
//     out.generated_rules ??
//     out.ruleset ??
//     out.dq_rules ??
//     out.business_rules ??
//     (Array.isArray(out.items) ? out.items : out.rules);

//   out.checks =
//     out.checks ??
//     out.dq_result ??
//     (Array.isArray(out.results) ? out.results : []) ??
//     out.metrics?.checks ??
//     out.checkResults;

//   const vArr = out.violations ?? out.errors ?? out.failures;
//   if (Array.isArray(vArr)) out.violations = vArr;

//   out.anomaly_score =
//     toNum(out.anomaly_score) ??
//     toNum(out.anomalyScore) ??
//     toNum(out.likelihood) ??
//     toNum(out.score) ??
//     toNum(out.risk) ??
//     toNum(out.metrics?.anomaly_score) ??
//     out.anomaly;

//   out.patterns = out.patterns ?? out.detected_patterns ?? out.regexes;
//   out.exec_id = out.exec_id ?? out.executionId ?? out.run_id ?? out.execId ?? out.runId;

//   return out;
// }

// function normalizePayload(p: any, explicitTool?: string): ToolResultPayload | undefined {
//   if (!p) return undefined;
//   const coerced = coerceDQFields(tryParse(p));
//   if (coerced && typeof coerced === 'object' && !(coerced as any).tool) {
//     (coerced as any).tool = explicitTool ?? inferToolNameFromObj(coerced) ?? 'UNKNOWN_TOOL';
//   }
//   return coerced;
// }

// function extractPayloadsFromMessage(msg: any): ToolResultPayload[] {
//   const out: any[] = [];
//   const push = (value: any, path: string, toolHint?: string) => {
//     if (!value) return;
//     const arr = Array.isArray(value) ? value : [value];
//     for (const item of arr) {
//       const normalized = normalizePayload(item, toolHint);
//       if (!normalized) continue;

//       const hasRules = !!(normalized as any).rules;
//       const hasChecks =
//         !!(normalized as any).checks ||
//         !!(normalized as any).dq_result ||
//         !!(normalized as any).results;
//       const hasAnom =
//         typeof (normalized as any).anomaly_score !== 'undefined' ||
//         Array.isArray((normalized as any).anomalies);

//       const pick = (obj: any, fields: string[]) => {
//         const o: any = {};
//         for (const f of fields) if (typeof (obj as any)[f] !== 'undefined') o[f] = (obj as any)[f];
//         return o;
//       };

//       let emitted = 0;
//       if (hasRules) {
//         const rOnly = pick(normalized, [
//           'rules', 'generated_rules', 'ruleset', 'dq_rules', 'business_rules', 'items', 'tool',
//         ]);
//         rOnly.tool = 'SYNTHESISER_AGENT_HIL';
//         out.push(rOnly);
//         emitted++;
//       }
//       if (hasChecks) {
//         const cOnly = pick(normalized, [
//           'checks', 'dq_result', 'results', 'violations', 'errors', 'failures', 'metrics', 'tool', '_derived_violations',
//         ]);
//         cOnly.tool = 'DATA_INSPECTOR_HIL';
//         out.push(cOnly);
//         emitted++;
//       }
//       if (hasAnom) {
//         const aOnly = pick(normalized, [
//           'anomaly_score', 'severity', 'contributors', 'metrics', 'notes', 'tool', '_derived_violations', 'anomalies', 'columns',
//         ]);
//         aOnly.tool = 'ANOMALY_AGENT_HIL';
//         out.push(aOnly);
//         emitted++;
//       }

//       if (!emitted) out.push(normalized);

//       if (typeof window !== 'undefined' && (window as any).DQ_DEBUG) {
//         console.log(
//           `[DQ] extracted payload from ${path}: ` +
//             JSON.stringify(
//               { tool: (normalized as any).tool, keys: Object.keys(normalized as any), emittedRecords: emitted || 1 },
//               null,
//               2,
//             ),
//         );
//       }
//     }
//   };

//   const textParsed =
//     tryParseFromText(msg?.text) ??
//     (typeof msg?.text === 'string' ? tryParseFromText(msg.text) : undefined);
//   if (textParsed) push(textParsed, 'assistant.text');

//   const respTextParsed =
//     tryParseFromText(msg?.response?.text) ??
//     (typeof msg?.response?.text === 'string' ? tryParseFromText(msg.response.text) : undefined);
//   if (respTextParsed) push(respTextParsed, 'response.text');

//   const contentLike: any[] = [];
//   if (Array.isArray(msg?.response?.content)) contentLike.push(...msg.response.content);

//   if (Array.isArray(msg?.timeline)) {
//     for (const t of msg.timeline) {
//       if (t?.type === 'tool' || /tool/i.test(String(t?.type))) {
//         const tt = t as any;
//         if (Array.isArray(tt?.content)) contentLike.push(...tt.content);
//         else if (tt?.content) contentLike.push(tt.content);
//         const containers = [tt?.payload, tt?.result, tt?.data, tt?.output].filter(Boolean);
//         for (const box of containers) {
//           if (Array.isArray(box?.content)) contentLike.push(...box.content);
//           else if (box?.content) contentLike.push(box.content);
//           else if (box) contentLike.push(box);
//         }
//       }
//     }
//   }

//   if (Array.isArray(msg?.response?.events)) {
//     for (const e of msg.response.events) {
//       const ce = (e as any)?.content;
//       if (Array.isArray(ce)) contentLike.push(...ce);
//       else if (ce) contentLike.push(ce);
//     }
//   }

//   const parsedContent: any[] = [];
//   for (const part of contentLike) {
//     const parsed = parseContentEntry(part);
//     if (parsed) parsedContent.push(parsed);
//   }
//   if (parsedContent.length) push(parsedContent, 'content:merged');

//   const payloads = out as ToolResultPayload[];
//   if (typeof window !== 'undefined' && (window as any).DQ_DEBUG) {
//     console.log('[DQ][Agg] total extracted payloads for msg', msg?.id, '=>', payloads.length);
//   }
//   return payloads;
// }

// /* -------- Data Inspector helpers -------- */
// function splitAppliedDims(applied: any): DQDimension[] {
//   if (!applied) return [];
//   const rawList: string[] = Array.isArray(applied)
//     ? applied.map(String)
//     : String(applied)
//         .split(/[,\n]/)
//         .map((s) => s.trim())
//         .filter(Boolean);
//   const dims = rawList.map(normDim).filter((d) => DIMS.includes(d));
//   return Array.from(new Set(dims));
// }

// /* ----------------------- Normalizers ----------------------- */
// function deriveViolationsFromChecks(
//   checks: any[],
// ): Array<{ rule_id: string; dimension?: DQDimension; description?: string; count: number; last_seen?: string }> {
//   const out: any[] = [];
//   for (const c of checks ?? []) {
//     const count =
//       toNum(c?.count) ??
//       toNum(c?.violations) ??
//       toNum(c?.failures) ??
//       toNum(c?.errors) ??
//       toNum(c?.failed_rows) ??
//       toNum(c?.violations_count) ??
//       toNum(c?.violations_cnt) ??
//       0;

//     // derive dimension; DO NOT default to accuracy
//     const dimExplicit =
//       strictDimFromCategory(c?.dimension) ??
//       strictDimFromCategory(c?.dim) ??
//       strictDimFromCategory(c?.category);
//     const appliedRaw =
//       pickCaseInsensitive(c, ['rule_applied', 'rules_applied', 'applied_rules', 'rule_types_applied']) ??
//       (c as any)?.Rule_Applied ??
//       (c as any)?.Applied_Rules;
//     const appliedDims = splitAppliedDims(appliedRaw);
//     const dimFinal = dimExplicit ?? appliedDims[0];

//     if (count && count > 0 && dimFinal) {
//       const v = {
//         rule_id:
//           c?.rule_id ??
//           c?.id ??
//           c?.name ??
//           c?.column ??
//           stableRuleKey({
//             dimension: dimFinal,
//             description: c?.description ?? c?.title ?? c?.text ?? (c?.column ? `Column ${c.column}` : ''),
//           }),
//         dimension: dimFinal,
//         description: c?.description ?? c?.title ?? c?.text ?? (c?.column ? `Column ${c.column}` : undefined),
//         count,
//         last_seen: c?.last_seen ?? c?.checked_at ?? c?.at ?? c?.time ?? c?.timestamp,
//       };
//       out.push(v);
//     }
//     // if no dimension known, skip (prevents phantom Accuracy)
//   }
//   return out;
// }

// function normalizeSynthesiser(raw: any): SynthesiserResult {
//   const r0 = raw.result ?? raw;
//   const rulesSrc =
//     r0.rules ??
//     r0.generated_rules ??
//     r0.ruleset ??
//     r0.dq_rules ??
//     r0.business_rules ??
//     (Array.isArray(r0.items) ? r0.items : []);
//   const rules = rulesSrc
//     .map((r: any) => {
//       const dimCat = strictDimFromCategory(r.category);
//       if (!dimCat) return null;
//       return {
//         rule_id: r.rule_id ?? r.id ?? r.name ?? stableRuleKey(r),
//         dimension: dimCat,
//         description: r.description ?? r.title ?? r.text ?? '',
//         expression: r.expression ?? r.sql ?? r.rule ?? r.query ?? undefined,
//         confidence: toNum(r.confidence ?? r.score ?? r.weight),
//         created_at: r.created_at ?? r.time ?? r.timestamp,
//       };
//     })
//     .filter(Boolean) as SynthesiserResult['rules'];
//   return { tool: raw.tool ?? 'SYNTHESISER_AGENT_HIL', rules };
// }

// function normalizeInspector(raw: any): DataInspectorResult {
//   const r0 = raw.result ?? raw;
//   const checksSrc =
//     r0.checks ??
//     r0.dq_result ??
//     (Array.isArray(r0.results) ? r0.results : []) ??
//     r0.metrics?.checks ??
//     r0.checkResults ??
//     [];

//   const checks: DataInspectorResult['checks'] = [];
//   for (const c of checksSrc) {
//     const dqRaw =
//       pickCaseInsensitive(c, ['dq_score', 'latest_score', 'pass_ratio', 'score', 'rate']) ??
//       (c as any)?.DQ_Score ??
//       (c as any)?.DQ;
//     const latestScore = toNumPercent(dqRaw);

//     const failedRows =
//       toNum(c?.failed_rows) ??
//       toNum(c?.violations) ??
//       toNum(c?.errors) ??
//       (typeof c?.status === 'string' && /fail/i.test(c.status) ? 1 : 0);

//     const explicitDim: DQDimension | undefined =
//       strictDimFromCategory(c?.dimension) ??
//       strictDimFromCategory(c?.dim) ??
//       strictDimFromCategory(c?.category);

//     const appliedRaw =
//       pickCaseInsensitive(c, ['rule_applied', 'rules_applied', 'applied_rules', 'rule_types_applied']) ??
//       (c as any)?.Rule_Applied ??
//       (c as any)?.Applied_Rules;
//     const appliedDims = splitAppliedDims(appliedRaw);

//     const dimsToEmit: DQDimension[] =
//       explicitDim && DIMS.includes(explicitDim)
//         ? [explicitDim]
//         : appliedDims.length
//         ? appliedDims
//         : [];

//     const colRaw = pickCaseInsensitive(c, ['column', 'col', 'field', 'name']) ?? (c as any)?.Column;
//     const colName = typeof colRaw === 'string' && colRaw.trim() ? colRaw.trim() : undefined;

//     for (const dim of dimsToEmit) {
//       checks.push({
//         rule_id: c?.rule_id ?? c?.id ?? c?.name ?? (colName || stableRuleKey(c)),
//         dimension: dim,
//         evaluated_rows: toNum(c?.evaluated_rows ?? c?.rows ?? c?.sample_size ?? c?.total_rows),
//         passed_rows: toNum(c?.passed_rows ?? c?.passed ?? c?.ok),
//         failed_rows: failedRows,
//         latest_score: latestScore,
//         ...(colName ? { column: colName } : {}),
//       } as any);
//     }
//   }

//   const violations = Array.isArray(r0.violations)
//     ? r0.violations.map((v: any) => ({
//         rule_id: v.rule_id ?? v.id ?? v.name ?? stableRuleKey(v),
//         dimension: (v?.dimension as DQDimension) ?? normDim(v?.dim ?? v?.category) ?? 'accuracy',
//         description: v.description ?? v.title ?? v.text,
//         count: toNum(v.count ?? v.violations ?? v.failures ?? v.errors) ?? 0,
//         last_seen: v.last_seen ?? v.at ?? v.time ?? v.timestamp,
//         examples: v.examples,
//       }))
//     : deriveViolationsFromChecks(checksSrc);

//   return { tool: raw.tool ?? 'DATA_INSPECTOR_HIL', checks, violations };
// }

// function buildAnomalyFromItems(items: RawAnomalyItem[]) {
//   const contributors = Array.from(new Set(items.map((it) => it.column).filter(Boolean))) as string[];
//   const notes = Array.from(
//     new Set([
//       ...items.map((it) => it.anomaly_type).filter(Boolean),
//       ...items.map((it) => it.suggested_remediation).filter(Boolean),
//     ]),
//   ) as string[];

//   const byCol: Record<string, { anomaly: number }> = {};
//   const maxCount = items.reduce((m, it) => Math.max(m, toNum(it.anomaly_count) ?? 0), 0);

//   const dimAgg: Record<DQDimension, { sum: number; n: number }> = {
//     uniqueness: { sum: 0, n: 0 },
//     validity:   { sum: 0, n: 0 },
//     completeness:{ sum: 0, n: 0 },
//     consistency:{ sum: 0, n: 0 },
//     accuracy:   { sum: 0, n: 0 },
//   };

//   for (const it of items) {
//     const pct =
//       toNumPercent(it.anomaly_pct) ??
//       toNumPercent(it.anomaly_percentage);
//     const conf = toNum(it.confidence_score);
//     const count = toNum(it.anomaly_count);
//     const total = toNum(it.total_rows);

//     let anomalyRatio: number | undefined =
//       pct !== undefined ? clamp01(pct)
//       : conf !== undefined ? clamp01(conf)
//       : count !== undefined && total !== undefined && total > 0 ? clamp01(count / total)
//       : count !== undefined && maxCount > 0 ? clamp01(count / maxCount)
//       : undefined;

//     if (anomalyRatio === undefined) anomalyRatio = 0;

//     const col = String(it.column ?? '').trim();
//     if (col) byCol[col] = { anomaly: anomalyRatio };

//     const dim = inferDimFromAnomalyType(it.anomaly_type);
//     dimAgg[dim].sum += clamp01(anomalyRatio);
//     dimAgg[dim].n += 1;
//   }

//   const overallAnomaly = Object.values(byCol).reduce((m, v) => Math.max(m, clamp01(v.anomaly)), 0);
//   const score = clamp01(overallAnomaly);

//   const derivedViolations = items.map((it) => {
//     const dim = inferDimFromAnomalyType(it.anomaly_type);
//     const count = toNum(it.anomaly_count) ?? 0;
//     const desc = `${it.anomaly_type ?? 'Anomaly'}${it.column ? ` on ${it.column}` : ''}`;
//     return {
//       rule_id: stableRuleKey({ dimension: dim, description: desc, expression: it.sql_fix }),
//       dimension: dim,
//       description: desc,
//       count,
//       last_seen: undefined as string | undefined,
//       examples: undefined as any,
//     };
//   });

//   const perColumnPositive = Object.fromEntries(
//     Object.entries(byCol).map(([col, v]) => [col, +(clamp01(1 - v.anomaly)).toFixed(4)]),
//   );

//   const perDimensionPositive = Object.fromEntries(
//     (Object.keys(dimAgg) as DQDimension[]).map((d) => {
//       const avgAnom = dimAgg[d].n ? dimAgg[d].sum / dimAgg[d].n : 0;
//       return [d, +(clamp01(1 - avgAnom)).toFixed(4)];
//     }),
//   );

//   return { score, contributors, notes, derivedViolations, perColumnPositive, perDimensionPositive };
// }

// function normalizeAnomaly(raw: any): AnomalyResult & { _derived_violations?: any[] } {
//   const r = raw.result ?? raw;

//   if (Array.isArray(r.anomalies) && isAnomalyArrayShape(r.anomalies)) {
//     const built = buildAnomalyFromItems(r.anomalies);
//     return {
//       tool: raw.tool ?? 'ANOMALY_AGENT_HIL',
//       anomaly_score: built.score,
//       severity: severityOf(built.score),
//       contributors: built.contributors,
//       metrics: { perColumnPositive: built.perColumnPositive, perDimensionPositive: built.perDimensionPositive },
//       notes: built.notes,
//       _derived_violations: built.derivedViolations,
//     };
//   }

//   if (Array.isArray(r) && isAnomalyArrayShape(r)) {
//     const built = buildAnomalyFromItems(r);
//     return {
//       tool: raw.tool ?? 'ANOMALY_AGENT_HIL',
//       anomaly_score: built.score,
//       severity: severityOf(built.score),
//       contributors: built.contributors,
//       metrics: { perColumnPositive: built.perColumnPositive, perDimensionPositive: built.perDimensionPositive },
//       notes: built.notes,
//       _derived_violations: built.derivedViolations,
//     };
//   }

//   const score =
//     toNum(r.anomaly_score) ??
//     toNum(r.anomalyScore) ??
//     toNum(r.likelihood) ??
//     toNum(r.score) ??
//     toNum(r.risk) ??
//     toNum(r.metrics?.anomaly_score) ??
//     0;

//   return {
//     tool: raw.tool ?? 'ANOMALY_AGENT_HIL',
//     anomaly_score: score,
//     severity: r.severity ?? r.severityLevel ?? r.level,
//     contributors: r.contributors ?? r.top_contributors ?? r.columns ?? r.suspects ?? [],
//     metrics: r.metrics,
//     notes: r.notes ?? r.comments ?? [],
//   };
// }

// /* -------------------------- Reducer -------------------------- */
// export function reduceMessagesToDashboard(messages: ChatMessage[]): DashboardState {
//   const state: DashboardState = {
//     dimensionScores: objFromDims(0),
//     ruleDistribution: objFromDims(0),
//     ruleOccurrences: Object.fromEntries(
//       DIMS.map((d) => [d, { rules_defined: 0, checks_reported: 0, violations_detected: 0 }]),
//     ) as DashboardState['ruleOccurrences'],
//     anomaly: null,
//     anomalyInsights: { top_contributors: [], notes: [] },
//     ruleViolationsTable: [],
//     appliedDims: new Set<DQDimension>(), // NEW
//   };

//   const sum = objFromDims(0);
//   const cnt = objFromDims(0);
//   const violationsByRule = new Map<string, { dim: DimensionKey; desc?: string; count: number; last?: string }>();
//   const inspectorColumns = new Set<string>();
//   const payloadColumns = new Set<string>();
//   const inspectorStatsByCol = new Map<string, { evaluated?: number }>();

//   if (typeof window !== 'undefined' && (window as any).DQ_DEBUG) {
//     console.log('[DQ][Agg] messages passed to reducer:', messages.length);
//   }

//   for (const msg of messages) {
//     const toolPayloads: ToolResultPayload[] = extractPayloadsFromMessage(msg);

//     for (const raw of toolPayloads) {
//       const tool = (((raw as any)?.tool ?? '') as string).toUpperCase();

//       if (tool.includes('SYNTHESISER')) {
//         const r = normalizeSynthesiser(raw);
//         for (const rule of r.rules) {
//           const dim = rule.dimension as DQDimension;
//           if (DIMS.includes(dim)) {
//             state.ruleDistribution[dim] += 1;
//             state.ruleOccurrences[dim].rules_defined += 1;
//           }
//         }
//       }

//       if (tool.includes('DATA_INSPECTOR')) {
//         const r = normalizeInspector(raw);
//         for (const check of r.checks) {
//           const dim = check.dimension as DQDimension;

//           // record strict applied dimension to filter averages in UI
//           if (DIMS.includes(dim)) state.appliedDims.add(dim);

//           const colName = (check as any)?.column;
//           if (typeof colName === 'string' && colName.trim()) {
//             const key = colName.trim();
//             inspectorColumns.add(key);
//             if (!inspectorStatsByCol.has(key)) inspectorStatsByCol.set(key, {});
//             const st = inspectorStatsByCol.get(key)!;
//             const evalRows = toNum((check as any).evaluated_rows);
//             if (typeof evalRows === 'number' && evalRows > 0) st.evaluated = evalRows;
//           }
//           if (DIMS.includes(dim)) {
//             if (typeof check.latest_score === 'number') {
//               sum[dim] += clamp01(check.latest_score);
//               cnt[dim] += 1;
//             }
//             state.ruleOccurrences[dim].checks_reported += 1;
//           }
//         }
//         for (const v of r.violations ?? []) {
//           const dim = v.dimension as DQDimension;
//           if (DIMS.includes(dim)) {
//             state.ruleOccurrences[dim].violations_detected += v.count ?? 0;
//           }
//           const key = v.rule_id ?? stableRuleKey(v);
//           const prev = violationsByRule.get(key) ?? { dim, desc: undefined, count: 0, last: undefined };
//           violationsByRule.set(key, {
//             dim,
//             desc: prev.desc ?? v.description,
//             count: prev.count + (v.count ?? 0),
//             last: v.last_seen ?? prev.last,
//           });
//         }
//       }

//       if (tool.includes('ANOMALY')) {
//         const a = normalizeAnomaly(raw);
//         const score = clamp01(a.anomaly_score ?? 0);
//         const sev = (a.severity as any) ?? severityOf(score);

//         if (!state.anomaly) {
//           state.anomaly = {
//             score,
//             severity: sev,
//             contributors: a.contributors ?? [],
//             metrics: a.metrics,
//             notes: a.notes,
//           };
//           state.anomalyInsights.top_contributors = a.contributors ?? [];
//           state.anomalyInsights.notes = a.notes ?? [];
//         } else {
//           if (score > (state.anomaly.score ?? 0)) {
//             state.anomaly = {
//               score,
//               severity: sev,
//               contributors: a.contributors ?? [],
//               metrics: a.metrics,
//               notes: a.notes,
//             };
//             state.anomalyInsights.top_contributors = a.contributors ?? [];
//             state.anomalyInsights.notes = a.notes ?? [];
//           } else if (score === state.anomaly.score) {
//             const mergedNotes = Array.from(new Set([...(state.anomaly.notes ?? []), ...(a.notes ?? [])]));
//             state.anomaly.notes = mergedNotes;
//             state.anomalyInsights.notes = mergedNotes;
//             const mergedContribs = Array.from(new Set([...(state.anomaly.contributors ?? []), ...(a.contributors ?? [])]));
//             state.anomaly.contributors = mergedContribs;
//             state.anomalyInsights.top_contributors = mergedContribs;

//             const incomingPos = (a.metrics as any)?.perColumnPositive;
//             if (incomingPos && !state.anomaly.metrics?.perColumnPositive) {
//               state.anomaly.metrics = { ...(state.anomaly.metrics ?? {}), perColumnPositive: incomingPos };
//             }
//             const incomingDimPos = (a.metrics as any)?.perDimensionPositive;
//             if (incomingDimPos && !state.anomaly.metrics?.perDimensionPositive) {
//               state.anomaly.metrics = { ...(state.anomaly.metrics ?? {}), perDimensionPositive: incomingDimPos };
//             }
//           }
//         }

//         const cols = (raw as any)?.columns;
//         if (Array.isArray(cols)) {
//           for (const c of cols) {
//             const name = typeof c === 'string' ? c : (c?.name ?? c?.column ?? '');
//             if (typeof name === 'string' && name.trim()) payloadColumns.add(name.trim());
//           }
//         }

//         const derived = (a as any)._derived_violations as any[] | undefined;
//         if (Array.isArray(derived)) {
//           for (const v of derived) {
//             const dim = v.dimension as DQDimension;
//             if (DIMS.includes(dim)) {
//               state.ruleOccurrences[dim].violations_detected += v.count ?? 0;
//             }
//             const key = v.rule_id ?? stableRuleKey(v);
//             const prev = violationsByRule.get(key) ?? { dim, desc: undefined, count: 0, last: undefined };
//             violationsByRule.set(key, {
//               dim,
//               desc: prev.desc ?? v.description,
//               count: prev.count + (v.count ?? 0),
//               last: v.last_seen ?? prev.last,
//             });
//           }
//         }
//       }
//     }
//   }

//   // Finalize dimensionScores as averages (checks)
//   for (const d of DIMS) {
//     state.dimensionScores[d] = cnt[d] ? +((sum[d] / cnt[d]).toFixed(4)) : 0;
//   }

//   // Backfill averages from anomaly perDimensionPositive when checks are absent
//   if (state.anomaly?.metrics?.perDimensionPositive) {
//     const pd = state.anomaly.metrics.perDimensionPositive as Record<DQDimension, number>;
//     for (const d of DIMS) {
//       if (!cnt[d] && typeof pd[d] === 'number') {
//         state.dimensionScores[d] = +pd[d].toFixed(4);
//       }
//     }
//   }

//   // Per-column positives:
//   // 1) mark all observed columns (inspector/payload) as 100% if not present in anomaly map
//   // 2) recompute anomaly columns using inspector evaluated_rows when total_rows is missing
//   if (state.anomaly) {
//     const pos = (state.anomaly.metrics?.perColumnPositive ?? {}) as Record<string, number>;

//     // ES5-safe union of observed columns
//     const allObserved = new Set<string>();
//     inspectorColumns.forEach((c) => allObserved.add(c));
//     payloadColumns.forEach((c) => allObserved.add(c));

//     // fill missing → 100%
//     allObserved.forEach((col) => {
//       if (typeof pos[col] === 'undefined') pos[col] = 1;
//     });

//     // counts from derived violations (used to recompute ratios)
//     const derived = (state.anomaly as any)?._derived_violations as any[] | undefined;
//     const countsByCol = new Map<string, number>();
//     if (Array.isArray(derived)) {
//       for (const v of derived) {
//         const desc = String(v?.description ?? '');
//         // try to locate column token after "on "
//         const m = desc.match(/\bon\s+([A-Za-z0-9_]+)/i);
//         const c = m?.[1];
//         const count = toNum(v?.count) ?? 0;
//         if (c) countsByCol.set(c, (countsByCol.get(c) ?? 0) + count);
//       }
//     }

//     countsByCol.forEach((count, col) => {
//       const st = inspectorStatsByCol.get(col);
//       if (st?.evaluated && st.evaluated > 0) {
//         const ratio = clamp01(count / st.evaluated);
//         const positive = +(clamp01(1 - ratio)).toFixed(4);
//         if (typeof pos[col] === 'undefined' || pos[col] === 0) pos[col] = positive;
//       }
//     });

//     // final guard for contributor chips: default to 100% if still 0/undefined
//     const contributors = state.anomaly.contributors ?? [];
//     contributors.forEach((rawCol) => {
//       const col = String(rawCol ?? '').trim();
//       if (typeof pos[col] === 'undefined' || pos[col] === 0 && !countsByCol.has(col)) {
//         pos[col] = 1;
//       }
//     });

//     state.anomaly.metrics = { ...(state.anomaly.metrics ?? {}), perColumnPositive: pos };
//   }

//   // Build violations table with clean display IDs
//   state.ruleViolationsTable = Array.from(violationsByRule.entries())
//     .map(([k, v]) => ({
//       rule_id: k,
//       display_rule_id: prettyRuleId(k, v.desc),
//       dimension: prettyDim(v.dim),
//       description: v.desc,
//       violations: v.count,
//       last_seen: v.last,
//     }))
//     .sort((a, b) => b.violations - a.violations);

//   if (typeof window !== 'undefined' && (window as any).DQ_DEBUG) {
//     const totals = {
//       rules: Object.values(state.ruleDistribution).reduce((a, b) => a + b, 0),
//       checks: Object.values(state.ruleOccurrences).reduce((a, b: any) => a + b.checks_reported, 0),
//       violations: Object.values(state.ruleOccurrences).reduce((a, b: any) => a + b.violations_detected, 0),
//       anomalyScore: state.anomaly?.score ?? 0,
//       anomalySeverity: state.anomaly?.severity ?? 'low',
//     };
//     console.log('[DQ] Aggregated totals:\n' + JSON.stringify(totals, null, 2));
//     console.log(
//       `[DQ] Health: rules=${totals.rules}, checks=${totals.checks}, violations=${totals.violations}, ` +
//         `anomaly=${Math.round((totals.anomalyScore ?? 0) * 100)}% (${totals.anomalySeverity})`,
//     );
//   }

//   return state;
// }






// src/dq/dqAggregator.ts
import type { ChatMessage } from '../types/chat';
import type {
  ToolResultPayload,
  SynthesiserResult,
  DataInspectorResult,
  AnomalyResult,
  DQDimension,
} from '../types/dqToolResults';

/* ============================================================
   Types & Dashboard State
   ============================================================ */

export type DimensionKey = DQDimension;

export interface DashboardState {
  dimensionScores: Record<DimensionKey, number>;
  ruleDistribution: Record<DimensionKey, number>;
  ruleOccurrences: Record<
    DimensionKey,
    { rules_defined: number; checks_reported: number; violations_detected: number }
  >;
  anomaly:
    | {
        score: number;
        severity: 'low' | 'moderate' | 'high' | 'critical';
        contributors: string[];
        metrics?: { perColumnPositive?: Record<string, number>; [k: string]: any };
        notes?: string[];
      }
    | null;
  anomalyInsights: { top_contributors: string[]; notes: string[] };
  ruleViolationsTable: Array<{
    rule_id: string;
    display_rule_id?: string;
    dimension: string;
    description?: string;
    violations: number;
    last_seen?: string;
  }>;
  /** Strict set of dimensions reported by Inspector (explicit category or Rule Applied) */
  appliedDims: Set<DQDimension>;
}

/* ============================================================
   Helpers
   ============================================================ */

const DIMS: DimensionKey[] = ['uniqueness', 'validity', 'completeness', 'consistency', 'accuracy'];
const objFromDims = <T,>(v: T) =>
  (Object.fromEntries(DIMS.map((d) => [d, v])) as unknown) as Record<DimensionKey, T>;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x ?? 0));
const toNum = (v: any) => {
  if (v === null || v === undefined) return undefined;
  const n = typeof v === 'string' ? Number(v) : v;
  return Number.isFinite(n) ? n : undefined;
};

const DIM_MAP: Record<string, DQDimension> = {
  uniqueness: 'uniqueness',
  unique: 'uniqueness',
  validity: 'validity',
  valid: 'validity',
  completeness: 'completeness',
  complete: 'completeness',
  consistency: 'consistency',
  consistent: 'consistency',
  accuracy: 'accuracy',
  accurate: 'accuracy',
};

function normDim(s: any): DQDimension {
  const k = String(s ?? '').toLowerCase().trim();
  return (DIM_MAP[k] ?? 'accuracy') as DQDimension;
}
function prettyDim(d: DQDimension) {
  return d[0].toUpperCase() + d.slice(1);
}
function severityOf(score: number): 'low' | 'moderate' | 'high' | 'critical' {
  return score >= 0.85 ? 'critical' : score >= 0.65 ? 'high' : score >= 0.35 ? 'moderate' : 'low';
}

// parse JSON (supports fenced blocks)
function tryParse(value: any): any {
  if (typeof value !== 'string') return value;
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const s = fenced ? fenced[1] : value;
  try { return JSON.parse(s); } catch { return value; }
}
function tryParseFromText(value: any): any | undefined {
  if (typeof value !== 'string') return undefined;
  const m = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const s = m ? m[1] : value;
  try { return JSON.parse(s); } catch { return undefined; }
}
function parseContentEntry(entry: any): any | undefined {
  try {
    if (entry?.json) {
      const j = entry.json;
      if (typeof j?.result === 'string') return JSON.parse(j.result);
      if (typeof j === 'object') return j;
    }
    if (typeof entry === 'string') return JSON.parse(entry);
    if (entry && typeof entry === 'object') return entry;
    return undefined;
  } catch { return undefined; }
}

// Deterministic key for violations aggregation
function stableRuleKey(v: any): string {
  const dim = String(v?.dimension ?? '').toLowerCase();
  const desc = String(v?.description ?? v?.title ?? v?.text ?? v?.column ?? '').trim();
  const expr = String(v?.expression ?? '').trim();
  const key = [dim, desc, expr].filter(Boolean).join('\n');
  return key || Math.random().toString(36).slice(2);
}

function strictDimFromCategory(cat?: any): DQDimension | undefined {
  const k = String(cat ?? '').toLowerCase().trim();
  const m = DIM_MAP[k];
  return m && DIMS.includes(m) ? m : undefined;
}

function pickCaseInsensitive(obj: any, canonicalNames: string[]): any {
  if (!obj || typeof obj !== 'object') return undefined;
  const wanted = new Set(canonicalNames.map((n) => n.toLowerCase().replace(/\s+/g, '_').trim()));
  for (const [key, val] of Object.entries(obj)) {
    const lc = key.toLowerCase().replace(/\s+/g, '_').trim();
    if (wanted.has(lc)) return val;
  }
  return undefined;
}

function firstDimFromApplied(applied?: string): DQDimension | undefined {
  if (!applied) return undefined;
  const first = applied.split(',')[0]?.trim();
  return first ? normDim(first) : undefined;
}

// Pretty Rule ID for UI
function tokenishId(s?: string): boolean {
  if (!s) return false;
  return /^[A-Za-z0-9_.:\-#]{1,40}$/.test(s);
}
function shortHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return (h >>> 0).toString(16).slice(0, 6);
}
function prettyRuleId(ruleId?: string, description?: string): string {
  if (tokenishId(ruleId)) return ruleId!;
  const hasSQLish = !!ruleId?.match(/\b(select|update|insert|delete|create|alter|merge)\b/i);
  if (!ruleId || hasSQLish || ruleId.length > 40 || /\s/.test(ruleId)) {
    if (description && description.trim()) {
      const trimmed = description.trim();
      return trimmed.length > 60 ? trimmed.slice(0, 57) + '…' : trimmed;
    }
    return `Rule-${shortHash(ruleId || 'unknown')}`;
  }
  return ruleId;
}

/* ============================================================
   Anomaly array recognizers & utilities
   ============================================================ */

type RawAnomalyItem = {
  anomaly_count?: number;
  anomaly_pct?: number | string;
  anomaly_percentage?: number | string;
  total_rows?: number;
  anomaly_type?: string;
  column?: string;
  confidence_score?: number;
  sql_fix?: string;
  suggested_remediation?: string;
  [k: string]: any;
};
function isAnomalyArrayShape(obj: any): obj is RawAnomalyItem[] {
  return Array.isArray(obj) &&
    obj.some((it) =>
      typeof it === 'object' &&
      ('anomaly_count' in it || 'confidence_score' in it || 'anomaly_type' in it || 'anomaly_pct' in it)
    );
}
function inferDimFromAnomalyType(t?: string): DQDimension {
  const s = String(t ?? '').toLowerCase();
  if (/duplicate|dup/i.test(s)) return 'uniqueness';
  if (/null|missing|empty/i.test(s)) return 'completeness';
  if (/format|regex|pattern|type/i.test(s)) return 'validity';
  if (/inconsisten|mismatch|drift/i.test(s)) return 'consistency';
  return 'accuracy';
}
function toNumPercent(v: any): number | undefined {
  if (v === null || v === undefined) return undefined;
  if (typeof v === 'string') {
    const s = v.trim();
    if (s.endsWith('%')) {
      const n = Number(s.slice(0, -1));
      return Number.isFinite(n) ? clamp01(n / 100) : undefined;
    }
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
  }
  if (typeof v === 'number') return v;
  return undefined;
}

/* ============================================================
   Payload recognition
   ============================================================ */

function inferToolNameFromObj(obj: any): string | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  if ('rules' in obj || 'generated_rules' in obj || 'ruleset' in obj || 'dq_rules' in obj || 'business_rules' in obj || 'items' in obj)
    return 'SYNTHESISER_AGENT_HIL';
  if ('checks' in obj || 'dq_result' in obj || 'results' in obj || 'violations' in obj || 'errors' in obj || 'failures' in obj)
    return 'DATA_INSPECTOR_HIL';
  if ('anomaly_score' in obj || 'anomalyScore' in obj || 'likelihood' in obj || 'score' in obj || 'risk' in obj)
    return 'ANOMALY_AGENT_HIL';
  if ('anomalies' in obj && Array.isArray(obj.anomalies)) return 'ANOMALY_AGENT_HIL';
  if ('patterns' in obj || 'detected_patterns' in obj || 'regexes' in obj) return 'PATTERN_AGENT_HIL';
  if ('exec_id' in obj || 'executionId' in obj || 'run_id' in obj) return 'TRACEABILITY_AGENT_HIL';
  const nested =
    (obj as any).result ??
    (obj as any).output ??
    (obj as any).data ??
    (obj as any).payload ??
    (obj as any).content;
  if (nested && typeof nested === 'object') return inferToolNameFromObj(nested);
  return undefined;
}

function coerceDQFields(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;

  if (isAnomalyArrayShape(obj)) {
    const built = buildAnomalyFromItems(obj as RawAnomalyItem[]);
    return {
      anomaly_score: built.score,
      contributors: built.contributors,
      notes: built.notes,
      _derived_violations: built.derivedViolations,
      metrics: {
        ...(obj as any).metrics,
        perColumnPositive: built.perColumnPositive,
        perDimensionPositive: built.perDimensionPositive,
      },
    };
  }

  const core =
    (obj as any).result ??
    (obj as any).output ??
    (obj as any).data ??
    (obj as any).payload ??
    (obj as any).content ??
    obj;

  const out: any = { ...core };

  try {
    if (Array.isArray(out.anomalies)) {
      const built = buildAnomalyFromItems(out.anomalies as RawAnomalyItem[]);
      out.anomaly_score = built.score;
      out.contributors = built.contributors;
      out.notes = built.notes;
      out._derived_violations = built.derivedViolations;
      out.metrics = {
        ...(out.metrics ?? {}),
        perColumnPositive: built.perColumnPositive,
        perDimensionPositive: built.perDimensionPositive,
      };
    }
  } catch {}

  out.rules =
    out.rules ??
    out.generated_rules ??
    out.ruleset ??
    out.dq_rules ??
    out.business_rules ??
    (Array.isArray(out.items) ? out.items : out.rules);

  out.checks =
    out.checks ??
    out.dq_result ??
    (Array.isArray(out.results) ? out.results : []) ??
    out.metrics?.checks ??
    out.checkResults;

  const vArr = out.violations ?? out.errors ?? out.failures;
  if (Array.isArray(vArr)) out.violations = vArr;

  out.anomaly_score =
    toNum(out.anomaly_score) ??
    toNum(out.anomalyScore) ??
    toNum(out.likelihood) ??
    toNum(out.score) ??
    toNum(out.risk) ??
    toNum(out.metrics?.anomaly_score) ??
    out.anomaly;

  out.patterns = out.patterns ?? out.detected_patterns ?? out.regexes;
  out.exec_id = out.exec_id ?? out.executionId ?? out.run_id ?? out.execId ?? out.runId;

  return out;
}

function normalizePayload(p: any, explicitTool?: string): ToolResultPayload | undefined {
  if (!p) return undefined;
  const coerced = coerceDQFields(tryParse(p));
  if (coerced && typeof coerced === 'object' && !(coerced as any).tool) {
    (coerced as any).tool = explicitTool ?? inferToolNameFromObj(coerced) ?? 'UNKNOWN_TOOL';
  }
  return coerced;
}

function extractPayloadsFromMessage(msg: any): ToolResultPayload[] {
  const out: any[] = [];
  const push = (value: any, path: string, toolHint?: string) => {
    if (!value) return;
    const arr = Array.isArray(value) ? value : [value];
    for (const item of arr) {
      const normalized = normalizePayload(item, toolHint);
      if (!normalized) continue;

      const hasRules = !!(normalized as any).rules;
      const hasChecks =
        !!(normalized as any).checks ||
        !!(normalized as any).dq_result ||
        !!(normalized as any).results;
      const hasAnom =
        typeof (normalized as any).anomaly_score !== 'undefined' ||
        Array.isArray((normalized as any).anomalies);

      const pick = (obj: any, fields: string[]) => {
        const o: any = {};
        for (const f of fields) if (typeof (obj as any)[f] !== 'undefined') o[f] = (obj as any)[f];
        return o;
      };

      let emitted = 0;
      if (hasRules) {
        const rOnly = pick(normalized, [
          'rules', 'generated_rules', 'ruleset', 'dq_rules', 'business_rules', 'items', 'tool',
        ]);
        rOnly.tool = 'SYNTHESISER_AGENT_HIL';
        out.push(rOnly);
        emitted++;
      }
      if (hasChecks) {
        const cOnly = pick(normalized, [
          'checks', 'dq_result', 'results', 'violations', 'errors', 'failures', 'metrics', 'tool', '_derived_violations',
        ]);
        cOnly.tool = 'DATA_INSPECTOR_HIL';
        out.push(cOnly);
        emitted++;
      }
      if (hasAnom) {
        const aOnly = pick(normalized, [
          'anomaly_score', 'severity', 'contributors', 'metrics', 'notes', 'tool', '_derived_violations', 'anomalies', 'columns',
        ]);
        aOnly.tool = 'ANOMALY_AGENT_HIL';
        out.push(aOnly);
        emitted++;
      }

      if (!emitted) out.push(normalized);

      if (typeof window !== 'undefined' && (window as any).DQ_DEBUG) {
        console.log(
          `[DQ] extracted payload from ${path}: ` +
            JSON.stringify(
              { tool: (normalized as any).tool, keys: Object.keys(normalized as any), emittedRecords: emitted || 1 },
              null,
              2,
            ),
        );
      }
    }
  };

  const textParsed =
    tryParseFromText(msg?.text) ??
    (typeof msg?.text === 'string' ? tryParseFromText(msg.text) : undefined);
  if (textParsed) push(textParsed, 'assistant.text');

  const respTextParsed =
    tryParseFromText(msg?.response?.text) ??
    (typeof msg?.response?.text === 'string' ? tryParseFromText(msg.response.text) : undefined);
  if (respTextParsed) push(respTextParsed, 'response.text');

  const contentLike: any[] = [];
  if (Array.isArray(msg?.response?.content)) contentLike.push(...msg.response.content);

  if (Array.isArray(msg?.timeline)) {
    for (const t of msg.timeline) {
      if (t?.type === 'tool' || /tool/i.test(String(t?.type))) {
        const tt = t as any;
        if (Array.isArray(tt?.content)) contentLike.push(...tt.content);
        else if (tt?.content) contentLike.push(tt.content);
        const containers = [tt?.payload, tt?.result, tt?.data, tt?.output].filter(Boolean);
        for (const box of containers) {
          if (Array.isArray(box?.content)) contentLike.push(...box.content);
          else if (box?.content) contentLike.push(box.content);
          else if (box) contentLike.push(box);
        }
      }
    }
  }

  if (Array.isArray(msg?.response?.events)) {
    for (const e of msg.response.events) {
      const ce = (e as any)?.content;
      if (Array.isArray(ce)) contentLike.push(...ce);
      else if (ce) contentLike.push(ce);
    }
  }

  const parsedContent: any[] = [];
  for (const part of contentLike) {
    const parsed = parseContentEntry(part);
    if (parsed) parsedContent.push(parsed);
  }
  if (parsedContent.length) push(parsedContent, 'content:merged');

  const payloads = out as ToolResultPayload[];
  if (typeof window !== 'undefined' && (window as any).DQ_DEBUG) {
    console.log('[DQ][Agg] total extracted payloads for msg', msg?.id, '=>', payloads.length);
  }
  return payloads;
}

/* ============================================================
   Inspector helpers
   ============================================================ */

function splitAppliedDims(applied: any): DQDimension[] {
  if (!applied) return [];
  const rawList: string[] = Array.isArray(applied)
    ? applied.map(String)
    : String(applied)
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter(Boolean);
  const dims = rawList.map(normDim).filter((d) => DIMS.includes(d));
  return Array.from(new Set(dims));
}

/* ============================================================
   Normalizers
   ============================================================ */

function deriveViolationsFromChecks(
  checks: any[],
): Array<{ rule_id: string; dimension?: DQDimension; description?: string; count: number; last_seen?: string }> {
  const out: any[] = [];
  for (const c of checks ?? []) {
    const count =
      toNum(c?.count) ??
      toNum(c?.violations) ??
      toNum(c?.failures) ??
      toNum(c?.errors) ??
      toNum(c?.failed_rows) ??
      toNum(c?.violations_count) ??
      toNum(c?.violations_cnt) ??
      0;

    // derive dimension; DO NOT default to accuracy
    const dimExplicit =
      strictDimFromCategory(c?.dimension) ??
      strictDimFromCategory(c?.dim) ??
      strictDimFromCategory(c?.category);
    const appliedRaw =
      pickCaseInsensitive(c, ['rule_applied', 'rules_applied', 'applied_rules', 'rule_types_applied']) ??
      (c as any)?.Rule_Applied ??
      (c as any)?.Applied_Rules;
    const appliedDims = splitAppliedDims(appliedRaw);
    const dimFinal = dimExplicit ?? appliedDims[0];

    if (count && count > 0 && dimFinal) {
      const v = {
        rule_id:
          c?.rule_id ??
          c?.id ??
          c?.name ??
          c?.column ??
          stableRuleKey({
            dimension: dimFinal,
            description: c?.description ?? c?.title ?? c?.text ?? (c?.column ? `Column ${c.column}` : ''),
          }),
        dimension: dimFinal,
        description: c?.description ?? c?.title ?? c?.text ?? (c?.column ? `Column ${c.column}` : undefined),
        count,
        last_seen: c?.last_seen ?? c?.checked_at ?? c?.at ?? c?.time ?? c?.timestamp,
      };
      out.push(v);
    }
    // no dim ⇒ skip (prevents phantom Accuracy)
  }
  return out;
}

function normalizeSynthesiser(raw: any): SynthesiserResult {
  const r0 = raw.result ?? raw;
  const rulesSrc =
    r0.rules ??
    r0.generated_rules ??
    r0.ruleset ??
    r0.dq_rules ??
    r0.business_rules ??
    (Array.isArray(r0.items) ? r0.items : []);
  const rules = rulesSrc
    .map((r: any) => {
      const dimCat = strictDimFromCategory(r.category);
      if (!dimCat) return null;
      return {
        rule_id: r.rule_id ?? r.id ?? r.name ?? stableRuleKey(r),
        dimension: dimCat,
        description: r.description ?? r.title ?? r.text ?? '',
        expression: r.expression ?? r.sql ?? r.rule ?? r.query ?? undefined,
        confidence: toNum(r.confidence ?? r.score ?? r.weight),
        created_at: r.created_at ?? r.time ?? r.timestamp,
      };
    })
    .filter(Boolean) as SynthesiserResult['rules'];
  return { tool: raw.tool ?? 'SYNTHESISER_AGENT_HIL', rules };
}

function normalizeInspector(raw: any): DataInspectorResult {
  const r0 = raw.result ?? raw;
  const checksSrc =
    r0.checks ??
    r0.dq_result ??
    (Array.isArray(r0.results) ? r0.results : []) ??
    r0.metrics?.checks ??
    r0.checkResults ??
    [];

  const checks: DataInspectorResult['checks'] = [];
  for (const c of checksSrc) {
    const dqRaw =
      pickCaseInsensitive(c, ['dq_score', 'latest_score', 'pass_ratio', 'score', 'rate']) ??
      (c as any)?.DQ_Score ??
      (c as any)?.DQ;
    const latestScore = toNumPercent(dqRaw);

    const failedRows =
      toNum(c?.failed_rows) ??
      toNum(c?.violations) ??
      toNum(c?.errors) ??
      (typeof c?.status === 'string' && /fail/i.test(c.status) ? 1 : 0);

    const explicitDim: DQDimension | undefined =
      strictDimFromCategory(c?.dimension) ??
      strictDimFromCategory(c?.dim) ??
      strictDimFromCategory(c?.category);

    const appliedRaw =
      pickCaseInsensitive(c, ['rule_applied', 'rules_applied', 'applied_rules', 'rule_types_applied']) ??
      (c as any)?.Rule_Applied ??
      (c as any)?.Applied_Rules;
    const appliedDims = splitAppliedDims(appliedRaw);

    const dimsToEmit: DQDimension[] =
      explicitDim && DIMS.includes(explicitDim)
        ? [explicitDim]
        : appliedDims.length
        ? appliedDims
        : [];

    const colRaw = pickCaseInsensitive(c, ['column', 'col', 'field', 'name']) ?? (c as any)?.Column;
    const colName = typeof colRaw === 'string' && colRaw.trim() ? colRaw.trim() : undefined;

    for (const dim of dimsToEmit) {
      checks.push({
        rule_id: c?.rule_id ?? c?.id ?? c?.name ?? (colName || stableRuleKey(c)),
        dimension: dim,
        evaluated_rows: toNum(c?.evaluated_rows ?? c?.rows ?? c?.sample_size ?? c?.total_rows),
        passed_rows: toNum(c?.passed_rows ?? c?.passed ?? c?.ok),
        failed_rows: failedRows,
        latest_score: latestScore,
        ...(colName ? { column: colName } : {}),
      } as any);
    }
  }

  const violations = Array.isArray(r0.violations)
    ? r0.violations.map((v: any) => ({
        rule_id: v.rule_id ?? v.id ?? v.name ?? stableRuleKey(v),
        dimension: (v?.dimension as DQDimension) ?? normDim(v?.dim ?? v?.category) ?? 'accuracy',
        description: v.description ?? v.title ?? v.text,
        count: toNum(v.count ?? v.violations ?? v.failures ?? v.errors) ?? 0,
        last_seen: v.last_seen ?? v.at ?? v.time ?? v.timestamp,
        examples: v.examples,
      }))
    : deriveViolationsFromChecks(checksSrc);

  return { tool: raw.tool ?? 'DATA_INSPECTOR_HIL', checks, violations };
}

function buildAnomalyFromItems(items: RawAnomalyItem[]) {
  const contributors = Array.from(new Set(items.map((it) => it.column).filter(Boolean))) as string[];
  const notes = Array.from(
    new Set([
      ...items.map((it) => it.anomaly_type).filter(Boolean),
      ...items.map((it) => it.suggested_remediation).filter(Boolean),
    ]),
  ) as string[];

  const byCol: Record<string, { anomaly: number }> = {};
  const maxCount = items.reduce((m, it) => Math.max(m, toNum(it.anomaly_count) ?? 0), 0);

  const dimAgg: Record<DQDimension, { sum: number; n: number }> = {
    uniqueness: { sum: 0, n: 0 },
    validity:   { sum: 0, n: 0 },
    completeness:{ sum: 0, n: 0 },
    consistency:{ sum: 0, n: 0 },
    accuracy:   { sum: 0, n: 0 },
  };

  for (const it of items) {
    const pct =
      toNumPercent(it.anomaly_pct) ??
      toNumPercent(it.anomaly_percentage);
    const conf = toNum(it.confidence_score);
    const count = toNum(it.anomaly_count);
    const total = toNum(it.total_rows);

    let anomalyRatio: number | undefined =
      pct !== undefined ? clamp01(pct)
      : conf !== undefined ? clamp01(conf)
      : count !== undefined && total !== undefined && total > 0 ? clamp01(count / total)
      : count !== undefined && maxCount > 0 ? clamp01(count / maxCount)
      : undefined;

    if (anomalyRatio === undefined) anomalyRatio = 0;

    const col = String(it.column ?? '').trim();
    if (col) byCol[col] = { anomaly: anomalyRatio };

    const dim = inferDimFromAnomalyType(it.anomaly_type);
    dimAgg[dim].sum += clamp01(anomalyRatio);
    dimAgg[dim].n += 1;
  }

  const overallAnomaly = Object.values(byCol).reduce((m, v) => Math.max(m, clamp01(v.anomaly)), 0);
  const score = clamp01(overallAnomaly);

  const derivedViolations = items.map((it) => {
    const dim = inferDimFromAnomalyType(it.anomaly_type);
    const count = toNum(it.anomaly_count) ?? 0;
    const desc = `${it.anomaly_type ?? 'Anomaly'}${it.column ? ` on ${it.column}` : ''}`;
    return {
      rule_id: stableRuleKey({ dimension: dim, description: desc, expression: it.sql_fix }),
      dimension: dim,
      description: desc,
      count,
      last_seen: undefined as string | undefined,
      examples: undefined as any,
    };
  });

  const perColumnPositive = Object.fromEntries(
    Object.entries(byCol).map(([col, v]) => [col, +(clamp01(1 - v.anomaly)).toFixed(4)]),
  );

  const perDimensionPositive = Object.fromEntries(
    (Object.keys(dimAgg) as DQDimension[]).map((d) => {
      const avgAnom = dimAgg[d].n ? dimAgg[d].sum / dimAgg[d].n : 0;
      return [d, +(clamp01(1 - avgAnom)).toFixed(4)];
    }),
  );

  return { score, contributors, notes, derivedViolations, perColumnPositive, perDimensionPositive };
}

function normalizeAnomaly(raw: any): AnomalyResult & { _derived_violations?: any[] } {
  const r = raw.result ?? raw;

  if (Array.isArray(r.anomalies) && isAnomalyArrayShape(r.anomalies)) {
    const built = buildAnomalyFromItems(r.anomalies);
    return {
      tool: raw.tool ?? 'ANOMALY_AGENT_HIL',
      anomaly_score: built.score,
      severity: severityOf(built.score),
      contributors: built.contributors,
      metrics: {
        perColumnPositive: built.perColumnPositive,
        perDimensionPositive: built.perDimensionPositive,
        anomalies: r.anomalies, // keep raw anomalies for column counts
      },
      notes: built.notes,
      _derived_violations: built.derivedViolations,
    };
  }

  if (Array.isArray(r) && isAnomalyArrayShape(r)) {
    const built = buildAnomalyFromItems(r);
    return {
      tool: raw.tool ?? 'ANOMALY_AGENT_HIL',
      anomaly_score: built.score,
      severity: severityOf(built.score),
      contributors: built.contributors,
      metrics: {
        perColumnPositive: built.perColumnPositive,
        perDimensionPositive: built.perDimensionPositive,
        anomalies: r, // keep raw anomalies for column counts
      },
      notes: built.notes,
      _derived_violations: built.derivedViolations,
    };
  }

  const score =
    toNum(r.anomaly_score) ??
    toNum(r.anomalyScore) ??
    toNum(r.likelihood) ??
    toNum(r.score) ??
    toNum(r.risk) ??
    toNum(r.metrics?.anomaly_score) ??
    0;

  return {
    tool: raw.tool ?? 'ANOMALY_AGENT_HIL',
    anomaly_score: score,
    severity: r.severity ?? r.severityLevel ?? r.level,
    contributors: r.contributors ?? r.top_contributors ?? r.columns ?? r.suspects ?? [],
    metrics: r.metrics,
    notes: r.notes ?? r.comments ?? [],
  };
}

/* -------------------------- Reducer -------------------------- */
export function reduceMessagesToDashboard(messages: ChatMessage[]): DashboardState {
  const state: DashboardState = {
    dimensionScores: objFromDims(0),
    ruleDistribution: objFromDims(0),
    ruleOccurrences: Object.fromEntries(
      DIMS.map((d) => [d, { rules_defined: 0, checks_reported: 0, violations_detected: 0 }]),
    ) as DashboardState['ruleOccurrences'],
    anomaly: null,
    anomalyInsights: { top_contributors: [], notes: [] },
    ruleViolationsTable: [],
    appliedDims: new Set<DQDimension>(),
  };

  const sum = objFromDims(0);
  const cnt = objFromDims(0);
  const violationsByRule = new Map<string, { dim: DimensionKey; desc?: string; count: number; last?: string }>();
  const inspectorColumns = new Set<string>();
  const payloadColumns = new Set<string>();
  const inspectorStatsByCol = new Map<string, { evaluated?: number; latest?: number }>(); // evaluated denominator + latest_score fallback
  const inspectorFailsByCol = new Map<string, number>(); // per-column failed counts (checks + violations)

  if (typeof window !== 'undefined' && (window as any).DQ_DEBUG) {
    console.log('[DQ][Agg] messages passed to reducer:', messages.length);
  }

  for (const msg of messages) {
    const toolPayloads: ToolResultPayload[] = extractPayloadsFromMessage(msg);

    for (const raw of toolPayloads) {
      const tool = (((raw as any)?.tool ?? '') as string).toUpperCase();

      if (tool.includes('SYNTHESISER')) {
        const r = normalizeSynthesiser(raw);
        for (const rule of r.rules) {
          const dim = rule.dimension as DQDimension;
          if (DIMS.includes(dim)) {
            state.ruleDistribution[dim] += 1;
            state.ruleOccurrences[dim].rules_defined += 1;
          }
        }
      }

      if (tool.includes('DATA_INSPECTOR')) {
        const r = normalizeInspector(raw);

        // checks → collect applied dims, per-column evaluated_rows, latest_score, and failed counts
        for (const check of r.checks) {
          const dim = check.dimension as DQDimension;
          const colName = (check as any)?.column;

          if (typeof colName === 'string' && colName.trim()) {
            const key = colName.trim();
            inspectorColumns.add(key);

            // ensure map entry
            if (!inspectorStatsByCol.has(key)) inspectorStatsByCol.set(key, {});
            const st = inspectorStatsByCol.get(key)!;

            // evaluated_rows denominator for recompute
            const evalRows = toNum((check as any).evaluated_rows);
            if (typeof evalRows === 'number' && evalRows > 0) st.evaluated = evalRows;

            // latest_score fallback (0..1)
            if (typeof check.latest_score === 'number') {
              st.latest = clamp01(check.latest_score);
            }

            // collect failed_rows as violation count for recompute
            const failedRows =
              toNum((check as any)?.failed_rows) ??
              toNum((check as any)?.violations) ??
              toNum((check as any)?.errors) ?? 0;

            if (typeof failedRows === 'number' && failedRows > 0) {
              inspectorFailsByCol.set(key, (inspectorFailsByCol.get(key) ?? 0) + failedRows);
            }
          }

          // record strict applied dimension to filter averages in UI
          if (DIMS.includes(dim)) state.appliedDims.add(dim);

          if (DIMS.includes(dim)) {
            if (typeof check.latest_score === 'number') {
              sum[dim] += clamp01(check.latest_score);
              cnt[dim] += 1;
            }
            state.ruleOccurrences[dim].checks_reported += 1;
          }
        }

        // violations → aggregate counts AND capture per-column failed rows (if we can parse the column)
        for (const v of r.violations ?? []) {
          const dim = v.dimension as DQDimension;
          if (DIMS.includes(dim)) {
            state.ruleOccurrences[dim].violations_detected += v.count ?? 0;
          }
          const key = v.rule_id ?? stableRuleKey(v);
          const prev = violationsByRule.get(key) ?? { dim, desc: undefined, count: 0, last: undefined };
          violationsByRule.set(key, {
            dim,
            desc: prev.desc ?? v.description,
            count: prev.count + (v.count ?? 0),
            last: v.last_seen ?? prev.last,
          });

          // try to capture a column and merge counts into inspectorFailsByCol
          const colFromField =
            typeof (v as any)?.column === 'string' && (v as any)?.column.trim()
              ? (v as any)?.column.trim()
              : undefined;

          let colParsed = colFromField;
          if (!colParsed) {
            const desc = String(v?.description ?? '');
            const mOn = desc.match(/\bon\s+([A-Za-z0-9_]+)/i);      // "... on COL"
            const mCol = desc.match(/\bcolumn\s+([A-Za-z0-9_]+)/i); // "Column COL"
            colParsed = (mOn?.[1] ?? mCol?.[1])?.trim();
          }

          if (colParsed) {
            
            const vCount = toNum((v as any)?.count) ?? toNum((v as any)?.violations) ?? toNum((v as any)?.failures) ??toNum((v as any)?.errors) ?? 0;
            if (vCount > 0) {
              inspectorFailsByCol.set(colParsed, (inspectorFailsByCol.get(colParsed) ?? 0) + vCount);
            }
          }
        }
      }

      if (tool.includes('ANOMALY')) {
        const a = normalizeAnomaly(raw);
        const score = clamp01(a.anomaly_score ?? 0);
        const sev = (a.severity as any) ?? severityOf(score);

        if (!state.anomaly) {
          state.anomaly = {
            score,
            severity: sev,
            contributors: a.contributors ?? [],
            metrics: a.metrics,
            notes: a.notes,
          };
          state.anomalyInsights.top_contributors = a.contributors ?? [];
          state.anomalyInsights.notes = a.notes ?? [];
        } else {
          if (score > (state.anomaly.score ?? 0)) {
            state.anomaly = {
              score,
              severity: sev,
              contributors: a.contributors ?? [],
              metrics: a.metrics,
              notes: a.notes,
            };
            state.anomalyInsights.top_contributors = a.contributors ?? [];
            state.anomalyInsights.notes = a.notes ?? [];
          } else if (score === state.anomaly.score) {
            const mergedNotes = Array.from(new Set([...(state.anomaly.notes ?? []), ...(a.notes ?? [])]));
            state.anomaly.notes = mergedNotes;
            state.anomalyInsights.notes = mergedNotes;
            const mergedContribs = Array.from(new Set([...(state.anomaly.contributors ?? []), ...(a.contributors ?? [])]));
            state.anomaly.contributors = mergedContribs;
            state.anomalyInsights.top_contributors = mergedContribs;

            const incomingPos = (a.metrics as any)?.perColumnPositive;
            if (incomingPos && !state.anomaly.metrics?.perColumnPositive) {
              state.anomaly.metrics = { ...(state.anomaly.metrics ?? {}), perColumnPositive: incomingPos };
            }
            const incomingDimPos = (a.metrics as any)?.perDimensionPositive;
            if (incomingDimPos && !state.anomaly.metrics?.perDimensionPositive) {
              state.anomaly.metrics = { ...(state.anomaly.metrics ?? {}), perDimensionPositive: incomingDimPos };
            }
          }
        }

        // capture full dataset column list coming from anomaly payload in file mode
        const cols = (raw as any)?.columns;
        if (Array.isArray(cols)) {
          for (const c of cols) {
            const name = typeof c === 'string' ? c : (c?.name ?? c?.column ?? '');
            if (typeof name === 'string' && name.trim()) payloadColumns.add(name.trim());
          }
        }

        const derived = (a as any)._derived_violations as any[] | undefined;
        if (Array.isArray(derived)) {
          for (const v of derived) {
            const dim = v.dimension as DQDimension;
            if (DIMS.includes(dim)) {
              state.ruleOccurrences[dim].violations_detected += v.count ?? 0;
            }
            const key = v.rule_id ?? stableRuleKey(v);
            const prev = violationsByRule.get(key) ?? { dim, desc: undefined, count: 0, last: undefined };
            violationsByRule.set(key, {
              dim,
              desc: prev.desc ?? v.description,
              count: prev.count + (v.count ?? 0),
              last: v.last_seen ?? prev.last,
            });
          }
        }
      }
    }
  }

  // Finalize dimensionScores as averages (checks)
  for (const d of DIMS) {
    state.dimensionScores[d] = cnt[d] ? +((sum[d] / cnt[d]).toFixed(4)) : 0;
  }

  // Backfill averages from anomaly perDimensionPositive when checks are absent
  if (state.anomaly?.metrics?.perDimensionPositive) {
    const pd = state.anomaly.metrics.perDimensionPositive as Record<DQDimension, number>;
    for (const d of DIMS) {
      if (!cnt[d] && typeof pd[d] === 'number') {
        state.dimensionScores[d] = +pd[d].toFixed(4);
      }
    }
  }

  // Per-column positives:
  // 1) mark all observed columns (inspector/payload) as 100% if not present in anomaly map
  // 2) recompute anomaly columns using inspector evaluated_rows when total_rows is missing
  if (state.anomaly) {
    const pos = (state.anomaly.metrics?.perColumnPositive ?? {}) as Record<string, number>;

    // ES5-safe union of observed columns
    const allObserved = new Set<string>();
    inspectorColumns.forEach((c) => allObserved.add(c));
    payloadColumns.forEach((c) => allObserved.add(c));

    // fill missing → 100%
    allObserved.forEach((col) => {
      if (typeof pos[col] === 'undefined') pos[col] = 1;
    });

    // counts from anomalies array and derived violations (used to recompute ratios)
    const countsByCol = new Map<string, number>();

    // Use anomalies array if present
    const anomaliesArr = (state.anomaly?.metrics as any)?.anomalies as RawAnomalyItem[] | undefined;
    if (Array.isArray(anomaliesArr)) {
      for (const it of anomaliesArr) {
        const c = String(it?.column ?? '').trim();
        const count = toNum(it?.anomaly_count) ?? 0;
        if (c) countsByCol.set(c, (countsByCol.get(c) ?? 0) + count);
      }
    }

    // Also use derived violations as a fallback source
    const derived = (state.anomaly as any)?._derived_violations as any[] | undefined;
    if (Array.isArray(derived)) {
      for (const v of derived) {
        const desc = String(v?.description ?? '');
        const m = desc.match(/\bon\s+([A-Za-z0-9_]+)/i);
        const c = m?.[1];
        const count = toNum(v?.count) ?? 0;
        if (c) countsByCol.set(c, (countsByCol.get(c) ?? 0) + count);
      }
    }

    // Merge Inspector failed counts for any column (table mode)
    inspectorFailsByCol.forEach((count, col) => {
      countsByCol.set(col, (countsByCol.get(col) ?? 0) + count);
    });

    // Recompute per-column positive using inspector evaluated_rows
    countsByCol.forEach((count, col) => {
      const st = inspectorStatsByCol.get(col);
      if (st?.evaluated && st.evaluated > 0) {
        const ratio = clamp01(count / st.evaluated);
        const positive = +(clamp01(1 - ratio)).toFixed(4);
        pos[col] = positive; // always compute (override 100% defaults for contributors)
      }
    });

    // Fallback — if no evaluated_rows, use latest_score (0..1) when available
    inspectorStatsByCol.forEach((st, col) => {
      if ((typeof pos[col] === 'undefined' || pos[col] === 0) && typeof st.latest === 'number') {
        pos[col] = +st.latest.toFixed(4);
      }
    });

    // Contributors: default to 100% only if no computed value exists at all
    const contributors = state.anomaly.contributors ?? [];
    contributors.forEach((rawCol) => {
      const col = String(rawCol ?? '').trim();
      if (typeof pos[col] === 'undefined') {
        pos[col] = 1;
      }
    });

    state.anomaly.metrics = { ...(state.anomaly.metrics ?? {}), perColumnPositive: pos };
  }

  // Build violations table with clean display IDs
  state.ruleViolationsTable = Array.from(violationsByRule.entries())
    .map(([k, v]) => ({
      rule_id: k,
      display_rule_id: prettyRuleId(k, v.desc),
      dimension: prettyDim(v.dim),
      description: v.desc,
      violations: v.count,
      last_seen: v.last,
    }))
    .sort((a, b) => b.violations - a.violations);

  if (typeof window !== 'undefined' && (window as any).DQ_DEBUG) {
    const totals = {
      rules: Object.values(state.ruleDistribution).reduce((a, b) => a + b, 0),
      checks: Object.values(state.ruleOccurrences).reduce((a, b: any) => a + b.checks_reported, 0),
      violations: Object.values(state.ruleOccurrences).reduce((a, b: any) => a + b.violations_detected, 0),
      anomalyScore: state.anomaly?.score ?? 0,
      anomalySeverity: state.anomaly?.severity ?? 'low',
    };
    console.log('[DQ] Aggregated totals:\n' + JSON.stringify(totals, null, 2));
    console.log(
      `[DQ] Health: rules=${totals.rules}, checks=${totals.checks}, violations=${totals.violations}, ` +
        `anomaly=${Math.round((totals.anomalyScore ?? 0) * 100)}% (${totals.anomalySeverity})`,
    );
  }

  return state;
}
