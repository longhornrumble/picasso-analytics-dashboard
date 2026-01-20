# UI Improvements: User Info Display & Super Admin Tenant Switching

## Overview
Three enhancements to the analytics dashboard:
1. Pass user info (name, role, company) from Bubble via JWT
2. Display user info in the header next to Sign Out
3. Super admin tenant switching via dropdown

---

## Part 1: Bubble JWT Changes (User Action Required)

### Fields to Add in Bubble JWT Payload
```json
{
  "tenant_id": "MYR384719",
  "tenant_hash": "my87674d777bf9",
  "email": "chris@myrecruiter.ai",
  "name": "Chris Miller",
  "role": "super_admin",           // NEW: "super_admin", "admin", "viewer"
  "company": "MyRecruiter",        // NEW: Organization/company name
  "features": {                    // NEW: Dashboard feature flags
    "dashboard_conversations": true,
    "dashboard_forms": true,
    "dashboard_attribution": false
  },
  "exp": 1767724800
}
```

---

## Part 2: Dashboard Code Changes

### Files to Modify

| File | Changes |
|------|---------|
| `src/types/analytics.ts` | Add `role`, `company` to User interface |
| `src/context/AuthContext.tsx` | Extract new JWT fields |
| `src/App.tsx` | Add user info display + tenant dropdown to NavigationBar |
| `src/services/analyticsApi.ts` | Add `fetchTenantList()` endpoint, update API calls to support tenant override |

### Step 1: Update User Type
**File:** `src/types/analytics.ts`

```typescript
export interface User {
  tenant_id: string;
  tenant_hash: string;
  email?: string;
  name?: string;
  role?: 'super_admin' | 'admin' | 'viewer';  // NEW
  company?: string;                            // NEW
  features?: DashboardFeatures;
}
```

### Step 2: Update JWT Extraction
**File:** `src/context/AuthContext.tsx`

Update `extractUserFromToken()` to include:
```typescript
role: payload.role as User['role'],
company: payload.company as string | undefined,
```

### Step 3: Update NavigationBar
**File:** `src/App.tsx`

Add to NavigationBar props:
- `user: User | null`
- `selectedTenant: string | null`
- `onTenantChange: (tenantId: string) => void`
- `tenantList: TenantOption[]`

UI Changes (desktop, next to SIGN OUT):
```
[User Avatar] Chris Miller | MyRecruiter | [Tenant Dropdown ▼] [SIGN OUT]
```

Mobile: Add user info section above Sign Out in mobile menu.

### Step 4: Add Tenant List API
**File:** `src/services/analyticsApi.ts`

```typescript
interface TenantOption {
  tenant_id: string;
  tenant_hash: string;
  name: string;  // Display name
}

export async function fetchTenantList(): Promise<TenantOption[]> {
  // GET /admin/tenants - only returns data for super_admin role
}
```

### Step 5: Add Tenant Context
**File:** `src/context/TenantContext.tsx` (NEW)

Create context to manage:
- `selectedTenant: string | null` (null = use JWT tenant)
- `setSelectedTenant(tenantId: string)`
- `effectiveTenantHash: string` (for API calls)

### Step 6: Update API Calls
**File:** `src/services/analyticsApi.ts`

All API calls should use `effectiveTenantHash` instead of JWT tenant when super admin has selected a different tenant. Add optional `tenantOverride` parameter to API functions.

---

## Part 3: Lambda Changes (Backend)

### New Endpoint: GET /admin/tenants
**File:** `Lambdas/lambda/Analytics_Dashboard_API/`

- Validate JWT has `role: 'super_admin'`
- Query DynamoDB or config for tenant list
- Return: `[{ tenant_id, tenant_hash, name }, ...]`

### Update Existing Endpoints
- Accept optional `X-Tenant-Override` header
- Validate requester has super_admin role before allowing override
- Use override tenant_hash for queries if provided

---

## Implementation Order

1. **Bubble**: Add role, company, features to JWT
2. **Dashboard**: Update types and JWT extraction
3. **Dashboard**: Add user info to header (visible immediately)
4. **Lambda**: Add `/admin/tenants` endpoint
5. **Dashboard**: Add tenant dropdown (only visible for super_admin)
6. **Lambda**: Add tenant override support to existing endpoints
7. **Dashboard**: Wire up tenant switching to refetch data

---

## Security Considerations

- Tenant override MUST be validated server-side (Lambda checks role)
- Never trust client-side role for authorization
- Log all tenant switches for audit trail
- Consider rate limiting tenant list endpoint

