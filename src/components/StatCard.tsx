/**
 * StatCard Component
 * Premium Emerald Design System
 *
 * Displays a centered metric card with:
 * - Large emerald-colored hero value (5xl)
 * - Aviation-style uppercase label (text-[10px], font-black, tracking-[0.2em])
 * - Subtle subtitle in slate-400
 * - Super-ellipse border radius (40px)
 * - Micro-shadow with hover lift effect
 */

interface StatCardProps {
  /** Aviation-style label (uppercase, wide tracking) */
  title: string;
  /** Large hero value */
  value: string | number;
  /** Subtle gray subtitle */
  subtitle?: string;
  /** Trend indicator with percentage */
  trend?: {
    value: number;
    label: string;
  };
  /** @deprecated - All hero cards now use emerald. Kept for backward compatibility. */
  variant?: 'default' | 'success' | 'danger' | 'primary' | 'info';
  /** Visual hierarchy tier - hero for primary KPIs, standard for secondary */
  tier?: 'hero' | 'standard';
}

export function StatCard({
  title,
  value,
  subtitle,
  trend,
  tier = 'standard',
}: StatCardProps) {
  // Hero tier uses premium emerald design, standard uses neutral
  const isHero = tier === 'hero';

  return (
    <div className={`group ${isHero ? 'card-hero' : 'card-analytical'}`}>
      {/* Hero Value - Large Emerald Number with hover scale */}
      <p
        className={`
          transition-transform duration-300 ease-out group-hover:scale-105
          ${isHero
            ? 'text-5xl font-extrabold leading-none text-primary-500'
            : 'text-3xl font-bold text-slate-900'
          }
        `}
      >
        {value}
      </p>

      {/* Aviation-Style Label */}
      <p
        className={
          isHero
            ? 'text-[10px] font-black uppercase text-slate-700 mt-4'
            : 'text-xs font-semibold text-slate-500 uppercase tracking-wider mt-2'
        }
        style={isHero ? { letterSpacing: '0.2em' } : undefined}
      >
        {title}
      </p>

      {/* Subtitle */}
      {subtitle && (
        <p className="text-sm text-slate-400 mt-1">
          {subtitle}
        </p>
      )}

      {/* Trend indicator */}
      {trend && (
        <p
          className={`text-xs mt-2 font-semibold ${
            trend.value >= 0 ? 'text-primary-600' : 'text-danger-500'
          }`}
        >
          {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
        </p>
      )}
    </div>
  );
}
