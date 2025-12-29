/**
 * TopQuestions Component
 * Premium Emerald Design System
 *
 * Displays ranked list of most frequently asked questions
 * with emerald progress bars and premium typography.
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
      <div className="card-analytical h-full">
        <div className="animate-pulse">
          <div className="h-6 bg-slate-200 rounded w-40 mb-6" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="mb-5">
              <div className="h-4 bg-slate-100 rounded w-full mb-2" />
              <div className="h-2 bg-slate-100 rounded w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="card-analytical h-full">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Top Five Questions</h3>
        <div className="flex items-center justify-center h-48 text-slate-400">
          No questions recorded yet
        </div>
      </div>
    );
  }

  return (
    <div className="card-analytical h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-slate-900">Top Five Questions</h3>
        <div className="text-right">
          <span className="text-2xl font-bold text-primary-500">
            {totalQuestions.toLocaleString()}
          </span>
          <span className="label-swiss text-slate-500 ml-2">Total</span>
        </div>
      </div>

      {/* Questions List */}
      <div className="space-y-5">
        {questions.map((question, index) => (
          <div key={index} className="group">
            {/* Question text */}
            <p className="text-sm text-slate-700 mb-2 line-clamp-2 leading-relaxed" title={question.question_text}>
              "{question.question_text}"
            </p>

            {/* Stats row */}
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-slate-500">
                <span className="font-semibold text-slate-700">{question.count}</span> times
              </span>
              <span className="font-semibold text-primary-500">
                {question.percentage.toFixed(1)}% of all questions
              </span>
            </div>

            {/* Progress bar - primary gradient */}
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${Math.min(question.percentage, 100)}%`,
                  background: 'linear-gradient(90deg, #34d399 0%, var(--color-primary-500) 100%)',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
