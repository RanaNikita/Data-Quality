// //working on 5 jan
// // src/components/dashboard/Dashboard.tsx

import { addTooltipEntrySettings } from "recharts/types/state/tooltipSlice";

// import React from 'react';
// import {
//   Box,
//   Paper,
//   Typography,
//   useTheme,
//   alpha,
//   Table,
//   TableBody,
//   TableRow,
//   TableCell,
//   TableHead,
//   Chip,
//   Stack,
// } from '@mui/material';
// import * as Recharts from 'recharts';
// import type { DashboardState } from '../../dq/dqAggregator';
// import { CHART_COLORS } from '../../types/chart';

// const {
//   ResponsiveContainer,
//   BarChart,
//   Bar,
//   XAxis,
//   YAxis,
//   CartesianGrid,
//   Tooltip,
// } = Recharts as any;

// type Props = { dashboard: DashboardState };

// const severityColor = (
//   sev: 'low' | 'moderate' | 'high' | 'critical',
//   theme: any,
// ) => {
//   switch (sev) {
//     case 'critical':
//       return theme.palette.error.main;
//     case 'high':
//       return alpha(theme.palette.error.main, 0.85);
//     case 'moderate':
//       return theme.palette.warning.main;
//     default:
//       return theme.palette.success.main;
//   }
// };

// // Mini semi-gauge (per column) -- unchanged
// const MiniSemiGauge: React.FC<{
//   positivePct: number;
//   label: string;
//   colorPos: string;
//   colorNeg: string;
// }> = ({ positivePct, label, colorPos, colorNeg }) => {
//   const pos = Math.max(0, Math.min(100, Math.round(positivePct)));
//   const neg = 100 - pos;
//   const data = [
//     { name: 'positive', value: pos },
//     { name: 'negative', value: neg },
//   ];
//   // Render the semicircle using a simple CSS-only approach to avoid any circles in main gauge
//   return (
//     <Box sx={{ width: 220 }}>
//       <Box
//         sx={{
//           position: 'relative',
//           width: '100%',
//           height: 100,
//           borderRadius: '100px 100px 0 0',
//           background: `linear-gradient(to right, ${colorPos} ${pos}%, ${alpha(colorNeg, 0.35)} ${pos}%)`,
//         }}
//       />
//       <Box sx={{ textAlign: 'center', mt: 1 }}>
//         <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
//           {label}: {pos}%
//         </Typography>
//       </Box>
//     </Box>
//   );
// };

// const Dashboard: React.FC<Props> = ({ dashboard }) => {
//   const theme = useTheme();

//   // Synthesiser-only: distribution & occurrences (counts per dimension)
//   const distributionSeries = Object.entries(dashboard.ruleDistribution).map(
//     ([k, v]) => ({
//       dimension: k[0].toUpperCase() + k.slice(1),
//       count: Number(v) || 0,
//     }),
//   );
//   const occurrencesSeries = distributionSeries;

//   // Inspector averages: DQ score (Y) by dimension / rule type applied (X)
//   const avgScoresSeries = Object.entries(dashboard.dimensionScores).map(
//     ([k, v]) => ({
//       dimension: k[0].toUpperCase() + k.slice(1),
//       scorePct: +((Number(v) * 100).toFixed(1)),
//     }),
//   );

//   // Overall Positive % = 100 − Anomaly %
//   const anomalySeverity = dashboard.anomaly?.severity ?? 'low';
//   const anomalyScore01 = Math.min(1, Math.max(0, dashboard.anomaly?.score ?? 0)); // 0..1
//   const overallPositive = Math.round((1 - anomalyScore01) * 100);

//   // Per-column positive% from aggregator (1 − anomalyRatio)
//   const perColumnPositive =
//     ((dashboard.anomaly?.metrics as any)?.perColumnPositive ?? {}) as Record<
//       string,
//       number
//     >;

//   const perColumnList = Object.entries(perColumnPositive)
//     .map(([col, val]) => ({ col, pct: Math.round((val ?? 0) * 100) }))
//     .sort((a, b) => b.pct - a.pct);

//   // Contributors: show "<column>: <positive%>"
//   const contributorList = (dashboard.anomaly?.contributors ?? []).map((col) => {
//     const pos01 = perColumnPositive?.[col];
//     // Default to 0% if missing (can switch to undefined/— if you want)
//     const pct = typeof pos01 === 'number' ? Math.round(pos01 * 100) : 0;
//     return { col, pct };
//   });

//   return (
//     <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
//       {/* Row 1: KPI cards — averages */}
//       <Box
//         sx={{
//           display: 'grid',
//           gap: 2,
//           gridTemplateColumns: {
//             xs: '1fr',
//             sm: 'repeat(2, 1fr)',
//             md: 'repeat(3, 1fr)',
//             lg: 'repeat(6, 1fr)',
//           },
//         }}
//       >
//         {avgScoresSeries.map((kpi) => (
//           <Paper key={kpi.dimension} sx={{ p: 2 }}>
//             <Typography variant="subtitle2" color="text.secondary">
//               {kpi.dimension}
//             </Typography>
//             <Typography variant="h5" sx={{ fontWeight: 700 }}>
//               {kpi.scorePct}%
//             </Typography>
//           </Paper>
//         ))}
//       </Box>

//       {/* Row 2: Anomaly Gauge (text-only) • Rule Quality Distribution */}
//       <Box
//         sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}
//       >
//         {/* LEFT: Overall positive (NO circle/arc) + per-column semi-gauges */}
//         <Paper sx={{ p: 2 }}>
//           <Stack
//             direction="row"
//             alignItems="center"
//             justifyContent="space-between"
//             sx={{ mb: 1 }}
//           >
//             <Typography variant="h6" sx={{ fontWeight: 700 }}>
//               Anomaly Gauge
//             </Typography>
//             <Chip
//               label={anomalySeverity.toUpperCase()}
//               size="small"
//               sx={{
//                 backgroundColor: alpha(severityColor(anomalySeverity, theme), 0.12),
//                 color: severityColor(anomalySeverity, theme),
//                 border: `1px solid ${alpha(severityColor(anomalySeverity, theme), 0.4)}`,
//               }}
//             />
//           </Stack>

//           {/* Text-only overall readout (NO circle, as requested) */}
//           <Box sx={{ textAlign: 'center', py: 4 }}>
//             <Typography variant="h4" sx={{ fontWeight: 800 }}>
//               {overallPositive}%
//             </Typography>
//             <Typography variant="body2" color="text.secondary">
//               Positive
//             </Typography>
//           </Box>

//           {/* Column semi-gauges */}
//           {perColumnList.length > 0 && (
//             <Box sx={{ mt: 2 }}>
//               <Typography
//                 variant="subtitle2"
//                 color="text.secondary"
//                 sx={{ mb: 0.5 }}
//               >
//                 Column Positives
//               </Typography>
//               <Box
//                 sx={{
//                   display: 'grid',
//                   gap: 2,
//                   gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
//                 }}
//               >
//                 {perColumnList.slice(0, 9).map(({ col, pct }) => (
//                   <MiniSemiGauge
//                     key={col}
//                     positivePct={pct}
//                     label={col}
//                     colorPos={theme.palette.success.main}
//                     colorNeg={theme.palette.error.main}
//                   />
//                 ))}
//               </Box>
//             </Box>
//           )}

//           {/* Contributors with Positive% */}
//           {dashboard.anomaly && dashboard.anomaly.contributors?.length > 0 && (
//             <Box sx={{ mt: 1 }}>
//               <Typography
//                 variant="subtitle2"
//                 color="text.secondary"
//                 sx={{ mb: 0.5 }}
//               >
//                 Contributors
//               </Typography>
//               <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
//                 {contributorList.slice(0, 10).map(({ col, pct }) => (
//                   <Chip
//                     key={col}
//                     label={`${col}: ${pct}%`}
//                     size="small"
//                   />
//                 ))}
//               </Stack>
//             </Box>
//           )}
//         </Paper>

//         {/* RIGHT: Rule Quality Distribution (Synthesiser-only) */}
//         <Paper sx={{ p: 2 }}>
//           <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
//             Rule Quality Distribution
//           </Typography>
//           <ResponsiveContainer width="100%" height={300}>
//             <BarChart
//               data={distributionSeries}
//               margin={{ top: 10, right: 30, left: 20, bottom: 60 }}
//             >
//               <CartesianGrid
//                 strokeDasharray="3 3"
//                 stroke={alpha(theme.palette.divider, 0.25)}
//               />
//               <XAxis dataKey="dimension" angle={-45} textAnchor="end" height={60} />
//               <YAxis allowDecimals={false} />
//               <Tooltip />
//               <Bar
//                 dataKey="count"
//                 fill={theme.palette.primary.main}
//                 radius={[4, 4, 0, 0]}
//               />
//             </BarChart>
//           </ResponsiveContainer>
//         </Paper>
//       </Box>

//       {/* Row 3: Average Latest Scores • Number of Rule Occurrences */}
//       <Paper sx={{ p: 2 }}>
//         <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
//           Average Latest Scores by Dimensions
//         </Typography>
//         <ResponsiveContainer width="100%" height={320}>
//           <BarChart
//             data={avgScoresSeries}
//             margin={{ top: 10, right: 30, left: 20, bottom: 60 }}
//           >
//             <CartesianGrid
//               strokeDasharray="3 3"
//               stroke={alpha(theme.palette.divider, 0.25)}
//             />
//             <XAxis
//               dataKey="dimension"
//               angle={-45}
//               textAnchor="end"
//               height={60}
//               label={{ value: 'Rule Type Applied', position: 'insideBottom', offset: -40 }}
//             />
//             <YAxis unit="%" label={{ value: 'DQ Score (Inspector)', angle: -90, position: 'insideLeft' }} />
//             <Tooltip />
//             <Bar dataKey="scorePct" fill={theme.palette.primary.main} />
//           </BarChart>
//         </ResponsiveContainer>
//       </Paper>

//       <Paper sx={{ p: 2 }}>
//         <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
//           Number of Rule Occurrences by Dimensions
//         </Typography>
//         <ResponsiveContainer width="100%" height={320}>
//           <BarChart
//             data={occurrencesSeries}
//             margin={{ top: 10, right: 30, left: 20, bottom: 60 }}
//           >
//             <CartesianGrid
//               strokeDasharray="3 3"
//               stroke={alpha(theme.palette.divider, 0.25)}
//             />
//             <XAxis dataKey="dimension" angle={-45} textAnchor="end" height={60} />
//             <YAxis allowDecimals={false} />
//             <Tooltip />
//             <Bar
//               dataKey="count"
//               fill={CHART_COLORS[0]}
//               radius={[4, 4, 0, 0]}
//             />
//           </BarChart>
//         </ResponsiveContainer>
//       </Paper>

//       {/* Row 4: Anomaly Insights • Rule Violations Summary */}
//       <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 2fr' } }}>
//         <Paper sx={{ p: 2 }}>
//           <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
//             Anomaly Insights
//           </Typography>
//           {dashboard.anomalyInsights.top_contributors.length === 0 &&
//           (!dashboard.anomaly?.notes || dashboard.anomaly.notes.length === 0) ? (
//             <Typography variant="body2" color="text.secondary">
//               No insights available for the latest run.
//             </Typography>
//           ) : (
//             <Box component="ul" sx={{ pl: 3, m: 0 }}>
//               {dashboard.anomalyInsights.top_contributors.map((c) => (
//                 <Typography key={c} component="li" variant="body2">
//                   {c}
//                 </Typography>
//               ))}
//               {dashboard.anomaly?.notes?.map((n, i) => (
//                 <Typography key={`n${i}`} component="li" variant="body2">
//                   {n}
//                 </Typography>
//               ))}
//             </Box>
//           )}
//         </Paper>

