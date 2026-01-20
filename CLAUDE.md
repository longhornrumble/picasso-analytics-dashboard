# Picasso Analytics Dashboard

Standalone analytics dashboard for Picasso AI Chat Widget form submissions and user engagement metrics.

**Part of User Journey Analytics Initiative** - See [USER_JOURNEY_ANALYTICS_PLAN.md](/Picasso/docs/User_Journey/USER_JOURNEY_ANALYTICS_PLAN.md)

## Implementation Status

| Component | Status |
|-----------|--------|
| React scaffold | ✅ Complete |
| Shared styles integration | ✅ Complete |
| Login page | ✅ Complete |
| Forms Dashboard | ✅ Complete (live data) |
| Conversations Dashboard | ✅ Complete (live data) |
| API integration | ✅ Complete |
| Master mock data switch | ✅ Complete |
| Lead Workspace Drawer | ✅ Complete (Phase 8 polish) |
| Marketing Style Guide alignment | ✅ Complete |

## Production URL

**Live Dashboard**: https://d3r39xkfb0snuq.cloudfront.net

## Quick Start

```bash
npm install
npm run dev     # Development server at localhost:5173
npm run build   # Production build
npm run preview # Preview production build
```

## Authentication

### Generating a Valid JWT Token (Development)

For local development and testing, generate a valid JWT token using this Python script:

```bash
AWS_PROFILE=chris-admin python3 << 'EOF'
import json
import hmac
import hashlib
import base64
import time
import boto3

# Get signing key from Secrets Manager
secrets_client = boto3.client('secretsmanager', region_name='us-east-1')
secret = secrets_client.get_secret_value(SecretId='picasso/staging/jwt/signing-key')
secret_data = json.loads(secret['SecretString'])
signing_key = secret_data['signingKey']

# Create JWT payload - UPDATE THESE VALUES AS NEEDED
payload = {
    "tenant_id": "MYR384719",           # Tenant ID (e.g., MYR384719, AUS123957)
    "tenant_hash": "my87674d777bf9",    # Tenant hash for API queries
    "email": "chris@myrecruiter.ai",    # User email
    "exp": int(time.time()) + 3600      # Expires in 1 hour
}

# Create JWT manually with HMAC-SHA256
header = {"alg": "HS256", "typ": "JWT"}
header_b64 = base64.urlsafe_b64encode(json.dumps(header).encode()).rstrip(b'=').decode()
payload_b64 = base64.urlsafe_b64encode(json.dumps(payload).encode()).rstrip(b'=').decode()
message = f"{header_b64}.{payload_b64}"
signature = hmac.new(signing_key.encode(), message.encode(), hashlib.sha256).digest()
signature_b64 = base64.urlsafe_b64encode(signature).rstrip(b'=').decode()
token = f"{message}.{signature_b64}"

print(token)
EOF
```

### Available Tenants for Testing

| Tenant ID | Tenant Hash | Description |
|-----------|-------------|-------------|
| MYR384719 | my87674d777bf9 | MyRecruiter (default dev tenant) |
| AUS123957 | auc5b0ecb0adcb | Austin Angels |
| FOS402334 | fo85e6a06dcdf4 | Foster Village |

### Using the Token

1. Start the dev server: `npm run dev`
2. Navigate to `http://localhost:5173`
3. Click "Enter Token Manually" on the login page
4. Paste the generated JWT token
5. Click "Sign In"

### JWT Token Structure

```json
{
  "tenant_id": "MYR384719",
  "tenant_hash": "my87674d777bf9",
  "email": "user@example.com",
  "exp": 1735084800
}
```

### Bubble SSO Integration (Production)

In production, the dashboard integrates with Bubble for single sign-on:

1. User clicks "Sign in with MyRecruiter"
2. Redirect to Bubble auth URL (configured via `VITE_BUBBLE_AUTH_URL`)
3. Bubble authenticates and redirects back with `?token=JWT`
4. Dashboard extracts JWT and stores in localStorage
5. All API calls include JWT in Authorization header

## Environment Variables

