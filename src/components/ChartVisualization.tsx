
import React, { useState, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  useTheme,
  alpha,
} from '@mui/material';

// All imports at the top (ESLint import/first)
import * as Recharts from 'recharts';
import { ChartVisualizationProps, VegaLiteSpec, RechartsData, CHART_COLORS } from '../types/chart';

// Destructure from Recharts as any to bypass TS 4.9 typing gaps with Recharts v3
const {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} = Recharts as any;

const ChartVisualization: React.FC<ChartVisualizationProps> = ({ chartContent, height = 380 }) => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);

  // Parse chart data from various formats
  const parseChartData = (
    chartSpec: any
  ): {
    type: string;
    data: RechartsData[];
    originalData: RechartsData[];
    title?: string;
  } => {
    try {
      // Handle Vega-Lite specifications (primary format)
      const hasVegaLiteSchema = chartSpec.$schema && chartSpec.$schema.includes('vega-lite');
      const hasVegaLiteFields = chartSpec.mark && chartSpec.data && chartSpec.data.values;

      if (hasVegaLiteSchema && hasVegaLiteFields) {
        const vegaSpec = chartSpec as VegaLiteSpec;
        const data = vegaSpec.data.values;
        const mark = typeof vegaSpec.mark === 'string' ? vegaSpec.mark : vegaSpec.mark.type;

        // Store original data for table view
        const originalData = data.map((item: any, index: number) => ({ id: index, ...item }));

        // Transform data for chart rendering
        let transformedData = [...data];

        // Handle multi-series line charts (convert from long to wide format)
        if (mark === 'line' && data.length > 0) {
          const firstItem = data[0] as Record<string, any>;
          const keys = Object.keys(firstItem);

          const categoryField = keys.find(
            (key) =>
              key.toUpperCase() === 'CATEGORY' ||
              key.toLowerCase().includes('category') ||
              key.toLowerCase().includes('group') ||
              key.toLowerCase().includes('series')
          );

          const timeField = keys.find((key) => {
            const v = firstItem[key];
            return (
              key.toLowerCase().includes('month') ||
              key.toLowerCase().includes('date') ||
              key.toLowerCase().includes('time') ||
              key.toLowerCase().includes('year') ||
              key.toLowerCase().includes('day') ||
              key.toLowerCase().includes('quarter') ||
              key.toLowerCase().includes('week') ||
              (typeof v === 'string' &&
                (v.includes('-') || v.includes('/') || v.match(/^\d{4}$/)))
            );
          });

          const valueField = keys.find((key) => {
            const v = firstItem[key];
            return (
              key.toLowerCase().includes('sales') ||
              key.toLowerCase().includes('value') ||
              key.toLowerCase().includes('amount') ||
              key.toLowerCase().includes('revenue') ||
              key.toLowerCase().includes('price') ||
              key.toLowerCase().includes('cost') ||
              key.toLowerCase().includes('total') ||
              key.toLowerCase().includes('count') ||
              key.toLowerCase().includes('quantity') ||
              key.toLowerCase().includes('score') ||
              key.toLowerCase().includes('rating') ||
              key.toLowerCase().includes('percent') ||
              (key !== categoryField && key !== timeField && typeof v === 'number')
            );
          });

          if (categoryField && timeField && valueField) {
            // Pivot the data from long to wide format
            const pivotMap = new Map<string, Record<string, any>>();
            data.forEach((row: any) => {
              const timeKey = row[timeField];
              const category = row[categoryField];
              const value = parseFloat(row[valueField]) || 0;

              if (!pivotMap.has(timeKey)) {
                pivotMap.set(timeKey, { name: timeKey, [timeField]: timeKey });
              }
              pivotMap.get(timeKey)![category] = value;
            });
            transformedData = Array.from(pivotMap.values());
          }
        }

        // Add normalized field names and ensure we have name/id fields
        transformedData = transformedData.map((item: any, index: number) => {
          const normalizedItem: Record<string, any> = { id: index, ...item };
          Object.keys(item).forEach((key) => {
            const lowerKey = key.toLowerCase();
            if (lowerKey !== key && !normalizedItem[lowerKey]) {
              normalizedItem[lowerKey] = item[key];
            }
          });
          if (!normalizedItem.name && !normalizedItem.NAME) {
            const nameFields = Object.keys(normalizedItem).filter(
              (key) =>
                typeof normalizedItem[key] === 'string' ||
                key.toLowerCase().includes('name') ||
                key.toLowerCase().includes('month') ||
                key.toLowerCase().includes('date')
            );
            if (nameFields.length > 0) {
              normalizedItem.name = normalizedItem[nameFields[0]];
            }
          }
          return normalizedItem;
        });

        return {
          type: mark || 'bar',
          data: transformedData,
          originalData,
          title: vegaSpec.title,
        };
      }

      // Handle generic chart specifications
      if (chartSpec.type && chartSpec.data) {
        const originalData = chartSpec.data.map((item: any, index: number) => ({ id: index, ...item }));
        return {
          type: chartSpec.type,
          data: chartSpec.data,
          originalData,
          title: chartSpec.title,
        };
      }

      // Handle direct data arrays
      if (Array.isArray(chartSpec)) {
        const originalData = chartSpec.map((item: any, index: number) => ({ id: index, ...item }));
        return {
          type: 'bar',
          data: chartSpec,
          originalData,
          title: 'Chart',
        };
      }

      // Fallback
      return {
        type: 'bar',
        data: [],
        originalData: [],
        title: 'No Data Available',
      };
    } catch {
      return {
        type: 'bar',
        data: [],
        originalData: [],
        title: 'Chart Parse Error',
      };
    }
  };

  const { type, data, originalData, title } = useMemo(() => {
    return parseChartData(chartContent.chart_spec);
  }, [chartContent]);

  // Auto-detect fields for rendering
  const chartConfig = useMemo(() => {
    if (!data || data.length === 0) {
      return { xKey: '', yKeys: [] as string[] };
    }

    const dataKeys = Object.keys(data[0] ?? {});

    // Auto-detect X-axis field (temporal/categorical)
    const xKey =
      dataKeys.find((key) => {
        const lower = key.toLowerCase();
        const isString = typeof (data[0] as any)?.[key] === 'string';
        return (
          lower.includes('month') ||
          lower.includes('date') ||
          lower.includes('timestamp') ||
          lower.includes('datetime') ||
          lower.includes('time_') ||
          lower.includes('_time') ||
          lower === 'time' ||
          lower.includes('year') ||
          lower.includes('quarter') ||
          lower.includes('week') ||
          lower.includes('day') ||
          key === 'name' ||
          lower.includes('category') ||
          lower.includes('group') ||
          lower.includes('type') ||
          lower.includes('label') ||
          lower.includes('ticker') ||
          lower.includes('primary_ticker') ||
          isString
        );
      }) ?? 'name';

    // Auto-detect Y-axis fields (numeric values, excluding metadata)
    let yKeys = dataKeys.filter((key) => {
      const isNotXKey = key !== xKey;
      const isNotName = key !== 'name';
      const isNotId = key !== 'id';
      const lower = key.toLowerCase();
      const hasNoDate = !lower.includes('date');
      const hasNoTime = !(
        lower.includes('timestamp') ||
        lower.includes('datetime') ||
        lower.includes('time_') ||
        lower.includes('_time') ||
        lower === 'time'
      );
      const hasNoMonth = !lower.includes('month');
      const hasNoYear = !lower.includes('year');
      const v = (data[0] as any)?.[key];
      const isNumeric = typeof v === 'number' || !isNaN(Number(v));
      return isNotXKey && isNotName && isNotId && hasNoDate && hasNoTime && hasNoMonth && hasNoYear && isNumeric;
    });

    // Filter out metadata/system fields
    const excludePatterns = [
      /^id$/i,
      /^name$/i,
      /^label$/i,
      /^key$/i,
      /timestamp/i,
      /created/i,
      /updated/i,
      /_id$/i,
      /_key$/i,
      /count_distinct/i,
      /COUNT_DISTINCT/i,
    ];
    yKeys = yKeys.filter((key) => !excludePatterns.some((pattern) => pattern.test(key)));

    // Remove case-insensitive duplicates
    const seen = new Set<string>();
    yKeys = yKeys.filter((key) => {
      const lowerKey = key.toLowerCase();
      if (seen.has(lowerKey)) return false;
      seen.add(lowerKey);
      return true;
    });

    return { xKey, yKeys };
  }, [data]);

  // -------- Formatters (typed) --------
  const formatTooltipValue = (value: number | string, name?: string | number) => {
    const rawName = typeof name === 'string' || typeof name === 'number' ? String(name) : '';
    const prettyName =
      rawName.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'Value';
    if (typeof value === 'number') {
      return [value.toLocaleString(), prettyName];
    }
    return [value as any, prettyName];
  };

  const formatTooltipLabel = (label?: string | number) => {
    const str = typeof label === 'string' ? label : String(label ?? '');
    if (str && str.includes('-') && str.length >= 7) {
      try {
        const date = new Date(str);
        if (!isNaN(date.getTime())) {
          const month = date.toLocaleDateString('en-US', { month: 'short' });
          const year = date.getFullYear();
          return `Month (${year}) ${month}`;
        }
      } catch {
        // fall through
      }
    }
    return str;
  };

  const customTooltipFormatter = (value: number | string, name?: string | number) => {
    const rawName = typeof name === 'string' || typeof name === 'number' ? String(name) : '';
    const formattedName =
      rawName
        .replace(/_/g, ' ')
        .replace(/\bCOUNT\b/gi, 'Count')
        .replace(/\bREGISTRATION\b/gi, 'Registration')
        .replace(/\bTOTAL\b/gi, 'Total')
        .replace(/\bAVG\b/gi, 'Average')
        .replace(/\bSUM\b/gi, 'Sum')
        .replace(/\bMAX\b/gi, 'Maximum')
        .replace(/\bMIN\b/gi, 'Minimum')
        .replace(/\b\w/g, (l) => l.toUpperCase()) || 'Value';

    if (typeof value === 'number') {
      return [value.toLocaleString(), formattedName];
    }
    return [value as any, formattedName];
  };

  const customLabelFormatter = (label?: string | number) => {
    const str = typeof label === 'string' ? label : String(label ?? '');
    // Try to parse as date
    if (str.includes('-') && str.length >= 7) {
      try {
        const date = new Date(str);
        if (!isNaN(date.getTime())) {
          // For monthly data (e.g., YYYY-MM-01)
          if (str.includes('-01')) {
            const month = date.toLocaleDateString('en-US', { month: 'short' });
            const year = date.getFullYear();
            return `${month} ${year}`;
          }
          // For daily data
          return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });
        }
      } catch {
        // fall through
      }
    }
    return str;
  };

  // Generate legend items for display above chart
  const renderLegendItems = () => {
    const { yKeys } = chartConfig;
    if (!yKeys || yKeys.length === 0) return null;

    return (
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          justifyContent: 'center',
          alignItems: 'center',
          flexWrap: 'wrap',
          mb: 2,
          pb: 1,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        }}
      >
        {yKeys.map((key, index) => (
          <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 16,
                height: 16,
                borderRadius: '3px',
                backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                flexShrink: 0,
              }}
            />
            <Typography
              variant="body2"
              sx={{ fontWeight: 600, fontSize: '0.875rem', color: 'text.primary' }}
            >
              {key.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
            </Typography>
          </Box>
        ))}
      </Box>
    );
  };

  // Render appropriate chart based on type
  const renderChart = () => {
    if (!data || data.length === 0) {
      return (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: height,
            color: 'text.secondary',
          }}
        >
          <Typography variant="body1">No data available for visualization</Typography>
        </Box>
      );
    }

    const { xKey, yKeys } = chartConfig;

    switch (type) {
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={data} margin={{ top: 20, right: 30, left: 50, bottom: 60 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={alpha(theme.palette.divider, 0.3)}
                horizontal
                vertical={false}
              />
              <XAxis
                dataKey={xKey}
                stroke={theme.palette.text.secondary}
                fontSize={12}
                angle={-45}
                textAnchor="end"
                height={60}
                tickFormatter={(value: string | number) => {
                  // Format month values for display
                  if (typeof value === 'string' && value.includes('-')) {
                    try {
                      const date = new Date(value);
                      if (!isNaN(date.getTime())) {
                        return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                      }
                    } catch {
                      // Fall through to default
                    }
                  }
                  return value as any;
                }}
              />
              <YAxis
                stroke={theme.palette.text.secondary}
                fontSize={11}
                tickFormatter={(value: string | number) => {
                  if (typeof value === 'number') {
                    if (value >= 1_000_000) {
                      return `${(value / 1_000_000).toFixed(1)}M`;
                    } else if (value >= 1_000) {
                      return `${(value / 1_000).toFixed(0)}K`;
                    }
                    return value.toLocaleString();
                  }
                  return value as any;
                }}
                domain={['dataMin * 0.95', 'dataMax * 1.1']}
                width={70}
              />
              <Tooltip
                formatter={customTooltipFormatter}
                labelFormatter={customLabelFormatter}
                contentStyle={{
                  backgroundColor: alpha(theme.palette.background.paper, 0.95),
                  border: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
                  borderRadius: '4px',
                  boxShadow: `0 4px 12px ${alpha(theme.palette.common.black, 0.15)}`,
                  fontSize: '0.9rem',
                  padding: '8px 12px',
                }}
                labelStyle={{
                  fontWeight: 600,
                  marginBottom: '4px',
                  color: theme.palette.text.primary,
                }}
                itemStyle={{
                  color: theme.palette.text.secondary,
                  fontSize: '0.9rem',
                }}
                cursor={{ stroke: alpha(theme.palette.primary.main, 0.3), strokeWidth: 1, strokeDasharray: '5 5' }}
              />
              {yKeys.map((key, index) => (
                <Line
                  key={key}
                  type="linear"
                  dataKey={key}
                  stroke={CHART_COLORS[index % CHART_COLORS.length]}
                  strokeWidth={3}
                  dot={{
                    fill: CHART_COLORS[index % CHART_COLORS.length],
                    strokeWidth: 2,
                    r: 5,
                  }}
                  activeDot={{
                    r: 8,
                    stroke: CHART_COLORS[index % CHART_COLORS.length],
                    strokeWidth: 3,
                    fill: '#ffffff',
                  }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );

      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={data} margin={{ top: 10, right: 30, left: 60, bottom: 90 }}>
              <defs>
                {yKeys.map((key, index) => (
                  <linearGradient key={`gradient-${index}`} id={`barGradient-${index}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS[index % CHART_COLORS.length]} stopOpacity={0.9} />
                    <stop offset="100%" stopColor={CHART_COLORS[index % CHART_COLORS.length]} stopOpacity={0.6} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid
                strokeDasharray="1 3"
                stroke={alpha(theme.palette.divider, 0.2)}
                strokeWidth={1}
                horizontal
                vertical={false}
              />
              <XAxis
                dataKey={xKey}
                stroke={theme.palette.text.secondary}
                fontSize={11}
                fontWeight={500}
                angle={-45}
                textAnchor="end"
                height={90}
                interval={0}
                axisLine={{ stroke: alpha(theme.palette.divider, 0.3), strokeWidth: 1 }}
                tickLine={{ stroke: alpha(theme.palette.divider, 0.3), strokeWidth: 1 }}
                tickFormatter={(value: string | number) => {
                  // Truncate long labels for better readability
                  if (typeof value === 'string' && value.length > 25) {
                    return value.substring(0, 22) + '...';
                  }
                  return value as any;
                }}
              />
              <YAxis
                stroke={theme.palette.text.secondary}
                fontSize={11}
                fontWeight={500}
                tickFormatter={(value: string | number) => {
                  if (typeof value === 'number') {
                    if (value >= 1_000_000) {
                      return `${(value / 1_000_000).toFixed(1)}M`;
                    } else if (value >= 1_000) {
                      return `${(value / 1_000).toFixed(0)}K`;
                    }
                    return value.toLocaleString();
                  }
                  return value as any;
                }}
                axisLine={{ stroke: alpha(theme.palette.divider, 0.3), strokeWidth: 1 }}
                tickLine={{ stroke: alpha(theme.palette.divider, 0.3), strokeWidth: 1 }}
                width={70}
              />
              <Tooltip
                formatter={customTooltipFormatter}
                labelFormatter={customLabelFormatter}
                contentStyle={{
                  backgroundColor: alpha(theme.palette.background.paper, 0.95),
                  border: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
                  borderRadius: '12px',
                  boxShadow:
                    theme.palette.mode === 'dark'
                      ? '0 8px 32px rgba(0, 0, 0, 0.4)'
                      : '0 8px 32px rgba(0, 0, 0, 0.12)',
                  fontSize: '0.875rem',
                  backdropFilter: 'blur(8px)',
                  padding: '12px 16px',
                }}
                labelStyle={{
                  color: theme.palette.text.primary,
                  fontWeight: 600,
                  marginBottom: '8px',
                  fontSize: '0.9rem',
                }}
                itemStyle={{
                  color: theme.palette.text.secondary,
                  fontSize: '0.875rem',
                  padding: '2px 0',
                }}
                cursor={false}
              />
              {yKeys.map((key, index) => (
                <Bar
                  key={key}
                  dataKey={key}
                  fill={`url(#barGradient-${index})`}
                  radius={[6, 6, 0, 0]}
                  stroke={CHART_COLORS[index % CHART_COLORS.length]}
                  strokeWidth={1}
                  strokeOpacity={0.8}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <AreaChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.3)} />
              <XAxis
                dataKey={xKey}
                stroke={theme.palette.text.secondary}
                fontSize={12}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis
                stroke={theme.palette.text.secondary}
                fontSize={12}
                tickFormatter={(value: string | number) =>
                  typeof value === 'number' ? value.toLocaleString() : (value as any)
                }
              />
              <Tooltip
                formatter={formatTooltipValue}
                labelFormatter={formatTooltipLabel}
                contentStyle={{
                  backgroundColor: theme.palette.background.paper,
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: theme.shape.borderRadius,
                  fontSize: '0.9rem',
                }}
                labelStyle={{
                  color: theme.palette.text.primary,
                  fontWeight: 600,
                  marginBottom: '4px',
                }}
                itemStyle={{
                  color: theme.palette.text.secondary,
                  fontSize: '0.9rem',
                }}
              />
              {yKeys.map((key, index) => (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stackId="1"
                  stroke={CHART_COLORS[index % CHART_COLORS.length]}
                  fill={alpha(CHART_COLORS[index % CHART_COLORS.length], 0.6)}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'circle':
      case 'pie': {
        const pieData =
          yKeys.length > 0
            ? data.map((item, index) => ({
                name: (item as any)[xKey] ?? `Item ${index + 1}`,
                value: (item as any)[yKeys[0]] ?? 0,
              }))
            : [];

        return (
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(props: any) => {
                  const { name, percent } = props;
                  return `${name}: ${(percent * 100).toFixed(1)}%`;
                }}
                outerRadius={Math.min(height * 0.3, 120)}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number | string) => [
                  typeof value === 'number' ? value.toLocaleString() : (value as any),
                  'Value',
                ]}
                contentStyle={{
                  backgroundColor: theme.palette.background.paper,
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: theme.shape.borderRadius,
                  fontSize: '0.9rem',
                }}
                labelStyle={{
                  color: theme.palette.text.primary,
                  fontWeight: 600,
                  marginBottom: '4px',
                }}
                itemStyle={{
                  color: theme.palette.text.secondary,
                  fontSize: '0.9rem',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        );
      }

      case 'point':
      case 'scatter':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <ScatterChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.3)} />
              <XAxis
                dataKey={xKey}
                stroke={theme.palette.text.secondary}
                fontSize={12}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis
                stroke={theme.palette.text.secondary}
                fontSize={12}
                tickFormatter={(value: string | number) =>
                  typeof value === 'number' ? value.toLocaleString() : (value as any)
                }
              />
              <Tooltip
                formatter={formatTooltipValue}
                labelFormatter={formatTooltipLabel}
                contentStyle={{
                  backgroundColor: theme.palette.background.paper,
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: theme.shape.borderRadius,
                  fontSize: '0.9rem',
                }}
                labelStyle={{
                  color: theme.palette.text.primary,
                  fontWeight: 600,
                  marginBottom: '4px',
                }}
                itemStyle={{
                  color: theme.palette.text.secondary,
                  fontSize: '0.9rem',
                }}
              />
              {yKeys.map((key, index) => (
                <Scatter key={key} dataKey={key} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        );

      default:
        // Default to bar chart for unknown types
        return (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.3)} />
              <XAxis
                dataKey={xKey}
                stroke={theme.palette.text.secondary}
                fontSize={12}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis
                stroke={theme.palette.text.secondary}
                fontSize={12}
                tickFormatter={(value: string | number) =>
                  typeof value === 'number' ? value.toLocaleString() : (value as any)
                }
              />
              <Tooltip
                formatter={formatTooltipValue}
                labelFormatter={formatTooltipLabel}
                contentStyle={{
                  backgroundColor: theme.palette.background.paper,
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: theme.shape.borderRadius,
                  fontSize: '0.9rem',
                }}
                labelStyle={{
                  color: theme.palette.text.primary,
                  fontWeight: 600,
                  marginBottom: '4px',
                }}
                itemStyle={{
                  color: theme.palette.text.secondary,
                  fontSize: '0.9rem',
                }}
              />
              {yKeys.map((key, index) => (
                <Bar key={key} dataKey={key} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );
    }
  };

  // Render data table
  const renderTable = () => {
    if (!originalData || originalData.length === 0) {
      return (
        <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
          <Typography variant="body1">No data available</Typography>
        </Box>
      );
    }

    const columns = Object.keys(originalData[0] ?? {}).filter((key) => key !== 'id');

    return (
      <TableContainer sx={{ maxHeight: height - 100 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell
                  key={column}
                  sx={{
                    fontWeight: 600,
                    backgroundColor: theme.palette.background.default,
                    fontSize: '0.9rem',
                  }}
                >
                  {column.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {originalData.map((row, index) => (
              <TableRow key={(row as any).id ?? index} hover>
                {columns.map((column) => (
                  <TableCell key={column} sx={{ fontSize: '0.9rem' }}>
                    {typeof (row as any)[column] === 'number'
                      ? ((row as any)[column] as number).toLocaleString()
                      : ((row as any)[column]?.toString() ?? '-')}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  return (
    <Paper
      elevation={2}
      sx={{
        borderRadius: 2,
        overflow: 'hidden',
        border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
      }}
    >
      {/* Header */}
      <Box sx={{ p: 2, pb: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {title ?? 'Data Visualization'}
          </Typography>
        </Box>

        {/* Simple Tabs */}
        <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="Chart" />
          <Tab label="Table" />
        </Tabs>
      </Box>

      {/* Content */}
      <Box sx={{ p: 2 }}>
        {activeTab === 0 ? (
          <>
            {renderLegendItems()}
            {renderChart()}
          </>
        ) : (
          renderTable()
        )}
      </Box>
    </Paper>
  );
};

export default ChartVisualization;
export { ChartVisualization };