//         <Paper sx={{ p: 2 }}>
//           <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
//             Rule Violations Summary
//           </Typography>
//           <Table size="small" stickyHeader>
//             <TableHead>
//               <TableRow>
//                 <TableCell>Rule ID</TableCell>
//                 <TableCell>Dimension</TableCell>
//                 <TableCell>Description</TableCell>
//                 <TableCell align="right">Violations</TableCell>
//                 <TableCell>Last Seen</TableCell>
//               </TableRow>
//             </TableHead>
//             <TableBody>
//               {dashboard.ruleViolationsTable.map((r) => (
//                 <TableRow key={r.rule_id}>
//                   <TableCell>{r.rule_id}</TableCell>
//                   <TableCell>{r.dimension}</TableCell>
//                   <TableCell
//                     sx={{
//                       maxWidth: 380,
//                       whiteSpace: 'nowrap',
//                       overflow: 'hidden',
//                       textOverflow: 'ellipsis',
//                     }}
//                   >
//                     {r.description ?? '—'}
//                   </TableCell>
//                   <TableCell align="right">{r.violations}</TableCell>
//                   <TableCell>{r.last_seen ?? '—'}</TableCell>
//                 </TableRow>
//               ))}
//               {dashboard.ruleViolationsTable.length === 0 && (
//                 <TableRow>
//                   <TableCell colSpan={5}>
//                     <Typography variant="body2" color="text.secondary">
//                       No violations in the latest run.
//                     </Typography>
//                   </TableCell>
//                 </TableRow>
//               )}
//             </TableBody>
//           </Table>
//         </Paper>
//       </Box>
//     </Box>
//   );
// };

// export default Dashboard;

// 6 jan - working but not properly


// // src/components/dashboard/Dashboard.tsx
// import React from 'react';
// import {
//   Box,
//   Paper,
//   Typography,
//   useTheme,
//   alpha,
//   Table,
//   TableBody,
//   TableRow,
//   TableCell,
//   TableHead,
//   Chip,
//   Stack,
// } from '@mui/material';
// import * as Recharts from 'recharts';
// import type { DashboardState } from '../../dq/dqAggregator';
// import { CHART_COLORS } from '../../types/chart';

// const {
//   ResponsiveContainer,
//   BarChart,
//   Bar,
//   XAxis,
//   YAxis,
//   CartesianGrid,
//   Tooltip,
// } = Recharts as any;

// type Props = { dashboard: DashboardState };

// const severityColor = (
//   sev: 'low' | 'moderate' | 'high' | 'critical',
//   theme: any,
// ) => {
//   switch (sev) {
//     case 'critical':
//       return theme.palette.error.main;
//     case 'high':
//       return alpha(theme.palette.error.main, 0.85);
//     case 'moderate':
//       return theme.palette.warning.main;
//     default:
//       return theme.palette.success.main;
//   }
// };

// // Mini semi-gauge (per column) — compact footprint
// const MiniSemiGauge: React.FC<{
//   positivePct: number;
//   label: string;
//   colorPos: string;
//   colorNeg: string;
// }> = ({ positivePct, label, colorPos, colorNeg }) => {
//   const pos = Math.max(0, Math.min(100, Math.round(positivePct)));
//   return (
//     <Box sx={{ width: 96 }}>
//       <Box
//         sx={{
//           position: 'relative',
//           width: '100%',
//           height: 44,
//           borderRadius: '100px 100px 0 0',
//           background: `linear-gradient(to right, ${colorPos} ${pos}%, ${alpha(colorNeg, 0.35)} ${pos}%)`,
//         }}
//       />
//       <Box sx={{ textAlign: 'center', mt: 0.5 }}>
//         <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>
//           {label}
//         </Typography>
//         <Typography variant="caption" color="text.secondary">{pos}%</Typography>
//       </Box>
//     </Box>
//   );
// };

// const Dashboard: React.FC<Props> = ({ dashboard }) => {
//   const theme = useTheme();

//   // Synthesiser-only: distribution (counts per dimension)
//   const distributionSeries = Object.entries(dashboard.ruleDistribution).map(
//     ([k, v]) => ({
//       dimension: k[0].toUpperCase() + k.slice(1),
//       count: Number(v) || 0,
//     }),
//   );

//   // Occurrences: choose the metric you want displayed (here violations_detected)
//   const occurrencesSeries = Object.entries(dashboard.ruleOccurrences).map(
//     ([k, v]) => ({
//       dimension: k[0].toUpperCase() + k.slice(1),
//       count: Number(v.violations_detected) || 0,
//     }),
//   );

//   // Inspector averages: DQ score (Y) by dimension
//   const avgScoresSeries = Object.entries(dashboard.dimensionScores).map(
//     ([k, v]) => ({
//       dimension: k[0].toUpperCase() + k.slice(1),
//       scorePct: +((Number(v) * 100).toFixed(1)),
//     }),
//   );

//   // Overall Positive % = 100 − Anomaly %
//   const anomalySeverity = dashboard.anomaly?.severity ?? 'low';
//   const anomalyScore01 = Math.min(1, Math.max(0, dashboard.anomaly?.score ?? 0)); // 0..1
//   const overallPositive = Math.round((1 - anomalyScore01) * 100);

//   // Per-column positive% from aggregator (1 − anomalyRatio)
//   const perColumnPositive =
//     ((dashboard.anomaly?.metrics as any)?.perColumnPositive ?? {}) as Record<string, number>;
//   const perColumnList = Object.entries(perColumnPositive)
//     .map(([col, val]) => ({ col, pct: Math.round((val ?? 0) * 100) }))
//     .sort((a, b) => b.pct - a.pct);

//   // Contributors: show "<column>: <positive%>" (show '—' if unknown)
//   const contributorList = (dashboard.anomaly?.contributors ?? []).map((col) => {
//     const pos01 = perColumnPositive?.[col];
//     const pct = typeof pos01 === 'number' ? Math.round(pos01 * 100) : undefined;
//     return { col, pct };
//   });

//   return (
//     <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
//       {/* Row 1: KPI cards — averages */}
//       <Box
//         sx={{
//           display: 'grid',
//           gap: 2,
//           gridTemplateColumns: {
//             xs: '1fr',
//             sm: 'repeat(2, 1fr)',
//             md: 'repeat(3, 1fr)',
//             lg: 'repeat(6, 1fr)',
//           },
//         }}
//       >
//         {avgScoresSeries.map((kpi) => (
//           <Paper key={kpi.dimension} sx={{ p: 2 }}>
//             <Typography variant="subtitle2" color="text.secondary">
//               {kpi.dimension}
//             </Typography>
//             <Typography variant="h5" sx={{ fontWeight: 700 }}>
//               {kpi.scorePct}%
//             </Typography>
//           </Paper>
//         ))}
//       </Box>

//       {/* Row 2: Anomaly Gauge (text-only) • Rule Quality Distribution */}
//       <Box
//         sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}
//       >
//         {/* LEFT: Overall positive (NO circle) + per-column semi-gauges */}
//         <Paper sx={{ p: 2 }}>
//           <Stack
//             direction="row"
//             alignItems="center"
//             justifyContent="space-between"
//             sx={{ mb: 1 }}
//           >
//             <Typography variant="h6" sx={{ fontWeight: 700 }}>
//               Anomaly Gauge
//             </Typography>
//             <Chip
//               label={anomalySeverity.toUpperCase()}
//               size="small"
//               sx={{
//                 backgroundColor: alpha(severityColor(anomalySeverity, theme), 0.12),
//                 color: severityColor(anomalySeverity, theme),
//                 border: `1px solid ${alpha(severityColor(anomalySeverity, theme), 0.4)}`,
//               }}
//             />
//           </Stack>

//           {/* Text-only overall readout */}
//           <Box sx={{ textAlign: 'center', py: 3 }}>
//             <Typography variant="h4" sx={{ fontWeight: 800 }}>
//               {overallPositive}%
//             </Typography>
//             <Typography variant="body2" color="text.secondary">
//               Positive
//             </Typography>
//           </Box>

//           {/* Column semi-gauges */}
//           {perColumnList.length > 0 && (
//             <Box sx={{ mt: 2 }}>
//               <Typography
//                 variant="subtitle2"
//                 color="text.secondary"
//                 sx={{ mb: 0.5 }}
//               >
//                 Column Positives
//               </Typography>
//               <Box
//                 sx={{
//                   display: 'grid',
//                   gap: 1,
//                   gridTemplateColumns: {
//                     xs: 'repeat(3, 1fr)',
//                     sm: 'repeat(4, 1fr)',
//                     md: 'repeat(6, 1fr)',
//                   },
//                 }}
//               >
//                 {perColumnList.slice(0, 12).map(({ col, pct }) => (
//                   <MiniSemiGauge
//                     key={col}
//                     positivePct={pct}
//                     label={col}
//                     colorPos={theme.palette.success.main}
//                     colorNeg={theme.palette.error.main}
//                   />
//                 ))}
//               </Box>
//             </Box>
//           )}

//           {/* Contributors with Positive% */}
//           {dashboard.anomaly && dashboard.anomaly.contributors?.length > 0 && (
//             <Box sx={{ mt: 1 }}>
//               <Typography
//                 variant="subtitle2"
//                 color="text.secondary"
//                 sx={{ mb: 0.5 }}
//               >
//                 Contributors
//               </Typography>
//               <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
//                 {contributorList.slice(0, 10).map(({ col, pct }) => (
//                   <Chip
//                     key={col}
//                     label={`${col}: ${typeof pct === 'number' ? `${pct}%` : '—'}`}
//                     size="small"
//                   />
//                 ))}
//               </Stack>
//             </Box>
//           )}
//         </Paper>

//         {/* RIGHT: Rule Quality Distribution (Synthesiser-only) */}
//         <Paper sx={{ p: 2 }}>
//           <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
//             Rule Quality Distribution
//           </Typography>
//           <ResponsiveContainer width="100%" height={300}>
//             <BarChart
//               data={distributionSeries}
//               margin={{ top: 10, right: 30, left: 20, bottom: 60 }}
//             >
//               <CartesianGrid
//                 strokeDasharray="3 3"
//                 stroke={alpha(theme.palette.divider, 0.25)}
//               />
//               <XAxis dataKey="dimension" angle={-45} textAnchor="end" height={60} />
//               <YAxis allowDecimals={false} />
//               <Tooltip />
//               <Bar
//                 dataKey="count"
//                 fill={theme.palette.primary.main}
//                 radius={[4, 4, 0, 0]}
//               />
//             </BarChart>
//           </ResponsiveContainer>
//         </Paper>
//       </Box>

//       {/* Row 3: Average Latest Scores • Number of Rule Occurrences */}
//       <Paper sx={{ p: 2 }}>
//         <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
//           Average Latest Scores by Dimensions
//         </Typography>
//         <ResponsiveContainer width="100%" height={320}>
//           <BarChart
//             data={avgScoresSeries}
//             margin={{ top: 10, right: 30, left: 20, bottom: 60 }}
//           >
//             <CartesianGrid
//               strokeDasharray="3 3"
//               stroke={alpha(theme.palette.divider, 0.25)}
//             />
//             <XAxis
//               dataKey="dimension"
//               angle={-45}
//               textAnchor="end"
//               height={60}
//               label={{ value: 'Rule Type Applied', position: 'insideBottom', offset: -40 }}
//             />
//             <YAxis unit="%" label={{ value: 'DQ Score (Inspector/Anomaly)', angle: -90, position: 'insideLeft' }} />
//             <Tooltip />
//             <Bar dataKey="scorePct" fill={theme.palette.primary.main} />
//           </BarChart>
//         </ResponsiveContainer>
//       </Paper>

