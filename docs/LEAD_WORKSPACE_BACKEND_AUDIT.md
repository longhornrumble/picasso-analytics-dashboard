# Lead Workspace Backend Audit

**Date:** 2025-12-28
**Status:** Gap Analysis Complete

---

## Executive Summary

The Lead Workspace Drawer frontend is fully built but uses mock data. This audit identifies the gaps between what the frontend expects and what the backend currently provides.

### Key Findings

| Area | Status | Gap |
|------|--------|-----|
| Form Submission Storage | ✅ Exists | Missing pipeline fields |
| List Endpoint | ✅ Exists | Returns minimal fields |
| Detail Endpoint | ❌ Missing | Need new `/leads/{id}` endpoint |
| Status Update | ❌ Missing | Need PATCH endpoint |
| Notes Update | ❌ Missing | Need PATCH endpoint |
| Lead Queue | ❌ Missing | Need queue navigation endpoint |

---

## 1. DynamoDB Table: `picasso_form_submissions`

### Current Schema (from Bedrock Streaming Handler)

```javascript
// form_handler.js:362-377
{
  submission_id: string,        // PK (e.g., "volunteer_apply_1704067200000")
  form_id: string,              // e.g., "volunteer_apply"
  form_title: string,           // e.g., "Volunteer Application"
  tenant_id: string,            // e.g., "MYR384719"
  tenant_hash: string,          // e.g., "my87674d777bf9"
  session_id: string,           // e.g., "session_1704067200000_abc123"
  conversation_id: string,      // Same as session_id typically
  form_data: object,            // Raw field IDs → values
  form_data_labeled: object,    // Human-readable labels → {type, value}
  priority: string,             // "high" | "normal" | "low"
  submitted_at: string,         // ISO timestamp
  status: string                // "pending_fulfillment"
}
```

### Indexes

| Index | Partition Key | Sort Key | Purpose |
|-------|---------------|----------|---------|
| Primary | `submission_id` | - | Direct lookup |
| `tenant-timestamp-index` | `tenant_id` | `timestamp` | List by tenant + time range |

### Missing Fields for Lead Workspace

These fields are **NOT** currently stored but are required by the frontend:

```typescript
// Required by LeadWorkspaceData type
pipeline_status: PipelineStatus;  // 'new' | 'reviewing' | 'contacted' | 'archived'
internal_notes?: string;          // Staff notes
processed_by?: string;            // Staff email who processed
contacted_at?: string;            // When lead was contacted
archived_at?: string;             // When lead was archived
```

**Recommendation:** Add these fields to DynamoDB records:
1. Set `pipeline_status: 'new'` on form submission
2. Add update logic for status changes
3. Index on `pipeline_status` for filtering

---

## 2. Analytics Dashboard API Endpoints

### Current: `GET /forms/submissions`

**Location:** `Analytics_Dashboard_API/lambda_function.py:1554-1674`

**Returns:**
```json
{
  "tenant_id": "MYR384719",
  "range": "30d",
  "submissions": [
    {
      "submission_id": "volunteer_apply_1704067200000",
      "session_id": "session_123",
      "form_id": "volunteer_apply",
      "form_label": "Volunteer Application",
      "submitted_at": "2025-12-28T10:00:00Z",
      "submitted_date": "Dec 28",
      "duration_seconds": 0,
      "fields_completed": 0,
      "fields": {
        "name": "Sarah Jenkins",
        "email": "sarah.j@email.com"
      }
    }
  ],
  "pagination": {...}
}
```

**Gap Analysis:**
- ❌ Missing `pipeline_status`
- ❌ Missing `phone`, `zip_code`, `comments` in fields
- ❌ Missing `program_id`
- ❌ No detail endpoint for single submission

### Required: `GET /leads/{submission_id}` (NEW)

**Purpose:** Fetch full lead details for drawer

