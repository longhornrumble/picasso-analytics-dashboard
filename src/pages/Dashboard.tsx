/**
 * Dashboard Page
 * Main analytics dashboard view
 */

import { useState, useEffect, useCallback } from 'react';
import { DashboardHeader } from '../components/DashboardHeader';
import { StatCard } from '../components/StatCard';
import { ConversionFunnel } from '../components/ConversionFunnel';
import { FieldBottlenecks } from '../components/FieldBottlenecks';
import { TopPerformingForms } from '../components/TopPerformingForms';
import { RecentSubmissions } from '../components/RecentSubmissions';
import {
  fetchSummary,
  fetchFunnel,
  exportData,
} from '../services/analyticsApi';
import type {
  TimeRange,
  SummaryMetrics,
  FunnelStage,
  FormStats,
  FieldBottleneck,
  FormSubmission,
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

export function Dashboard() {
  // State
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [selectedForm, setSelectedForm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data state
  const [metrics, setMetrics] = useState<SummaryMetrics | null>(null);
  const [funnelStages, setFunnelStages] = useState<FunnelStage[]>([]);
  const [conversionRate, setConversionRate] = useState(0);

  // Pagination for submissions
  const [page, setPage] = useState(1);
  const pageSize = 5;

  // Fetch data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [summaryData, funnelData] = await Promise.all([
        fetchSummary(timeRange),
        fetchFunnel(timeRange),
      ]);

      setMetrics(summaryData.metrics);
      setFunnelStages(funnelData.funnel);
      setConversionRate(funnelData.overall_conversion);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
      console.error('Dashboard data load error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [timeRange]);

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

  // Calculate derived metrics
  const totalViews = metrics?.widget_opens || 0;
  const formsCompleted = metrics?.forms_completed || 0;
  const formsStarted = metrics?.forms_started || 0;
  const abandoned = formsStarted - formsCompleted;
  const abandonRate = formsStarted > 0 ? ((abandoned / formsStarted) * 100).toFixed(1) : '0';
  const avgCompletionTime = 134; // Mock: 2m 14s in seconds

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
        <DashboardHeader
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          selectedForm={selectedForm}
          onFormChange={setSelectedForm}
          forms={mockForms.map(f => ({ id: f.id, name: f.name }))}
          onExport={handleExport}
          isExporting={isExporting}
        />

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            title="Total Form Views"
            value={totalViews.toLocaleString()}
            subtitle="Across all active forms"
          />
          <StatCard
            title="Total Completions"
            value={formsCompleted.toLocaleString()}
            subtitle={`${metrics?.conversion_rate || 0}% Completion Rate`}
            variant="success"
          />
          <StatCard
            title="Avg. Completion Time"
            value={formatTime(avgCompletionTime)}
            subtitle="From start to submit"
          />
          <StatCard
            title="Abandon Rate"
            value={`${abandonRate}%`}
            subtitle={`${abandoned} Incomplete starts`}
            variant="danger"
          />
        </div>

        {/* Funnel and Bottlenecks */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <ConversionFunnel
            stages={funnelStages}
            conversionRate={conversionRate}
            totalViews={totalViews}
            abandoned={abandoned}
            completed={formsCompleted}
          />
          <FieldBottlenecks
            bottlenecks={mockBottlenecks}
            totalAbandons={742}
          />
        </div>

        {/* Top Performing Forms */}
        <div className="mb-8">
          <TopPerformingForms
            forms={mockForms}
            totalSubmissions={521}
            totalActiveForms={12}
            onViewAll={() => console.log('View all forms')}
          />
        </div>

        {/* Recent Submissions */}
        <RecentSubmissions
          submissions={mockSubmissions}
          totalCount={128}
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