//       <Paper sx={{ p: 2 }}>
//         <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
//           Number of Rule Occurrences by Dimensions
//         </Typography>
//         <ResponsiveContainer width="100%" height={320}>
//           <BarChart
//             data={occurrencesSeries}
//             margin={{ top: 10, right: 30, left: 20, bottom: 60 }}
//           >
//             <CartesianGrid
//               strokeDasharray="3 3"
//               stroke={alpha(theme.palette.divider, 0.25)}
//             />
//             <XAxis dataKey="dimension" angle={-45} textAnchor="end" height={60} />
//             <YAxis allowDecimals={false} />
//             <Tooltip />
//             <Bar
//               dataKey="count"
//               fill={CHART_COLORS[0]}
//               radius={[4, 4, 0, 0]}
//             />
//           </BarChart>
//         </ResponsiveContainer>
//       </Paper>

//       {/* Row 4: Anomaly Insights • Rule Violations Summary */}
//       <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 2fr' } }}>
//         <Paper sx={{ p: 2 }}>
//           <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
//             Anomaly Insights
//           </Typography>
//           {dashboard.anomalyInsights.top_contributors.length === 0 &&
//           (!dashboard.anomaly?.notes || dashboard.anomaly.notes.length === 0) ? (
//             <Typography variant="body2" color="text.secondary">
//               No insights available for the latest run.
//             </Typography>
//           ) : (
//             <Box component="ul" sx={{ pl: 3, m: 0 }}>
//               {dashboard.anomalyInsights.top_contributors.map((c) => (
//                 <Typography key={c} component="li" variant="body2">
//                   {c}
//                 </Typography>
//               ))}
//               {dashboard.anomaly?.notes?.map((n, i) => (
//                 <Typography key={`n${i}`} component="li" variant="body2">
//                   {n}
//                 </Typography>
//               ))}
//             </Box>
//           )}
//         </Paper>

//         <Paper sx={{ p: 2 }}>
//           <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
//             Rule Violations Summary
//           </Typography>
//           <Table size="small" stickyHeader>
//             <TableHead>
//               <TableRow>
//                 <TableCell>Rule ID</TableCell>
//                 <TableCell>Dimension</TableCell>
//                 <TableCell>Description</TableCell>
//                 <TableCell align="right">Violations</TableCell>
//                 <TableCell>Last Seen</TableCell>
//               </TableRow>
//             </TableHead>
//             <TableBody>
//               {dashboard.ruleViolationsTable.map((r) => (
//                 <TableRow key={r.rule_id}>
//                   <TableCell>{r.rule_id}</TableCell>
//                   <TableCell>{r.dimension}</TableCell>
//                   <TableCell
//                     sx={{
//                       maxWidth: 380,
//                       whiteSpace: 'nowrap',
//                       overflow: 'hidden',
//                       textOverflow: 'ellipsis',
//                     }}
//                   >
//                     {r.description ?? '—'}
//                   </TableCell>
//                   <TableCell align="right">{r.violations}</TableCell>
//                   <TableCell>{r.last_seen ?? '—'}</TableCell>
//                 </TableRow>
//               ))}
//               {dashboard.ruleViolationsTable.length === 0 && (
//                 <TableRow>
//                   <TableCell colSpan={5}>
//                     <Typography variant="body2" color="text.secondary">
//                       No violations in the latest run.
//                     </Typography>
//                   </TableCell>
//                 </TableRow>
//               )}
//             </TableBody>
//           </Table>
//         </Paper>
//       </Box>
//     </Box>
//   );
// };

// export default Dashboard;

// 7 jan


// // src/components/dashboard/Dashboard.tsx
// import React from 'react';
// import {
//   Box,
//   Paper,
//   Typography,
//   useTheme,
//   alpha,
//   Table,
//   TableBody,
//   TableRow,
//   TableCell,
//   TableHead,
//   Chip,
//   Stack,
// } from '@mui/material';
// import * as Recharts from 'recharts';
// import type { DashboardState } from '../../dq/dqAggregator';
// import { CHART_COLORS } from '../../types/chart';

// const {
//   ResponsiveContainer,
//   BarChart,
//   Bar,
//   XAxis,
//   YAxis,
//   CartesianGrid,
//   Tooltip,
// } = Recharts as any;

// type Props = { dashboard: DashboardState };

// const severityColor = (
//   sev: 'low' | 'moderate' | 'high' | 'critical',
//   theme: any,
// ) => {
//   switch (sev) {
//     case 'critical':
//       return theme.palette.error.main;
//     case 'high':
//       return alpha(theme.palette.error.main, 0.85);
//     case 'moderate':
//       return theme.palette.warning.main;
//     default:
//       return theme.palette.success.main;
//   }
// };

// // Compact mini semi-gauge
// const MiniSemiGauge: React.FC<{
//   positivePct: number;
//   label: string;
//   colorPos: string;
//   colorNeg: string;
// }> = ({ positivePct, label, colorPos, colorNeg }) => {
//   const pos = Math.max(0, Math.min(100, Math.round(positivePct)));
//   return (
//     <Box sx={{ width: 96 }}>
//       <Box
//         sx={{
//           position: 'relative',
//           width: '100%',
//           height: 44,
//           borderRadius: '100px 100px 0 0',
//           background: `linear-gradient(to right, ${colorPos} ${pos}%, ${alpha(colorNeg, 0.35)} ${pos}%)`,
//         }}
//       />
//       <Box sx={{ textAlign: 'center', mt: 0.5 }}>
//         <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>
//           {label}
//         </Typography>
//         <Typography variant="caption" color="text.secondary">{pos}%</Typography>
//       </Box>
//     </Box>
//   );
// };

// const Dashboard: React.FC<Props> = ({ dashboard }) => {
//   const theme = useTheme();

//   // Rule Quality Distribution (Synthesiser-only)
//   const distributionSeries = Object.entries(dashboard.ruleDistribution).map(
//     ([k, v]) => ({
//       dimension: k[0].toUpperCase() + k.slice(1),
//       count: Number(v) || 0,
//     }),
//   );

//   // Average Latest Scores by Dimensions (filter out dims not present)
//   const dimScores = dashboard.dimensionScores;
//   const anomalyDimPos =
//     ((dashboard.anomaly?.metrics as any)?.perDimensionPositive ?? {}) as Record<string, number>;

//   const presentDims = new Set<string>([
//     ...Object.entries(dashboard.ruleDistribution).filter(([, cnt]) => Number(cnt) > 0).map(([d]) => d),
//     ...Object.keys(anomalyDimPos).filter((d) => typeof anomalyDimPos[d] === 'number'),
//     ...Object.entries(dimScores).filter(([, v]) => typeof v === 'number' && v > 0).map(([d]) => d),
//   ]);

//   const avgScoresSeries = Object.entries(dimScores)
//     .filter(([d]) => presentDims.has(d)) // hides "Accuracy" when absent
//     .map(([k, v]) => ({
//       dimension: k[0].toUpperCase() + k.slice(1),
//       scorePct: +((Number(v) * 100).toFixed(1)),
//     }));

//   // Anomaly Gauge
//   const anomalySeverity = dashboard.anomaly?.severity ?? 'low';
//   const anomalyScore01 = Math.min(1, Math.max(0, dashboard.anomaly?.score ?? 0)); // 0..1
//   const overallPositive = Math.round((1 - anomalyScore01) * 100);

//   // Per-column positive% (default missing to 100% in Contributors)
//   const perColumnPositive =
//     ((dashboard.anomaly?.metrics as any)?.perColumnPositive ?? {}) as Record<string, number>;

//   const perColumnList = Object.entries(perColumnPositive)
//     .map(([col, val]) => ({ col, pct: Math.round((val ?? 0) * 100) }))
//     .sort((a, b) => b.pct - a.pct);

//   const contributorList = (dashboard.anomaly?.contributors ?? []).map((col) => {
//     const pos01 = perColumnPositive?.[col];
//     const pct = typeof pos01 === 'number' ? Math.round(pos01 * 100) : 100;
//     return { col, pct };
//   });

//   return (
//     <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
//       {/* Row 1: KPI cards — averages */}
//       <Box
//         sx={{
//           display: 'grid',
//           gap: 2,
//           gridTemplateColumns: {
//             xs: '1fr',
//             sm: 'repeat(2, 1fr)',
//             md: 'repeat(3, 1fr)',
//             lg: 'repeat(6, 1fr)',
//           },
//         }}
//       >
//         {avgScoresSeries.map((kpi) => (
//           <Paper key={kpi.dimension} sx={{ p: 2 }}>
//             <Typography variant="subtitle2" color="text.secondary">
//               {kpi.dimension}
//             </Typography>
//             <Typography variant="h5" sx={{ fontWeight: 700 }}>
//               {kpi.scorePct}%
//             </Typography>
//           </Paper>
//         ))}
//       </Box>

//       {/* Row 2: Anomaly Gauge (text-only) • Rule Quality Distribution */}
//       <Box
//         sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}
//       >
//         {/* LEFT: Overall positive + per-column semi-gauges */}
//         <Paper sx={{ p: 2 }}>
//           <Stack
//             direction="row"
//             alignItems="center"
//             justifyContent="space-between"
//             sx={{ mb: 1 }}
//           >
//             <Typography variant="h6" sx={{ fontWeight: 700 }}>
//               Anomaly Gauge
//             </Typography>
//             <Chip
//               label={anomalySeverity.toUpperCase()}
//               size="small"
//               sx={{
//                 backgroundColor: alpha(severityColor(anomalySeverity, theme), 0.12),
//                 color: severityColor(anomalySeverity, theme),
//                 border: `1px solid ${alpha(severityColor(anomalySeverity, theme), 0.4)}`,
//               }}
//             />
//           </Stack>

//           <Box sx={{ textAlign: 'center', py: 3 }}>
//             <Typography variant="h4" sx={{ fontWeight: 800 }}>
//               {overallPositive}%
//             </Typography>
//             <Typography variant="body2" color="text.secondary">
//               Positive
//             </Typography>
//           </Box>

//           {perColumnList.length > 0 && (
//             <Box sx={{ mt: 2 }}>
//               <Typography
//                 variant="subtitle2"
//                 color="text.secondary"
//                 sx={{ mb: 0.5 }}
//               >
//                 Column Positives
//               </Typography>
//               <Box
//                 sx={{
//                   display: 'grid',
//                   gap: 1,
//                   gridTemplateColumns: {
//                     xs: 'repeat(3, 1fr)',
//                     sm: 'repeat(4, 1fr)',
//                     md: 'repeat(6, 1fr)',
//                   },
//                 }}
//               >
//                 {perColumnList.slice(0, 12).map(({ col, pct }) => (
//                   <MiniSemiGauge
//                     key={col}
//                     positivePct={pct}
//                     label={col}
//                     colorPos={theme.palette.success.main}
//                     colorNeg={theme.palette.error.main}
//                   />
//                 ))}
//               </Box>
//             </Box>
//           )}

//           {dashboard.anomaly && dashboard.anomaly.contributors?.length > 0 && (
//             <Box sx={{ mt: 1 }}>
//               <Typography
//                 variant="subtitle2"
//                 color="text.secondary"
//                 sx={{ mb: 0.5 }}
//               >
//                 Contributors
//               </Typography>
//               <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
//                 {contributorList.slice(0, 10).map(({ col, pct }) => (
//                   <Chip key={col} label={`${col}: ${pct}%`} size="small" />
//                 ))}
//               </Stack>
//             </Box>
//           )}
//         </Paper>

