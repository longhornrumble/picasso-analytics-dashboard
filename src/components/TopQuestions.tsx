/**
 * TopQuestions Component
 *
 * Displays ranked list of most frequently asked questions.
 * Shows question text, count, and percentage of total.
 *
 * Based on Bubble mockup showing top 5 questions with stats.
 */

import type { TopQuestion } from '../types/analytics';

interface TopQuestionsProps {
  /** List of top questions */
  questions: TopQuestion[];
  /** Total question count for header */
  totalQuestions: number;
  /** Loading state */
  loading?: boolean;
}

export function TopQuestions({
  questions,
  totalQuestions,
  loading = false,
}: TopQuestionsProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 h-full">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-40 mb-4" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="mb-4">
              <div className="h-4 bg-gray-200 rounded w-full mb-2" />
              <div className="h-3 bg-gray-100 rounded w-24" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 h-full">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Five Questions</h3>
        <div className="flex items-center justify-center h-48 text-gray-400">
          No questions recorded yet
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Top Five Questions</h3>
        <span className="text-sm text-gray-500">
          <span className="font-semibold text-gray-900">{totalQuestions.toLocaleString()}</span> Total
        </span>
      </div>

      {/* Questions List */}
      <div className="space-y-4">
        {questions.map((question, index) => (
          <div key={index} className="group">
            {/* Question text */}
            <p className="text-sm text-gray-900 mb-1 line-clamp-2" title={question.question_text}>
              "{question.question_text}"
            </p>

            {/* Stats row */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">
                <span className="font-medium text-gray-700">{question.count}</span> times
              </span>
              <span className="text-primary-600 font-medium">
                {question.percentage.toFixed(1)}% of all questions
              </span>
            </div>

            {/* Progress bar */}
            <div className="mt-1.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-500 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(question.percentage, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
