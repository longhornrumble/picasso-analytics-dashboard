# Picasso Analytics Dashboard Style Guide

## Premium Emerald Design System

A world-class design system that balances Swiss-style neutrality with modern friendliness, creating an enterprise-grade analytics experience comparable to Intercom and HubSpot.

---

## 1. Brand Colors

### Primary: Emerald (#50C878)

The signature brand color used strategically throughout the interface.

```css
--emerald: #50C878;
--emerald-rgb: 80, 200, 120;
```

**Usage Rules:**
| Context | Use Emerald |
|---------|-------------|
| Positive KPIs | ✅ Completion rates, conversions, upward trends |
| Success states | ✅ Completed, Approved, Active |
| Primary CTAs | ✅ Main action buttons |
| Navigation active state | ✅ Selected tab indicator |
| Checkmarks | ✅ Success signifiers in lists |
| Decorative elements | ❌ Use neutral gray instead |
| Heatmaps | ❌ Use for intensity, not decoration |

### Supporting Palette

```css
/* Semantic Colors */
--slate-900: #0f172a;    /* Headlines, primary text */
--slate-700: #334155;    /* Body text, labels */
--slate-500: #64748b;    /* Secondary text, descriptions */
--slate-400: #94a3b8;    /* Meta labels, placeholders */
--slate-300: #cbd5e1;    /* Disabled states, subtle icons */
--slate-100: #f1f5f9;    /* Borders, dividers */
--slate-50:  #f8fafc;    /* Background tints */

/* Friction Spectrum (for bottlenecks/errors) */
--rose-100: #ffe4e6;     /* Low severity (< 15%) */
--rose-200: #fecdd3;     /* Moderate (15-25%) */
--rose-300: #fda4af;     /* High (25-40%) */
--rose-400: #fb7185;     /* Critical (> 40%) */
--rose-600: #e11d48;     /* Severe endpoint */

/* Premium Badge */
--amber-badge-bg: rgba(251, 191, 36, 0.12);
--amber-badge-text: #b45309;
```

---

## 2. Typography

### Font Family: Plus Jakarta Sans

A high-end geometric sans-serif that balances Swiss-style neutrality with modern friendliness.

```css
font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
```

### Type Scale

| Element | Class | Weight | Size | Tracking | Usage |
|---------|-------|--------|------|----------|-------|
| **Hero Headline** | `text-6xl font-black` | 900 | 60px | -0.03em | Premium lock pages |
| **Page Title** | `text-3xl font-bold` | 700 | 30px | normal | Dashboard headers |
| **Section Title** | `text-xl font-semibold` | 600 | 20px | normal | Card headers |
| **KPI Value** | `text-4xl font-bold` | 700 | 36px | -0.02em | StatCard numbers |
| **Body** | `text-base font-medium` | 500 | 16px | normal | General content |
| **Body Secondary** | `text-sm text-slate-500` | 400 | 14px | normal | Descriptions |
| **Aviation Label** | `text-[10px] font-black uppercase` | 900 | 10px | 0.2em | KPI labels |
| **Meta Label** | `text-[11px] font-black uppercase` | 900 | 11px | 0.3em | Section headers |

### Aviation-Style Labels

Used for KPI titles and section indicators. Mimics engineering blueprints and high-end technical reports.

```jsx
<p
  className="text-[10px] font-black uppercase text-slate-700"
  style={{ letterSpacing: '0.2em' }}
>
  TOTAL FORM VIEWS
</p>
```

---

## 3. Spacing System

Based on an 8px grid for consistent rhythm.

```css
--spacing-xs:  0.5rem;   /*  8px */
--spacing-sm:  1rem;     /* 16px */
--spacing-md:  1.5rem;   /* 24px */
--spacing-lg:  2rem;     /* 32px */
--spacing-xl:  3rem;     /* 48px */
--spacing-2xl: 4rem;     /* 64px */
```

| Context | Spacing |
|---------|---------|
| Between major sections | `mb-8` (32px) |
| Grid gaps (sections) | `gap-6` (24px) |
| Grid gaps (cards) | `gap-4` (16px) |
| Card padding | `p-6` (24px) |
| Card padding (hero) | `p-8` to `p-12` |
| Component internal | `space-y-4` (16px) |

---

## 4. Border Radius

### Super-Ellipse Geometry

Softer than standard corners, sharper than pills. Creates a "smooth-tech" aesthetic common in modern iOS and premium hardware.

```css
/* Standard Components */
--radius-sm:   0.5rem;   /*  8px - buttons, inputs */
--radius-md:   0.75rem;  /* 12px - small cards */
--radius-lg:   1rem;     /* 16px - standard cards */
--radius-xl:   1.5rem;   /* 24px - feature cards */
--radius-2xl:  2rem;     /* 32px - CTA buttons */
--radius-3xl:  2.5rem;   /* 40px - icon containers */
--radius-4xl:  4rem;     /* 64px - hero cards */
```