//         {/* RIGHT: Rule Quality Distribution */}
//         <Paper sx={{ p: 2 }}>
//           <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
//             Rule Quality Distribution
//           </Typography>
//           <ResponsiveContainer width="100%" height={300}>
//             <BarChart
//               data={distributionSeries}
//               margin={{ top: 10, right: 30, left: 20, bottom: 60 }}
//             >
//               <CartesianGrid
//                 strokeDasharray="3 3"
//                 stroke={alpha(theme.palette.divider, 0.25)}
//               />
//               <XAxis dataKey="dimension" angle={-45} textAnchor="end" height={60} />
//               <YAxis allowDecimals={false} />
//               <Tooltip />
//               <Bar
//                 dataKey="count"
//                 fill={theme.palette.primary.main}
//                 radius={[4, 4, 0, 0]}
//               />
//             </BarChart>
//           </ResponsiveContainer>
//         </Paper>
//       </Box>

//       {/* Row 3: Average Latest Scores (Occurrences chart removed) */}
//       <Paper sx={{ p: 2 }}>
//         <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
//           Average Latest Scores by Dimensions
//         </Typography>
//         <ResponsiveContainer width="100%" height={320}>
//           <BarChart
//             data={avgScoresSeries}
//             margin={{ top: 10, right: 30, left: 20, bottom: 60 }}
//           >
//             <CartesianGrid
//               strokeDasharray="3 3"
//               stroke={alpha(theme.palette.divider, 0.25)}
//             />
//             <XAxis
//               dataKey="dimension"
//               angle={-45}
//               textAnchor="end"
//               height={60}
//               label={{ value: 'Rule Type Applied', position: 'insideBottom', offset: -40 }}
//             />
//             <YAxis unit="%" label={{ value: 'DQ Score (Inspector/Anomaly)', angle: -90, position: 'insideLeft' }} />
//             <Tooltip />
//             <Bar dataKey="scorePct" fill={theme.palette.primary.main} />
//           </BarChart>
//         </ResponsiveContainer>
//       </Paper>

//       {/* Row 4: Anomaly Insights • Rule Violations Summary */}
//       <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 2fr' } }}>
//         <Paper sx={{ p: 2 }}>
//           <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
//             Anomaly Insights
//           </Typography>
//           {dashboard.anomalyInsights.top_contributors.length === 0 &&
//           (!dashboard.anomaly?.notes || dashboard.anomaly.notes.length === 0) ? (
//             <Typography variant="body2" color="text.secondary">
//               No insights available for the latest run.
//             </Typography>
//           ) : (
//             <Box component="ul" sx={{ pl: 3, m: 0 }}>
//               {dashboard.anomalyInsights.top_contributors.map((c) => (
//                 <Typography key={c} component="li" variant="body2">
//                   {c}
//                 </Typography>
//               ))}
//               {dashboard.anomaly?.notes?.map((n, i) => (
//                 <Typography key={`n${i}`} component="li" variant="body2">
//                   {n}
//                 </Typography>
//               ))}
//             </Box>
//           )}
//         </Paper>

//         <Paper sx={{ p: 2 }}>
//           <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
//             Rule Violations Summary
//           </Typography>
//           <Table size="small" stickyHeader>
//             <TableHead>
//               <TableRow>
//                 <TableCell>Rule ID</TableCell>
//                 <TableCell>Dimension</TableCell>
//                 <TableCell>Description</TableCell>
//                 <TableCell align="right">Violations</TableCell>
//                 <TableCell>Last Seen</TableCell>
//               </TableRow>
//             </TableHead>
//             <TableBody>
//               {dashboard.ruleViolationsTable.map((r) => (
//                 <TableRow key={r.rule_id}>
//                   <TableCell>{r.rule_id}</TableCell>
//                   <TableCell>{r.dimension}</TableCell>
//                   <TableCell
//                     sx={{
//                       maxWidth: 380,
//                       whiteSpace: 'nowrap',
//                       overflow: 'hidden',
//                       textOverflow: 'ellipsis',
//                     }}
//                   >
//                     {r.description ?? '—'}
//                   </TableCell>
//                   <TableCell align="right">{r.violations}</TableCell>
//                   <TableCell>{r.last_seen ?? '—'}</TableCell>
//                 </TableRow>
//               ))}
//               {dashboard.ruleViolationsTable.length === 0 && (
//                 <TableRow>
//                   <TableCell colSpan={5}>
//                     <Typography variant="body2" color="text.secondary">
//                       No violations in the latest run.
//                     </Typography>
//                   </TableCell>
//                 </TableRow>
//               )}
//             </TableBody>
//           </Table>
//         </Paper>
//       </Box>
//     </Box>
//   );
// };

// export default Dashboard;


// trying 

// working 7 jan partially

// src/components/dashboard/Dashboard.tsx
// import React from 'react';
// import {
//   Box,
//   Paper,
//   Typography,
//   useTheme,
//   alpha,
//   Table,
//   TableBody,
//   TableRow,
//   TableCell,
//   TableHead,
//   Chip,
//   Stack,
// } from '@mui/material';
// import * as Recharts from 'recharts';
// import type { DashboardState } from '../../dq/dqAggregator';
// import { CHART_COLORS } from '../../types/chart';

// const {
//   ResponsiveContainer,
//   BarChart,
//   Bar,
//   XAxis,
//   YAxis,
//   CartesianGrid,
//   Tooltip,
// } = Recharts as any;

// type Props = { dashboard: DashboardState };

// const severityColor = (
//   sev: 'low' | 'moderate' | 'high' | 'critical',
//   theme: any,
// ) => {
//   switch (sev) {
//     case 'critical':
//       return theme.palette.error.main;
//     case 'high':
//       return alpha(theme.palette.error.main, 0.85);
//     case 'moderate':
//       return theme.palette.warning.main;
//     default:
//       return theme.palette.success.main;
//   }
// };

// // Tiny semi-gauge
// const MiniSemiGauge: React.FC<{
//   positivePct: number;
//   label: string;
//   colorPos: string;
//   colorNeg: string;
// }> = ({ positivePct, label, colorPos, colorNeg }) => {
//   const pos = Math.max(0, Math.min(100, Math.round(positivePct)));
//   return (
//     <Box sx={{ width: 96 }}>
//       <Box
//         sx={{
//           position: 'relative',
//           width: '100%',
//           height: 44,
//           borderRadius: '100px 100px 0 0',
//           background: `linear-gradient(to right, ${colorPos} ${pos}%, ${alpha(colorNeg, 0.35)} ${pos}%)`,
//         }}
//       />
//       <Box sx={{ textAlign: 'center', mt: 0.5 }}>
//         <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>
//           {label}
//         </Typography>
//         <Typography variant="caption" color="text.secondary">{pos}%</Typography>
//       </Box>
//     </Box>
//   );
// };

// const Dashboard: React.FC<Props> = ({ dashboard }) => {
//   const theme = useTheme();

//   // Rule Quality Distribution
//   const distributionSeries = Object.entries(dashboard.ruleDistribution).map(
//     ([k, v]) => ({
//       dimension: k[0].toUpperCase() + k.slice(1),
//       count: Number(v) || 0,
//     }),
//   );

//   // ✅ Averages: ONLY dimensions that actually had Inspector checks (no phantom Accuracy)
//   const dimsWithChecks = Object.entries(dashboard.ruleOccurrences)
//     .filter(([, occ]) => (occ as any).checks_reported > 0)
//     .map(([d]) => d);

//   const avgScoresSeries = dimsWithChecks.map((d) => ({
//     dimension: d[0].toUpperCase() + d.slice(1),
//     scorePct: +((Number(dashboard.dimensionScores[d as keyof typeof dashboard.dimensionScores]) * 100).toFixed(1)),
//   }));

//   // Anomaly Gauge
//   const anomalySeverity = dashboard.anomaly?.severity ?? 'low';
//   const anomalyScore01 = Math.min(1, Math.max(0, dashboard.anomaly?.score ?? 0)); // 0..1
//   const overallPositive = Math.round((1 - anomalyScore01) * 100);

//   // Per-column positives (the reducer now fills "no anomaly" columns as 100%)
//   const perColumnPositive =
//     ((dashboard.anomaly?.metrics as any)?.perColumnPositive ?? {}) as Record<string, number>;
//   const perColumnList = Object.entries(perColumnPositive)
//     .map(([col, val]) => ({ col, pct: Math.round((val ?? 0) * 100) }))
//     .sort((a, b) => b.pct - a.pct);

//   // Contributors: also show 100% when missing
//   const contributorList = (dashboard.anomaly?.contributors ?? []).map((col) => {
//     const pos01 = perColumnPositive?.[col];
//     const pct = typeof pos01 === 'number' ? Math.round(pos01 * 100) : 100;
//     return { col, pct };
//   });

//   return (
//     <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
//       {/* Row 1: KPI cards — averages */}
//       <Box
//         sx={{
//           display: 'grid',
//           gap: 2,
//           gridTemplateColumns: {
//             xs: '1fr',
//             sm: 'repeat(2, 1fr)',
//             md: 'repeat(3, 1fr)',
//             lg: 'repeat(6, 1fr)',
//           },
//         }}
//       >
//         {avgScoresSeries.map((kpi) => (
//           <Paper key={kpi.dimension} sx={{ p: 2 }}>
//             <Typography variant="subtitle2" color="text.secondary">
//               {kpi.dimension}
//             </Typography>
//             <Typography variant="h5" sx={{ fontWeight: 700 }}>
//               {kpi.scorePct}%
//             </Typography>
//           </Paper>
//         ))}
//       </Box>

//       {/* Row 2: Anomaly Gauge • Rule Quality Distribution */}
//       <Box
//         sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}
//       >
//         {/* LEFT: Gauge + per-column gauges */}
//         <Paper sx={{ p: 2 }}>
//           <Stack
//             direction="row"
//             alignItems="center"
//             justifyContent="space-between"
//             sx={{ mb: 1 }}
//           >
//             <Typography variant="h6" sx={{ fontWeight: 700 }}>
//               Anomaly Gauge
//             </Typography>
//             <Chip
//               label={anomalySeverity.toUpperCase()}
//               size="small"
//               sx={{
//                 backgroundColor: alpha(severityColor(anomalySeverity, theme), 0.12),
//                 color: severityColor(anomalySeverity, theme),
//                 border: `1px solid ${alpha(severityColor(anomalySeverity, theme), 0.4)}`,
//               }}
//             />
//           </Stack>

//           <Box sx={{ textAlign: 'center', py: 3 }}>
//             <Typography variant="h4" sx={{ fontWeight: 800 }}>
//               {overallPositive}%
//             </Typography>
//             <Typography variant="body2" color="text.secondary">
//               Positive
//             </Typography>
//           </Box>

//           {perColumnList.length > 0 && (
//             <Box sx={{ mt: 2 }}>
//               <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
//                 Column Positives
//               </Typography>
//               <Box
//                 sx={{
//                   display: 'grid',
//                   gap: 1,
//                   gridTemplateColumns: {
//                     xs: 'repeat(3, 1fr)',
//                     sm: 'repeat(4, 1fr)',
//                     md: 'repeat(6, 1fr)',
//                   },
//                 }}
//               >
//                 {perColumnList.slice(0, 12).map(({ col, pct }) => (
//                   <MiniSemiGauge
//                     key={col}
//                     positivePct={pct}
//                     label={col}
//                     colorPos={theme.palette.success.main}
//                     colorNeg={theme.palette.error.main}
//                   />
//                 ))}
//               </Box>
//             </Box>
//           )}

