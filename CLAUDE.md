# Picasso Analytics Dashboard

Standalone analytics dashboard for Picasso AI Chat Widget form submissions and user engagement metrics.

## Quick Start

```bash
npm install
npm run dev     # Development server at localhost:5173
npm run build   # Production build
npm run preview # Preview production build
```

## Architecture

### Tech Stack
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Analytics Dashboard API** - Backend (Lambda Function URL)

### Project Structure

```
src/
├── components/           # Reusable UI components
│   ├── StatCard.tsx         # Metric display card
│   ├── ConversionFunnel.tsx # Funnel visualization
│   ├── FieldBottlenecks.tsx # Drop-off analysis
│   ├── TopPerformingForms.tsx # Form performance cards
│   ├── RecentSubmissions.tsx  # Submissions table
│   └── DashboardHeader.tsx    # Header with filters
├── context/
│   └── AuthContext.tsx   # Authentication state & Bubble SSO
├── hooks/                # Custom React hooks
├── pages/
│   ├── Dashboard.tsx     # Main dashboard view
│   └── Login.tsx         # Authentication page
├── services/
│   └── analyticsApi.ts   # API client for Analytics Lambda
├── types/
│   └── analytics.ts      # TypeScript type definitions
└── App.tsx               # Application entry point
```

## Authentication

### Bubble SSO Integration

The dashboard integrates with Bubble for single sign-on:

1. User clicks "Sign in with MyRecruiter"
2. Redirect to Bubble auth URL (configured via `VITE_BUBBLE_AUTH_URL`)
3. Bubble authenticates and redirects back with `?token=JWT`
4. Dashboard extracts JWT and stores in localStorage
5. All API calls include JWT in Authorization header

### JWT Token Structure

```json
{
  "tenant_id": "FOS402334",
  "tenant_hash": "fo85e6a06dcdf4",
  "email": "user@example.com",
  "exp": 1735084800
}
```

### Manual Token Entry (Development)

For testing, use the "Enter Token Manually" option on the login page.

## API Integration

The dashboard connects to `Analytics_Dashboard_API` Lambda:

| Endpoint | Description |
|----------|-------------|
| `GET /analytics/summary` | Overview metrics |
| `GET /analytics/sessions` | Session counts over time |
| `GET /analytics/events` | Event breakdown by type |
| `GET /analytics/funnel` | Conversion funnel data |

### Query Parameters
- `range`: Time range (`1d`, `7d`, `30d`, `90d`)
- `granularity`: For sessions (`day`, `week`, `month`)
- `type`: Filter events by type

## Environment Variables

Copy `.env.example` to `.env`:

```env
VITE_ANALYTICS_API_URL=https://your-lambda-url.lambda-url.us-east-1.on.aws
VITE_BUBBLE_AUTH_URL=https://your-bubble-app.bubbleapps.io/auth
VITE_DEV_MODE=false
```

## Development

### Commands

```bash
npm run dev        # Start dev server
npm run build      # Build for production
npm run preview    # Preview production build
npm run lint       # Run ESLint
npm run typecheck  # TypeScript type checking
```

### Adding New Components

1. Create component in `src/components/`
2. Export from `src/components/index.ts`
3. Add types to `src/types/analytics.ts`
4. Use in pages

## Deployment

### Build

```bash
npm run build
```

Output is in `dist/` directory.

### S3/CloudFront Deployment

```bash
aws s3 sync dist/ s3://picasso-analytics-dashboard/ --profile chris-admin
aws cloudfront create-invalidation --distribution-id XXXXX --paths "/*"
```

## Design Reference

The dashboard UI is based on the Form Analytics Overview mockup:

### Key UI Elements
- **Stats Cards**: Total Views, Completions, Avg Time, Abandon Rate
- **Conversion Funnel**: Horizontal bar chart with stages
- **Field Bottlenecks**: Red bars showing drop-off points
- **Top Forms**: Card grid with trend indicators
- **Recent Submissions**: Paginated table with search

### Color Palette
- Primary Green: `#10b981` (success metrics)
- Danger Red: `#ef4444` (abandons, errors)
- Background: `#f9fafb` (gray-50)
- Cards: `#ffffff` with subtle shadow

## Related Projects

- **Picasso Widget**: `/Picasso` - Chat widget frontend
- **Analytics Lambda**: `/Lambdas/lambda/Analytics_Dashboard_API` - Backend API
- **Event Processor**: `/Lambdas/lambda/Analytics_Event_Processor` - SQS → S3