| Element | Radius |
|---------|--------|
| StatCards | `rounded-2xl` (16px) |
| Analytical cards | `rounded-xl` (12px) |
| Buttons (standard) | `rounded-lg` (8px) |
| CTA Buttons (premium) | `rounded-[2rem]` (32px) |
| Icon containers | `rounded-[2.5rem]` (40px) |
| Premium Lock card | `rounded-[4rem]` (64px) |
| Time range pills | `rounded-full` |

---

## 5. Elevation System

### Shadow Tiers

```css
/* Hero - Primary KPI cards */
--elevation-hero:
  0 4px 20px -2px rgb(0 0 0 / 0.08),
  0 2px 8px -2px rgb(0 0 0 / 0.04);

/* Analytical - Charts, tables */
--elevation-card:
  0 1px 3px 0 rgb(0 0 0 / 0.04),
  0 1px 2px -1px rgb(0 0 0 / 0.04);

/* Subtle - Utility components */
--elevation-subtle:
  0 1px 2px 0 rgb(0 0 0 / 0.02);

/* Premium - Sales pages */
--elevation-premium:
  0 25px 80px -20px rgba(0, 0, 0, 0.08),
  0 0 0 1px rgba(0, 0, 0, 0.02);

/* Colored Shadow (CTA buttons) */
--shadow-emerald-glow:
  0 20px 40px -10px rgba(80, 200, 120, 0.4),
  0 8px 16px -8px rgba(80, 200, 120, 0.3);
```

---

## 6. Component Patterns

### 6.1 StatCard (KPI Card)

Hero-tier cards displaying primary metrics.

```jsx
<div
  className="bg-white rounded-2xl p-6 text-center"
  style={{ boxShadow: 'var(--elevation-hero)' }}
>
  {/* Value - Large emerald number */}
  <p
    className="text-4xl font-bold mb-4"
    style={{ color: '#50C878', letterSpacing: '-0.02em' }}
  >
    1,240
  </p>

  {/* Aviation Label */}
  <p
    className="text-[10px] font-black uppercase text-slate-700"
    style={{ letterSpacing: '0.2em' }}
  >
    TOTAL FORM VIEWS
  </p>

  {/* Subtitle */}
  <p className="text-sm text-slate-400 mt-1">
    843 forms started
  </p>
</div>
```

### 6.2 Section Header

Aviation-style section indicators.

```jsx
<div className="flex items-center gap-2 mb-2">
  {/* Emerald indicator line */}
  <div
    className="w-4 h-0.5 rounded-full"
    style={{ backgroundColor: '#50C878' }}
  />

  {/* Meta label */}
  <span
    className="text-[10px] font-black uppercase"
    style={{ color: '#50C878', letterSpacing: '0.2em' }}
  >
    UNIFIED INSIGHTS
  </span>
</div>
```

### 6.3 Navigation Bar (Liquid Header)

Frosted glass effect with backdrop blur.

```jsx
<header
  className="sticky top-0 z-50 border-b border-slate-100"
  style={{
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
  }}
>
  {/* Content */}
</header>
```

### 6.4 Time Range Pills

```jsx
<button
  className={`
    px-4 py-2 text-sm font-semibold rounded-full
    transition-all duration-200
    ${isActive
      ? 'text-white'
      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
    }
  `}
  style={isActive ? { backgroundColor: '#50C878' } : undefined}
>
  7D
</button>
```

### 6.5 Funnel (Chromatic Gradient)

Progressive emerald gradient showing conversion flow.

```jsx
const gradientShades = [
  'linear-gradient(90deg, #6ee7b7 0%, #50C878 100%)',  // Stage 1 - Lightest
  'linear-gradient(90deg, #34d399 0%, #10b981 100%)',  // Stage 2 - Medium
  'linear-gradient(90deg, #10b981 0%, #059669 100%)',  // Stage 3 - Forest
];
```

### 6.6 Friction Spectrum (Bottlenecks)

Rose gradient indicating severity of drop-off.

```jsx
function getFrictionColor(abandonRate: number): string {
  if (abandonRate >= 40)
    return 'linear-gradient(90deg, #fb7185 0%, #e11d48 100%)'; // Critical
  if (abandonRate >= 25)
    return 'linear-gradient(90deg, #fda4af 0%, #fb7185 100%)'; // High
  if (abandonRate >= 15)
    return 'linear-gradient(90deg, #fecdd3 0%, #fda4af 100%)'; // Moderate
  return 'linear-gradient(90deg, #ffe4e6 0%, #fecdd3 100%)';   // Low
}
```

### 6.7 Heatmap (Engagement Density)

Peak cells receive emerald glow effect.

```jsx
style={{
  backgroundColor: colors.bg,
  boxShadow: isPeakCell ? '0 0 20px rgba(80, 200, 120, 0.4)' : undefined,
}}
```

---

## 7. Buttons

### Primary CTA

