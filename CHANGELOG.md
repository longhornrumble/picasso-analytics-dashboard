# Changelog

All notable changes to the Picasso Analytics Dashboard will be documented in this file.

## [1.1.2] - 2026-01-05

### Changed
- **Contact Phase Rename**: "Execution Phase" renamed to "Contact Phase" in Lead Workspace Drawer
- **New Pipeline Statuses**: Added "Disqualified" and "Advancing" to pipeline status options
  - Total 5 statuses: New, Reviewing, Contacted, Disqualified, Advancing
  - Color-coded: Green, Blue, Purple, Red, Amber respectively

### Added
- **Status Column**: New Status column in Form Submissions table
  - Shows current contact phase status with color-coded badges
  - Updates in real-time when status changes in Lead Workspace Drawer
  - Sortable column for filtering by status
- **Mobile Dropdown**: Custom dropdown component for pipeline status on mobile
  - Replaced native select to fix positioning issues in transformed containers
  - Includes color dots, descriptions, and checkmark for active selection
  - Desktop retains pill buttons for quick status changes

### Fixed
- **Status Wiring**: Pipeline status now properly flows from Lead Workspace to table
  - API data defaults to 'new' status
  - Status overrides applied before rendering

### Technical Details
- PipelineStatus type extended: `'new' | 'reviewing' | 'contacted' | 'disqualified' | 'advancing' | 'archived'`
- PipelineStepper component rewritten with responsive design (hidden sm:flex / sm:hidden)
- Custom dropdown with click-outside and escape key handlers
- Dashboard applies `mockStatusOverrides` to `dataWithOverrides` before filtering

---

## [1.1.1] - 2026-01-05

### Fixed
- Mobile responsive improvements
- Session ID unification between Conversations and Forms

---

## [1.1.0] - 2026-01-05

### Added
- Lead Workspace Drawer Phase 8 polish
- CSV export functionality improvements

---

## [1.0.0] - 2026-01-05

### Added
- **View Form Link**: Link from Conversations to Form Submissions
  - "View Form" button in SessionCard for sessions with form completions
  - "View Form Submission" button in SessionTimeline modal footer
  - Cross-tab navigation from Conversations to Forms dashboard
  - Session ID search in Form Submissions table

### Changed
- DataTable: Added `searchValue` prop for controlled external search
- FormSubmission type: Added `session_id` field for conversation linking
- Search filters: Now include session_id and submission_id fields

### Technical Details
- SessionCard: Added `onViewFormSubmission` callback prop
- SessionTimeline: Added `onViewFormSubmission` callback prop
- ConversationsDashboard: Wires callbacks to parent App
- App: Manages `formsSearchQuery` state for cross-tab navigation
- Dashboard: Accepts `initialSearchQuery` prop for external navigation

### Deployment Notes
- **S3 Bucket**: `app-myrecruiter-ai`
- **CloudFront**: `EJ0Y6ZUIUBSAT`
- **Production URL**: https://d3r39xkfb0snuq.cloudfront.net
- **Build**: `npm run build`
- **Deploy**: `aws s3 sync dist/ s3://app-myrecruiter-ai/ --delete`

---

## [0.x.x] - Pre-release

### Features
- Forms Dashboard with submissions table
- Conversations Dashboard with session timeline
- Lead Workspace Drawer
- Heatmap visualization
- Top questions analysis
- CSV export functionality