```env
# Analytics API endpoint (Lambda Function URL)
VITE_ANALYTICS_API_URL=https://uniywvlgstv2ymc46uyqs3z3du0vucst.lambda-url.us-east-1.on.aws

# Bubble SSO authentication URL (leave empty for manual token entry)
VITE_BUBBLE_AUTH_URL=

# MASTER MOCK DATA SWITCH
# Set to 'true' to show mock data as fallback when API returns empty
# Set to 'false' (or omit) to only show live data from API
VITE_USE_MOCK_DATA=false

# Session Timeline Feature Flag
VITE_USE_SESSIONS_API=true
```

### Master Mock Data Switch

The `VITE_USE_MOCK_DATA` environment variable controls whether components show mock data as fallback:

| Value | Behavior |
|-------|----------|
| `true` | Components fall back to mock data when API returns empty |
| `false` | Components show empty states when no data available |

This affects:
- Recent Submissions table
- Top Performing Forms cards
- Field Bottlenecks display
- Form filter dropdown

## API Integration

The dashboard connects to `Analytics_Dashboard_API` Lambda:

### Forms API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /forms/summary` | Form metrics (views, completions, abandon rate) |
| `GET /forms/bottlenecks` | Field drop-off analysis |
| `GET /forms/top-performers` | Top forms by conversion rate |
| `GET /forms/submissions` | Recent form submissions with pagination |

### Conversations API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /conversations/summary` | Conversation metrics |
| `GET /conversations/heatmap` | Activity by day/hour |
| `GET /conversations/top-questions` | Most common first questions |
| `GET /conversations/recent` | Recent conversations list |
| `GET /conversations/trend` | Conversation volume over time |

### Query Parameters

- `range`: Time range (`1d`, `7d`, `30d`, `90d`)
- `page`: Page number for pagination (default: 1)
- `limit`: Items per page (default: 25, max: 100)
- `form_id`: Filter by specific form
- `search`: Search filter for submissions

### Testing API Directly

```bash
# Generate token first (see above), then:
TOKEN="your-jwt-token-here"

# Test forms summary
curl -s "https://uniywvlgstv2ymc46uyqs3z3du0vucst.lambda-url.us-east-1.on.aws/forms/summary?range=7d" \
  -H "Authorization: Bearer $TOKEN"

# Test submissions
curl -s "https://uniywvlgstv2ymc46uyqs3z3du0vucst.lambda-url.us-east-1.on.aws/forms/submissions?range=7d" \
  -H "Authorization: Bearer $TOKEN"

# Test conversations
curl -s "https://uniywvlgstv2ymc46uyqs3z3du0vucst.lambda-url.us-east-1.on.aws/conversations/summary?range=30d" \
  -H "Authorization: Bearer $TOKEN"
```

## Architecture

### Tech Stack
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS 3** - Styling (with shared preset)
- **@picasso/shared-styles** - Centralized design tokens
- **Analytics Dashboard API** - Backend (Lambda + DynamoDB + Athena)

### Project Structure

```
src/
├── components/           # Reusable UI components
│   ├── StatCard.tsx         # Metric display card
│   ├── FieldBottlenecks.tsx # Drop-off analysis
│   ├── lead-workspace/      # Lead Workspace Drawer components
│   │   ├── LeadWorkspaceDrawer.tsx  # Main drawer component
│   │   ├── DrawerHeader.tsx         # Header with lead name/ref
│   │   ├── TerminalActions.tsx      # Archive/Next Lead buttons
│   │   └── ...                      # Pipeline, notes, communications
│   └── shared/              # Shared UI components
│       ├── Funnel.tsx       # Conversion funnel
│       ├── DataTable.tsx    # Paginated table
│       ├── RankedCards.tsx  # Performance cards
│       └── PageHeader.tsx   # Header with filters
├── context/
│   └── AuthContext.tsx   # Authentication state & JWT handling
├── hooks/                # Custom React hooks
│   ├── useFocusTrap.ts      # Focus trap for modals/drawers (WCAG 2.4.3)
│   ├── useAnnounce.ts       # Screen reader announcements
│   └── useSwipeGesture.ts   # Touch gesture detection
├── pages/
│   ├── Dashboard.tsx     # Main dashboard (Forms + Conversations tabs)
│   └── Login.tsx         # Authentication page
├── services/
│   └── analyticsApi.ts   # API client for Analytics Lambda
├── types/
│   └── analytics.ts      # TypeScript type definitions
└── App.tsx               # Application entry point
```

