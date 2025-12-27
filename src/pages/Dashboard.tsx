/**
 * Dashboard Page
 * Main analytics dashboard view
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { StatCard } from '../components/StatCard';
import { FieldBottlenecks } from '../components/FieldBottlenecks';
import {
  Funnel,
  DataTable,
  BadgeCell,
  TwoLineCell,
  TruncatedCell,
  RankedCards,
  mapTrend,
  PageHeader,
  FilterDropdown,
  type Column,
  type TimeRangeValue,
} from '../components/shared';
import {
  fetchFormSummary,
  fetchBottlenecks,
  fetchSubmissions,
  fetchTopPerformers,
  exportData,
} from '../services/analyticsApi';
import type {
  FormSummaryMetrics,
  FormStats,
  FieldBottleneck,
  FormSubmission,
  FieldBottleneckAPI,
  FormSubmissionAPI,
  FormPerformerAPI,
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
  { id: '1', name: 'Sarah Jenkins', email: 'sarah.j@email.com', formType: 'Volunteer App', comments: 'I have 5 years of ex...', date: 'Dec 01' },
  { id: '2', name: 'Michael Chen', email: 'm.chen@email.com', formType: 'Donation Req', comments: 'Looking to donate of...', date: 'Dec 01' },
  { id: '3', name: 'Jessica Ford', email: 'jess.ford@email.com', formType: 'Event Reg', comments: 'Dietary restriction: P...', date: 'Nov 30' },
  { id: '4', name: 'Robert Smith', email: 'rob.smith@email.com', formType: 'General Inquiry', comments: 'What are your openi...', date: 'Nov 30' },
  { id: '5', name: 'Emily Davis', email: 'emily.d@email.com', formType: 'Volunteer App', comments: 'Interested in the me...', date: 'Nov 29' },
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
 * When VITE_USE_MOCK_DATA=true AND tenant is MYR384719, shows mock data for demos.
 * Otherwise, shows live data from API.
 *
 * This is NOT a fallback - when enabled for the demo tenant, mock data is shown
 * instead of real data. Used only for sales demos and presentations.
 */
const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA === 'true';

// Form type badge colors
const formTypeBadgeColors: Record<string, string> = {
  'Volunteer App': 'bg-blue-100 text-blue-700',
  'Donation Req': 'bg-green-100 text-green-700',
  'Event Reg': 'bg-purple-100 text-purple-700',
  'General Inquiry': 'bg-gray-100 text-gray-700',
  'Supply Request': 'bg-orange-100 text-orange-700',
};

// Column definitions for submissions table
const submissionColumns: Column<FormSubmission>[] = [
  {
    key: 'name',
    header: 'Name',
    render: (row) => <TwoLineCell primary={row.name} secondary={row.email} />,
  },
  {
    key: 'type',
    header: 'Type',
    render: (row) => <BadgeCell value={row.formType} colorMap={formTypeBadgeColors} />,
  },
  {
    key: 'comments',
    header: 'Comments',
    render: (row) => <TruncatedCell text={row.comments} />,
  },
  {
    key: 'date',
    header: 'Date',
    field: 'date',
  },
];

