# Lead Workspace Backend Integration - Implementation Plan

**Version:** 1.1
**Date:** 2025-12-30
**Status:** **COMPLETE - ALL IMPLEMENTED**
**Estimated Effort:** 1-2 days (DONE)

---

## Executive Summary

This document provides the complete implementation plan to connect the Lead Workspace Drawer frontend to the backend.

### **IMPLEMENTATION STATUS: COMPLETE**

All components have been fully implemented and are production-ready:

| Layer | Status | Details |
|-------|--------|---------|
| DynamoDB | ✅ Complete | GSI `tenant-pipeline-index` active, all fields present |
| Bedrock Handler | ✅ Complete | `form_handler.js` initializes pipeline fields on submission |
| Analytics API | ✅ Complete | 5 endpoints in `lambda_function.py` (lines 2719-3205) |
| Frontend | ✅ Complete | All components built, API client integrated |

### Implemented Endpoints

| Endpoint | Handler | Lines |
|----------|---------|-------|
| `GET /leads/{id}` | `handle_lead_detail()` | 2725-2771 |
| `PATCH /leads/{id}/status` | `handle_lead_status_update()` | 2864-2955 |
| `PATCH /leads/{id}/notes` | `handle_lead_notes_update()` | 2957-3027 |
| `POST /leads/{id}/reactivate` | `handle_lead_reactivate()` | 3029-3137 |
| `GET /leads/queue` | `handle_lead_queue()` | 3140-3205 |

---

## Original Scope (Reference)

| Layer | Changes |
|-------|---------|
| DynamoDB | Schema updates + new GSI |
| Bedrock Handler | Add new fields on form submission |
| Analytics API | 5 new endpoints |
| Frontend | Replace mock data with API calls |

---

## Table of Contents