//           {dashboard.anomaly && dashboard.anomaly.contributors?.length > 0 && (
//             <Box sx={{ mt: 1 }}>
//               <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
//                 Contributors
//               </Typography>
//               <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
//                 {contributorList.slice(0, 10).map(({ col, pct }) => (
//                   <Chip key={col} label={`${col}: ${pct}%`} size="small" />
//                 ))}
//               </Stack>
//             </Box>
//           )}
//         </Paper>

//         {/* RIGHT: Rule Quality Distribution */}
//         <Paper sx={{ p: 2 }}>
//           <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
//             Rule Quality Distribution
//           </Typography>
//           <ResponsiveContainer width="100%" height={300}>
//             <BarChart
//               data={distributionSeries}
//               margin={{ top: 10, right: 30, left: 20, bottom: 60 }}
//             >
//               <CartesianGrid
//                 strokeDasharray="3 3"
//                 stroke={alpha(theme.palette.divider, 0.25)}
//               />
//               <XAxis dataKey="dimension" angle={-45} textAnchor="end" height={60} />
//               <YAxis allowDecimals={false} />
//               <Tooltip />
//               <Bar dataKey="count" fill={theme.palette.primary.main} radius={[4, 4, 0, 0]} />
//             </BarChart>
//           </ResponsiveContainer>
//         </Paper>
//       </Box>

//       {/* Row 3: Average Latest Scores (Occurrences chart removed earlier) */}
//       <Paper sx={{ p: 2 }}>
//         <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
//           Average Latest Scores by Dimensions
//         </Typography>
//         <ResponsiveContainer width="100%" height={320}>
//           <BarChart
//             data={avgScoresSeries}
//             margin={{ top: 10, right: 30, left: 20, bottom: 60 }}
//           >
//             <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.25)} />
//             <XAxis
//               dataKey="dimension"
//               angle={-45}
//               textAnchor="end"
//               height={60}
//               label={{ value: 'Rule Type Applied', position: 'insideBottom', offset: -40 }}
//             />
//             <YAxis unit="%" label={{ value: 'DQ Score (Insp.)', angle: -90, position: 'insideLeft' }} />
//             <Tooltip />
//             <Bar dataKey="scorePct" fill={theme.palette.primary.main} />
//           </BarChart>
//         </ResponsiveContainer>
//       </Paper>

//       {/* Row 4: Anomaly Insights • Rule Violations Summary */}
//       <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 2fr' } }}>
//         <Paper sx={{ p: 2 }}>
//           <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
//             Anomaly Insights
//           </Typography>
//           {dashboard.anomalyInsights.top_contributors.length === 0 &&
//           (!dashboard.anomaly?.notes || dashboard.anomaly.notes.length === 0) ? (
//             <Typography variant="body2" color="text.secondary">
//               No insights available for the latest run.
//             </Typography>
//           ) : (
//             <Box component="ul" sx={{ pl: 3, m: 0 }}>
//               {dashboard.anomalyInsights.top_contributors.map((c) => (
//                 <Typography key={c} component="li" variant="body2">
//                   {c}
//                 </Typography>
//               ))}
//               {dashboard.anomaly?.notes?.map((n, i) => (
//                 <Typography key={`n${i}`} component="li" variant="body2">
//                   {n}
//                 </Typography>
//               ))}
//             </Box>
//           )}
//         </Paper>

//         <Paper sx={{ p: 2 }}>
//           <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
//             Rule Violations Summary
//           </Typography>
//           <Table size="small" stickyHeader>
//             <TableHead>
//               <TableRow>
//                 <TableCell>Rule ID</TableCell>
//                 <TableCell>Dimension</TableCell>
//                 <TableCell>Description</TableCell>
//                 <TableCell align="right">Violations</TableCell>
//                 <TableCell>Last Seen</TableCell>
//               </TableRow>
//             </TableHead>
//             <TableBody>
//               {dashboard.ruleViolationsTable.map((r) => (
//                 <TableRow key={r.rule_id}>
//                   {/* ✅ Use display_rule_id when available */}
//                   <TableCell>{r.display_rule_id ?? r.rule_id}</TableCell>
//                   <TableCell>{r.dimension}</TableCell>
//                   <TableCell
//                     sx={{
//                       maxWidth: 380,
//                       whiteSpace: 'nowrap',
//                       overflow: 'hidden',
//                       textOverflow: 'ellipsis',
//                     }}
//                   >
//                     {r.description ?? '—'}
//                   </TableCell>
//                   <TableCell align="right">{r.violations}</TableCell>
//                   <TableCell>{r.last_seen ?? '—'}</TableCell>
//                 </TableRow>
//               ))}
//               {dashboard.ruleViolationsTable.length === 0 && (
//                 <TableRow>
//                   <TableCell colSpan={5}>
//                     <Typography variant="body2" color="text.secondary">
//                       No violations in the latest run.
//                     </Typography>
//                   </TableCell>
//                 </TableRow>
//               )}
//             </TableBody>
//           </Table>
//         </Paper>
//       </Box>
//     </Box>
//   );
// };

// export default Dashboard;


//trying again

// working file &partial table

// // src/components/dashboard/Dashboard.tsx
// import React from 'react';
// import {
//   Box,
//   Paper,
//   Typography,
//   useTheme,
//   alpha,
//   Table,
//   TableBody,
//   TableRow,
//   TableCell,
//   TableHead,
//   Chip,
//   Stack,
// } from '@mui/material';
// import * as Recharts from 'recharts';
// import type { DashboardState } from '../../dq/dqAggregator';
// import { CHART_COLORS } from '../../types/chart';

// const {
//   ResponsiveContainer,
//   BarChart,
//   Bar,
//   XAxis,
//   YAxis,
//   CartesianGrid,
//   Tooltip,
// } = Recharts as any;

// type Props = { dashboard: DashboardState };

// const severityColor = (
//   sev: 'low' | 'moderate' | 'high' | 'critical',
//   theme: any,
// ) => {
//   switch (sev) {
//     case 'critical':
//       return theme.palette.error.main;
//     case 'high':
//       return alpha(theme.palette.error.main, 0.85);
//     case 'moderate':
//       return theme.palette.warning.main;
//     default:
//       return theme.palette.success.main;
//   }
// };

// // Compact mini semi-gauge
// const MiniSemiGauge: React.FC<{
//   positivePct: number;
//   label: string;
//   colorPos: string;
//   colorNeg: string;
// }> = ({ positivePct, label, colorPos, colorNeg }) => {
//   const pos = Math.max(0, Math.min(100, Math.round(positivePct)));
//   return (
//     <Box sx={{ width: 96 }}>
//       <Box
//         sx={{
//           position: 'relative',
//           width: '100%',
//           height: 44,
//           borderRadius: '100px 100px 0 0',
//           background: `linear-gradient(to right, ${colorPos} ${pos}%, ${alpha(colorNeg, 0.35)} ${pos}%)`,
//         }}
//       />
//       <Box sx={{ textAlign: 'center', mt: 0.5 }}>
//         <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>
//           {label}
//         </Typography>
//         <Typography variant="caption" color="text.secondary">{pos}%</Typography>
//       </Box>
//     </Box>
//   );
// };

// const Dashboard: React.FC<Props> = ({ dashboard }) => {
//   const theme = useTheme();

//   // Rule Quality Distribution
//   const distributionSeries = Object.entries(dashboard.ruleDistribution).map(
//     ([k, v]) => ({
//       dimension: k[0].toUpperCase() + k.slice(1),
//       count: Number(v) || 0,
//     }),
//   );

//   // ✅ Average Latest Scores by Dimensions:
//   // show dimensions that have checks_reported > 0 OR anomaly perDimensionPositive available
//   const anomalyDimPos =
//     ((dashboard.anomaly?.metrics as any)?.perDimensionPositive ?? {}) as Record<string, number>;
//   const dimsForAvg = Object.entries(dashboard.ruleOccurrences)
//     .filter(([d, occ]) => (occ as any).checks_reported > 0 || typeof anomalyDimPos[d] === 'number')
//     .map(([d]) => d);

//   const avgScoresSeries = dimsForAvg.map((d) => ({
//     dimension: d[0].toUpperCase() + d.slice(1),
//     scorePct: +((Number(dashboard.dimensionScores[d as keyof typeof dashboard.dimensionScores]) * 100).toFixed(1)),
//   }));

//   // Anomaly Gauge
//   const anomalySeverity = dashboard.anomaly?.severity ?? 'low';
//   const anomalyScore01 = Math.min(1, Math.max(0, dashboard.anomaly?.score ?? 0)); // 0..1
//   const overallPositive = Math.round((1 - anomalyScore01) * 100);

//   // Per-column positives (default missing to 100%):
//   const perColumnPositive =
//     ((dashboard.anomaly?.metrics as any)?.perColumnPositive ?? {}) as Record<string, number>;
//   const perColumnList = Object.entries(perColumnPositive)
//     .map(([col, val]) => ({ col, pct: Math.round(((val ?? 1) * 100)) })) // ← default to 100%
//     .sort((a, b) => b.pct - a.pct);

//   // Contributors: also show 100% when missing
//   const contributorList = (dashboard.anomaly?.contributors ?? []).map((col) => {
//     const pos01 = perColumnPositive?.[col];
//     const pct = typeof pos01 === 'number' ? Math.round(pos01 * 100) : 100;
//     return { col, pct };
//   });

//   return (
//     <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
//       {/* Row 1: KPI cards — averages */}
//       <Box
//         sx={{
//           display: 'grid',
//           gap: 2,
//           gridTemplateColumns: {
//             xs: '1fr',
//             sm: 'repeat(2, 1fr)',
//             md: 'repeat(3, 1fr)',
//             lg: 'repeat(6, 1fr)',
//           },
//         }}
//       >
//         {avgScoresSeries.map((kpi) => (
//           <Paper key={kpi.dimension} sx={{ p: 2 }}>
//             <Typography variant="subtitle2" color="text.secondary">
//               {kpi.dimension}
//             </Typography>
//             <Typography variant="h5" sx={{ fontWeight: 700 }}>
//               {kpi.scorePct}%
//             </Typography>
//           </Paper>
//         ))}
//       </Box>

//       {/* Row 2: Anomaly Gauge • Rule Quality Distribution */}
//       <Box
//         sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}
//       >
//         {/* LEFT: Gauge + per-column gauges */}
//         <Paper sx={{ p: 2 }}>
//           <Stack
//             direction="row"
//             alignItems="center"
//             justifyContent="space-between"
//             sx={{ mb: 1 }}
//           >
//             <Typography variant="h6" sx={{ fontWeight: 700 }}>
//               Anomaly Gauge
//             </Typography>
//             <Chip
//               label={anomalySeverity.toUpperCase()}
//               size="small"
//               sx={{
//                 backgroundColor: alpha(severityColor(anomalySeverity, theme), 0.12),
//                 color: severityColor(anomalySeverity, theme),
//                 border: `1px solid ${alpha(severityColor(anomalySeverity, theme), 0.4)}`,
//               }}
//             />
//           </Stack>

//           <Box sx={{ textAlign: 'center', py: 3 }}>
//             <Typography variant="h4" sx={{ fontWeight: 800 }}>
//               {overallPositive}%
//             </Typography>
//             <Typography variant="body2" color="text.secondary">
//               Positive
//             </Typography>
//           </Box>

