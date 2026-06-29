# Scheduling Settings — UI Review Findings

Running log from the fine-tooth-comb review of the Scheduling Settings page
(`SchedulingSetup.tsx`) and its wiring to the backend. Admin view.

**Started:** 2026-06-29 · **Branch:** `align/recent-messages-iam-followup` (dashboard repo)
**Scope so far:** Section 1 — "What can be booked" (Appointment Types + Teams)

Status legend: ✅ Fixed · 🔵 Logged (no change yet) · 🟡 Needs build · 🔴 Bug

---

## Section 1 — What can be booked

### ✅ F1 — "Everyone (solo)" → "Everyone"
The team label fell back to `"Everyone (solo)"` for any unconditioned routing policy.
"(solo)" was misleading (it implies one person; the policy actually pools everyone
bookable, and the backend's runtime "solo" = `poolSize == 1` is a different concept).
**Fix:** `teamLabel` fallback string → `"Everyone"` (`SchedulingSetup.tsx:38-41`). Frontend-only
(the name was never stored).

### ✅ F2 — "tenant vocabulary" jargon removed → "Team Name"
Internal term "tenant vocabulary" leaked into user-facing copy in 3 strings; the
team-tag field was labeled "Team tag". **Fix (copy only):**
- Field label "Team tag" → **"Team Name"**; placeholder → `Volunteer Coordinators (leave blank = Everyone)`
- Helper, team-save error, staff teams empty-state, staff-save error reworded to drop "tenant vocabulary".
- Tests updated (`SchedulingSetup.test.tsx`, `StaffSchedulingSection.test.tsx`); 21 green.
Internal identifiers (`fetchTagVocabulary`, `/scheduling/tag-vocabulary`, `scheduling_tag_vocabulary`)
left unchanged — not user-facing.

### ✅ F7 — Minute fields step by 15
Duration/lead/buffer inputs stepped by 1. **Fix:** `step={15}` on all four; duration
`min` 1 → 15 (`SchedulingSetup.tsx` appointment-type form). Client-side UX only — server
still accepts any `1..480` (`lambda_function.py:4503`), so not enforced, just a nicer stepper.

### ✅ F8 — Every appointment-type / team EDIT 502'd "failed to update appointment type" (HIGH) — FIXED + DEPLOYED to staging
Saving any edit in Section 1 returned the error. **Root cause (confirmed via CloudWatch
`Analytics_Dashboard_API`, staging 525, 2026-06-29):**
```
ValidationException: Value provided in ExpressionAttributeNames unused in expressions: keys: {#at}
```
Logged for BOTH `[routing policy] update failed` and `[appointment type] update failed` — both
edit paths broken.
- `_update_scheduling_row` declared `#at` in `ExpressionAttributeNames` unconditionally, but
  `#at` is only *used* in the real-If-Match branch (`#mod.#at = :ifmatch`). Rows with no
  `modified_at` stamp (fixture/legacy) make the frontend send `If-Match: '*'`, which takes the
  `attribute_not_exists(#mod)` branch that never references `#at` → DynamoDB rejects the unused
  name → 502. (Create works because it's a `PutItem`, no condition.)
- **Why CI was green:** unit tests mock `update_item` (`test_scheduling_config_write.py:144`),
  and the only update test used a *real* If-Match (else branch), so the `'*'` path had zero
  coverage — the live ValidationException could never surface.

**Fix:** declare `#at` only inside the else branch that uses it
(`Lambdas/lambda/Analytics_Dashboard_API/lambda_function.py` `_update_scheduling_row`).
**Regression test:** `test_routing_policy_update_star_if_match_no_unused_names` exercises the
`'*'` branch and asserts every declared `ExpressionAttributeName` is referenced (58 tests pass).
**Deploy:** patched the live staging artifact in place (preserving bundled deps) →
`update-function-code` → `LastUpdateStatus: Successful`. Rollback artifact saved.
**Still open:** commit + PR the code/test to the `Lambdas/lambda` submodule (staging-first).

### ✅ F6 — Team Names authoring (the "create vocabulary on this page" feature) — SHIPPED
Team Names (`scheduling_tag_vocabulary`) lived in the tenant config JSON in S3, **read-only**
from every tool, so admins could only make "Everyone" teams. **Built (value-is-label model):**
- **Backend (lambda#353):** new ADMIN-only `PUT /scheduling/tag-vocabulary` — replace-list write
  via an S3 read-modify-write of *only* `scheduling.scheduling_tag_vocabulary` (modeled on
  `update_tenant_scheduling_activation`; ETag optimistic lock; siblings preserved). FAIL-CLOSED
  **delete-guard**: removing a name still referenced by a routing policy's `tag_conditions` OR a
  staffer's `scheduling_tags` → `422 {inUseTags, references}`. Validation: ≤50 chars, deduped,
  ≤100 names. Full ADA suite 497 passed; deployed + smoke-tested on staging.
- **Frontend (dashboard#47):** a **"Team Names" manager** at the top of the Teams subsection
  (chips + remove + inline add; each add/remove is a replace-list PUT; 422 in-use surfaces a
  "reassign first" message and keeps the name; duplicate adds blocked client-side).
**IA note:** kept as a distinct "Team Names" block above "Teams" (clearer than one merged list,
since a name can be used by staff tagging independent of any routing policy).

### 🟡 F9 — Section 1 needs help text
No guidance anywhere on what duration / lead time / buffers / location / "Handled by team"
mean, or the lifecycle ("set a team → tag staff → connect calendars → bookable"). Needs
content design pass across the appointment-type and team forms. (Pairs with F6 — once Team
Names are authorable, the team form copy changes too.)

### 🔵 F4 — Editing "Everyone" + adding a name silently re-scopes it (footgun)
Edit on a team PATCHes the same `routing_policy_id` (`SchedulingSetup.tsx:266-285`), so adding
a Team Name to "Everyone" converts that policy in place — and every appointment type pointed at
it is silently restricted to the new name. No guard, no warning. Decide: guard/confirm dialog,
or make "Everyone" a non-editable implicit policy. (Note: while F8 is unfixed this edit 502s
anyway, but the footgun stands once F8 is fixed.)

### ✅ F3 — Team Name field is a picker, not free text — SHIPPED (with F6, dashboard#47)
The team form's "Team Name" field was a free-text input (server 422-on-typo). **Fixed:** it is
now a `<select>` sourced from the authored vocabulary (author once, select everywhere; no typos),
matching `StaffSchedulingSection`'s checkbox picker. Blank = Everyone; a defensive off-vocabulary
option keeps an existing team's value selectable so editing never silently re-scopes it.

### 🔵 F5 — New tenants start with zero teams (possible onboarding gap)
"Add appointment type" is disabled until a team exists ("Add a team first",
`SchedulingSetup.tsx:427`); nothing auto-provisions a default. Decide whether onboarding should
auto-create an "Everyone" team so the first admin isn't gated.