### Data Flow

```
User Browser
    ↓
Dashboard (React + Vite)
    ↓
JWT Authentication (localStorage)
    ↓
Analytics Dashboard API (Lambda)
    ├─→ DynamoDB (hot path, <100ms)
    │   ├── picasso-session-summaries
    │   ├── picasso-session-events
    │   └── picasso_form_submissions
    └─→ Athena (fallback, 5-30s)
        └── picasso_analytics.events
```

## DynamoDB Tables

| Table | Purpose | Key Schema |
|-------|---------|------------|
| `picasso-session-summaries` | Session metadata | pk: `TENANT#{hash}`, sk: `SESSION#{id}` |
| `picasso-session-events` | Individual events | pk: `TENANT#{hash}`, sk: `{date}#{event_id}` |
| `picasso_form_submissions` | Form data | pk: `submission_id`, GSI: `tenant_id + timestamp` |

### Form Submissions Schema

```json
{
  "submission_id": "apply_dare2dream_1766797544456",
  "tenant_id": "MYR384719",
  "tenant_hash": "my87674d777bf9",
  "form_id": "apply_dare2dream",
  "form_title": "Dare to Dream Mentor Application",
  "session_id": "session_1766797454267_amh6licae",
  "form_data": { "field_123": "value" },
  "form_data_labeled": {
    "Name": { "label": "Name", "value": { "First Name": "Chris", "Last Name": "Miller" }, "type": "composite" },
    "Email": { "label": "Email", "value": "chris@example.com", "type": "email" }
  },
  "submitted_at": "2025-12-27T01:05:44.456Z",
  "timestamp": "2025-12-27T01:05:44.456Z",
  "status": "pending_fulfillment"
}
```

**Important**: Records need both `submitted_at` AND `timestamp` attributes. The GSI uses `timestamp` as the sort key.

## Development

### Commands

```bash
npm run dev        # Start dev server (localhost:5173)
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
# Deploy to production
aws s3 sync dist/ s3://app-myrecruiter-ai/ --delete --profile chris-admin
aws cloudfront create-invalidation --distribution-id EJ0Y6ZUIUBSAT --paths "/*"
```

**Infrastructure:**
- **S3 Bucket**: `app-myrecruiter-ai`
- **CloudFront Distribution**: `EJ0Y6ZUIUBSAT`
- **S3 Versioning**: Enabled (30-day retention)

### Rollback to Previous Version

S3 versioning is enabled, allowing rollback to any deployment within the last 30 days:

```bash
# List versions of the main JS bundle
aws s3api list-object-versions --bucket app-myrecruiter-ai --prefix assets/index --profile chris-admin

# Restore a specific version (replace VERSION_ID)
aws s3api copy-object --bucket app-myrecruiter-ai --key assets/index-XXX.js \
  --copy-source "app-myrecruiter-ai/assets/index-XXX.js?versionId=VERSION_ID" --profile chris-admin

# Invalidate CloudFront after rollback
aws cloudfront create-invalidation --distribution-id EJ0Y6ZUIUBSAT --paths "/*" --profile chris-admin
```
- **Domain**: `d3r39xkfb0snuq.cloudfront.net`

## Known Issues & Fixes

### Form Submissions Not Appearing

**Symptom**: API returns 0 submissions but DynamoDB has data.

**Cause**: New records have `submitted_at` but missing `timestamp` attribute (GSI key).