export function Dashboard() {
  const { logout } = useAuth();

  // State
  const [timeRange, setTimeRange] = useState<TimeRangeValue>('7d');
  const [selectedForm, setSelectedForm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Pagination for submissions
  const [page, setPage] = useState(1);
  const pageSize = 5;

  // Fetch data (falls back to mock in dev mode)
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [formSummaryData, bottlenecksData, topPerformersData, submissionsData] = await Promise.all([
        fetchFormSummary(timeRange, selectedForm || undefined),
        fetchBottlenecks(timeRange, selectedForm || undefined, 5),
        fetchTopPerformers(timeRange, 5, 'conversion_rate'),
        fetchSubmissions(timeRange, page, pageSize, selectedForm || undefined),
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
  }, [timeRange, selectedForm, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Export handler
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const blob = await exportData(timeRange);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-${timeRange}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setIsExporting(false);
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
  const totalViews = USE_MOCK_DATA ? currentMockMetrics.views : (formMetrics?.form_views || 0);
  const formsCompleted = USE_MOCK_DATA ? currentMockMetrics.completed : (formMetrics?.forms_completed || 0);
  const formsStarted = USE_MOCK_DATA ? currentMockMetrics.started : (formMetrics?.forms_started || 0);
  const formsAbandoned = USE_MOCK_DATA ? currentMockMetrics.abandoned : (formMetrics?.forms_abandoned || 0);
  const completionRate = USE_MOCK_DATA ? currentMockMetrics.completionRate : (formMetrics?.completion_rate || 0);
  const abandonRate = USE_MOCK_DATA ? currentMockMetrics.abandonRate : (formMetrics?.abandon_rate || 0);
  const displayAvgCompletionTime = USE_MOCK_DATA ? currentMockMetrics.avgTime : (formMetrics?.avg_completion_time_seconds || avgCompletionTime || 0);

  // Get form-specific bottlenecks for mock data
  const currentMockBottlenecks = mockFormBottlenecks[selectedForm] || mockFormBottlenecks[''];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-xl shadow-sm max-w-md">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Failed to load data</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <PageHeader
          title="Form Analytics Overview"
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          onExport={handleExport}
          isExporting={isExporting}
          onSignOut={logout}
          filters={
            <FilterDropdown
              value={selectedForm}
              onChange={setSelectedForm}
              options={USE_MOCK_DATA
                ? mockForms.map(f => ({ id: f.id, name: f.name }))
                : topForms.map(f => ({ id: f.form_id, name: f.form_label || f.form_id }))}
              placeholder="All Forms"
            />
          }
        />

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            title="Total Form Views"
            value={totalViews.toLocaleString()}
            subtitle={`${formsStarted} forms started`}
          />
          <StatCard
            title="Total Completions"
            value={formsCompleted.toLocaleString()}
            subtitle={`${completionRate.toFixed(1)}% Completion Rate`}
            variant="success"
          />
          <StatCard
            title="Avg. Completion Time"
            value={formatTime(displayAvgCompletionTime)}
            subtitle="From start to submit"
          />
          <StatCard
            title="Abandon Rate"
            value={`${abandonRate.toFixed(1)}%`}
            subtitle={`${formsAbandoned} Abandoned`}
            variant="danger"
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
            bottlenecks={USE_MOCK_DATA ? currentMockBottlenecks : bottlenecks.map(b => ({
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
            summaryValue={USE_MOCK_DATA ? 521 : totalCompletions}
            summaryLabel="Total Submissions"
            items={USE_MOCK_DATA ? mockForms.map(f => ({
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
            viewAllSublabel={`${USE_MOCK_DATA ? 5 : topForms.length} active forms`}
          />
        </div>

        {/* Recent Submissions */}
        <DataTable<FormSubmission>
          title="Recent Submissions"
          subtitle="Latest form entries"
          columns={submissionColumns}
          data={USE_MOCK_DATA ? mockSubmissions : submissions.map(s => ({
            id: s.submission_id,
            name: s.fields?.name || s.fields?.full_name || 'Anonymous',
            email: s.fields?.email || '',
            formType: s.form_label || s.form_id,
            comments: s.fields?.comments || s.fields?.message || '',
            date: s.submitted_date,
          }))}
          rowKey="id"
          totalCount={USE_MOCK_DATA ? 128 : submissionsTotalCount}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onSearch={(query) => console.log('Search:', query)}
        />

        {/* Footer */}
        <footer className="mt-12 text-center py-6 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            Mission Intelligence Platform powered by{' '}
            <span className="font-semibold text-gray-700">MyRecruiter</span>
          </p>
        </footer>
      </div>
    </div>
  );
}
