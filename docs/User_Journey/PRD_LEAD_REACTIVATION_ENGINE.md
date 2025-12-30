# PRD: Emerald Lead Reactivation Engine

**Version:** 4.2.1-STABLE
**Status:** Final / Approved
**Author:** Senior Product Manager, Mission Intelligence
**Release Window:** Q1 2025
**Last Updated:** 2025-12-28

---

## 1. Executive Summary

The Lead Reactivation Engine transforms the Emerald Archive from a "terminal graveyard" into a "dynamic asset vault." This feature introduces a high-integrity workflow for reviving deactivated leads, ensuring that no historical data is lost and that every reactivation is accompanied by a transparent audit trail. The focus is on state-aware UI transitions and contextual restoration.

---

## 2. The Opportunity

Currently, leads are archived once their immediate lifecycle ends. However, business intelligence shows that **15-20% of "dead" leads re-engage within 6 months**. Without a reactivation flow, administrators either create duplicate records (fragmenting data) or lose the historical internal notes.

**The Solution:** A "Restore-with-Context" capability that allows one-click migration from the desaturated "Vault" back into the vibrant "Active Queue."

---

## 3. User Persona

### The Growth Specialist

An admin tasked with re-mining old data for new opportunities. They need to:
- See archived data clearly (without it cluttering current tasks)
- Have a frictionless way to "wake up" a record and start working immediately

---

## 4. Functional Requirements

### 4.1 The "Vault" State (Conditional UI)

| Requirement | Description |
|-------------|-------------|
| **Visual Fog** | When a lead is in the archived state, the drawer must enter "Vault Mode." This includes a desaturated color palette (70% saturation) and a background watermark (Ghost icon) to provide immediate visual context that the record is inactive. |
| **Read-Only Safeguards** | Primary growth actions (like the Mailto link) must be disabled or "shrouded" in the vaulted state to prevent accidental engagement before reactivation. |

### 4.2 State Transition Logic

| Transition | Behavior |
|------------|----------|
| **Terminal to Active** | The primary action in the Vaulted Drawer must transition from "Archive" to "Reactivate Lead." |
| **State Reset** | Upon reactivation, the lead's status must reset to `new` by default (or the first stage of the active pipeline). |

### 4.3 Automated Audit Trail (The System Note)

| Requirement | Description |
|-------------|-------------|
| **Traceability** | Every reactivation must automatically prepend a system-generated note to the `internal_notes` field. |
| **Metadata** | The note must include: `[System]` tag, action (`Restored from Archive`), high-precision ISO timestamp |
| **Data Preservation** | Existing user notes must never be overwritten; the audit trail is strictly additive. |

**Example System Note:**
```
[System] Restored from Archive at 2025-01-15T14:32:47.123Z
---
[Previous notes below]
```

### 4.4 Global Navigation Context

| Requirement | Description |
|-------------|-------------|
| **Filter Persistence** | The "View Archive" toggle in the main list must persist the user's focus. |
| **Live Sync** | When a lead is reactivated from within the drawer, the main list (background) must reactively remove that lead from the "Archive Vault" view if the filter is still active. |

---

## 5. UI & Interaction Design (The "Emerald Revive" Experience)

### 5.1 The "Ghost-to-Vibrant" Mask

| Element | Specification |
|---------|---------------|
| **Interaction** | When the "Reactivate" button is triggered, the drawer saturation must "bloom" back to 100% over a **400ms transition**. |
| **Psychology** | This provides the user with a dopamine hit, signaling that the lead is now "alive" and ready for high-value operations. |

### 5.2 The "Vault Pulse" Animation

| Element | Specification |
|---------|---------------|
| **Visual** | The `RefreshCw` icon on the reactivation button should execute a **360-degree rotation** with an emerald glow trail upon click. |
| **Feedback** | This confirms the backend DynamoDB sync has initiated successfully. |

### 5.3 Desaturated List Rows

| Element | Specification |
|---------|---------------|
| **Aesthetics** | Archived leads in the main list view must use **grayscale** and **opacity-80**. |
| **Scanning** | This allows the admin to scan the vault without the visual "noise" of active emerald badges, ensuring the vault feels "quiet" compared to the active workspace. |

---

## 6. UI Mockups & Visual Reference

> **Note:** Mockup images should be placed in `docs/mockups/reactivation-engine/` directory.
> Source files provided by Product on 2025-12-28.

### 6.1 Active Workspace (Default View)

**Mockup:** `active-workspace.png`

**Key Elements:**
- **Title:** "Active Workspace" with subtitle "LIVE INTERACTION PIPELINE"
- **VIEW ARCHIVE Button:** Outlined button with archive icon in header
- **Status Indicators:** Green dot (NEW), Orange dot (IN PROGRESS)
- **Columns:** CURRENT STATE, CONTACT, SOURCE TYPE, WORKSPACE NOTES, LAST INGESTED, COMMAND
- **Footer:** "X RECORDS IN FOCUS" counter

### 6.2 Archive Vault (Vault View)

**Mockup:** `archive-vault.png`

