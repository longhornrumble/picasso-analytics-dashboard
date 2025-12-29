/**
 * Dashboard Page
 * Main analytics dashboard view
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { StatCard } from '../components/StatCard';
import { FieldBottlenecks } from '../components/FieldBottlenecks';
import { LeadWorkspaceDrawer } from '../components/lead-workspace';
import {
  Funnel,
  DataTable,
  BadgeCell,
  TruncatedCell,
  RankedCards,
  mapTrend,
  PageHeader,
  FilterDropdown,
  ExportDropdown,
  DateFilter,
  type Column,
  type TimeRangeValue,
  type ExportFormat,
  type DateRange,
  type DateFilterRange,
  type SortDirection,
} from '../components/shared';
import { generateFormsPDF } from '../components/export';
import Papa from 'papaparse';
import {
  fetchFormSummary,
  fetchBottlenecks,
  fetchSubmissions,
  fetchTopPerformers,
  exportFormSubmissionsData,
} from '../services/analyticsApi';
import type {
  FormSummaryMetrics,
  FormStats,
  FieldBottleneck,
  FormSubmission,
  FieldBottleneckAPI,
  FormSubmissionAPI,
  FormPerformerAPI,
  PipelineStatus,
} from '../types/analytics';

// Mock data for sections not yet supported by API
const mockForms: FormStats[] = [
  { id: '1', name: 'Volunteer Application', submissions: 185, conversionRate: 78.2, trend: 'trending' },
  { id: '2', name: 'Donation Request', submissions: 142, conversionRate: 64.5, trend: 'stable' },
  { id: '3', name: 'Event Registration', submissions: 98, conversionRate: 52.1, trend: 'low' },
  { id: '4', name: 'General Inquiry', submissions: 76, conversionRate: 45.8, trend: 'stable' },
  { id: '5', name: 'Supply Request', submissions: 20, conversionRate: 22.4, trend: 'low' },
];

const mockBottlenecks: FieldBottleneck[] = [
  { fieldName: 'Background Check', abandonRate: 38 },
  { fieldName: 'References', abandonRate: 25 },
  { fieldName: 'Address History', abandonRate: 18 },
  { fieldName: 'Age Verification', abandonRate: 12 },
  { fieldName: 'SMS Opt-in', abandonRate: 7 },
];

const mockSubmissions: FormSubmission[] = [
  { id: '1', name: 'Sarah Jenkins', email: 'sarah.j@email.com', phone: '(555) 123-4567', formType: 'Volunteer App', comments: 'I have 5 years of experience working with youth programs and would love to contribute to your mentorship initiative.', date: 'Dec 01', pipeline_status: 'new' },
  { id: '2', name: 'Michael Chen', email: 'm.chen@email.com', phone: '(555) 234-5678', formType: 'Donation Req', comments: 'Looking to donate office supplies and furniture from our company that is relocating. Can arrange pickup or delivery.', date: 'Dec 01', pipeline_status: 'reviewing' },
  { id: '3', name: 'Jessica Ford', email: 'jess.ford@email.com', phone: '(555) 345-6789', formType: 'Event Reg', comments: 'Dietary restriction: Please note I am vegetarian and allergic to nuts. Will need accommodation for the lunch portion.', date: 'Nov 30', pipeline_status: 'archived' },
  { id: '4', name: 'Robert Smith', email: 'rob.smith@email.com', phone: '(555) 456-7890', formType: 'General Inquiry', comments: 'What are your opening hours on weekends? I work during the week and can only visit on Saturdays or Sundays.', date: 'Nov 30', pipeline_status: 'contacted' },
  { id: '5', name: 'Emily Davis', email: 'emily.d@email.com', phone: '(555) 567-8901', formType: 'Volunteer App', comments: 'Interested in the mentorship program. I am a retired teacher with 30 years of experience in elementary education.', date: 'Nov 29', pipeline_status: 'archived' },
];

// Form-specific mock metrics (keyed by form ID, empty string = all forms)
const mockFormMetrics: Record<string, {
  views: number;
  started: number;
  completed: number;
  abandoned: number;
  completionRate: number;
  abandonRate: number;
  avgTime: number;
}> = {
  '': { views: 1240, started: 843, completed: 521, abandoned: 322, completionRate: 61.8, abandonRate: 38.2, avgTime: 134 },
  '1': { views: 320, started: 280, completed: 185, abandoned: 95, completionRate: 78.2, abandonRate: 21.8, avgTime: 95 },  // Volunteer Application
  '2': { views: 280, started: 220, completed: 142, abandoned: 78, completionRate: 64.5, abandonRate: 35.5, avgTime: 120 }, // Donation Request
  '3': { views: 240, started: 188, completed: 98, abandoned: 90, completionRate: 52.1, abandonRate: 47.9, avgTime: 145 },  // Event Registration
  '4': { views: 220, started: 166, completed: 76, abandoned: 90, completionRate: 45.8, abandonRate: 54.2, avgTime: 85 },   // General Inquiry
  '5': { views: 180, started: 89, completed: 20, abandoned: 69, completionRate: 22.4, abandonRate: 77.6, avgTime: 180 },   // Supply Request
};

// Form-specific mock bottlenecks
const mockFormBottlenecks: Record<string, FieldBottleneck[]> = {
  '': mockBottlenecks,
  '1': [
    { fieldName: 'Background Check', abandonRate: 42 },
    { fieldName: 'References (3 required)', abandonRate: 28 },
    { fieldName: 'Availability Schedule', abandonRate: 15 },
    { fieldName: 'Skills Assessment', abandonRate: 10 },
    { fieldName: 'Photo Upload', abandonRate: 5 },
  ],
  '2': [
    { fieldName: 'Payment Method', abandonRate: 35 },
    { fieldName: 'Recurring Options', abandonRate: 25 },
    { fieldName: 'Dedication Message', abandonRate: 20 },
    { fieldName: 'Tax Receipt Info', abandonRate: 12 },
    { fieldName: 'Newsletter Signup', abandonRate: 8 },
  ],
  '3': [
    { fieldName: 'Dietary Restrictions', abandonRate: 30 },
    { fieldName: 'Emergency Contact', abandonRate: 25 },
    { fieldName: 'T-Shirt Size', abandonRate: 22 },
    { fieldName: 'Accessibility Needs', abandonRate: 15 },
    { fieldName: 'Carpool Interest', abandonRate: 8 },
  ],
  '4': [
    { fieldName: 'Detailed Message', abandonRate: 45 },
    { fieldName: 'Category Selection', abandonRate: 25 },
    { fieldName: 'Preferred Contact', abandonRate: 18 },
    { fieldName: 'Best Time to Call', abandonRate: 8 },
    { fieldName: 'How Did You Hear', abandonRate: 4 },
  ],
  '5': [
    { fieldName: 'Item List (5+ items)', abandonRate: 55 },
    { fieldName: 'Delivery Address', abandonRate: 20 },
    { fieldName: 'Urgency Level', abandonRate: 12 },
    { fieldName: 'Organization Info', abandonRate: 8 },
    { fieldName: 'Follow-up Consent', abandonRate: 5 },
  ],
};

/**
 * MOCK DATA SWITCH (Demo Mode)
 * ============================
 * Mock data is ONLY shown when BOTH conditions are met:
 * 1. VITE_USE_MOCK_DATA=true (environment variable)
 * 2. Tenant ID is MYR384719 (demo tenant)
 *
 * This prevents mock data from accidentally appearing for real tenants.
 * Used only for sales demos and presentations.
 */