//           {perColumnList.length > 0 && (
//             <Box sx={{ mt: 2 }}>
//               <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
//                 Column Positives
//               </Typography>
//               <Box
//                 sx={{
//                   display: 'grid',
//                   gap: 1,
//                   gridTemplateColumns: {
//                     xs: 'repeat(3, 1fr)',
//                     sm: 'repeat(4, 1fr)',
//                     md: 'repeat(6, 1fr)',
//                   },
//                 }}
//               >
//                 {perColumnList.slice(0, 12).map(({ col, pct }) => (
//                   <MiniSemiGauge
//                     key={col}
//                     positivePct={pct}
//                     label={col}
//                     colorPos={theme.palette.success.main}
//                     colorNeg={theme.palette.error.main}
//                   />
//                 ))}
//               </Box>
//             </Box>
//           )}

//           {dashboard.anomaly && dashboard.anomaly.contributors?.length > 0 && (
//             <Box sx={{ mt: 1 }}>
//               <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
//                 Contributors
//               </Typography>
//               <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
//                 {contributorList.slice(0, 10).map(({ col, pct }) => (
//                   <Chip key={col} label={`${col}: ${pct}%`} size="small" />
//                 ))}
//               </Stack>
//             </Box>
//           )}
//         </Paper>

//         {/* RIGHT: Rule Quality Distribution */}
//         <Paper sx={{ p: 2 }}>
//           <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
//             Rule Quality Distribution
//           </Typography>
//           <ResponsiveContainer width="100%" height={300}>
//             <BarChart
//               data={distributionSeries}
//               margin={{ top: 10, right: 30, left: 20, bottom: 60 }}
//             >
//               <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.25)} />
//               <XAxis dataKey="dimension" angle={-45} textAnchor="end" height={60} />
//               <YAxis allowDecimals={false} />
//               <Tooltip />
//               <Bar dataKey="count" fill={theme.palette.primary.main} radius={[4, 4, 0, 0]} />
//             </BarChart>
//           </ResponsiveContainer>
//         </Paper>
//       </Box>

//       {/* Row 3: Average Latest Scores (Occurrences chart removed earlier) */}
//       <Paper sx={{ p: 2 }}>
//         <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
//           Average Latest Scores by Dimensions
//         </Typography>
//         <ResponsiveContainer width="100%" height={320}>
//           <BarChart
//             data={avgScoresSeries}
//             margin={{ top: 10, right: 30, left: 20, bottom: 60 }}
//           >
//             <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.25)} />
//             <XAxis
//               dataKey="dimension"
//               angle={-45}
//               textAnchor="end"
//               height={60}
//               label={{ value: 'Rule Type Applied', position: 'insideBottom', offset: -40 }}
//             />
//             <YAxis unit="%" label={{ value: 'DQ Score (Insp.)', angle: -90, position: 'insideLeft' }} />
//             <Tooltip />
//             <Bar dataKey="scorePct" fill={theme.palette.primary.main} />
//           </BarChart>
//         </ResponsiveContainer>
//       </Paper>

//       {/* Row 4: Anomaly Insights • Rule Violations Summary */}
//       <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 2fr' } }}>
//         <Paper sx={{ p: 2 }}>
//           <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
//             Anomaly Insights
//           </Typography>
//           {dashboard.anomalyInsights.top_contributors.length === 0 &&
//           (!dashboard.anomaly?.notes || dashboard.anomaly.notes.length === 0) ? (
//             <Typography variant="body2" color="text.secondary">
//               No insights available for the latest run.
//             </Typography>
//           ) : (
//             <Box component="ul" sx={{ pl: 3, m: 0 }}>
//               {dashboard.anomalyInsights.top_contributors.map((c) => (
//                 <Typography key={c} component="li" variant="body2">
//                   {c}
//                 </Typography>
//               ))}
//               {dashboard.anomaly?.notes?.map((n, i) => (
//                 <Typography key={`n${i}`} component="li" variant="body2">
//                   {n}
//                 </Typography>
//               ))}
//             </Box>
//           )}
//         </Paper>

//         <Paper sx={{ p: 2 }}>
//           <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
//             Rule Violations Summary
//           </Typography>
//           <Table size="small" stickyHeader>
//             <TableHead>
//               <TableRow>
//                 <TableCell>Rule ID</TableCell>
//                 <TableCell>Dimension</TableCell>
//                 <TableCell>Description</TableCell>
//                 <TableCell align="right">Violations</TableCell>
//                 <TableCell>Last Seen</TableCell>
//               </TableRow>
//             </TableHead>
//             <TableBody>
//               {dashboard.ruleViolationsTable.map((r) => (
//                 <TableRow key={r.rule_id}>
//                   <TableCell>{r.display_rule_id ?? r.rule_id}</TableCell>
//                   <TableCell>{r.dimension}</TableCell>
//                   <TableCell
//                     sx={{
//                       maxWidth: 380,
//                       whiteSpace: 'nowrap',
//                       overflow: 'hidden',
//                       textOverflow: 'ellipsis',
//                     }}
//                   >
//                     {r.description ?? '—'}
//                   </TableCell>
//                   <TableCell align="right">{r.violations}</TableCell>
//                   <TableCell>{r.last_seen ?? '—'}</TableCell>
//                 </TableRow>
//               ))}
//               {dashboard.ruleViolationsTable.length === 0 && (
//                 <TableRow>
//                   <TableCell colSpan={5}>
//                     <Typography variant="body2" color="text.secondary">
//                       No violations in the latest run.
//                     </Typography>
//                   </TableCell>
//                 </TableRow>
//               )}
//             </TableBody>
//           </Table>
//         </Paper>
//       </Box>
//     </Box>
//   );
// };

// export default Dashboard;


// trying


// // src/components/dashboard/Dashboard.tsx
// import React from 'react';
// import {
//   Box,
//   Paper,
//   Typography,
//   useTheme,
//   alpha,
//   Table,
//   TableBody,
//   TableRow,
//   TableCell,
//   TableHead,
//   Chip,
//   Stack,
// } from '@mui/material';
// import * as Recharts from 'recharts';
// import type { DashboardState } from '../../dq/dqAggregator';

// const {
//   ResponsiveContainer,
//   BarChart,
//   Bar,
//   XAxis,
//   YAxis,
//   CartesianGrid,
//   Tooltip,
// } = Recharts as any;

// type Props = { dashboard: DashboardState };

// const severityColor = (
//   sev: 'low' | 'moderate' | 'high' | 'critical',
//   theme: any,
// ) => {
//   switch (sev) {
//     case 'critical':  return theme.palette.error.main;
//     case 'high':      return alpha(theme.palette.error.main, 0.85);
//     case 'moderate':  return theme.palette.warning.main;
//     default:          return theme.palette.success.main;
//   }
// };

// const MiniSemiGauge: React.FC<{
//   positivePct: number;
//   label: string;
//   colorPos: string;
//   colorNeg: string;
// }> = ({ positivePct, label, colorPos, colorNeg }) => {
//   const pos = Math.max(0, Math.min(100, Math.round(positivePct)));
//   return (
//     <Box sx={{ width: 96 }}>
//       <Box
//         sx={{
//           position: 'relative',
//           width: '100%',
//           height: 44,
//           borderRadius: '100px 100px 0 0',
//           background: `linear-gradient(to right, ${colorPos} ${pos}%, ${alpha(colorNeg, 0.35)} ${pos}%)`,
//         }}
//       />
//       <Box sx={{ textAlign: 'center', mt: 0.5 }}>
//         <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>
//           {label}
//         </Typography>
//         <Typography variant="caption" color="text.secondary">{pos}%</Typography>
//       </Box>
//     </Box>
//   );
// };

// const Dashboard: React.FC<Props> = ({ dashboard }) => {
//   const theme = useTheme();

//   // Rule Quality Distribution
//   const distributionSeries = Object.entries(dashboard.ruleDistribution).map(
//     ([k, v]) => ({ dimension: k[0].toUpperCase() + k.slice(1), count: Number(v) || 0 })
//   );

//   // Average Latest Scores: show if checks exist OR anomaly provides perDimensionPositive
//   const anomalyDimPos =
//     ((dashboard.anomaly?.metrics as any)?.perDimensionPositive ?? {}) as Record<string, number>;

//   const dimsForAvg = Object.entries(dashboard.ruleOccurrences)
//     .filter(([d, occ]) => (occ as any).checks_reported > 0 || typeof anomalyDimPos[d] === 'number')
//     .map(([d]) => d);

//   const avgScoresSeries = dimsForAvg.map((d) => ({
//     dimension: d[0].toUpperCase() + d.slice(1),
//     scorePct: +((Number(dashboard.dimensionScores[d as keyof typeof dashboard.dimensionScores]) * 100).toFixed(1)),
//   }));

//   // Anomaly Gauge
//   const anomalySeverity = dashboard.anomaly?.severity ?? 'low';
//   const anomalyScore01 = Math.min(1, Math.max(0, dashboard.anomaly?.score ?? 0));
//   const overallPositive = Math.round((1 - anomalyScore01) * 100);

//   // Per-column positives (default missing → 100%)
//   const perColumnPositive =
//     ((dashboard.anomaly?.metrics as any)?.perColumnPositive ?? {}) as Record<string, number>;
//   const perColumnList = Object.entries(perColumnPositive)
//     .map(([col, val]) => ({ col, pct: Math.round(((val ?? 1) * 100)) }))
//     .sort((a, b) => b.pct - a.pct);

//   // Contributors chips
//   const contributorList = (dashboard.anomaly?.contributors ?? []).map((col) => {
//     const pos01 = perColumnPositive?.[col];
//     const pct = typeof pos01 === 'number' ? Math.round(pos01 * 100) : 100;
//     return { col, pct };
//   });

//   return (
//     <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
//       {/* Row 1: KPI cards — averages */}
//       <Box
//         sx={{
//           display: 'grid',
//           gap: 2,
//           gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(6, 1fr)' },
//         }}
//       >
//         {avgScoresSeries.map((kpi) => (
//           <Paper key={kpi.dimension} sx={{ p: 2 }}>
//             <Typography variant="subtitle2" color="text.secondary">{kpi.dimension}</Typography>
//             <Typography variant="h5" sx={{ fontWeight: 700 }}>{kpi.scorePct}%</Typography>
//           </Paper>
//         ))}
//       </Box>

//       {/* Row 2: Gauge • Distribution */}
//       <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
//         <Paper sx={{ p: 2 }}>
//           <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
//             <Typography variant="h6" sx={{ fontWeight: 700 }}>Anomaly Gauge</Typography>
//             <Chip
//               label={anomalySeverity.toUpperCase()}
//               size="small"
//               sx={{
//                 backgroundColor: alpha(severityColor(anomalySeverity, theme), 0.12),
//                 color: severityColor(anomalySeverity, theme),
//                 border: `1px solid ${alpha(severityColor(anomalySeverity, theme), 0.4)}`,
//               }}
//             />
//           </Stack>

//           <Box sx={{ textAlign: 'center', py: 3 }}>
//             <Typography variant="h4" sx={{ fontWeight: 800 }}>{overallPositive}%</Typography>
//             <Typography variant="body2" color="text.secondary">Positive</Typography>
//           </Box>

//           {perColumnList.length > 0 && (
//             <Box sx={{ mt: 2 }}>
//               <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>Column Positives</Typography>
//               <Box
//                 sx={{
//                   display: 'grid',
//                   gap: 1,
//                   gridTemplateColumns: { xs: 'repeat(3, 1fr)', sm: 'repeat(4, 1fr)', md: 'repeat(6, 1fr)' },
//                 }}
//               >
//                 {perColumnList.slice(0, 12).map(({ col, pct }) => (
//                   <MiniSemiGauge
//                     key={col}
//                     positivePct={pct}
//                     label={col}
//                     colorPos={theme.palette.success.main}
//                     colorNeg={theme.palette.error.main}
//                   />
//                 ))}
//               </Box>
//             </Box>
//           )}

