/**
 * Forms Dashboard PDF Document
 * Uses @react-pdf/renderer to generate a PDF report
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';

// PDF Styles - A4 page is 595 x 842 points
const styles = StyleSheet.create({
  page: {
    padding: 40,
    paddingBottom: 60,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#1f2937',
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 11,
    color: '#6b7280',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  // KPI Cards - 4 cards across full width
  kpiRow: {
    flexDirection: 'row',
    gap: 12,
  },
  kpiCard: {
    flex: 1,
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 6,
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#50C878',
    marginBottom: 4,
  },
  kpiValueDanger: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ef4444',
    marginBottom: 4,
  },
  kpiLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  kpiSubtitle: {
    fontSize: 8,
    color: '#6b7280',
  },
  // Funnel visualization
  funnelContainer: {
    marginTop: 8,
  },
  funnelStage: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  funnelLabel: {
    width: 80,
    fontSize: 9,
    color: '#374151',
  },
  funnelBarContainer: {
    flex: 1,
    height: 24,
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    overflow: 'hidden',
  },
  funnelBar: {
    height: '100%',
    backgroundColor: '#50C878',
    borderRadius: 4,
  },
  funnelValue: {
    width: 60,
    fontSize: 10,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'right',
    marginLeft: 8,
  },
  funnelSummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  funnelStat: {
    alignItems: 'center',
  },
  funnelStatValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111827',
  },
  funnelStatValueSuccess: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#50C878',
  },
  funnelStatValueDanger: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ef4444',
  },
  funnelStatLabel: {
    fontSize: 7,
    color: '#6b7280',
    marginTop: 2,
  },
  // Two-column layout with fixed height
  twoColumnRow: {
    flexDirection: 'row',
    gap: 16,
  },
  column: {
    flex: 1,
    minHeight: 180,
  },
  // Shared row style for both columns
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 28,
    marginBottom: 4,
  },
  rowLabel: {
    width: 110,
    fontSize: 9,
    color: '#374151',
  },
  rowBarContainer: {
    flex: 1,
    height: 18,
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    overflow: 'hidden',
  },
  rowBarSuccess: {
    height: '100%',
    backgroundColor: '#50C878',
    borderRadius: 4,
  },
  rowBarDanger: {
    height: '100%',
    backgroundColor: '#ef4444',
    borderRadius: 4,
  },
  rowValue: {
    width: 45,
    fontSize: 9,
    fontWeight: 'bold',
    textAlign: 'right',
    marginLeft: 8,
  },
  rowValueSuccess: {
    color: '#16a34a',
  },
  rowValueDanger: {
    color: '#ef4444',
  },
  // Summary boxes
  summaryBox: {
    marginTop: 8,
    padding: 8,
    borderRadius: 4,
  },
  summaryBoxSuccess: {
    backgroundColor: '#f0fdf4',
  },
  summaryBoxDanger: {
    backgroundColor: '#fef2f2',
  },
  summaryText: {
    fontSize: 8,
  },
  summaryTextSuccess: {
    color: '#166534',
  },
  summaryTextDanger: {
    color: '#991b1b',
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
    borderTopColor: '#e5e7eb',
    paddingTop: 8,
  },
  footerText: {
    fontSize: 8,
    color: '#9ca3af',
  },
});

// Helper to format time
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

interface FormMetrics {
  form_views: number;
  forms_started: number;
  forms_completed: number;
  forms_abandoned: number;
  completion_rate: number;
  abandon_rate: number;
  avg_completion_time_seconds: number;
}

interface Bottleneck {
  fieldName: string;
  abandonRate: number;
}

interface TopForm {
  id: string;
  name: string;
  submissions: number;
  conversionRate: number;
  trend?: string;
}

interface FormsPDFProps {
  metrics: FormMetrics;
  bottlenecks: Bottleneck[];
  topForms: TopForm[];
  timeRange: string;
  tenantName?: string;
}

export function FormsPDF({
  metrics,
  bottlenecks,
  topForms,
  timeRange,
  tenantName = 'Analytics Dashboard',
}: FormsPDFProps) {
  const maxConversionRate = Math.max(...topForms.map(f => f.conversionRate), 1);
  const maxBottleneckRate = Math.max(...bottlenecks.map(b => b.abandonRate), 1);
  const totalSubmissions = topForms.reduce((sum, f) => sum + f.submissions, 0);

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
          <Text style={styles.title}>Form Analytics Report</Text>
          <Text style={styles.subtitle}>
            {tenantName} • {timeRangeLabel} • Generated {exportDate}
          </Text>
        </View>

        {/* KPI Cards */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary Metrics</Text>
          <View style={styles.kpiRow}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiValue}>{metrics.form_views.toLocaleString()}</Text>
              <Text style={styles.kpiLabel}>Form Views</Text>
              <Text style={styles.kpiSubtitle}>{metrics.forms_started} started</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiValue}>{metrics.forms_completed.toLocaleString()}</Text>
              <Text style={styles.kpiLabel}>Completions</Text>
              <Text style={styles.kpiSubtitle}>{metrics.completion_rate.toFixed(1)}% rate</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiValue}>{formatTime(metrics.avg_completion_time_seconds)}</Text>
              <Text style={styles.kpiLabel}>Avg. Time</Text>
              <Text style={styles.kpiSubtitle}>Start to submit</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiValueDanger}>{metrics.abandon_rate.toFixed(1)}%</Text>
              <Text style={styles.kpiLabel}>Abandon Rate</Text>
              <Text style={styles.kpiSubtitle}>{metrics.forms_abandoned} abandoned</Text>
            </View>
          </View>
        </View>

        {/* Conversion Funnel */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Form Conversion Funnel</Text>
          <View style={styles.funnelContainer}>
            <View style={styles.funnelStage}>
              <Text style={styles.funnelLabel}>Views</Text>
              <View style={styles.funnelBarContainer}>
                <View style={[styles.funnelBar, { width: '100%' }]} />
              </View>
              <Text style={styles.funnelValue}>{metrics.form_views.toLocaleString()}</Text>
            </View>
            <View style={styles.funnelStage}>
              <Text style={styles.funnelLabel}>Started</Text>
              <View style={styles.funnelBarContainer}>
                <View style={[styles.funnelBar, { width: `${(metrics.forms_started / metrics.form_views) * 100}%` }]} />
              </View>
              <Text style={styles.funnelValue}>{metrics.forms_started.toLocaleString()}</Text>
            </View>
            <View style={styles.funnelStage}>
              <Text style={styles.funnelLabel}>Completed</Text>
              <View style={styles.funnelBarContainer}>
                <View style={[styles.funnelBar, { width: `${(metrics.forms_completed / metrics.form_views) * 100}%` }]} />
              </View>
              <Text style={styles.funnelValue}>{metrics.forms_completed.toLocaleString()}</Text>
            </View>
          </View>
          <View style={styles.funnelSummary}>
            <View style={styles.funnelStat}>
              <Text style={styles.funnelStatValue}>{metrics.form_views}</Text>
              <Text style={styles.funnelStatLabel}>Total Views</Text>
            </View>
            <View style={styles.funnelStat}>
              <Text style={styles.funnelStatValueDanger}>{metrics.forms_abandoned}</Text>
              <Text style={styles.funnelStatLabel}>Abandoned</Text>
            </View>
            <View style={styles.funnelStat}>
              <Text style={styles.funnelStatValueSuccess}>{metrics.forms_completed}</Text>
              <Text style={styles.funnelStatLabel}>Completed</Text>
            </View>
          </View>
        </View>

        {/* Two-column: Top Forms and Bottlenecks */}
        <View style={styles.section}>
          <View style={styles.twoColumnRow} wrap={false}>
            {/* Top Performing Forms */}
            <View style={styles.column}>
              <Text style={styles.sectionTitle}>Top Performing Forms</Text>
              {topForms.length > 0 ? (
                topForms.slice(0, 5).map((form, i) => (
                  <View key={form.id} style={styles.dataRow}>
                    <Text style={styles.rowLabel}>{i + 1}. {form.name}</Text>
                    <View style={styles.rowBarContainer}>
                      <View style={[styles.rowBarSuccess, { width: `${(form.conversionRate / maxConversionRate) * 100}%` }]} />
                    </View>
                    <Text style={[styles.rowValue, styles.rowValueSuccess]}>{form.conversionRate.toFixed(0)}%</Text>
                  </View>
                ))
              ) : (
                <Text style={{ fontSize: 9, color: '#6b7280' }}>No form data available</Text>
              )}
              <View style={[styles.summaryBox, styles.summaryBoxSuccess]}>
                <Text style={[styles.summaryText, styles.summaryTextSuccess]}>
                  Total: {totalSubmissions} submissions across {topForms.length} forms
                </Text>
              </View>
            </View>

            {/* Field Bottlenecks */}
            <View style={styles.column}>
              <Text style={styles.sectionTitle}>Field Bottlenecks</Text>
              {bottlenecks.length > 0 ? (
                bottlenecks.slice(0, 5).map((field, i) => (
                  <View key={i} style={styles.dataRow}>
                    <Text style={styles.rowLabel}>{field.fieldName}</Text>
                    <View style={styles.rowBarContainer}>
                      <View style={[styles.rowBarDanger, { width: `${(field.abandonRate / maxBottleneckRate) * 100}%` }]} />
                    </View>
                    <Text style={[styles.rowValue, styles.rowValueDanger]}>{field.abandonRate}%</Text>
                  </View>
                ))
              ) : (
                <Text style={{ fontSize: 9, color: '#6b7280' }}>No bottleneck data available</Text>
              )}
              <View style={[styles.summaryBox, styles.summaryBoxDanger]}>
                <Text style={[styles.summaryText, styles.summaryTextDanger]}>
                  Fields with highest drop-off rates
                </Text>
              </View>
            </View>
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