const DEMO_TENANT_ID = 'MYR384719';
const MOCK_DATA_ENV_ENABLED = import.meta.env.VITE_USE_MOCK_DATA === 'true';

/**
 * Check if mock data should be used for a given tenant
 * @param tenantId - The current tenant's ID
 * @returns true only if env var is enabled AND tenant is the demo tenant
 */
function shouldUseMockData(tenantId: string | undefined): boolean {
  return MOCK_DATA_ENV_ENABLED && tenantId === DEMO_TENANT_ID;
}

// Form type badge colors
const formTypeBadgeColors: Record<string, string> = {
  'Volunteer App': 'bg-blue-100 text-blue-700',
  'Donation Req': 'bg-green-100 text-green-700',
  'Event Reg': 'bg-purple-100 text-purple-700',
  'General Inquiry': 'bg-gray-100 text-gray-700',
  'Supply Request': 'bg-orange-100 text-orange-700',
};

// Column definitions for submissions table (function to allow filter callback)
const getSubmissionColumns = (onTypeClick?: (formType: string) => void): Column<FormSubmission>[] => [
  {
    key: 'date',
    header: 'Date',
    render: (row) => <span className="text-sm text-slate-700">{row.date}</span>,
    sortable: true,
    sortKey: 'date',
  },
  {
    key: 'name',
    header: 'Name',
    render: (row) => <span className="text-sm font-medium text-slate-700">{row.name}</span>,
    sortable: true,
    sortKey: 'name',
  },
  {
    key: 'email',
    header: 'Email',
    render: (row) => <span className="text-sm text-slate-700">{row.email}</span>,
  },
  {
    key: 'phone',
    header: 'Phone',
    render: (row) => <span className="text-sm text-slate-700">{row.phone || '—'}</span>,
  },
  {
    key: 'type',
    header: 'Type',
    render: (row) => (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onTypeClick?.(row.formType);
        }}
        className="cursor-pointer hover:opacity-80 transition-opacity"
        title={`Filter by ${row.formType}`}
      >
        <BadgeCell value={row.formType} colorMap={formTypeBadgeColors} />
      </button>
    ),
    sortable: true,
    sortKey: 'formType',
  },
  {
    key: 'comments',
    header: 'Comments',
    render: (row) => <TruncatedCell text={row.comments} maxWidth="150px" />,
  },
];

