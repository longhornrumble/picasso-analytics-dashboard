/**
 * StatCard Component
 * Displays a single metric card with value and description
 */


interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    label: string;
  };
  variant?: 'default' | 'success' | 'danger' | 'primary' | 'info';
}

export function StatCard({
  title,
  value,
  subtitle,
  trend,
  variant = 'default',
}: StatCardProps) {
  const valueColorClass = {
    default: 'text-gray-900',
    success: 'text-primary-500',
    danger: 'text-danger-500',
    primary: 'text-primary-600',
    info: 'text-info-500',
  }[variant];

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <div className="text-center">
        <p className={`text-4xl font-bold ${valueColorClass}`}>
          {value}
        </p>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-2">
          {title}
        </p>
        {subtitle && (
          <p className="text-xs text-gray-400 mt-1">
            {subtitle}
          </p>
        )}
        {trend && (
          <p className={`text-xs mt-1 ${trend.value >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
          </p>
        )}
      </div>
    </div>
  );
}
