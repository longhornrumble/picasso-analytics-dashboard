/**
 * LeadWorkspacePanel — the tabbed lead workspace slide-over, built to the
 * "Scheduling + Lead Workspace" design spec.
 *
 * Presentational + self-contained: driven entirely by a `lead` prop (no fetching),
 * so it can be folded into the scheduling view now and wired to real lead data
 * (the booking→lead join) later. Slides up from the bottom on mobile, in from the
 * right on desktop. Data-dependent tabs degrade to honest empty states when the
 * lead carries no note / form fields / activity yet.
 *
 * Security: lead name / note / field values are USER-GENERATED — rendered as text
 * (React escapes), or through mailto:/tel: hrefs built from the raw value.
 */
import { useState } from 'react';

export interface LeadWorkspaceAppointment {
  dow: string;
  day: string;
  title: string;
  time: string;
  dispo?: string;
  joinable?: boolean;
  joinHref?: string;
}
export interface LeadWorkspaceField {
  label: string;
  value: string;
}
export interface LeadWorkspaceActivity {
  label: string;
  meta: string;
}
export interface LeadWorkspaceLead {
  name: string;
  relationship?: string;
  appName?: string;
  program?: string;
  /** Categorical swatch for the program (fg/bg hex); falls back to brand emerald. */
  programColor?: { fg: string; bg: string };
  phone?: string;
  email?: string;
  /** Free-text "what they want to talk about" (needs the lead join). */
  note?: string;
  /** Current contact phase (one of PHASES). */
  phase?: string;
  appointments?: LeadWorkspaceAppointment[];
  fields?: LeadWorkspaceField[];
  activity?: LeadWorkspaceActivity[];
}

export interface LeadWorkspacePanelProps {
  lead: LeadWorkspaceLead | null;
  isOpen: boolean;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onArchive?: () => void;
  onSchedule?: () => void;
  /** Leads remaining in the queue (shown in the footer). */
  queueCount?: number;
}

type Tab = 'overview' | 'form' | 'notes' | 'activity';
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'form', label: 'Form Responses' },
  { id: 'notes', label: 'Notes' },
  { id: 'activity', label: 'Activity' },
];
const PHASES = ['New', 'Reviewing', 'Contacted', 'Disqualified', 'Advancing'];
const SECTION = 'text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400';

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3.5 text-sm leading-relaxed text-slate-400">
      {children}
    </div>
  );
}