export function Dashboard() {
  const { user } = useAuth();

  // Mock data is ONLY enabled for demo tenant MYR384719
  const useMockData = shouldUseMockData(user?.tenant_id);

  // State
  const [timeRange, setTimeRange] = useState<TimeRangeValue>('7d');
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [selectedForm, setSelectedForm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null);
  const [exportToast, setExportToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Handle time range change - clear custom date range when switching to preset
  const handleTimeRangeChange = (range: TimeRangeValue) => {
    setTimeRange(range);
    if (range !== 'custom') {
      setDateRange(null);
    }
  };

  // Data state - formMetrics for form-specific stats
  const [formMetrics, setFormMetrics] = useState<FormSummaryMetrics | null>(null);

  // Forms-specific data state
  const [bottlenecks, setBottlenecks] = useState<FieldBottleneckAPI[]>([]);
  const [_totalAbandons, setTotalAbandons] = useState(0);
  const [topForms, setTopForms] = useState<FormPerformerAPI[]>([]);
  const [totalCompletions, setTotalCompletions] = useState(0);
  const [submissions, setSubmissions] = useState<FormSubmissionAPI[]>([]);
  const [submissionsTotalCount, setSubmissionsTotalCount] = useState(0);
  const [avgCompletionTime, setAvgCompletionTime] = useState(0);

  // Pagination, search, and table filter for submissions
  const [page, setPage] = useState(1);
  const pageSize = 5;
  const [searchQuery, setSearchQuery] = useState('');
  const [tableFormTypeFilter, setTableFormTypeFilter] = useState<string | null>(null);
  const [tableDateFilter, setTableDateFilter] = useState<DateFilterRange>({ value: 'all' });
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  // Lead Workspace Drawer state
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Archive Vault view state (per PRD: Emerald Lead Reactivation Engine)
  const [isArchiveView, setIsArchiveView] = useState(false);

  // Mock submission status overrides (for archive/reactivate state sync)
  const [mockStatusOverrides, setMockStatusOverrides] = useState<Record<string, PipelineStatus>>({});

  // Handle status change from drawer (archive/reactivate)
  const handleLeadStatusChange = useCallback((leadId: string, newStatus: PipelineStatus) => {
    setMockStatusOverrides((prev) => ({ ...prev, [leadId]: newStatus }));
  }, []);

  // Drawer handlers
  const openDrawer = useCallback((leadId: string) => {
    setSelectedLeadId(leadId);
    setIsDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setIsDrawerOpen(false);
    // Delay clearing the leadId to allow close animation
    setTimeout(() => setSelectedLeadId(null), 300);
  }, []);

  // Navigate to next lead in queue (for mock data, cycle through IDs)
  const goToNextLead = useCallback(() => {
    if (!selectedLeadId) return;
    // For mock IDs (1-5), cycle to next
    const mockIds = ['1', '2', '3', '4', '5'];
    const currentIndex = mockIds.indexOf(selectedLeadId);
    if (currentIndex !== -1) {
      const nextIndex = (currentIndex + 1) % mockIds.length;
      setSelectedLeadId(mockIds[nextIndex]);
    }
    // For real IDs, the drawer handles navigation via API queue
  }, [selectedLeadId]);

  // Fetch data (falls back to mock in dev mode)
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    // Build date range options for custom range
    const dateRangeOptions = timeRange === 'custom' && dateRange ? {
      startDate: dateRange.startDate.toISOString().split('T')[0],
      endDate: dateRange.endDate.toISOString().split('T')[0],
    } : undefined;

    try {
      const [formSummaryData, bottlenecksData, topPerformersData, submissionsData] = await Promise.all([
        fetchFormSummary(timeRange, selectedForm || undefined, dateRangeOptions),
        fetchBottlenecks(timeRange, selectedForm || undefined, 5, dateRangeOptions),
        fetchTopPerformers(timeRange, 5, 'conversion_rate', dateRangeOptions),
        fetchSubmissions(timeRange, page, pageSize, selectedForm || undefined, undefined, dateRangeOptions),
      ]);

      setFormMetrics(formSummaryData.metrics);

      // Set forms-specific data
      setBottlenecks(bottlenecksData.bottlenecks);
      setTotalAbandons(bottlenecksData.total_abandonments);
      setTopForms(topPerformersData.forms);
      setTotalCompletions(topPerformersData.total_completions);
      setSubmissions(submissionsData.submissions);
      setSubmissionsTotalCount(submissionsData.pagination.total_count);

      // Calculate average completion time from top performers
      if (topPerformersData.forms.length > 0) {
        const totalTime = topPerformersData.forms.reduce((acc, f) => acc + f.avg_completion_time_seconds, 0);
        setAvgCompletionTime(Math.round(totalTime / topPerformersData.forms.length));
      }
    } catch (err) {
      console.error('Dashboard data load error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, [timeRange, dateRange, selectedForm, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Show toast notification
  const showToast = (type: 'success' | 'error', message: string) => {
    setExportToast({ type, message });
    setTimeout(() => setExportToast(null), 4000);
  };

  // Export handler
  const handleExport = async (format: ExportFormat) => {
    setIsExporting(true);
    setExportingFormat(format);
    try {
      if (format === 'csv') {
        // CSV export - form submissions from Recent Submissions table
        let blob: Blob;

        if (useMockData) {
          // Use mock data for CSV export
          const csvData = mockSubmissions.map(s => ({
            'Submission ID': s.id,
            'Name': s.name,
            'Email': s.email,
            'Form': s.formType,
            'Comments': s.comments,
            'Submitted Date': s.date,
          }));
          const csv = Papa.unparse(csvData, { header: true, quotes: true });
          const BOM = '\uFEFF';
          blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8' });
        } else {
          // Use live API data
          blob = await exportFormSubmissionsData(timeRange, selectedForm || undefined);
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `form-submissions-${timeRange}-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('success', 'Form submissions exported as CSV');
      } else if (format === 'pdf') {
        // PDF export - summary report
        const pdfMetrics = useMockData ? {
          form_views: currentMockMetrics.views,
          forms_started: currentMockMetrics.started,
          forms_completed: currentMockMetrics.completed,
          forms_abandoned: currentMockMetrics.abandoned,
          completion_rate: currentMockMetrics.completionRate,
          abandon_rate: currentMockMetrics.abandonRate,
          avg_completion_time_seconds: currentMockMetrics.avgTime,
        } : formMetrics;

        const pdfBottlenecks = useMockData ? currentMockBottlenecks : bottlenecks.map(b => ({
          fieldName: b.field_label || b.field_id,
          abandonRate: b.abandon_percentage,
        }));

        const pdfTopForms = useMockData ? mockForms : topForms.map(f => ({
          id: f.form_id,
          name: f.form_label || f.form_id,
          submissions: f.completions,
          conversionRate: f.conversion_rate,
          trend: f.trend,
        }));

        if (pdfMetrics) {
          await generateFormsPDF({
            metrics: pdfMetrics,
            bottlenecks: pdfBottlenecks,
            topForms: pdfTopForms,
            timeRange,
            tenantName: 'MyRecruiter',
          });
          showToast('success', 'Forms report exported as PDF');
        } else {
          showToast('error', 'No data available to export');
        }
      }
    } catch (err) {
      console.error('Export error:', err);
      showToast('error', 'Export failed. Please try again.');
    } finally {
      setIsExporting(false);
      setExportingFormat(null);
    }
  };

  // Format time for display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  // Calculate derived metrics - use form-specific mock values in demo mode, otherwise use formMetrics
  const currentMockMetrics = mockFormMetrics[selectedForm] || mockFormMetrics[''];
  const totalViews = useMockData ? currentMockMetrics.views : (formMetrics?.form_views || 0);
  const formsCompleted = useMockData ? currentMockMetrics.completed : (formMetrics?.forms_completed || 0);
  const formsStarted = useMockData ? currentMockMetrics.started : (formMetrics?.forms_started || 0);
  const formsAbandoned = useMockData ? currentMockMetrics.abandoned : (formMetrics?.forms_abandoned || 0);
  const completionRate = useMockData ? currentMockMetrics.completionRate : (formMetrics?.completion_rate || 0);
  const abandonRate = useMockData ? currentMockMetrics.abandonRate : (formMetrics?.abandon_rate || 0);
  const displayAvgCompletionTime = useMockData ? currentMockMetrics.avgTime : (formMetrics?.avg_completion_time_seconds || avgCompletionTime || 0);

  // Get form-specific bottlenecks for mock data
  const currentMockBottlenecks = mockFormBottlenecks[selectedForm] || mockFormBottlenecks[''];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div
            className="w-12 h-12 rounded-full animate-spin mx-auto mb-4"
            style={{
              border: '4px solid rgba(80, 200, 120, 0.2)',
              borderTopColor: '#50C878',
            }}
          />
          <p className="text-slate-500 font-medium">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-2xl shadow-sm max-w-md border border-slate-100">
          <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">Failed to load data</h2>
          <p className="text-slate-500 mb-4">{error}</p>
          <button
            onClick={loadData}
            className="px-5 py-2.5 text-white rounded-xl font-semibold transition-all duration-200 hover:opacity-90"
            style={{ backgroundColor: '#50C878' }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Export Toast Notification */}
      {exportToast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg transition-all duration-300 ${
            exportToast.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {exportToast.type === 'success' ? (
            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          <span className="text-sm font-medium">{exportToast.message}</span>
          <button
            onClick={() => setExportToast(null)}
            className="ml-2 text-gray-400 hover:text-gray-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <PageHeader
          sectionLabel="ENTERPRISE INTELLIGENCE"
          title="Form Performance"
          timeRange={timeRange}
          onTimeRangeChange={handleTimeRangeChange}
          showExport={false}
          showDatePicker={true}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          filters={
            <FilterDropdown
              value={selectedForm}
              onChange={setSelectedForm}
              options={useMockData
                ? mockForms.map(f => ({ id: f.id, name: f.name }))
                : topForms.map(f => ({ id: f.form_id, name: f.form_label || f.form_id }))}
              placeholder="All Forms"
            />
          }
          actions={
            <ExportDropdown
              onExport={handleExport}
              isExporting={isExporting}
              exportingFormat={exportingFormat}
            />
          }
        />

        {/* Stats Cards - Hero Tier */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Form Views"
            value={totalViews.toLocaleString()}
            subtitle={`${formsStarted} forms started`}
            tier="hero"
          />
          <StatCard
            title="Total Completions"
            value={formsCompleted.toLocaleString()}
            subtitle={`${completionRate.toFixed(1)}% Completion Rate`}
            variant="success"
            tier="hero"
          />
          <StatCard
            title="Avg. Completion Time"
            value={formatTime(displayAvgCompletionTime)}
            subtitle="From start to submit"
            tier="hero"
          />
          <StatCard
            title="Abandon Rate"
            value={`${abandonRate.toFixed(1)}%`}
            subtitle={`${formsAbandoned} Abandoned`}
            variant="danger"
            tier="hero"
          />
        </div>

        {/* Funnel and Bottlenecks */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Funnel
            title="Form Conversion Funnel"
            stages={[
              { name: 'FORM_VIEWED', count: totalViews, displayName: 'Form Views' },
              { name: 'FORM_STARTED', count: formsStarted, displayName: 'Started' },
              { name: 'FORM_COMPLETED', count: formsCompleted, displayName: 'Completed' },
            ]}
            rate={completionRate}
            rateLabel="Completion Rate"
            stats={[
              { label: 'Total Views', value: totalViews },
              { label: 'Abandoned', value: formsAbandoned, variant: 'danger' },
              { label: 'Completed', value: formsCompleted, variant: 'success' },
            ]}
          />
          <FieldBottlenecks
            bottlenecks={useMockData ? currentMockBottlenecks : bottlenecks.map(b => ({
              fieldName: b.field_label || b.field_id,
              abandonRate: b.abandon_percentage,
              insight: b.insight,
              recommendation: b.recommendation,
            }))}
            totalAbandons={formsAbandoned}
          />
        </div>

        {/* Top Performing Forms */}
        <div className="mb-8">
          <RankedCards
            title="Top Performing Forms"
            summaryValue={useMockData ? 521 : totalCompletions}
            summaryLabel="Total Submissions"
            items={useMockData ? mockForms.map(f => ({
              id: f.id,
              name: f.name,
              primaryValue: `${f.conversionRate}%`,
              primaryLabel: 'Conv.',
              secondaryValue: f.submissions,
              secondaryLabel: 'submissions',
              trend: mapTrend(f.trend),
            })) : topForms.map(f => ({
              id: f.form_id,
              name: f.form_label || f.form_id,
              primaryValue: `${f.conversion_rate}%`,
              primaryLabel: 'Conv.',
              secondaryValue: f.completions,
              secondaryLabel: 'submissions',
              trend: mapTrend(f.trend),
            }))}
            onViewAll={() => console.log('View all forms')}
            viewAllLabel="View All Forms"
            viewAllSublabel={`${useMockData ? 5 : topForms.length} active forms`}
          />
        </div>

        {/* Active Workspace / Archive Vault (per PRD: Emerald Lead Reactivation Engine) */}
        <DataTable<FormSubmission>
          title={isArchiveView ? "Archive Vault" : "Active Workspace"}
          subtitle={
            <span className={isArchiveView ? "text-slate-500" : ""}>
              {isArchiveView
                ? "Reviewing deactivated records"
                : "Live interaction pipeline"
              }
              {tableFormTypeFilter && (
                <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-700">
                  Type: {tableFormTypeFilter}
                  <button
                    type="button"
                    onClick={() => setTableFormTypeFilter(null)}
                    className="ml-1 hover:text-primary-900"
                    title="Clear filter"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )}
            </span>
          }
          headerAction={
            <button
              type="button"
              onClick={() => {
                setIsArchiveView(!isArchiveView);
                setPage(1);
              }}
              className={`
                inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                transition-all duration-200
                ${isArchiveView
                  ? "bg-slate-800 text-white hover:bg-slate-700"
                  : "border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"
                }
              `}
            >
              {isArchiveView ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Exit Vault
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                  View Archive
                </>
              )}
            </button>
          }
          columns={getSubmissionColumns((formType) => {
            // Toggle filter: click same type to clear, different type to set
            setTableFormTypeFilter(prev => prev === formType ? null : formType);
            setPage(1);
          })}
          filterComponent={
            <DateFilter
              value={tableDateFilter}
              onChange={(range) => {
                setTableDateFilter(range);
                setPage(1);
              }}
            />
          }
          data={(() => {
            // Helper to check if date matches filter
            const matchesDateFilter = (dateStr: string): boolean => {
              if (tableDateFilter.value === 'all') return true;

              // Parse the date string (e.g., "Dec 01" or "2025-12-01")
              const today = new Date();
              today.setHours(0, 0, 0, 0);

              let rowDate: Date;
              if (dateStr.includes('-')) {
                // ISO format
                rowDate = new Date(dateStr);
              } else {
                // "Dec 01" format - assume current year
                const [month, day] = dateStr.split(' ');
                const monthIndex = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(month);
                rowDate = new Date(today.getFullYear(), monthIndex, parseInt(day));
              }
              rowDate.setHours(0, 0, 0, 0);

              switch (tableDateFilter.value) {
                case 'today':
                  return rowDate.getTime() === today.getTime();
                case '7d': {
                  const sevenDaysAgo = new Date(today);
                  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                  return rowDate >= sevenDaysAgo && rowDate <= today;
                }
                case '30d': {
                  const thirtyDaysAgo = new Date(today);
                  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                  return rowDate >= thirtyDaysAgo && rowDate <= today;
                }
                case 'custom':
                  if (tableDateFilter.startDate && tableDateFilter.endDate) {
                    const start = new Date(tableDateFilter.startDate);
                    start.setHours(0, 0, 0, 0);
                    const end = new Date(tableDateFilter.endDate);
                    end.setHours(23, 59, 59, 999);
                    return rowDate >= start && rowDate <= end;
                  }
                  return true;
                default:
                  return true;
              }
            };

            // Transform API data to FormSubmission format
            const transformedData: FormSubmission[] = useMockData
              ? mockSubmissions
              : submissions.map(s => ({
                  id: s.submission_id,
                  name: s.fields?.name || s.fields?.full_name || 'Anonymous',
                  email: s.fields?.email || '',
                  phone: s.fields?.phone || s.fields?.phone_number || '',
                  formType: s.form_label || s.form_id,
                  comments: s.fields?.comments || s.fields?.message || '',
                  date: s.submitted_date,
                }));

            // Apply archive filter (per PRD: Emerald Lead Reactivation Engine)
            // Archive Vault shows only archived leads; Active Workspace shows non-archived
            // Apply status overrides for mock data (from archive/reactivate actions)
            let filteredData = transformedData.filter(row => {
              const effectiveStatus = mockStatusOverrides[row.id] ?? row.pipeline_status;
              if (isArchiveView) {
                return effectiveStatus === 'archived';
              } else {
                return effectiveStatus !== 'archived';
              }
            });

            // Apply date filter
            filteredData = filteredData.filter(row => matchesDateFilter(row.date));

            // Apply type filter
            if (tableFormTypeFilter) {
              filteredData = filteredData.filter(row => row.formType === tableFormTypeFilter);
            }

            // Then apply search filter
            if (searchQuery.trim()) {
              const query = searchQuery.toLowerCase().trim();
              filteredData = filteredData.filter(row =>
                row.name.toLowerCase().includes(query) ||
                row.email.toLowerCase().includes(query) ||
                (row.phone && row.phone.toLowerCase().includes(query)) ||
                row.formType.toLowerCase().includes(query)
              );
            }

            // Apply sorting
            if (sortColumn && sortDirection) {
              filteredData = [...filteredData].sort((a, b) => {
                let aVal: string = '';
                let bVal: string = '';

                if (sortColumn === 'date') {
                  // Parse dates for comparison
                  const parseDate = (dateStr: string): Date => {
                    if (dateStr.includes('-')) return new Date(dateStr);
                    const [month, day] = dateStr.split(' ');
                    const monthIndex = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(month);
                    return new Date(new Date().getFullYear(), monthIndex, parseInt(day));
                  };
                  const aDate = parseDate(a.date);
                  const bDate = parseDate(b.date);
                  return sortDirection === 'asc'
                    ? aDate.getTime() - bDate.getTime()
                    : bDate.getTime() - aDate.getTime();
                }

                // String comparison for other fields
                if (sortColumn === 'name') {
                  aVal = a.name.toLowerCase();
                  bVal = b.name.toLowerCase();
                } else if (sortColumn === 'formType') {
                  aVal = a.formType.toLowerCase();
                  bVal = b.formType.toLowerCase();
                }

                if (sortDirection === 'asc') {
                  return aVal.localeCompare(bVal);
                } else {
                  return bVal.localeCompare(aVal);
                }
              });
            }

            return filteredData;
          })()}
          rowKey="id"
          totalCount={(() => {
            // Helper to check if date matches filter (duplicated for totalCount)
            const matchesDateFilter = (dateStr: string): boolean => {
              if (tableDateFilter.value === 'all') return true;

              const today = new Date();
              today.setHours(0, 0, 0, 0);

              let rowDate: Date;
              if (dateStr.includes('-')) {
                rowDate = new Date(dateStr);
              } else {
                const [month, day] = dateStr.split(' ');
                const monthIndex = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(month);
                rowDate = new Date(today.getFullYear(), monthIndex, parseInt(day));
              }
              rowDate.setHours(0, 0, 0, 0);

              switch (tableDateFilter.value) {
                case 'today':
                  return rowDate.getTime() === today.getTime();
                case '7d': {
                  const sevenDaysAgo = new Date(today);
                  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                  return rowDate >= sevenDaysAgo && rowDate <= today;
                }
                case '30d': {
                  const thirtyDaysAgo = new Date(today);
                  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                  return rowDate >= thirtyDaysAgo && rowDate <= today;
                }
                case 'custom':
                  if (tableDateFilter.startDate && tableDateFilter.endDate) {
                    const start = new Date(tableDateFilter.startDate);
                    start.setHours(0, 0, 0, 0);
                    const end = new Date(tableDateFilter.endDate);
                    end.setHours(23, 59, 59, 999);
                    return rowDate >= start && rowDate <= end;
                  }
                  return true;
                default:
                  return true;
              }
            };

            if (!useMockData) return submissionsTotalCount;

            let data = mockSubmissions;

            // Apply archive filter (per PRD: Emerald Lead Reactivation Engine)
            // Apply status overrides for mock data (from archive/reactivate actions)
            data = data.filter(row => {
              const effectiveStatus = mockStatusOverrides[row.id] ?? row.pipeline_status;
              if (isArchiveView) {
                return effectiveStatus === 'archived';
              } else {
                return effectiveStatus !== 'archived';
              }
            });

            // Apply date filter
            data = data.filter(row => matchesDateFilter(row.date));

            // Apply type filter
            if (tableFormTypeFilter) {
              data = data.filter(row => row.formType === tableFormTypeFilter);
            }

            // Apply search filter
            if (searchQuery.trim()) {
              const query = searchQuery.toLowerCase();
              data = data.filter(row =>
                row.name.toLowerCase().includes(query) ||
                row.email.toLowerCase().includes(query) ||
                (row.phone && row.phone.toLowerCase().includes(query)) ||
                row.formType.toLowerCase().includes(query)
              );
            }

            return data.length;
          })()}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onSearch={(query) => {
            setSearchQuery(query);
            setPage(1); // Reset to first page when searching
          }}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={(column, direction) => {
            setSortColumn(direction ? column : null);
            setSortDirection(direction);
          }}
          reorderable
          isArchiveView={isArchiveView}
          renderActions={(row) => (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openDrawer(row.id);
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors duration-150"
              title="Open lead workspace"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
          )}
        />

        {/* Footer */}
        <footer className="mt-12 py-6 border-t border-slate-100 flex items-center justify-center gap-2">
          <span className="text-sm text-slate-400">Mission Intelligence Platform powered by</span>
          <img src="/myrecruiter-logo.png" alt="MyRecruiter" className="h-6 w-auto" />
        </footer>
      </div>

      {/* Lead Workspace Drawer */}
      <LeadWorkspaceDrawer
        leadId={selectedLeadId}
        isOpen={isDrawerOpen}
        onClose={closeDrawer}
        onNext={goToNextLead}
        onStatusChange={handleLeadStatusChange}
        effectivePipelineStatus={selectedLeadId ? mockStatusOverrides[selectedLeadId] : undefined}
      />
    </div>
  );
}