```jsx
<button
  className="
    inline-flex items-center justify-center
    px-8 py-3.5
    text-white font-semibold
    transition-all duration-200
    hover:scale-[1.03] active:scale-[0.97]
  "
  style={{
    borderRadius: '2rem',
    backgroundColor: '#50C878',
    boxShadow: '0 20px 40px -10px rgba(80, 200, 120, 0.4), 0 8px 16px -8px rgba(80, 200, 120, 0.3)',
  }}
>
  Contact Sales
</button>
```

### Secondary (Ghost) Button

```jsx
<button
  className="
    inline-flex items-center justify-center
    px-8 py-3.5
    border-2 border-slate-100
    text-slate-600 font-semibold
    hover:bg-slate-50 hover:border-slate-200
    transition-all duration-200
  "
  style={{ borderRadius: '2rem' }}
>
  Return Home
</button>
```

### Standard Button

```jsx
<button
  className="
    px-4 py-2
    text-xs font-semibold text-white
    rounded-lg
    transition-all duration-200
    hover:opacity-90
  "
  style={{ backgroundColor: '#1e293b' }}
>
  SIGN OUT
</button>
```

---

## 8. Motion & Animation

### Entrance Animations

```css
/* Page entrance - zoom + fade */
.animate-in {
  animation: animate-in 500ms ease-out;
}

@keyframes animate-in {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
```

### Micro-interactions

| Element | Interaction |
|---------|-------------|
| Primary CTA | `hover:scale-[1.03] active:scale-[0.97]` |
| Cards | `hover:shadow-lg transition-shadow duration-200` |
| Logo | `hover:scale-105 transition-all duration-300` |
| Heatmap cells | `hover:scale-110 transition-transform duration-200` |
| Table rows | `hover:bg-slate-50 transition-colors duration-150` |

### Transition Defaults

```css
transition-all duration-200  /* Standard */
transition-all duration-300  /* Emphasized */
transition-all duration-500  /* Page-level */
```

---

## 9. Scrollbar

Thin emerald scrollbar for premium feel.

```css
::-webkit-scrollbar {
  width: 4px;
  height: 4px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  border-radius: 9999px;
  background-color: rgba(80, 200, 120, 0.3);
}

::-webkit-scrollbar-thumb:hover {
  background-color: rgba(80, 200, 120, 0.5);
}
```

---

## 10. Premium Lock Page

The "aspirational destination" design for locked features.

### Key Elements

| Element | Specification |
|---------|---------------|
| Container | `max-w-[850px]`, `rounded-[4rem]` |
| Lock icon | 48px in `rounded-[2.5rem]` container, `text-slate-300` |
| Badge | `text-[11px] font-black uppercase`, `tracking-[0.3em]`, amber tint |
| Headline | `text-6xl font-black`, `tracking-[-0.03em]` |
| Body | `text-xl font-medium text-slate-500` |
| Benefits box | `bg-slate-50/40`, `backdrop-blur-sm` |
| Background | Emerald vortex: `blur(120px)` radial gradient |

### Background Vortex

```jsx
<div
  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
  style={{
    background: 'radial-gradient(circle, rgba(80, 200, 120, 0.15) 0%, transparent 70%)',
    filter: 'blur(120px)',
  }}
/>
```

---

## 11. Tables

### DataTable Styling

```jsx
{/* Header */}
<th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4">
  Column Name
</th>

{/* Rows - Zebra striping */}
<tr className="odd:bg-white even:bg-slate-50/70 hover:bg-slate-100/80 transition-colors duration-150">
  <td className="py-3 px-4 text-sm text-slate-700">
    Cell content
  </td>
</tr>

{/* Numeric columns */}
<td className="text-right tabular-nums">
  1,234
</td>
```

---

## 12. Footer

```jsx
<footer className="mt-12 py-6 border-t border-slate-100 flex items-center justify-center gap-2">
  <span className="text-sm text-slate-400">
    Mission Intelligence Platform powered by
  </span>
  <img
    src="/myrecruiter-logo.png"
    alt="MyRecruiter"
    className="h-6 w-auto"
  />
</footer>
```

---

## 13. Accessibility

- All interactive elements have visible focus states
- Color contrast meets WCAG AA standards
- Icons paired with text labels where possible
- Semantic HTML structure maintained
- Keyboard navigation supported

---

## 14. File Reference

| Component | File |
|-----------|------|
| Navigation | `src/App.tsx` |
| StatCard | `src/components/StatCard.tsx` |
| PageHeader | `src/components/shared/PageHeader.tsx` |
| Funnel | `src/components/shared/Funnel.tsx` |
| Heatmap | `src/components/ConversationHeatMap.tsx` |
| Bottlenecks | `src/components/FieldBottlenecks.tsx` |
| DataTable | `src/components/shared/DataTable.tsx` |
| TrendChart | `src/components/shared/TrendChart.tsx` |
| PremiumLock | `src/components/PremiumLock.tsx` |
| Global CSS | `src/index.css` |
| Tailwind Config | `tailwind.config.js` |

---

*Last updated: December 2024*
*Design System Version: 1.0 (Premium Emerald)*
