# Program-Keyed Scheduling — Appointment-Type Binding + "Who handles bookings"

**Status:** Part 1 ✅ complete + tested (2026-06-30); Part 2 in progress. **Owner:** dashboard + `Analytics_Dashboard_API`.
**Design source:** `Scheduling Settings.dc.html` (v2) + handoff `README.md`.

**Part 1 done (uncommitted, working tree):** `GET /scheduling/programs` + `program_id` on the
appointment-type write handler (required, FK-validated against config.programs) + editor Name→
program picker (`<Select>` value=program_id/label=program_name, read-only program_id, name from
program). Verified: ADA `py_compile` OK, 78 ADA scheduling tests pass; dashboard `tsc` clean,
204 scheduling tests pass, lint clean. Canonical id = the nested `program_id` field (falls back
to the object key). Open (deferred-only): confirm the widget's `form.program` uses `program_id`
vs the object key before building runtime program-selection.

## Goal

Make `program_id` (from `config.programs`, the same key the chat widget uses) the shared
spine on the scheduling side, and deliver the "Who handles bookings" read-out grouped by
program. **No new DDB tables.** Staging-first.

## Locked model

```
config.programs (program_id + program_name)      ← canonical, widget's key
        │ 1:1, via a program dropdown on the appointment type
        ▼
Appointment Type  ── Handled by Team ──▶  Team (routing policy)  ──▶  members
   (+ program_id, NEW)   (routing_policy_id, existing)          (scheduling_tags, existing)
```

- **Individual ↔ Program:** many-to-many, **derived** (person → team → appointment type →
  program). Nothing new stored on staff.
- **A Team = exactly one tag** (verified: the Teams UI only writes
  `tag_conditions:[{operator:'in_any', values:[tag]}]`). So "assign to program" = add that
  program's team tag. Clean, reversible.
- **Program membership is truthful** — it reflects the team that actually gets routed the
  bookings, not a parallel flag.

## Storage — zero new tables

| Data | Store | Access |
|---|---|---|
| Program catalog (names + ids) | `config.programs` (S3 tenant config) | Lambda read, **5-min cached** |
| `program_id` on appointment type | scheduling config (S3) | existing appt-type write API |
| Staff team membership | employee registry (existing DDB) | existing `updateEmployeeScheduling` |

## Part 1 — the binding (prerequisite)

1. **`GET /scheduling/programs`** (`Analytics_Dashboard_API`) → projects `config.programs` to
   `[{program_id, program_name}]`, using the existing cached `load_tenant_config`.
   - _Verify:_ curl returns the tenant's programs; served from cache on repeat.
2. **`program_id` on the appointment type** — additive/optional (forward-compat: existing
   appointment types without it still validate). Added in **every** schema copy
   (config-builder Zod, lambda validation, dashboard TS) in lockstep.
   - _Verify:_ old appointment-type record (no `program_id`) still passes validation; a bound
     one round-trips through create/update → GET.
3. **Appointment-type editor** (`SchedulingSetup.tsx`): replace the free-text **Name** input
   with the canonical `<Select>` — options `{value: program_id, label: program_name}` from
   step 1 — plus an adjacent **read-only `program_id`** field that auto-fills on select.
   - _Verify:_ picking "Donor" stores `program_id`, shows the id read-only; Save persists it.
4. **Resolve the appointment type's display name from its bound program** so confirmation
   emails / the booking `appointment_type_name` snapshot don't go blank when the free-text
   Name is removed.
   - _Verify:_ a booking on a program-bound appointment type still renders a real name.

## Part 2 — the read-out ("Who handles bookings")

5. Rebuild `StaffSchedulingSection.tsx` to the v2 design: group by program
   (Program → appointment type → Team → members), coverage pills (`0`→danger "No bookable
   staff", `1`→warning, `≥2`→success), **thinnest-coverage-first sort**, 3-state status pill
   (effective bookable = `connected && !paused`), derived secondary lines, `Remind to connect`
   (+ Edit) on not-bookable rows, footer **"Manage team →"** (no Invite button).
6. **Person-scoped Edit modal** — Programs (checkboxes → the program's team tag) / Pause /
   Calendar email → writes via existing `updateEmployeeScheduling` PATCH; list re-renders.
7. **Program colors** — curated ordered palette keyed by program (not the label-hash in
   `MyAppointments.tsx`), always paired with the text label + marker.
8. **Reminders** — local component state v1 (mock parity); server-side `lastRemindedAt` + 24h
   cooldown is a follow-up.
   - _Verify:_ staff group under the right programs; a person on two programs appears under
     both; coverage gaps surface thinnest-first; assigning in the modal moves people between
     groups + recomputes coverage.

## Deferred (NOT this task)

Runtime "applicant's program_id → the program-bound appointment type → its team" at booking
time. Part 1 is the foundation this needs; runtime selection + stamping `program_id` on the
booking is a separate gated piece.

**B0 verified (2026-06-30):** the scheduling agent
(`Bedrock_Streaming_Handler_Staging/scheduling/newBookingEntry.js` `resolveQualifyingContext`,
:73-77) selects the appointment type by (1) explicit `routingMetadata.appointment_type_id`
from the CTA, else (2) the sole configured type, else (3) pass-through. **`program_id` is not
consulted at runtime.** The program→appointment-type link is realized by the onboarding-wired
CTA carrying `appointment_type_id`. So Part 1's `program_id` is **additive metadata that does
not touch the booking-selection path** (cannot break booking), and the "trump card" already
works via CTA wiring — runtime program-selection is optional, not blocking.

## Discipline

Staging-first; branch → PR → CI per repo. Forward-compatible reads (every new field optional
with a default). Canonical `<Select>` (not native/legacy). `primary-*` tokens, not raw
emerald. Additive schema field must land in all copies in lockstep.