//           {dashboard.anomaly && dashboard.anomaly.contributors?.length > 0 && (
//             <Box sx={{ mt: 1 }}>
//               <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>Contributors</Typography>
//               <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
//                 {contributorList.slice(0, 10).map(({ col, pct }) => (
//                   <Chip key={col} label={`${col}: ${pct}%`} size="small" />
//                 ))}
//               </Stack>
//             </Box>
//           )}
//         </Paper>

//         <Paper sx={{ p: 2 }}>
//           <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Rule Quality Distribution</Typography>
//           <ResponsiveContainer width="100%" height={300}>
//             <BarChart data={distributionSeries} margin={{ top: 10, right: 30, left: 20, bottom: 60 }}>
//               <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.25)} />
//               <XAxis dataKey="dimension" angle={-45} textAnchor="end" height={60} />
//               <YAxis allowDecimals={false} />
//               <Tooltip />
//               <Bar dataKey="count" fill={theme.palette.primary.main} radius={[4, 4, 0, 0]} />
//             </BarChart>
//           </ResponsiveContainer>
//         </Paper>
//       </Box>

//       {/* Row 3: Averages */}
//       <Paper sx={{ p: 2 }}>
//         <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Average Latest Scores by Dimensions</Typography>
//         <ResponsiveContainer width="100%" height={320}>
//           <BarChart data={avgScoresSeries} margin={{ top: 10, right: 30, left: 20, bottom: 60 }}>
//             <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.25)} />
//             <XAxis
//               dataKey="dimension"
//               angle={-45}
//               textAnchor="end"
//               height={60}
//               label={{ value: 'Rule Type Applied', position: 'insideBottom', offset: -40 }}
//             />
//             <YAxis unit="%" label={{ value: 'DQ Score (Insp.)', angle: -90, position: 'insideLeft' }} />
//             <Tooltip />
//             <Bar dataKey="scorePct" fill={theme.palette.primary.main} />
//           </BarChart>
//         </ResponsiveContainer>
//       </Paper>

//       {/* Row 4: Insights • Violations */}
//       <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 2fr' } }}>
//         <Paper sx={{ p: 2 }}>
//           <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Anomaly Insights</Typography>
//           {dashboard.anomalyInsights.top_contributors.length === 0 &&
//           (!dashboard.anomaly?.notes || dashboard.anomaly.notes.length === 0) ? (
//             <Typography variant="body2" color="text.secondary">No insights available for the latest run.</Typography>
//           ) : (
//             <Box component="ul" sx={{ pl: 3, m: 0 }}>
//               {dashboard.anomalyInsights.top_contributors.map((c) => (
//                 <Typography key={c} component="li" variant="body2">{c}</Typography>
//               ))}
//               {dashboard.anomaly?.notes?.map((n, i) => (
//                 <Typography key={`n${i}`} component="li" variant="body2">{n}</Typography>
//               ))}
//             </Box>
//           )}
//         </Paper>

//         <Paper sx={{ p: 2 }}>
//           <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Rule Violations Summary</Typography>
//           <Table size="small" stickyHeader>
//             <TableHead>
//               <TableRow>
//                 <TableCell>Rule ID</TableCell>
//                 <TableCell>Dimension</TableCell>
//                 <TableCell>Description</TableCell>
//                 <TableCell align="right">Violations</TableCell>
//                 <TableCell>Last Seen</TableCell>
//               </TableRow>
//             </TableHead>
//             <TableBody>
//               {dashboard.ruleViolationsTable.map((r) => (
//                 <TableRow key={r.rule_id}>
//                   <TableCell>{r.display_rule_id ?? r.rule_id}</TableCell>
//                   <TableCell>{r.dimension}</TableCell>
//                   <TableCell
//                     sx={{ maxWidth: 380, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
//                   >
//                     {r.description ?? '—'}
//                   </TableCell>
//                   <TableCell align="right">{r.violations}</TableCell>
//                   <TableCell>{r.last_seen ?? '—'}</TableCell>
//                 </TableRow>
//               ))}
//               {dashboard.ruleViolationsTable.length === 0 && (
//                 <TableRow>
//                   <TableCell colSpan={5}>
//                     <Typography variant="body2" color="text.secondary">
//                       No violations in the latest run.
//                     </Typography>
//                   </TableCell>
//                 </TableRow>
//               )}
//             </TableBody>
//           </Table>
//         </Paper>
//       </Box>
//     </Box>
//   );
// };

// export default Dashboard;


// trying after main


// // src/components/dashboard/Dashboard.tsx
// import React from 'react';
// import {
//   Box,
//   Paper,
//   Typography,
//   useTheme,
//   alpha,
//   Table,
//   TableBody,
//   TableRow,
//   TableCell,
//   TableHead,
//   Chip,
//   Stack,
// } from '@mui/material';
// import * as Recharts from 'recharts';
// import type { DashboardState } from '../../dq/dqAggregator';

// const {
//   ResponsiveContainer,
//   BarChart,
//   Bar,
//   XAxis,
//   YAxis,
//   CartesianGrid,
//   Tooltip,
// } = Recharts as any;

// type Props = { dashboard: DashboardState };

// const severityColor = (
//   sev: 'low' | 'moderate' | 'high' | 'critical',
//   theme: any,
// ) => {
//   switch (sev) {
//     case 'critical':  return theme.palette.error.main;
//     case 'high':      return alpha(theme.palette.error.main, 0.85);
//     case 'moderate':  return theme.palette.warning.main;
//     default:          return theme.palette.success.main;
//   }
// };

// const MiniSemiGauge: React.FC<{
//   positivePct: number;
//   label: string;
//   colorPos: string;
//   colorNeg: string;
// }> = ({ positivePct, label, colorPos, colorNeg }) => {
//   const pos = Math.max(0, Math.min(100, Math.round(positivePct)));
//   return (
//     <Box sx={{ width: 96 }}>
//       <Box
//         sx={{
//           position: 'relative',
//           width: '100%',
//           height: 44,
//           borderRadius: '100px 100px 0 0',
//           background: `linear-gradient(to right, ${colorPos} ${pos}%, ${alpha(colorNeg, 0.35)} ${pos}%)`,
//         }}
//       />
//       <Box sx={{ textAlign: 'center', mt: 0.5 }}>
//         <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>
//           {label}
//         </Typography>
//         <Typography variant="caption" color="text.secondary">{pos}%</Typography>
//       </Box>
//     </Box>
//   );
// };

// const Dashboard: React.FC<Props> = ({ dashboard }) => {
//   const theme = useTheme();

//   // Rule Quality Distribution
//   const distributionSeries = Object.entries(dashboard.ruleDistribution).map(
//     ([k, v]) => ({ dimension: k[0].toUpperCase() + k.slice(1), count: Number(v) || 0 })
//   );

//   // STRICT: Averages are built ONLY from Inspector-applied dims
//   const dimsForAvg = Array.from(dashboard.appliedDims ?? []);
//   const avgScoresSeries = dimsForAvg.map((d) => ({
//     dimension: d[0].toUpperCase() + d.slice(1),
//     scorePct: +((Number(dashboard.dimensionScores[d as keyof typeof dashboard.dimensionScores]) * 100).toFixed(1)),
//   }));

//   // Anomaly Gauge
//   const anomalySeverity = dashboard.anomaly?.severity ?? 'low';
//   const anomalyScore01 = Math.min(1, Math.max(0, dashboard.anomaly?.score ?? 0));
//   const overallPositive = Math.round((1 - anomalyScore01) * 100);

//   // Per-column positives (default missing → 100%)
//   const perColumnPositive =
//     ((dashboard.anomaly?.metrics as any)?.perColumnPositive ?? {}) as Record<string, number>;
//   const perColumnList = Object.entries(perColumnPositive)
//     .map(([col, val]) => ({ col, pct: Math.round(((val ?? 1) * 100)) }))
//     .sort((a, b) => b.pct - a.pct);

//   // Contributors chips → use recomputed/defaulted positives
//   const contributorList = (dashboard.anomaly?.contributors ?? []).map((col) => {
//     const pos01 = perColumnPositive?.[col];
//     const pct = typeof pos01 === 'number' ? Math.round(pos01 * 100) : 100;
//     return { col, pct };
//   });

//   return (
//     <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
//       {/* Row 1: KPI cards — averages */}
//       <Box
//         sx={{
//           display: 'grid',
//           gap: 2,
//           gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(6, 1fr)' },
//         }}
//       >
//         {avgScoresSeries.map((kpi) => (
//           <Paper key={kpi.dimension} sx={{ p: 2 }}>
//             <Typography variant="subtitle2" color="text.secondary">{kpi.dimension}</Typography>
//             <Typography variant="h5" sx={{ fontWeight: 700 }}>{kpi.scorePct}%</Typography>
//           </Paper>
//         ))}
//       </Box>

//       {/* Row 2: Gauge • Distribution */}
//       <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
//         <Paper sx={{ p: 2 }}>
//           <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
//             <Typography variant="h6" sx={{ fontWeight: 700 }}>Anomaly Gauge</Typography>
//             <Chip
//               label={anomalySeverity.toUpperCase()}
//               size="small"
//               sx={{
//                 backgroundColor: alpha(severityColor(anomalySeverity, theme), 0.12),
//                 color: severityColor(anomalySeverity, theme),
//                 border: `1px solid ${alpha(severityColor(anomalySeverity, theme), 0.4)}`,
//               }}
//             />
//           </Stack>

//           <Box sx={{ textAlign: 'center', py: 3 }}>
//             <Typography variant="h4" sx={{ fontWeight: 800 }}>{overallPositive}%</Typography>
//             <Typography variant="body2" color="text.secondary">Positive</Typography>
//           </Box>

//           {perColumnList.length > 0 && (
//             <Box sx={{ mt: 2 }}>
//               <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>Column Positives</Typography>
//               <Box
//                 sx={{
//                   display: 'grid',
//                   gap: 1,
//                   gridTemplateColumns: { xs: 'repeat(3, 1fr)', sm: 'repeat(4, 1fr)', md: 'repeat(6, 1fr)' },
//                 }}
//               >
//                 {perColumnList.slice(0, 12).map(({ col, pct }) => (
//                   <MiniSemiGauge
//                     key={col}
//                     positivePct={pct}
//                     label={col}
//                     colorPos={theme.palette.success.main}
//                     colorNeg={theme.palette.error.main}
//                   />
//                 ))}
//               </Box>
//             </Box>
//           )}

//           {dashboard.anomaly && dashboard.anomaly.contributors?.length > 0 && (
//             <Box sx={{ mt: 1 }}>
//               <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>Contributors</Typography>
//               <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
//                 {contributorList.slice(0, 10).map(({ col, pct }) => (
//                   <Chip key={col} label={`${col}: ${pct}%`} size="small" />
//                 ))}
//               </Stack>
//             </Box>
//           )}
//         </Paper>

//         <Paper sx={{ p: 2 }}>
//           <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Rule Quality Distribution</Typography>
//           <ResponsiveContainer width="100%" height={300}>
//             <BarChart data={distributionSeries} margin={{ top: 10, right: 30, left: 20, bottom: 60 }}>
//               <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.25)} />
//               <XAxis dataKey="dimension" angle={-45} textAnchor="end" height={60} />
//               <YAxis allowDecimals={false} />
//               <Tooltip />
//               <Bar dataKey="count" fill={theme.palette.primary.main} radius={[4, 4, 0, 0]} />
//             </BarChart>
//           </ResponsiveContainer>
//         </Paper>
//       </Box>