export function LeadWorkspacePanel({
  lead,
  isOpen,
  onClose,
  onPrev,
  onNext,
  onArchive,
  onSchedule,
  queueCount,
}: LeadWorkspacePanelProps) {
  const [tab, setTab] = useState<Tab>('overview');

  if (!lead || !isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} aria-hidden="true" className="lwp-backdrop fixed inset-0 z-[60] bg-slate-900/40" />
      {/* Sheet — slides up from the bottom on mobile, in from the right on desktop (lwp-sheet keyframes). */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Lead workspace"
        className="lwp-sheet fixed z-[61] flex flex-col bg-white
          inset-x-0 bottom-0 max-h-[94vh] rounded-t-[20px] shadow-[0_-12px_44px_rgba(15,27,45,0.22)]
          lg:inset-y-0 lg:right-0 lg:left-auto lg:bottom-auto lg:h-full lg:max-h-none lg:w-[560px] lg:max-w-[94vw] lg:rounded-none lg:shadow-[-18px_0_50px_rgba(15,27,45,0.18)]"
      >
        {/* Header */}
        <div className="flex-none border-b border-slate-100 px-7 pt-7">
          <div className="mb-4 flex items-start justify-between">
            <div className="min-w-0">
              <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.09em] text-slate-400">
                Lead Workspace
              </div>
              <div className="flex items-center gap-2.5">
                <div className="text-[25px] font-bold leading-none tracking-tight text-slate-900">{lead.name}</div>
                {lead.relationship && (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500">
                    {lead.relationship}
                  </span>
                )}
              </div>
              {lead.appName && <div className="mt-1.5 text-sm text-slate-500">{lead.appName}</div>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close lead workspace"
              className="flex-none rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-lg leading-none text-slate-500 hover:bg-slate-50"
            >
              ✕
            </button>
          </div>
          <div className="flex gap-6" role="tablist" aria-label="Lead workspace sections">
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(t.id)}
                  className={`-mb-px border-b-[2.5px] pb-3 text-sm transition-colors ${
                    active
                      ? 'border-primary-700 font-bold text-primary-700'
                      : 'border-transparent font-semibold text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-7 py-6">
          {tab === 'overview' && (
            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 px-4 py-3">
                  <div className="mb-1 text-[10.5px] font-bold uppercase tracking-[0.06em] text-slate-400">Program</div>
                  <div className="text-sm font-bold text-slate-900">{lead.program || '—'}</div>
                </div>
                <div className="rounded-xl border border-slate-200 px-4 py-3">
                  <div className="mb-1 text-[10.5px] font-bold uppercase tracking-[0.06em] text-slate-400">Contact</div>
                  <div className="text-[13px] font-bold text-slate-900">{lead.phone || lead.email || '—'}</div>
                </div>
              </div>

              <div>
                <div className={`${SECTION} mb-2.5`}>What they want to talk about</div>
                {lead.note ? (
                  <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3.5 text-sm leading-relaxed text-slate-700">
                    “{lead.note}”
                  </div>
                ) : (
                  <EmptyState>Conversation context appears here once this booking is linked to the lead's profile.</EmptyState>
                )}
              </div>

              <div>
                <div className={`${SECTION} mb-2.5`}>Contact phase</div>
                <div className="flex flex-wrap gap-2">
                  {PHASES.map((p) => {
                    const current = lead.phase === p;
                    return (
                      <span
                        key={p}
                        className={`rounded-full px-3.5 py-1.5 text-xs font-bold ${
                          current ? 'bg-primary-700 text-white' : 'border border-slate-200 bg-white text-slate-400'
                        }`}
                      >
                        {p}
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-primary-200 bg-primary-50 px-4 py-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.05em] text-primary-700">
                    📅 Appointments
                  </div>
                  {onSchedule && (
                    <button type="button" onClick={onSchedule} className="text-xs font-bold text-primary-700 hover:underline">
                      + Schedule
                    </button>
                  )}
                </div>
                {lead.appointments && lead.appointments.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {lead.appointments.map((ap, i) => (
                      <div key={i} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2.5">
                        <div className="w-12 flex-none text-center">
                          <div className="text-[10px] font-bold uppercase text-slate-400">{ap.dow}</div>
                          <div className="text-[17px] font-bold leading-none text-slate-900">{ap.day}</div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[13.5px] font-bold text-slate-900">{ap.title}</div>
                          <div className="text-xs text-slate-500">{ap.time}</div>
                        </div>
                        {ap.joinable && ap.joinHref ? (
                          <a
                            href={ap.joinHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-none rounded-full bg-white px-3.5 py-1.5 text-xs font-bold text-primary-700 hover:bg-primary-100"
                          >
                            Join
                          </a>
                        ) : (
                          ap.dispo && (
                            <span className="flex-none rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500">
                              {ap.dispo}
                            </span>
                          )
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-primary-700/70">No appointments yet.</div>
                )}
              </div>

              <div>
                <div className={`${SECTION} mb-2.5`}>Communications</div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5">
                    <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-primary-50">✉️</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-slate-400">Email</div>
                      {lead.email ? (
                        <a href={`mailto:${lead.email}`} className="block truncate text-[13.5px] font-semibold text-slate-700 hover:text-primary-700">
                          {lead.email}
                        </a>
                      ) : (
                        <div className="text-[13.5px] font-semibold text-slate-400">—</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5">
                    <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-blue-50">📞</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-slate-400">Phone</div>
                      {lead.phone ? (
                        <a href={`tel:${lead.phone}`} className="block text-[13.5px] font-semibold text-slate-700 hover:text-primary-700">
                          {lead.phone}
                        </a>
                      ) : (
                        <div className="text-[13.5px] font-semibold text-slate-400">—</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'form' && (
            <div className="rounded-2xl border border-slate-200 px-4 py-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-bold uppercase tracking-[0.05em] text-primary-700">Form data</div>
              </div>
              {lead.fields && lead.fields.length > 0 ? (
                <>
                  {lead.fields.map((f, i) => (
                    <div key={i} className="flex items-start justify-between gap-4 border-b border-slate-100 py-2.5">
                      <span className="flex-none text-xs font-bold uppercase tracking-[0.04em] text-primary-700">{f.label}</span>
                      <span className="text-right text-sm text-slate-700">{f.value}</span>
                    </div>
                  ))}
                  <div className="pt-3 text-center text-xs font-semibold text-slate-400">{lead.fields.length} fields submitted</div>
                </>
              ) : (
                <EmptyState>Form responses appear here once this booking is linked to the lead's profile.</EmptyState>
              )}
            </div>
          )}

          {tab === 'notes' && <NotesTab />}

          {tab === 'activity' &&
            (lead.activity && lead.activity.length > 0 ? (
              <div className="flex flex-col">
                {lead.activity.map((a, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-none flex-col items-center">
                      <span className="mt-1 h-2.5 w-2.5 rounded-full bg-primary-500" />
                      {i < lead.activity!.length - 1 && <span className="w-0.5 flex-1 bg-slate-100" />}
                    </div>
                    <div className="pb-4">
                      <div className="text-[13.5px] font-bold text-slate-800">{a.label}</div>
                      <div className="mt-0.5 text-xs text-slate-400">{a.meta}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState>Activity appears here once this booking is linked to the lead's profile.</EmptyState>
            ))}
        </div>

        {/* Footer */}
        <div className="flex-none border-t border-slate-100 px-7 py-4">
          <div className="mb-3 flex items-center gap-3">
            <button
              type="button"
              onClick={onArchive}
              className="flex-none rounded-full bg-danger-50 px-4 py-2.5 text-[13px] font-bold text-danger-600 hover:bg-danger-100"
            >
              🗑 Archive
            </button>
            <button
              type="button"
              onClick={onPrev}
              className="ml-auto flex-none rounded-full border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-bold text-slate-600 hover:bg-slate-50"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={onNext}
              className="flex-none rounded-full bg-primary-500 px-5 py-2.5 text-[13px] font-bold text-white shadow-[0_8px_24px_rgba(80,200,120,0.28)] hover:bg-primary-600"
            >
              Next →
            </button>
          </div>
          <div className="text-center text-xs text-slate-400">
            {typeof queueCount === 'number' ? `${queueCount} leads remaining in queue · ` : ''}synced from Google Calendar
          </div>
        </div>
      </div>
    </>
  );
}

/** Notes tab — local-only composer (persistence arrives with the lead join). */
function NotesTab() {
  const [draft, setDraft] = useState('');
  const quickAdds = ['Left voicemail', 'Sent follow-up email', 'Scheduled callback', 'Needs more info'];
  return (
    <div>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Add notes about this lead…"
        aria-label="Lead notes"
        className="min-h-[84px] w-full rounded-xl border border-slate-200 p-3.5 text-[13.5px] text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
      />
      <div className="mb-3.5 mt-2 text-xs text-slate-400">
        Notes will save once this booking is linked to the lead's profile. Only visible to your team.
      </div>
      <div className="mb-2 text-xs font-bold text-slate-600">Quick add:</div>
      <div className="mb-5 flex flex-wrap gap-2">
        {quickAdds.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => setDraft((d) => (d ? `${d}\n${q}` : q))}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-primary-200 hover:bg-primary-50"
          >
            + {q}
          </button>
        ))}
      </div>
      <div className={`${SECTION} mb-3`}>Recent notes</div>
      <EmptyState>Past notes appear here once this booking is linked to the lead's profile.</EmptyState>
    </div>
  );
}