**Expected Response:**
```json
{
  "lead": {
    "submission_id": "volunteer_apply_1704067200000",
    "session_id": "session_123",
    "form_id": "volunteer_apply",
    "form_label": "Volunteer Application",
    "submitted_at": "2025-12-28T10:00:00Z",
    "submitted_date": "Dec 28",
    "duration_seconds": 180,
    "fields_completed": 8,
    "fields": {
      "name": "Sarah Jenkins",
      "email": "sarah.j@email.com",
      "phone": "(555) 123-4567",
      "zip": "78701",
      "comments": "I have experience working with youth programs..."
    },
    "pipeline_status": "new",
    "internal_notes": "",
    "processed_by": null,
    "program_id": "mentorship",
    "zip_code": "78701"
  },
  "tenant_name": "Atlanta Angels"
}
```

### Required: `PATCH /leads/{submission_id}/status` (NEW)

**Purpose:** Update pipeline status

**Request:**
```json
{
  "pipeline_status": "reviewing"
}
```

**Response:**
```json
{
  "submission_id": "volunteer_apply_1704067200000",
  "pipeline_status": "reviewing",
  "updated_at": "2025-12-28T10:30:00Z"
}
```

### Required: `PATCH /leads/{submission_id}/notes` (NEW)

**Purpose:** Update internal notes

**Request:**
```json
{
  "internal_notes": "Called on 12/28, left voicemail"
}
```

**Response:**
```json
{
  "submission_id": "volunteer_apply_1704067200000",
  "internal_notes": "Called on 12/28, left voicemail",
  "updated_at": "2025-12-28T10:30:00Z"
}
```

### Required: `GET /leads/queue` (NEW)

**Purpose:** Navigate to next lead in queue

**Query Params:**
- `status`: Filter by pipeline status (optional)
- `current_id`: Current lead ID for "next" logic

**Response:**
```json
{
  "next_lead_id": "volunteer_apply_1704067300000",
  "queue_count": 12
}
```

---

## 3. Frontend Data Requirements

### LeadWorkspaceData Interface

```typescript
// src/types/analytics.ts:418-431
interface LeadWorkspaceData extends FormSubmissionAPI {
  pipeline_status: PipelineStatus;     // Required
  internal_notes?: string;              // Optional
  processed_by?: string;                // Optional
  contacted_at?: string;                // Optional
  archived_at?: string;                 // Optional
  submission_type: SubmissionType;      // Required
  tenant_name?: string;                 // For email subjects
  program_id?: string;                  // From form config
  zip_code?: string;                    // Extracted from fields
}
```

### Field Extraction Logic

The frontend extracts fields from `fields` object:

```typescript
// FormDataManifest.tsx:20-23
const PRIORITY_FIELDS = ['name', 'full_name', 'first_name', 'email', 'phone', 'mobile'];
const HIDDEN_FIELDS = ['submission_id', 'session_id', 'tenant_id', 'tenant_hash', 'timestamp'];
```

**Backend must return:** All fields from `form_data_labeled` mapped to flat structure.

---

## 4. Data Flow Mapping

### Current Flow (Broken)

```
User submits form
    ↓
Bedrock Handler saves to DynamoDB
    ↓
Analytics API returns limited fields
    ↓
Frontend shows "Anonymous" / missing data ❌
```

### Required Flow (Fixed)

```
User submits form
    ↓
Bedrock Handler saves to DynamoDB
  + Add: pipeline_status = 'new'
  + Add: timestamp attribute (for GSI)
    ↓
Analytics API: GET /leads/{id}
  + Parse form_data_labeled into flat fields
  + Include pipeline_status
  + Fetch tenant_name from config
    ↓
Frontend displays full lead data ✅
    ↓
User updates status/notes
    ↓
Analytics API: PATCH /leads/{id}/status
Analytics API: PATCH /leads/{id}/notes
  + Update DynamoDB record
    ↓
Frontend reflects changes ✅
```

---

## 5. Implementation Plan

### Phase 1: DynamoDB Schema Updates

1. **Add `pipeline_status` to form submissions**
   - Update `form_handler.js:362-377` to include `pipeline_status: 'new'`
   - Backfill existing records with `pipeline_status: 'new'`

2. **Add `timestamp` attribute** (already required by GSI)
   - Currently some records missing this (see CLAUDE.md "Known Issues")

### Phase 2: New API Endpoints

1. **`GET /leads/{submission_id}`**
   - Direct DynamoDB GetItem by submission_id
   - Parse `form_data_labeled` into flat `fields` object
   - Look up `tenant_name` from S3 config cache