//       {/* Row 3: Averages */}
//       <Paper sx={{ p: 2 }}>
//         <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Average Latest Scores by Dimensions</Typography>
//         <ResponsiveContainer width="100%" height={320}>
//           <BarChart data={avgScoresSeries} margin={{ top: 10, right: 30, left: 20, bottom: 60 }}>
//             <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.25)} />
//             <XAxis
//               dataKey="dimension"
//               angle={-45}
//               textAnchor="end"
//               height={60}
//               label={{ value: 'Rule Type Applied', position: 'insideBottom', offset: -40 }}
//             />
//             <YAxis unit="%" label={{ value: 'DQ Score (Insp.)', angle: -90, position: 'insideLeft' }} />
//             <Tooltip />
//             <Bar dataKey="scorePct" fill={theme.palette.primary.main} />
//           </BarChart>
//         </ResponsiveContainer>
//       </Paper>

//       {/* Row 4: Insights • Violations */}
//       <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 2fr' } }}>
//         <Paper sx={{ p: 2 }}>
//           <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Anomaly Insights</Typography>
//           {dashboard.anomalyInsights.top_contributors.length === 0 &&
//           (!dashboard.anomaly?.notes || dashboard.anomaly.notes.length === 0) ? (
//             <Typography variant="body2" color="text.secondary">No insights available for the latest run.</Typography>
//           ) : (
//             <Box component="ul" sx={{ pl: 3, m: 0 }}>
//               {dashboard.anomalyInsights.top_contributors.map((c) => (
//                 <Typography key={c} component="li" variant="body2">{c}</Typography>
//               ))}
//               {dashboard.anomaly?.notes?.map((n, i) => (
//                 <Typography key={`n${i}`} component="li" variant="body2">{n}</Typography>
//               ))}
//             </Box>
//           )}
//         </Paper>

//         <Paper sx={{ p: 2 }}>
//           <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Rule Violations Summary</Typography>
//           <Table size="small" stickyHeader>
//             <TableHead>
//               <TableRow>
//                 <TableCell>Rule ID</TableCell>
//                 <TableCell>Dimension</TableCell>
//                 <TableCell>Description</TableCell>
//                 <TableCell align="right">Violations</TableCell>
//                 <TableCell>Last Seen</TableCell>
//               </TableRow>
//             </TableHead>
//             <TableBody>
//               {dashboard.ruleViolationsTable.map((r) => (
//                 <TableRow key={r.rule_id}>
//                   <TableCell>{r.display_rule_id ?? r.rule_id}</TableCell>
//                   <TableCell>{r.dimension}</TableCell>
//                   <TableCell
//                     sx={{ maxWidth: 380, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
//                   >
//                     {r.description ?? '—'}
//                   </TableCell>
//                   <TableCell align="right">{r.violations}</TableCell>
//                   <TableCell>{r.last_seen ?? '—'}</TableCell>
//                 </TableRow>
//               ))}
//               {dashboard.ruleViolationsTable.length === 0 && (
//                 <TableRow>
//                   <TableCell colSpan={5}>
//                     <Typography variant="body2" color="text.secondary">
//                       No violations in the latest run.
//                     </Typography>
//                   </TableCell>
//                 </TableRow>
//               )}
//             </TableBody>
//           </Table>
//         </Paper>
//       </Box>
//     </Box>
//   );
// };

// export default Dashboard;


// trying


// src/components/dashboard/Dashboard.tsx
import React from 'react';
import {
  Box,
  Paper,
  Typography,
  useTheme,
  alpha,
  Table,
  TableBody,
  TableRow,
  TableCell,
  TableHead,
  Chip,
  Stack,
} from '@mui/material';
import * as Recharts from 'recharts';
import type { DashboardState } from '../../dq/dqAggregator';

const {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} = Recharts as any;

type Props = { dashboard: DashboardState };

const severityColor = (
  sev: 'low' | 'moderate' | 'high' | 'critical',
  theme: any,
) => {
  switch (sev) {
    case 'critical':  return theme.palette.error.main;
    case 'high':      return alpha(theme.palette.error.main, 0.85);
    case 'moderate':  return theme.palette.warning.main;
    default:          return theme.palette.success.main;
  }
};

const MiniSemiGauge: React.FC<{
  positivePct: number;
  label: string;
  colorPos: string;
  colorNeg: string;
}> = ({ positivePct, label, colorPos, colorNeg }) => {
  const pos = Math.max(0, Math.min(100, Math.round(positivePct)));
  return (
    <Box sx={{ width: 96 }}>
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          height: 44,
          borderRadius: '100px 100px 0 0',
          background: `linear-gradient(to right, ${colorPos} ${pos}%, ${alpha(colorNeg, 0.35)} ${pos}%)`,
        }}
      />
      <Box sx={{ textAlign: 'center', mt: 0.5 }}>
        <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>
          {label}
        </Typography>
        <Typography variant="caption" color="text.secondary">{pos}%</Typography>
      </Box>
    </Box>
  );
};

const Dashboard: React.FC<Props> = ({ dashboard }) => {
  const theme = useTheme();

  // Rule Quality Distribution
  const distributionSeries = Object.entries(dashboard.ruleDistribution).map(
    ([k, v]) => ({ dimension: k[0].toUpperCase() + k.slice(1), count: Number(v) || 0 })
  );

  // STRICT from Inspector first; fallback to anomaly dims when none present (file mode)
  const inspectorDims = Array.from(dashboard.appliedDims ?? []);
  const anomalyDimPos =
    ((dashboard.anomaly?.metrics as any)?.perDimensionPositive ?? {}) as Record<string, number>;

  const dimsForAvg =
    inspectorDims.length > 0
      ? inspectorDims
      : Object.keys(anomalyDimPos).filter((d) => typeof anomalyDimPos[d] === 'number');

  // Build series from dimensionScores (already backfilled by reducer)
  const avgScoresSeries = dimsForAvg.map((d) => ({
    dimension: d[0].toUpperCase() + d.slice(1),
    scorePct: +((Number(dashboard.dimensionScores[d as keyof typeof dashboard.dimensionScores]) * 100).toFixed(1)),
  }));

  // Anomaly Gauge
  const anomalySeverity = dashboard.anomaly?.severity ?? 'low';
  const anomalyScore01 = Math.min(1, Math.max(0, dashboard.anomaly?.score ?? 0));
  const overallPositive = Math.round((1 - anomalyScore01) * 100);

  // Per-column positives (default missing → 100%)
  const perColumnPositive =
    ((dashboard.anomaly?.metrics as any)?.perColumnPositive ?? {}) as Record<string, number>;
  const perColumnList = Object.entries(perColumnPositive)
    .map(([col, val]) => ({ col, pct: Math.round(((val ?? 1) * 100)) }))
    .sort((a, b) => b.pct - a.pct);

  // Contributors chips → use recomputed/defaulted positives
  const contributorList = (dashboard.anomaly?.contributors ?? []).map((col) => {
    const pos01 = perColumnPositive?.[col];
    const pct = typeof pos01 === 'number' ? Math.round(pos01 * 100) : 100;
    return { col, pct };
  });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Row 1: KPI cards — averages */}
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(6, 1fr)' },
        }}
      >
        {avgScoresSeries.map((kpi) => (
          <Paper key={kpi.dimension} sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">{kpi.dimension}</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{kpi.scorePct}%</Typography>
          </Paper>
        ))}
      </Box>

      {/* Row 2: Gauge • Distribution */}
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
        <Paper sx={{ p: 2 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Anomaly Gauge</Typography>
            <Chip
              label={anomalySeverity.toUpperCase()}
              size="small"
              sx={{
                backgroundColor: alpha(severityColor(anomalySeverity, theme), 0.12),
                color: severityColor(anomalySeverity, theme),
                border: `1px solid ${alpha(severityColor(anomalySeverity, theme), 0.4)}`,
              }}
            />
          </Stack>

          <Box sx={{ textAlign: 'center', py: 3 }}>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>{overallPositive}%</Typography>
            <Typography variant="body2" color="text.secondary">Positive</Typography>
          </Box>

          {perColumnList.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>Column Positives</Typography>
              <Box
                sx={{
                  display: 'grid',
                  gap: 1,
                  gridTemplateColumns: { xs: 'repeat(3, 1fr)', sm: 'repeat(4, 1fr)', md: 'repeat(6, 1fr)' },
                }}
              >
                {perColumnList.slice(0, 12).map(({ col, pct }) => (
                  <MiniSemiGauge
                    key={col}
                    positivePct={pct}
                    label={col}
                    colorPos={theme.palette.success.main}
                    colorNeg={theme.palette.error.main}
                  />
                ))}
              </Box>
            </Box>
          )}

          {dashboard.anomaly && dashboard.anomaly.contributors?.length > 0 && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>Contributors</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {contributorList.slice(0, 10).map(({ col, pct }) => (
                  <Chip key={col} label={`${col}: ${pct}%`} size="small" />
                ))}
              </Stack>
            </Box>
          )}
        </Paper>

        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Rule Quality Distribution</Typography>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={distributionSeries} margin={{ top: 10, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.25)} />
              <XAxis dataKey="dimension" angle={-45} textAnchor="end" height={60} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill={theme.palette.primary.main} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Paper>
      </Box>

      {/* Row 3: Averages */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Average Latest Scores by Dimensions</Typography>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={avgScoresSeries} margin={{ top: 10, right: 30, left: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.25)} />
            <XAxis
              dataKey="dimension"
              angle={-45}
              textAnchor="end"
              height={60}
              label={{ value: 'Rule Type Applied', position: 'insideBottom', offset: -40 }}
            />
            <YAxis unit="%" label={{ value: 'DQ Score (Insp.)', angle: -90, position: 'insideLeft' }} />
            <Tooltip />
            <Bar dataKey="scorePct" fill={theme.palette.primary.main} />
          </BarChart>
        </ResponsiveContainer>
      </Paper>

      {/* Row 4: Insights • Violations */}
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 2fr' } }}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Anomaly Insights</Typography>
          {dashboard.anomalyInsights.top_contributors.length === 0 &&
          (!dashboard.anomaly?.notes || dashboard.anomaly.notes.length === 0) ? (
            <Typography variant="body2" color="text.secondary">No insights available for the latest run.</Typography>
          ) : (
            <Box component="ul" sx={{ pl: 3, m: 0 }}>
              {dashboard.anomalyInsights.top_contributors.map((c) => (
                <Typography key={c} component="li" variant="body2">{c}</Typography>
              ))}
              {dashboard.anomaly?.notes?.map((n, i) => (
                <Typography key={`n${i}`} component="li" variant="body2">{n}</Typography>
              ))}
            </Box>
          )}
        </Paper>

        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Rule Violations Summary</Typography>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Rule ID</TableCell>
                <TableCell>Dimension</TableCell>
                <TableCell>Description</TableCell>
                <TableCell align="right">Violations</TableCell>
                <TableCell>Last Seen</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {dashboard.ruleViolationsTable.map((r) => (
                <TableRow key={r.rule_id}>
                  <TableCell>{r.display_rule_id ?? r.rule_id}</TableCell>
                  <TableCell>{r.dimension}</TableCell>
                  <TableCell
                    sx={{ maxWidth: 380, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                  >
                    {r.description ?? '—'}
                  </TableCell>
                  <TableCell align="right">{r.violations}</TableCell>
                  <TableCell>{r.last_seen ?? '—'}</TableCell>
                </TableRow>
              ))}
              {dashboard.ruleViolationsTable.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Typography variant="body2" color="text.secondary">
                      No violations in the latest run.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>
      </Box>
    </Box>
  );
};

export default Dashboard;