**Key Elements:**
- **Title:** "Archive Vault" with subtitle "REVIEWING DEACTIVATED RECORDS"
- **EXIT VAULT Button:** Solid dark button with refresh icon (replaces VIEW ARCHIVE)
- **Status Indicator:** Gray dot with "ARCHIVED" label
- **Visual Treatment:** Grayscale rows, muted badges, desaturated palette
- **Footer:** "X RECORD IN VAULT" counter (note singular/plural)

### 6.3 Vaulted Drawer - Header Notice

**Mockup:** `drawer-header-archived.png`

**Key Elements:**
- **Header Label:** "VAULTED ARCHIVE" (replaces "LEAD WORKSPACE")
- **Desaturated UI:** 70% saturation applied to entire drawer
- **Ghost Watermark:** Subtle background overlay indicating inactive state
- **Archived State Callout:** Amber/gold info box containing:
  - Icon: Information circle
  - Title: "ARCHIVED STATE"
  - Message: "This lead is currently read-only and removed from active queues. Reactivate to continue engagement."
- **Disabled Actions:** PRIMARY CONTACT mailto link is grayed out with disabled external link icon

### 6.4 Vaulted Drawer - Footer CTAs

**Mockup:** `drawer-footer-archived.png`

**Key Elements:**
- **REACTIVATE LEAD Button:** Primary emerald green with `RefreshCw` icon (replaces ARCHIVE RECORD)
- **NEXT LEAD Button:** Dark/navy button with arrow icon
- **SAVE & EXIT WORKSPACE Button:** Full-width outlined button below

**Button Behavior:**
| Button | Action |
|--------|--------|
| REACTIVATE LEAD | Triggers 400ms saturation bloom, resets status to `new`, prepends system note |
| NEXT LEAD | Navigates to next archived record in vault queue |
| SAVE & EXIT WORKSPACE | Closes drawer, returns to vault list view |

---

## 7. Technical Constraints & Security

| Constraint | Description |
|------------|-------------|
| **Idempotency** | Reactivating an already active lead should result in a "no-op" to prevent redundant system notes. |
| **Audit Persistence** | Once a "Restoration Note" is written to the DynamoDB notes field, it becomes part of the immutable history of that lead. |
| **Performance** | The state transition must occur locally in the state manager immediately, with the backend sync happening in the background to maintain the "Emerald Speed" standard. |

---

## 8. Success Metrics

| Metric | Target |
|--------|--------|
| **Lead Recovery Rate** | 10% of archived leads reactivated within the first 30 days of deployment |
| **Data Integrity** | 0% loss of historical notes during state transitions |
| **User Efficiency** | Average time from "Vault Open" to "Lead Reactivated" < 5 seconds |

---

## 9. Implementation Checklist

### Phase 1: Backend Support
- [ ] Add `PATCH /leads/{id}/reactivate` endpoint to Analytics Dashboard API
- [ ] Implement system note prepending logic
- [ ] Add idempotency check for already-active leads

### Phase 2: Frontend - Vault Mode UI
- [ ] Implement desaturated drawer state (70% saturation filter)
- [ ] Add ghost watermark background for archived leads
- [ ] Disable mailto/tel links in vault state
- [ ] Replace "Archive" button with "Reactivate Lead" for archived leads

### Phase 3: Frontend - Animations
- [ ] Implement 400ms saturation bloom transition
- [ ] Add RefreshCw icon rotation animation with emerald glow
- [ ] Apply grayscale + opacity-80 to archived rows in list view

### Phase 4: Integration
- [ ] Wire reactivation button to API endpoint
- [ ] Implement optimistic UI updates
- [ ] Add "View Archive" toggle filter to submissions table
- [ ] Ensure live sync removes reactivated leads from archive view

---

## 10. Related Documentation

- [LEAD_WORKSPACE_BACKEND_AUDIT.md](../../LEAD_WORKSPACE_BACKEND_AUDIT.md) - Backend gap analysis
- [ANNEX_C_FORMS_DASHBOARD.md](./ANNEX_C_FORMS_DASHBOARD.md) - Forms dashboard specification
- [USER_JOURNEY_ANALYTICS_PLAN.md](./USER_JOURNEY_ANALYTICS_PLAN.md) - Overall analytics plan

---

## Appendix A: State Diagram

```
┌─────────────┐     Archive      ┌─────────────┐
│             │ ───────────────► │             │
│   ACTIVE    │                  │  ARCHIVED   │
│  (Vibrant)  │ ◄─────────────── │   (Vault)   │
│             │    Reactivate    │             │
└─────────────┘                  └─────────────┘
      │                                │
      │ Status Flow:                   │ Visual State:
      │ new → reviewing → contacted    │ • 70% saturation
      │                                │ • Ghost watermark
      │                                │ • Disabled actions
      ▼                                ▼
```

## Appendix B: System Note Format

```typescript
interface SystemNote {
  tag: '[System]';
  action: 'Restored from Archive';
  timestamp: string; // ISO 8601 with milliseconds
}

// Example output:
// "[System] Restored from Archive at 2025-01-15T14:32:47.123Z\n---\n"
```
