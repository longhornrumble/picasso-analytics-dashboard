# Changelog

All notable changes to the Picasso Analytics Dashboard will be documented in this file.

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
