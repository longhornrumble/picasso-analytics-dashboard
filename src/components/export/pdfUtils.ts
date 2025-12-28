/**
 * PDF Export Utilities
 * Functions for generating and downloading PDF reports
 */

import { pdf } from '@react-pdf/renderer';
import { ConversationsPDF } from './ConversationsPDF';
import { FormsPDF } from './FormsPDF';
import type {
  ConversationSummaryMetrics,
  TopQuestion,
  HeatmapRow,
  HeatmapPeak,
  ConversationTrendPoint,
} from '../../types/analytics';

interface ConversationsPDFData {
  summary: ConversationSummaryMetrics;
  topQuestions: TopQuestion[];
  heatmap: HeatmapRow[];
  peak: HeatmapPeak | null;
  trend: ConversationTrendPoint[];
  timeRange: string;
  tenantName?: string;
}

/**
 * Generate a Conversations Dashboard PDF and trigger download
 */
export async function generateConversationsPDF(data: ConversationsPDFData): Promise<void> {
  // Create the PDF document
  const doc = ConversationsPDF(data);

  // Generate the blob
  const blob = await pdf(doc).toBlob();

  // Create download link
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;

  // Generate filename: conversations_summary_{tenant}_{range}_{date}.pdf
  const date = new Date().toISOString().split('T')[0];
  const tenantSlug = (data.tenantName || 'dashboard').toLowerCase().replace(/\s+/g, '-');
  a.download = `conversations_summary_${tenantSlug}_${data.timeRange}_${date}.pdf`;

  // Trigger download
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // Clean up
  URL.revokeObjectURL(url);
}

// Forms PDF types
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

interface FormsPDFData {
  metrics: FormMetrics;
  bottlenecks: Bottleneck[];
  topForms: TopForm[];
  timeRange: string;
  tenantName?: string;
}

/**
 * Generate a Forms Dashboard PDF and trigger download
 */
export async function generateFormsPDF(data: FormsPDFData): Promise<void> {
  // Create the PDF document
  const doc = FormsPDF(data);

  // Generate the blob
  const blob = await pdf(doc).toBlob();

  // Create download link
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;

  // Generate filename: forms_summary_{tenant}_{range}_{date}.pdf
  const date = new Date().toISOString().split('T')[0];
  const tenantSlug = (data.tenantName || 'dashboard').toLowerCase().replace(/\s+/g, '-');
  a.download = `forms_summary_${tenantSlug}_${data.timeRange}_${date}.pdf`;

  // Trigger download
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // Clean up
  URL.revokeObjectURL(url);
}