2. **`PATCH /leads/{submission_id}/status`**
   - UpdateItem with `pipeline_status`, `updated_at`
   - Add `contacted_at` if status → 'contacted'
   - Add `archived_at` if status → 'archived'

3. **`PATCH /leads/{submission_id}/notes`**
   - UpdateItem with `internal_notes`, `updated_at`

4. **`GET /leads/queue`**
   - Query GSI for tenant's pending leads
   - Return next lead after current_id

### Phase 3: Frontend Integration

1. **Replace mock data fetch** in `LeadWorkspaceDrawer.tsx:170-184`
2. **Wire up status changes** to API
3. **Wire up notes autosave** to API
4. **Implement queue navigation** with real data

---

## 6. Field Mapping Reference

### DynamoDB → Frontend Mapping

| DynamoDB Field | Frontend Field | Transform |
|----------------|----------------|-----------|
| `submission_id` | `submission_id` | Direct |
| `session_id` | `session_id` | Direct |
| `form_id` | `form_id` | Direct |
| `form_title` | `form_label` | Rename |
| `submitted_at` | `submitted_at` | Direct |
| `submitted_at` | `submitted_date` | Format: "Dec 28" |
| `form_data_labeled.Name.value` | `fields.name` | Extract/flatten |
| `form_data_labeled.Email.value` | `fields.email` | Extract |
| `form_data_labeled.Phone.value` | `fields.phone` | Extract |
| `form_data_labeled.*.value` | `fields.*` | Flatten all |
| `priority` | Not used | - |
| `status` | Not used | - |
| **NEW** `pipeline_status` | `pipeline_status` | Direct |
| **NEW** `internal_notes` | `internal_notes` | Direct |

### Submission Type Inference

```typescript
function inferSubmissionType(formId: string): SubmissionType {
  if (formId.includes('volunteer') || formId.includes('mentor')) return 'volunteer';
  if (formId.includes('donor') || formId.includes('donate')) return 'donor';
  return 'general';
}
```

---

## 7. Security Considerations

1. **Tenant Isolation**
   - All endpoints must validate `tenant_id` from JWT matches record
   - Query GSI with tenant_id as partition key

2. **PII Handling**
   - `form_data` and `form_data_labeled` contain PII
   - Only return to authenticated dashboard users
   - Audit log access

3. **Authorization**
   - `dashboard_forms` feature flag required
   - Consider role-based access for status updates

---

## 8. Files to Modify

### Backend (Lambda)

| File | Changes |
|------|---------|
| `Bedrock_Streaming_Handler_Staging/form_handler.js` | Add `pipeline_status: 'new'` |
| `Analytics_Dashboard_API/lambda_function.py` | Add lead detail/update endpoints |

### Frontend (React)

| File | Changes |
|------|---------|
| `src/services/analyticsApi.ts` | Add lead API methods |
| `src/components/lead-workspace/LeadWorkspaceDrawer.tsx` | Replace mock with API calls |

---

## Appendix: Sample DynamoDB Record

```json
{
  "submission_id": "apply_mentorship_1735380344456",
  "tenant_id": "MYR384719",
  "tenant_hash": "my87674d777bf9",
  "form_id": "apply_mentorship",
  "form_title": "Mentor Application",
  "session_id": "session_1735380254267_amh6licae",
  "conversation_id": "session_1735380254267_amh6licae",
  "form_data": {
    "field_1762286136120": "Sarah",
    "field_1762286136121": "Jenkins",
    "field_1762286136122": "sarah.j@email.com"
  },
  "form_data_labeled": {
    "Name": {
      "type": "composite",
      "value": {
        "First Name": "Sarah",
        "Last Name": "Jenkins"
      }
    },
    "Email": {
      "type": "email",
      "value": "sarah.j@email.com"
    },
    "Phone": {
      "type": "tel",
      "value": "(555) 123-4567"
    },
    "ZIP Code": {
      "type": "text",
      "value": "78701"
    },
    "Comments": {
      "type": "text",
      "value": "I have experience working with youth programs..."
    }
  },
  "priority": "normal",
  "submitted_at": "2025-12-28T10:05:44.456Z",
  "timestamp": "2025-12-28T10:05:44.456Z",
  "status": "pending_fulfillment",
  "pipeline_status": "new"
}
```
