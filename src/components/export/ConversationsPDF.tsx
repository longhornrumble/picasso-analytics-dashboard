/**
 * Conversations Dashboard PDF Document
 * Uses @react-pdf/renderer to generate a PDF report
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';
import type {
  ConversationSummaryMetrics,
  TopQuestion,
  HeatmapRow,
  HeatmapPeak,
  ConversationTrendPoint,
} from '../../types/analytics';

// Design token colors (from @picasso/shared-styles)
// Note: react-pdf doesn't support CSS variables, so we use hex values with token references
const COLORS = {
  primary500: '#50C878',    // var(--color-primary-500)
  success700: '#166534',    // var(--color-success-700)
  gray50: '#f9fafb',        // var(--color-gray-50)
  gray100: '#f3f4f6',       // var(--color-gray-100)
  gray200: '#e5e7eb',       // var(--color-gray-200)
  gray400: '#9ca3af',       // var(--color-gray-400)
  gray500: '#6b7280',       // var(--color-gray-500)
  gray700: '#374151',       // var(--color-gray-700)
  gray800: '#1f2937',       // var(--color-gray-800)
  gray900: '#111827',       // var(--color-gray-900)
  green50: '#f0fdf4',       // var(--color-green-50)
  green200: '#bbf7d0',      // var(--color-green-200)
  green300: '#86efac',      // var(--color-green-300)
  green400: '#4ade80',      // var(--color-green-400)
  green500: '#22c55e',      // var(--color-green-500)
  white: '#ffffff',         // var(--color-white)
};

// PDF Styles - A4 page is 595 x 842 points
const styles = StyleSheet.create({
  page: {
    padding: 40,
    paddingBottom: 60,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: COLORS.gray800,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.gray900,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 11,
    color: COLORS.gray500,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.gray900,
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  // KPI Cards - 4 cards across full width
  kpiRow: {
    flexDirection: 'row',
    gap: 12,
  },
  kpiCard: {
    flex: 1,
    padding: 12,
    backgroundColor: COLORS.gray50,
    borderRadius: 6,
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.primary500,
    marginBottom: 4,
  },
  kpiLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    color: COLORS.gray700,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  kpiSubtitle: {
    fontSize: 8,
    color: COLORS.gray500,
  },
  // Two-column layout for Questions and Heatmap
  twoColumnRow: {
    flexDirection: 'row',
    gap: 16,
  },
  column: {
    flex: 1,
  },
  // Top Questions
  questionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
  },
  questionRank: {
    width: 20,
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.primary500,
  },
  questionText: {
    flex: 1,
    fontSize: 9,
    color: COLORS.gray700,
    paddingRight: 8,
  },
  questionStats: {
    width: 60,
    textAlign: 'right',
  },
  questionCount: {
    fontSize: 9,
    fontWeight: 'bold',
    color: COLORS.gray900,
  },
  questionPercent: {
    fontSize: 7,
    color: COLORS.primary500,
  },
  // Heatmap - Compact version
  heatmapContainer: {
    marginTop: 4,
  },
  heatmapHeader: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  heatmapHeaderCell: {
    width: 28,
    fontSize: 7,
    fontWeight: 'bold',
    color: COLORS.gray500,
    textAlign: 'center',
  },
  heatmapHourLabel: {
    width: 32,
    fontSize: 7,
    color: COLORS.gray500,
  },
  heatmapRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  heatmapCell: {
    width: 28,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 2,
    marginRight: 1,
  },
  heatmapCellText: {
    fontSize: 6,
    color: COLORS.white,
  },
  peakInfo: {
    marginTop: 8,
    padding: 6,
    backgroundColor: COLORS.green50,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  peakLabel: {
    fontSize: 8,
    color: COLORS.success700,
    fontWeight: 'bold',
  },
  peakValue: {
    fontSize: 8,
    color: COLORS.success700,
    marginLeft: 4,
  },
  // Trend Chart
  trendContainer: {
    marginTop: 4,
  },
  trendChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 80,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
    paddingBottom: 4,
  },
  trendBarContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
  },
  trendBar: {
    width: '70%',
    backgroundColor: COLORS.primary500,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    minHeight: 2,
  },
  trendLabels: {
    flexDirection: 'row',
    marginTop: 4,
  },
  trendLabel: {
    flex: 1,
    fontSize: 6,
    color: COLORS.gray500,
    textAlign: 'center',
  },
  trendSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray100,
  },
  trendStat: {
    alignItems: 'center',
  },
  trendStatValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.gray900,
  },
  trendStatLabel: {
    fontSize: 7,
    color: COLORS.gray500,
    marginTop: 2,
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: COLORS.gray200,
    paddingTop: 8,
  },
  footerText: {
    fontSize: 8,
    color: COLORS.gray400,
  },
});

// Helper to get heatmap cell color based on value
function getHeatmapColor(value: number, maxValue: number): string {
  if (value === 0) return COLORS.gray100;
  const intensity = Math.min(value / maxValue, 1);
  if (intensity < 0.25) return COLORS.green200;
  if (intensity < 0.5) return COLORS.green300;
  if (intensity < 0.75) return COLORS.green400;
  return COLORS.green500;
}

// Helper to format response time
function formatResponseTime(seconds: number): string {
  if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
  return `${seconds.toFixed(1)}s`;
}

interface ConversationsPDFProps {
  summary: ConversationSummaryMetrics;
  topQuestions: TopQuestion[];
  heatmap: HeatmapRow[];
  peak: HeatmapPeak | null;
  trend: ConversationTrendPoint[];
  timeRange: string;
  tenantName?: string;
}

export function ConversationsPDF({
  summary,
  topQuestions,
  heatmap,
  peak,
  trend,
  timeRange,
  tenantName = 'Analytics Dashboard',
}: ConversationsPDFProps) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const maxHeatmapValue = Math.max(
    ...heatmap.flatMap(row => row.data.map(d => d.value)),
    1
  );
  const maxTrendValue = Math.max(...trend.map(t => t.value), 1);
  const totalTrendValue = trend.reduce((sum, t) => sum + t.value, 0);
  const avgTrendValue = trend.length > 0 ? Math.round(totalTrendValue / trend.length) : 0;

  const exportDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const timeRangeLabel = {
    '1d': 'Last 24 Hours',
    '7d': 'Last 7 Days',
    '30d': 'Last 30 Days',
    '90d': 'Last 90 Days',
  }[timeRange] || timeRange;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Conversation Analytics Report</Text>
          <Text style={styles.subtitle}>
            {tenantName} • {timeRangeLabel} • Generated {exportDate}
          </Text>
        </View>

        {/* KPI Cards */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary Metrics</Text>
          <View style={styles.kpiRow}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiValue}>{summary.total_conversations.toLocaleString()}</Text>
              <Text style={styles.kpiLabel}>Conversations</Text>
              <Text style={styles.kpiSubtitle}>Unique chat sessions</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiValue}>{summary.total_messages.toLocaleString()}</Text>
              <Text style={styles.kpiLabel}>Messages</Text>
              <Text style={styles.kpiSubtitle}>User + bot messages</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiValue}>{formatResponseTime(summary.avg_response_time_seconds)}</Text>
              <Text style={styles.kpiLabel}>Response Time</Text>
              <Text style={styles.kpiSubtitle}>Average bot response</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiValue}>{summary.after_hours_percentage.toFixed(1)}%</Text>
              <Text style={styles.kpiLabel}>After Hours</Text>
              <Text style={styles.kpiSubtitle}>Outside 9am-5pm</Text>
            </View>
          </View>
        </View>

        {/* Conversations Trend */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Conversations Trend</Text>
          <View style={styles.trendContainer}>
            <View style={styles.trendChart}>
              {trend.map((point, i) => (
                <View key={i} style={styles.trendBarContainer}>
                  <View
                    style={[
                      styles.trendBar,
                      { height: `${(point.value / maxTrendValue) * 100}%` },
                    ]}
                  />
                </View>
              ))}
            </View>
            <View style={styles.trendLabels}>
              {trend.map((point, i) => (
                <Text key={i} style={styles.trendLabel}>{point.period}</Text>
              ))}
            </View>
            <View style={styles.trendSummary}>
              <View style={styles.trendStat}>
                <Text style={styles.trendStatValue}>{totalTrendValue}</Text>
                <Text style={styles.trendStatLabel}>Total</Text>
              </View>
              <View style={styles.trendStat}>
                <Text style={styles.trendStatValue}>{maxTrendValue}</Text>
                <Text style={styles.trendStatLabel}>Peak</Text>
              </View>
              <View style={styles.trendStat}>
                <Text style={styles.trendStatValue}>{avgTrendValue}</Text>
                <Text style={styles.trendStatLabel}>Average</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Two-column: Top Questions and Heatmap */}
        <View style={styles.twoColumnRow}>
          {/* Top Questions */}
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Top Questions</Text>
            {topQuestions.slice(0, 5).map((q, i) => (
              <View key={i} style={styles.questionRow}>
                <Text style={styles.questionRank}>{i + 1}.</Text>
                <Text style={styles.questionText}>"{q.question_text}"</Text>
                <View style={styles.questionStats}>
                  <Text style={styles.questionCount}>{q.count}</Text>
                  <Text style={styles.questionPercent}>{q.percentage.toFixed(1)}%</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Activity Heatmap */}
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Activity Heatmap</Text>
            <View style={styles.heatmapContainer}>
              {/* Header row */}
              <View style={styles.heatmapHeader}>
                <Text style={styles.heatmapHourLabel}></Text>
                {days.map(day => (
                  <Text key={day} style={styles.heatmapHeaderCell}>{day}</Text>
                ))}
              </View>
              {/* Data rows */}
              {heatmap.map((row, rowIndex) => (
                <View key={rowIndex} style={styles.heatmapRow}>
                  <Text style={styles.heatmapHourLabel}>{row.hour_block}</Text>
                  {row.data.map((cell, cellIndex) => (
                    <View
                      key={cellIndex}
                      style={[
                        styles.heatmapCell,
                        { backgroundColor: getHeatmapColor(cell.value, maxHeatmapValue) },
                      ]}
                    >
                      {cell.value > 0 && (
                        <Text style={[
                          styles.heatmapCellText,
                          { color: cell.value / maxHeatmapValue > 0.5 ? COLORS.white : COLORS.gray700 }
                        ]}>
                          {cell.value}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              ))}
            </View>
            {/* Peak indicator */}
            {peak && (
              <View style={styles.peakInfo}>
                <Text style={styles.peakLabel}>Peak:</Text>
                <Text style={styles.peakValue}>
                  {peak.day} at {peak.hour_block} ({peak.count})
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Mission Intelligence Platform • {tenantName}
          </Text>
          <Text style={styles.footerText}>
            Page 1 of 1
          </Text>
        </View>
      </Page>
    </Document>
  );
}