1. [DynamoDB Changes](#1-dynamodb-changes)
2. [Bedrock Streaming Handler Changes](#2-bedrock-streaming-handler-changes)
3. [Analytics Dashboard API Changes](#3-analytics-dashboard-api-changes)
4. [Frontend Changes](#4-frontend-changes)
5. [Backfill Script](#5-backfill-script)
6. [Testing Plan](#6-testing-plan)
7. [Deployment Order](#7-deployment-order)

---

## 1. DynamoDB Changes

### 1.1 Table: `picasso_form_submissions`

**No table recreation required** - DynamoDB allows adding attributes to existing items.

### 1.2 New Attributes

Add these attributes to all new form submissions:

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `pipeline_status` | String | `"new"` | Enum: `new`, `reviewing`, `contacted`, `archived` |
| `internal_notes` | String | `""` | Staff notes (free text) |
| `processed_by` | String | `null` | Email of staff who last updated |
| `contacted_at` | String | `null` | ISO timestamp when status → contacted |
| `archived_at` | String | `null` | ISO timestamp when status → archived |
| `updated_at` | String | `null` | ISO timestamp of last modification |
| `ttl` | Number | `null` | Unix timestamp for auto-deletion (optional) |

### 1.3 New Global Secondary Index

**Purpose:** Enable efficient queue queries by tenant and pipeline status.

```
Index Name: tenant-pipeline-index
Partition Key: tenant_pipeline_key (String)
Sort Key: submitted_at (String)
Projection: ALL
Read Capacity: On-demand (or match table settings)
Write Capacity: On-demand (or match table settings)
```

**Composite Key Format:**
```
tenant_pipeline_key = "{tenant_id}#{pipeline_status}"
Example: "MYR384719#new"
```

### 1.4 AWS CLI Command to Create GSI

```bash
aws dynamodb update-table \
  --table-name picasso_form_submissions \
  --attribute-definitions \
    AttributeName=tenant_pipeline_key,AttributeType=S \
    AttributeName=submitted_at,AttributeType=S \
  --global-secondary-index-updates \
    "[{
      \"Create\": {
        \"IndexName\": \"tenant-pipeline-index\",
        \"KeySchema\": [
          {\"AttributeName\": \"tenant_pipeline_key\", \"KeyType\": \"HASH\"},
          {\"AttributeName\": \"submitted_at\", \"KeyType\": \"RANGE\"}
        ],
        \"Projection\": {\"ProjectionType\": \"ALL\"}
      }
    }]" \
  --billing-mode PAY_PER_REQUEST \
  --profile chris-admin \
  --region us-east-1
```

**Note:** GSI creation is non-blocking and can take 5-10 minutes to become ACTIVE.

---

## 2. Bedrock Streaming Handler Changes

### 2.1 File: `Lambdas/lambda/Bedrock_Streaming_Handler_Staging/form_handler.js`

### 2.2 Modify: `saveFormSubmission()` function

**Location:** Lines 352-387

**Current Code:**
```javascript
async function saveFormSubmission(submissionId, formId, formData, config, priority = 'normal', sessionId = null, conversationId = null) {
  // ... existing code ...

  const params = {
    TableName: FORM_SUBMISSIONS_TABLE,
    Item: {
      submission_id: submissionId,
      form_id: formId,
      form_title: formConfig.title || formId,
      tenant_id: config.tenant_id || 'unknown',
      tenant_hash: config.tenant_hash || 'unknown',
      session_id: sessionId || 'unknown',
      conversation_id: conversationId || sessionId || 'unknown',
      form_data: formData,
      form_data_labeled: labeledData,
      priority: priority,
      submitted_at: new Date().toISOString(),
      status: 'pending_fulfillment'
    }
  };
  // ...
}
```

**Updated Code:**
```javascript
async function saveFormSubmission(submissionId, formId, formData, config, priority = 'normal', sessionId = null, conversationId = null) {
  if (!FORM_SUBMISSIONS_TABLE) {
    console.warn('⚠️ FORM_SUBMISSIONS_TABLE not configured, skipping DynamoDB save');
    return;
  }

  // Get form config for field labels
  const formConfig = config.conversational_forms?.[formId] || {};
  const labeledData = buildLabeledFormData(formData, formConfig);

  const now = new Date().toISOString();
  const tenantId = config.tenant_id || 'unknown';

  const params = {
    TableName: FORM_SUBMISSIONS_TABLE,
    Item: {
      // Existing fields
      submission_id: submissionId,
      form_id: formId,
      form_title: formConfig.title || formId,
      tenant_id: tenantId,
      tenant_hash: config.tenant_hash || 'unknown',
      session_id: sessionId || 'unknown',
      conversation_id: conversationId || sessionId || 'unknown',
      form_data: formData,
      form_data_labeled: labeledData,
      priority: priority,
      submitted_at: now,
      timestamp: now,  // Required for existing GSI
      status: 'pending_fulfillment',

      // NEW: Lead Workspace fields
      pipeline_status: 'new',
      tenant_pipeline_key: `${tenantId}#new`,  // Composite key for new GSI
      internal_notes: '',
      processed_by: null,
      contacted_at: null,
      archived_at: null,
      updated_at: now
    }
  };

  try {
    await dynamodb.send(new PutCommand(params));
    console.log(`✅ Form saved to DynamoDB with pipeline_status: new`);
  } catch (error) {
    console.error('Error saving to DynamoDB:', error);
  }
}
```

### 2.3 Deployment

```bash
cd Lambdas/lambda/Bedrock_Streaming_Handler_Staging
npm ci --production
npm run package
aws lambda update-function-code \
  --function-name Bedrock_Streaming_Handler_Staging \
  --zip-file fileb://deployment.zip \
  --profile chris-admin
```

---

## 3. Analytics Dashboard API Changes

### 3.1 File: `Lambdas/lambda/Analytics_Dashboard_API/lambda_function.py`

### 3.2 Add New Route Handler

**Location:** Add to route handling section (~line 280-300)

```python
# In handle_request() function, add these routes:

# Lead Workspace endpoints
elif path.startswith('/leads/') and method == 'GET':
    # GET /leads/{submission_id} - Lead detail
    submission_id = path.split('/leads/')[1].split('/')[0]
    if submission_id and '/' not in submission_id:
        return handle_lead_detail(tenant_id, submission_id)
    return cors_response(400, {'error': 'Invalid submission_id'})

elif path.startswith('/leads/') and '/status' in path and method == 'PATCH':
    # PATCH /leads/{submission_id}/status
    submission_id = path.split('/leads/')[1].split('/status')[0]
    body = json.loads(event.get('body', '{}'))
    return handle_lead_status_update(tenant_id, submission_id, body, user_email)

elif path.startswith('/leads/') and '/notes' in path and method == 'PATCH':
    # PATCH /leads/{submission_id}/notes
    submission_id = path.split('/leads/')[1].split('/notes')[0]
    body = json.loads(event.get('body', '{}'))
    return handle_lead_notes_update(tenant_id, submission_id, body, user_email)

elif path == '/leads/queue' and method == 'GET':
    # GET /leads/queue - Next lead in queue
    return handle_lead_queue(tenant_id, params)
```

### 3.3 New Function: `handle_lead_detail()`

```python
def handle_lead_detail(tenant_id: str, submission_id: str) -> Dict[str, Any]:
    """
    GET /leads/{submission_id}
    Returns full lead details for the workspace drawer.
    """
    # Validate feature access
    access_error = validate_feature_access(tenant_id, 'dashboard_forms')
    if access_error:
        return access_error

    # Validate submission_id format
    if not submission_id or not SUBMISSION_ID_PATTERN.match(submission_id):
        return cors_response(400, {'error': 'Invalid submission_id format'})

    try:
        # Direct GetItem by primary key
        response = dynamodb.get_item(
            TableName=FORM_SUBMISSIONS_TABLE,
            Key={'submission_id': {'S': submission_id}}
        )

        item = response.get('Item')
        if not item:
            return cors_response(404, {'error': 'Lead not found'})

        # Verify tenant ownership
        item_tenant = item.get('tenant_id', {}).get('S', '')
        if item_tenant != tenant_id:
            return cors_response(403, {'error': 'Access denied'})

        # Parse the lead data
        lead = parse_lead_from_dynamodb(item)

        # Get tenant name from config cache
        tenant_name = get_tenant_name(tenant_id)

        return cors_response(200, {
            'lead': lead,
            'tenant_name': tenant_name
        })

    except Exception as e:
        logger.error(f"Error fetching lead detail: {e}")
        return cors_response(500, {'error': 'Failed to fetch lead'})


def parse_lead_from_dynamodb(item: Dict) -> Dict[str, Any]:
    """
    Parse DynamoDB item into LeadWorkspaceData format.
    Flattens form_data_labeled into fields object.
    """
    submission_id = item.get('submission_id', {}).get('S', '')
    submitted_at = item.get('submitted_at', {}).get('S', '')
    form_id = item.get('form_id', {}).get('S', '')

    # Format date
    try:
        dt = datetime.fromisoformat(submitted_at.replace('Z', '+00:00'))
        submitted_date = dt.strftime('%b %d')
    except:
        submitted_date = submitted_at[:10] if submitted_at else 'Unknown'

    # Parse form_data_labeled into flat fields object
    fields = {}
    form_data_labeled = item.get('form_data_labeled', {}).get('M', {})

    for field_label, field_wrapper in form_data_labeled.items():
        if not isinstance(field_wrapper, dict) or 'M' not in field_wrapper:
            continue

        field_obj = field_wrapper['M']
        value_obj = field_obj.get('value', {})

        # Handle different value types
        if 'S' in value_obj:
            fields[field_label.lower().replace(' ', '_')] = value_obj['S']
        elif 'M' in value_obj:
            # Composite field (e.g., Name with First/Last)
            nested = value_obj['M']
            parts = []
            for sub_key, sub_val in nested.items():
                if isinstance(sub_val, dict) and 'S' in sub_val:
                    parts.append(sub_val['S'])
            fields[field_label.lower().replace(' ', '_')] = ' '.join(parts)
        elif 'BOOL' in value_obj:
            fields[field_label.lower().replace(' ', '_')] = 'Yes' if value_obj['BOOL'] else 'No'

    # Infer submission type from form_id
    submission_type = 'general'
    if 'volunteer' in form_id.lower() or 'mentor' in form_id.lower():
        submission_type = 'volunteer'
    elif 'donor' in form_id.lower() or 'donate' in form_id.lower():
        submission_type = 'donor'

    return {
        'submission_id': submission_id,
        'session_id': item.get('session_id', {}).get('S', ''),
        'form_id': form_id,
        'form_label': item.get('form_title', {}).get('S', form_id),
        'submitted_at': submitted_at,
        'submitted_date': submitted_date,
        'duration_seconds': 0,  # Not tracked
        'fields_completed': len(fields),
        'fields': fields,
        'pipeline_status': item.get('pipeline_status', {}).get('S', 'new'),
        'internal_notes': item.get('internal_notes', {}).get('S', ''),
        'processed_by': item.get('processed_by', {}).get('S'),
        'contacted_at': item.get('contacted_at', {}).get('S'),
        'archived_at': item.get('archived_at', {}).get('S'),
        'submission_type': submission_type,
        'program_id': item.get('form_id', {}).get('S', ''),
        'zip_code': fields.get('zip_code') or fields.get('zip') or fields.get('postal_code', '')
    }


def get_tenant_name(tenant_id: str) -> str:
    """Get tenant display name from cached config."""
    try:
        # Use existing config cache if available
        config = load_tenant_config(tenant_id)
        return config.get('chat_title', config.get('organization_name', tenant_id))
    except:
        return tenant_id
```

### 3.4 New Function: `handle_lead_status_update()`

```python
# Valid pipeline status values
VALID_PIPELINE_STATUSES = {'new', 'reviewing', 'contacted', 'archived'}

def handle_lead_status_update(
    tenant_id: str,
    submission_id: str,
    body: Dict,
    user_email: str
) -> Dict[str, Any]:
    """
    PATCH /leads/{submission_id}/status
    Update lead pipeline status.
    """
    access_error = validate_feature_access(tenant_id, 'dashboard_forms')
    if access_error:
        return access_error

    # Validate request body
    new_status = body.get('pipeline_status')
    if not new_status or new_status not in VALID_PIPELINE_STATUSES:
        return cors_response(400, {
            'error': f'Invalid pipeline_status. Must be one of: {", ".join(VALID_PIPELINE_STATUSES)}'
        })

    try:
        # First, verify the lead exists and belongs to tenant
        response = dynamodb.get_item(
            TableName=FORM_SUBMISSIONS_TABLE,
            Key={'submission_id': {'S': submission_id}},
            ProjectionExpression='tenant_id, pipeline_status'
        )

        item = response.get('Item')
        if not item:
            return cors_response(404, {'error': 'Lead not found'})

        if item.get('tenant_id', {}).get('S') != tenant_id:
            return cors_response(403, {'error': 'Access denied'})

        now = datetime.utcnow().isoformat() + 'Z'

        # Build update expression
        update_expr = 'SET pipeline_status = :status, tenant_pipeline_key = :tpk, updated_at = :now, processed_by = :user'
        expr_values = {
            ':status': {'S': new_status},
            ':tpk': {'S': f'{tenant_id}#{new_status}'},
            ':now': {'S': now},
            ':user': {'S': user_email or 'unknown'}
        }

        # Add timestamp for status-specific fields
        if new_status == 'contacted':
            update_expr += ', contacted_at = :contacted'
            expr_values[':contacted'] = {'S': now}
        elif new_status == 'archived':
            update_expr += ', archived_at = :archived'
            expr_values[':archived'] = {'S': now}
            # Optionally set TTL for 1 year
            ttl = int((datetime.utcnow() + timedelta(days=365)).timestamp())
            update_expr += ', #ttl = :ttl'
            expr_values[':ttl'] = {'N': str(ttl)}

        # Perform update
        dynamodb.update_item(
            TableName=FORM_SUBMISSIONS_TABLE,
            Key={'submission_id': {'S': submission_id}},
            UpdateExpression=update_expr,
            ExpressionAttributeValues=expr_values,
            ExpressionAttributeNames={'#ttl': 'ttl'} if new_status == 'archived' else {}
        )

        logger.info(f"Lead {submission_id} status updated to {new_status} by {user_email}")

        return cors_response(200, {
            'submission_id': submission_id,
            'pipeline_status': new_status,
            'updated_at': now
        })

    except Exception as e:
        logger.error(f"Error updating lead status: {e}")
        return cors_response(500, {'error': 'Failed to update status'})
```

### 3.5 New Function: `handle_lead_notes_update()`

```python
def handle_lead_notes_update(
    tenant_id: str,
    submission_id: str,
    body: Dict,
    user_email: str
) -> Dict[str, Any]:
    """
    PATCH /leads/{submission_id}/notes
    Update lead internal notes.
    """
    access_error = validate_feature_access(tenant_id, 'dashboard_forms')
    if access_error:
        return access_error

    # Validate request body
    notes = body.get('internal_notes')
    if notes is None:
        return cors_response(400, {'error': 'internal_notes field required'})

    # Limit notes length
    if len(notes) > 10000:
        return cors_response(400, {'error': 'Notes too long (max 10000 characters)'})

    try:
        # Verify lead exists and belongs to tenant
        response = dynamodb.get_item(
            TableName=FORM_SUBMISSIONS_TABLE,
            Key={'submission_id': {'S': submission_id}},
            ProjectionExpression='tenant_id'
        )

        item = response.get('Item')
        if not item:
            return cors_response(404, {'error': 'Lead not found'})

        if item.get('tenant_id', {}).get('S') != tenant_id:
            return cors_response(403, {'error': 'Access denied'})

        now = datetime.utcnow().isoformat() + 'Z'

        # Update notes
        dynamodb.update_item(
            TableName=FORM_SUBMISSIONS_TABLE,
            Key={'submission_id': {'S': submission_id}},
            UpdateExpression='SET internal_notes = :notes, updated_at = :now, processed_by = :user',
            ExpressionAttributeValues={
                ':notes': {'S': notes},
                ':now': {'S': now},
                ':user': {'S': user_email or 'unknown'}
            }
        )

        return cors_response(200, {
            'submission_id': submission_id,
            'internal_notes': notes,
            'updated_at': now
        })

    except Exception as e:
        logger.error(f"Error updating lead notes: {e}")
        return cors_response(500, {'error': 'Failed to update notes'})
```

### 3.6 New Function: `handle_lead_queue()`

```python
def handle_lead_queue(tenant_id: str, params: Dict[str, str]) -> Dict[str, Any]:
    """
    GET /leads/queue
    Get next lead in queue and total count.

    Query params:
    - status: Filter by pipeline status (default: 'new')
    - current_id: Current submission_id to find next after
    """
    access_error = validate_feature_access(tenant_id, 'dashboard_forms')
    if access_error:
        return access_error

    status_filter = params.get('status', 'new')
    current_id = params.get('current_id')

    if status_filter not in VALID_PIPELINE_STATUSES:
        return cors_response(400, {'error': 'Invalid status filter'})

    try:
        # Query using the new GSI
        tenant_pipeline_key = f'{tenant_id}#{status_filter}'

        response = dynamodb.query(
            TableName=FORM_SUBMISSIONS_TABLE,
            IndexName='tenant-pipeline-index',
            KeyConditionExpression='tenant_pipeline_key = :tpk',
            ExpressionAttributeValues={
                ':tpk': {'S': tenant_pipeline_key}
            },
            ScanIndexForward=True,  # Oldest first (FIFO)
            ProjectionExpression='submission_id, submitted_at'
        )

        items = response.get('Items', [])
        queue_count = len(items)

        # Find next lead after current_id
        next_lead_id = None
        if items:
            if current_id:
                # Find position of current lead and return next
                for i, item in enumerate(items):
                    if item.get('submission_id', {}).get('S') == current_id:
                        if i + 1 < len(items):
                            next_lead_id = items[i + 1].get('submission_id', {}).get('S')
                        break
                # If current not found or was last, return first
                if next_lead_id is None and items:
                    next_lead_id = items[0].get('submission_id', {}).get('S')
            else:
                # No current, return first in queue
                next_lead_id = items[0].get('submission_id', {}).get('S')

        return cors_response(200, {
            'next_lead_id': next_lead_id,
            'queue_count': queue_count,
            'status': status_filter
        })

    except Exception as e:
        logger.error(f"Error fetching lead queue: {e}")
        return cors_response(500, {'error': 'Failed to fetch queue'})
```

### 3.7 Add Required Imports and Constants

At top of file, add:

```python
from datetime import datetime, timedelta
import re

# Validation patterns
SUBMISSION_ID_PATTERN = re.compile(r'^[a-zA-Z0-9_\-]+$')

# Valid pipeline statuses
VALID_PIPELINE_STATUSES = {'new', 'reviewing', 'contacted', 'archived'}
```

### 3.8 Deployment

```bash
cd Lambdas/lambda/Analytics_Dashboard_API
zip -r deployment.zip lambda_function.py -x "*.pyc" -x "__pycache__/*" -x "test_*.py"
aws lambda update-function-code \
  --function-name Analytics_Dashboard_API \
  --zip-file fileb://deployment.zip \
  --profile chris-admin
```

---

## 4. Frontend Changes

### 4.1 File: `src/services/analyticsApi.ts`

Add new API methods:

```typescript
// Lead Workspace API Methods

export interface LeadDetailResponse {
  lead: LeadWorkspaceData;
  tenant_name: string;
}

export interface StatusUpdateResponse {
  submission_id: string;
  pipeline_status: PipelineStatus;
  updated_at: string;
}

export interface NotesUpdateResponse {
  submission_id: string;
  internal_notes: string;
  updated_at: string;
}

export interface LeadQueueResponse {
  next_lead_id: string | null;
  queue_count: number;
  status: string;
}

/**
 * Fetch full lead details for workspace drawer
 */
export async function fetchLeadDetail(submissionId: string): Promise<LeadDetailResponse> {
  const response = await fetch(`${API_BASE_URL}/leads/${submissionId}`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch lead: ${response.status}`);
  }

  return response.json();
}

/**
 * Update lead pipeline status
 */
export async function updateLeadStatus(
  submissionId: string,
  pipelineStatus: PipelineStatus
): Promise<StatusUpdateResponse> {
  const response = await fetch(`${API_BASE_URL}/leads/${submissionId}/status`, {
    method: 'PATCH',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ pipeline_status: pipelineStatus }),
  });

  if (!response.ok) {
    throw new Error(`Failed to update status: ${response.status}`);
  }

  return response.json();
}

/**
 * Update lead internal notes
 */
export async function updateLeadNotes(
  submissionId: string,
  notes: string
): Promise<NotesUpdateResponse> {
  const response = await fetch(`${API_BASE_URL}/leads/${submissionId}/notes`, {
    method: 'PATCH',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ internal_notes: notes }),
  });

  if (!response.ok) {
    throw new Error(`Failed to update notes: ${response.status}`);
  }

  return response.json();
}

/**
 * Get next lead in queue
 */
export async function fetchLeadQueue(
  status: PipelineStatus = 'new',
  currentId?: string
): Promise<LeadQueueResponse> {
  const params = new URLSearchParams({ status });
  if (currentId) {
    params.set('current_id', currentId);
  }

  const response = await fetch(`${API_BASE_URL}/leads/queue?${params}`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch queue: ${response.status}`);
  }

  return response.json();
}
```

### 4.2 File: `src/components/lead-workspace/LeadWorkspaceDrawer.tsx`

Replace mock data with API calls:

```typescript
import {
  fetchLeadDetail,
  updateLeadStatus,
  updateLeadNotes,
  fetchLeadQueue
} from '../../services/analyticsApi';

// Remove getMockLeadData function

// Update useEffect for loading lead data
useEffect(() => {
  if (isOpen && leadId) {
    setIsLoading(true);
    setLeadData(null);

    fetchLeadDetail(leadId)
      .then((response) => {
        setLeadData({
          ...response.lead,
          tenant_name: response.tenant_name,
        });
        setIsLoading(false);
      })
      .catch((error) => {
        console.error('Failed to load lead:', error);
        setIsLoading(false);
        // Optionally show error state
      });
  } else if (!isOpen) {
    const timer = setTimeout(() => setLeadData(null), 300);
    return () => clearTimeout(timer);
  }
}, [isOpen, leadId]);

// Update handleStatusChange
const handleStatusChange = useCallback(async (newStatus: PipelineStatus) => {
  if (!leadData) return;

  setIsSavingStatus(true);
  try {
    await updateLeadStatus(leadData.submission_id, newStatus);
    setLeadData((prev) => prev ? { ...prev, pipeline_status: newStatus } : null);
  } catch (error) {
    console.error('Failed to update status:', error);
    // Optionally show error toast
  } finally {
    setIsSavingStatus(false);
  }
}, [leadData]);

// Update handleNotesChange with debounce
const handleNotesChange = useCallback(async (newNotes: string) => {
  if (!leadData) return;

  setIsSavingNotes(true);
  try {
    const response = await updateLeadNotes(leadData.submission_id, newNotes);
    setLeadData((prev) => prev ? { ...prev, internal_notes: newNotes } : null);
    setNotesLastSaved(response.updated_at);
  } catch (error) {
    console.error('Failed to update notes:', error);
  } finally {
    setIsSavingNotes(false);
  }
}, [leadData]);

// Update handleArchive
const handleArchive = useCallback(async () => {
  if (!leadData) return;

  setIsArchiving(true);
  try {
    await updateLeadStatus(leadData.submission_id, 'archived');
    setLeadData((prev) => prev ? { ...prev, pipeline_status: 'archived' } : null);
    onArchive?.();
  } catch (error) {
    console.error('Failed to archive:', error);
  } finally {
    setIsArchiving(false);
  }
}, [leadData, onArchive]);

// Update handleNextLead
const handleNextLead = useCallback(async () => {
  if (!leadData) return;

  try {
    const queue = await fetchLeadQueue('new', leadData.submission_id);
    if (queue.next_lead_id) {
      // Navigate to next lead - this depends on your routing
      onNext?.(queue.next_lead_id);
    }
  } catch (error) {
    console.error('Failed to fetch next lead:', error);
  }
}, [leadData, onNext]);

// Add queue count state
const [queueInfo, setQueueInfo] = useState<{ count: number } | null>(null);

// Fetch queue info when drawer opens
useEffect(() => {
  if (isOpen && leadId) {
    fetchLeadQueue('new')
      .then((queue) => setQueueInfo({ count: queue.queue_count }))
      .catch(console.error);
  }
}, [isOpen, leadId]);
```

### 4.3 Update Props Interface

```typescript
interface LeadWorkspaceDrawerProps {
  leadId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onNext?: (nextLeadId: string) => void;  // Updated: receives next lead ID
  onArchive?: () => void;
}
```

---

## 5. Backfill Script

### 5.1 File: `scripts/backfill_pipeline_status.py`

```python
#!/usr/bin/env python3
"""
Backfill pipeline_status for existing form submissions.
Run with --dry-run first to preview changes.
"""

import boto3
import argparse
from datetime import datetime

def backfill_pipeline_status(dry_run: bool = True):
    dynamodb = boto3.client('dynamodb', region_name='us-east-1')
    table_name = 'picasso_form_submissions'

    updated_count = 0
    scanned_count = 0

    # Scan for items without pipeline_status
    paginator = dynamodb.get_paginator('scan')

    for page in paginator.paginate(
        TableName=table_name,
        FilterExpression='attribute_not_exists(pipeline_status)',
        ProjectionExpression='submission_id, tenant_id, submitted_at'
    ):
        for item in page.get('Items', []):
            scanned_count += 1
            submission_id = item['submission_id']['S']
            tenant_id = item['tenant_id']['S']
            submitted_at = item.get('submitted_at', {}).get('S', datetime.utcnow().isoformat())

            print(f"{'[DRY RUN] ' if dry_run else ''}Updating: {submission_id}")

            if not dry_run:
                try:
                    dynamodb.update_item(
                        TableName=table_name,
                        Key={'submission_id': {'S': submission_id}},
                        UpdateExpression='''
                            SET pipeline_status = :status,
                                tenant_pipeline_key = :tpk,
                                internal_notes = if_not_exists(internal_notes, :empty),
                                updated_at = :now
                        ''',
                        ExpressionAttributeValues={
                            ':status': {'S': 'new'},
                            ':tpk': {'S': f'{tenant_id}#new'},
                            ':empty': {'S': ''},
                            ':now': {'S': datetime.utcnow().isoformat() + 'Z'}
                        }
                    )
                    updated_count += 1
                except Exception as e:
                    print(f"  ERROR: {e}")
            else:
                updated_count += 1

    print(f"\n{'[DRY RUN] ' if dry_run else ''}Summary:")
    print(f"  Scanned: {scanned_count} items")
    print(f"  {'Would update' if dry_run else 'Updated'}: {updated_count} items")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Backfill pipeline_status')
    parser.add_argument('--dry-run', action='store_true', help='Preview changes without writing')
    parser.add_argument('--execute', action='store_true', help='Actually perform the updates')
    args = parser.parse_args()

    if not args.dry_run and not args.execute:
        print("Please specify --dry-run or --execute")
        exit(1)

    backfill_pipeline_status(dry_run=not args.execute)
```

### 5.2 Run Backfill

```bash
# Preview changes
AWS_PROFILE=chris-admin python3 scripts/backfill_pipeline_status.py --dry-run

# Execute backfill
AWS_PROFILE=chris-admin python3 scripts/backfill_pipeline_status.py --execute
```

---

## 6. Testing Plan

### 6.1 DynamoDB Tests

```bash
# Verify GSI exists and is ACTIVE
aws dynamodb describe-table \
  --table-name picasso_form_submissions \
  --query 'Table.GlobalSecondaryIndexes[?IndexName==`tenant-pipeline-index`].IndexStatus' \
  --profile chris-admin

# Test GSI query
aws dynamodb query \
  --table-name picasso_form_submissions \
  --index-name tenant-pipeline-index \
  --key-condition-expression "tenant_pipeline_key = :tpk" \
  --expression-attribute-values '{":tpk":{"S":"MYR384719#new"}}' \
  --profile chris-admin
```

### 6.2 API Tests

```bash
# Generate JWT token first (see CLAUDE.md)
TOKEN="your-jwt-token"

# Test lead detail
curl -s "https://[API_URL]/leads/apply_mentorship_1735380344456" \
  -H "Authorization: Bearer $TOKEN" | jq

# Test status update
curl -s -X PATCH "https://[API_URL]/leads/apply_mentorship_1735380344456/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pipeline_status": "reviewing"}' | jq

# Test notes update
curl -s -X PATCH "https://[API_URL]/leads/apply_mentorship_1735380344456/notes" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"internal_notes": "Called, left voicemail"}' | jq

# Test queue
curl -s "https://[API_URL]/leads/queue?status=new" \
  -H "Authorization: Bearer $TOKEN" | jq
```

### 6.3 Frontend Tests

1. Open drawer and verify real data loads
2. Change status and verify it persists on refresh
3. Add notes and verify autosave
4. Archive and verify it moves to archived status
5. Click "Next Lead" and verify navigation

---

## 7. Deployment Order

Execute in this order to avoid breaking changes:

### Phase 1: Database (No Downtime)
1. Create GSI using AWS CLI command
2. Wait for GSI status to become ACTIVE (~5-10 min)
3. Run backfill script with `--dry-run`
4. Run backfill script with `--execute`

### Phase 2: Backend (Rolling Update)
1. Deploy Bedrock Handler with new fields
2. Deploy Analytics API with new endpoints
3. Test API endpoints with curl

### Phase 3: Frontend (After Backend Verified)
1. Add API methods to analyticsApi.ts
2. Update LeadWorkspaceDrawer.tsx
3. Test locally
4. Deploy to staging
5. Test in staging
6. Deploy to production

---

## Appendix A: Environment Variables

Ensure these are set in Analytics_Dashboard_API:

```
FORM_SUBMISSIONS_TABLE=picasso_form_submissions
```

---

## Appendix B: Rollback Plan

If issues occur:

1. **Frontend**: Revert to mock data by uncommenting `getMockLeadData()`
2. **API**: Previous Lambda version can be restored
3. **DynamoDB**: New fields are additive - no rollback needed
4. **GSI**: Can be deleted if not needed: `aws dynamodb update-table --table-name picasso_form_submissions --global-secondary-index-updates "[{\"Delete\":{\"IndexName\":\"tenant-pipeline-index\"}}]"`

---

## Appendix C: Security Checklist

- [x] All endpoints validate `tenant_id` from JWT
- [x] Direct item access verified against tenant ownership
- [x] Input validation on status enum
- [x] Notes length limit (10000 chars)
- [x] Submission ID format validation
- [x] Feature flag (`dashboard_forms`) required