**Fix**: Add `timestamp` attribute to records:
```bash
AWS_PROFILE=chris-admin python3 << 'EOF'
import boto3
dynamodb = boto3.client('dynamodb', region_name='us-east-1')
response = dynamodb.scan(TableName='picasso_form_submissions')
for item in response.get('Items', []):
    if 'submitted_at' in item and 'timestamp' not in item:
        sid = item['submission_id']['S']
        ts = item['submitted_at']['S']
        dynamodb.update_item(
            TableName='picasso_form_submissions',
            Key={'submission_id': {'S': sid}},
            UpdateExpression='SET #ts = :ts',
            ExpressionAttributeNames={'#ts': 'timestamp'},
            ExpressionAttributeValues={':ts': {'S': ts}}
        )
        print(f"Updated {sid}")
EOF
```

### Name/Email Showing as Anonymous

**Symptom**: Recent Submissions shows "Anonymous" instead of actual name.

**Cause**: API was reading from `form_data` (cryptic field IDs) instead of `form_data_labeled` (human-readable labels).

**Fix**: Analytics Dashboard API now checks `form_data_labeled` first, falls back to `form_data` for old records.

## Design Reference

### Key UI Elements
- **Stats Cards**: Total Views, Completions, Avg Time, Abandon Rate
- **Conversion Funnel**: Horizontal bar chart with stages
- **Field Bottlenecks**: Red bars showing drop-off points
- **Top Forms**: Card grid with trend indicators
- **Recent Submissions**: Paginated table with search

### Color Palette (via @picasso/shared-styles)

Colors are centralized in `/picasso-shared-styles/src/tokens.css` and aligned with the **MyRecruiter Marketing Style Guide** (`/marketing_style_guide`).

**Primary Emerald Palette:**
| Token | Hex | Usage |
|-------|-----|-------|
| `--color-primary-500` | `#50C878` | Primary brand color, CTAs |
| `--color-primary-400` | `#34d399` | Hover states, secondary accents |
| `--color-primary-600` | `#059669` | Eyebrow text, icons on light |
| `--color-primary-700` | `#047857` | Setup step numbers, icon strokes |
| `--color-primary-800` | `#065f46` | Premium card backgrounds |

**Semantic Colors:**
- **Danger Red**: `#ef4444` (abandons, errors)
- **Info Blue**: `#3b82f6` (links, informational)
- **Warning Amber**: `#f59e0b` (warnings, saving states)
- **Background**: `#f9fafb` (gray-50)
- **Cards**: `#ffffff` with `--shadow-card-elevated`

**Alpha Variants** (for shadows, overlays):
- `--color-primary-alpha-10` through `--color-primary-alpha-50`
- Used for button glows, focus rings, hover states

## Related Projects

| Project | Path | Description |
|---------|------|-------------|
| **Picasso Widget** | `/Picasso` | Chat widget frontend |
| **Shared Styles** | `/picasso-shared-styles` | Centralized design tokens |
| **Marketing Style Guide** | `/marketing_style_guide` | Brand colors, typography, UI components |
| **Analytics API** | `/Lambdas/lambda/Analytics_Dashboard_API` | Backend API (DynamoDB + Athena) |
| **Event Processor** | `/Lambdas/lambda/Analytics_Event_Processor` | SQS → S3 pipeline |
| **Bedrock Handler** | `/Lambdas/lambda/Bedrock_Streaming_Handler_Staging` | Form submission processing |

## Documentation

- [USER_JOURNEY_ANALYTICS_PLAN.md](/Picasso/docs/User_Journey/USER_JOURNEY_ANALYTICS_PLAN.md) - Full implementation plan
- [USER_JOURNEY_ANALYTICS_PRD.md](/Picasso/docs/User_Journey/USER_JOURNEY_ANALYTICS_PRD.md) - Product requirements
- [ANNEX_C_FORMS_DASHBOARD.md](/Picasso/docs/User_Journey/ANNEX_C_FORMS_DASHBOARD.md) - Forms dashboard spec
- [ANNEX_B_CONVERSATIONS_DASHBOARD.md](/Picasso/docs/User_Journey/ANNEX_B_CONVERSATIONS_DASHBOARD.md) - Conversations dashboard spec
