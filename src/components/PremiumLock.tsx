/**
 * PremiumLock Component
 * Premium Intelligence Sales Page
 *
 * Design Philosophy: An "aspirational destination" that transitions users
 * from active utility into a premium intelligence mindset.
 */

interface PremiumLockProps {
  feature: 'forms' | 'conversations' | 'attribution';
  onReturn: () => void;
}

const featureInfo: Record<string, { title: string; description: string; benefits: string[] }> = {
  forms: {
    title: 'Forms Analytics',
    description: 'Gain complete visibility into your form performance and optimize conversion at every step of the journey.',
    benefits: [
      'Real-time form completion tracking',
      'Field-level bottleneck analysis',
      'Conversion funnel visualization',
      'Abandonment pattern insights',
    ],
  },
  conversations: {
    title: 'Conversations Analytics',
    description: 'Understand how users interact with your AI assistant and optimize engagement across every touchpoint.',
    benefits: [
      'Conversation volume trends',
      'Peak activity time analysis',
      'Top questions & topics',
      'Response performance metrics',
    ],
  },
  attribution: {
    title: 'Attribution Analytics',
    description: 'Unify your multi-channel data to discover exactly which touchpoints drive high-value conversions.',
    benefits: [
      'Multi-touch lead source tracking',
      'Campaign ROI & effectiveness',
      'Path-to-purchase path mapping',
      'Optimized media spend allocation',
    ],
  },
};

export function PremiumLock({ feature, onReturn }: PremiumLockProps) {
  const info = featureInfo[feature];

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6 py-16 relative overflow-hidden">
      {/* Background "Vortex" - Atmospheric primary glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(80, 200, 120, 0.08) 0%, transparent 70%)',
          filter: 'blur(120px)',
        }}
      />

      {/* Main Container - animate-in fade-in zoom-in */}
      <div
        className="max-w-[850px] w-full relative animate-in fade-in zoom-in-95 duration-500"
      >
        {/* Master Card - Ultra-round cornering (64px) */}
        <div
          className="bg-white p-12 md:p-16 text-center relative"
          style={{
            borderRadius: '4rem',
            boxShadow: '0 25px 80px -20px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.02)',
          }}
        >
          {/* Lock Icon Container */}
          <div
            className="w-28 h-28 mx-auto mb-10 flex items-center justify-center"
            style={{
              borderRadius: '2.5rem',
              background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
              boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.03)',
            }}
          >
            {/* Lock Icon - size 48, soft slate-300, "waiting to be unlocked" */}
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              className="text-slate-300"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>

          {/* Premium Badge - Meta-label styling */}
          <span
            className="inline-flex items-center px-5 py-2 mb-8 font-black uppercase"
            style={{
              fontSize: '11px',
              letterSpacing: '0.3em',
              borderRadius: '2rem',
              backgroundColor: 'rgba(251, 191, 36, 0.12)',
              color: '#b45309',
            }}
          >
            Premium Intelligence
          </span>

          {/* Headline - text-6xl font-black tracking-tighter */}
          <h1
            className="text-5xl md:text-6xl font-black text-slate-900 mb-6"
            style={{ letterSpacing: '-0.03em' }}
          >
            {info.title}
          </h1>

          {/* Body Copy - text-xl font-medium slate-500 */}
          <p className="text-xl font-medium text-slate-500 mb-12 max-w-lg mx-auto leading-relaxed">
            {info.description}
          </p>

          {/* Benefits List Container - Sub-layer with backdrop blur */}
          <div
            className="mb-12 p-8 text-left max-w-md mx-auto"
            style={{
              borderRadius: '1.5rem',
              backgroundColor: 'rgba(248, 250, 252, 0.4)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
          >
            {/* Meta-Label - Blueprint styling */}
            <p
              className="font-black uppercase text-slate-400 mb-6"
              style={{
                fontSize: '11px',
                letterSpacing: '0.3em',
              }}
            >
              Strategic Capabilities
            </p>

            {/* Benefits List */}
            <ul className="space-y-4">
              {info.benefits.map((benefit, index) => (
                <li key={index} className="flex items-center gap-4">
                  {/* Checkmark in rounded-xl primary box - Success Signifier */}
                  <div
                    className="w-7 h-7 flex items-center justify-center flex-shrink-0"
                    style={{
                      borderRadius: '0.75rem',
                      backgroundColor: 'rgba(80, 200, 120, 0.08)',
                    }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--color-primary-500)"
                      strokeWidth={3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <span className="text-slate-700 font-medium text-[15px]">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* CTA Buttons - Super-Ellipse (32px radius) */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {/* Primary CTA - Colored shadow, scale micro-interaction */}
            <a
              href="mailto:sales@myrecruiter.ai?subject=Premium%20Dashboard%20Access"
              className="inline-flex items-center justify-center px-10 py-4 text-white font-semibold transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]"
              style={{
                borderRadius: '2rem',
                backgroundColor: 'var(--color-primary-500)',
                boxShadow: '0 20px 40px -10px rgba(80, 200, 120, 0.4), 0 8px 16px -8px rgba(80, 200, 120, 0.3)',
              }}
            >
              Contact Sales
            </a>

            {/* Secondary CTA - Ghost Button */}
            <button
              onClick={onReturn}
              className="inline-flex items-center justify-center px-10 py-4 border-2 border-slate-100 text-slate-600 font-semibold hover:bg-slate-50 hover:border-slate-200 transition-all duration-200"
              style={{ borderRadius: '2rem' }}
            >
              Return Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
