/**
 * NotificationTemplatesEditor — E14 (ui_plan Surface 7) — "Messages we send" (Stage 3 of the
 * Scheduling Settings lifecycle spine, per the "Scheduling Settings" design import).
 *
 * Per-tenant overrides of the scheduling lifecycle-notice EMAIL copy (admin-only — the §E14
 * endpoints enforce it). Each moment is a compact row; tapping one opens a slide-over editor
 * with subject + message, tap-to-insert merge variables, an advanced "Edit HTML" disclosure,
 * an SMS-copy field, and a live preview rendered with sample data.
 *
 * Moments (§E14): confirmation · reminder_24h · reminder_1h (S4a/b) and reschedule_link ·
 * reoffer · cancel_notice. Each renders only when the API returns it, so this stays graceful
 * against an older ADA. Saving an empty field RESETS that override to the platform default;
 * the editor seeds from the OVERRIDE only (never the effective copy) so a no-op Save can't
 * persist a default as an override. The STOP/unsubscribe line is appended by notify.js and is
 * not editable. SMS delivery is HELD platform-wide; the copy field saves now and applies once
 * the SMS sender lands (no per-tenant SMS toggle exists to gate it behind).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/useAuth';
import { useFocusTrap } from '../../hooks';
import { Toggle } from '../shared/Toggle';
import {
  fetchNotificationTemplates,
  updateNotificationTemplate,
  SchedulingApiError,
  type NotificationMoment,
  type MomentTemplate,
  type TemplateCopy,
  type NotificationTemplateWrite,
} from '../../services/schedulingApi';

/** The editor's per-moment draft = the editable email copy + the SMS override text. */
type EditorDraft = TemplateCopy & { sms_text: string };

const SMS_MAX = 480; // §E14 (G7a): ~3 segments; the STOP/HELP footer is appended on top server-side.

/** Static per-moment presentation: grouping, icon, blurb, and the preview CTA label. */
interface MomentMeta {
  id: NotificationMoment;
  name: string;
  /** Short row blurb / slide-over description. */
  desc: string;
  /** Slide-over eyebrow + the group caption in the list. */
  group: 'Confirm & remind' | 'When plans change';
  /** SVG path for the row/disclosure icon. */
  icon: string;
  /** Preview CTA button label; '' = no CTA. */
  cta: string;
  /**
   * Whether this moment renders a CTA button — an EXPLICIT per-template flag, not inferred from
   * the message id or a live {{actionUrl}} scan. (Design-review rule: a button is meaningless
   * without a link; the confirmation's reschedule link is auto-appended, so it carries a CTA.)
   */
  hasCta: boolean;
  /** Optional always-included note shown under the body. */
  note?: string;
}

const MAIL = 'M4 6h16a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V7a1 1 0 011-1zm0 1l8 6 8-6';
const BELL = 'M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0';
const CLOCK = 'M12 7v5l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
const SWAP = 'M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H3';
const BAN = 'M4.93 4.93l14.14 14.14M21 12a9 9 0 11-18 0 9 9 0 0118 0z';

// Ordered so .filter() preserves the design's grouping: confirm & remind, then when plans change.
const MOMENT_META: MomentMeta[] = [
  {
    id: 'confirmation', name: 'Booking confirmation', group: 'Confirm & remind', icon: MAIL,
    desc: 'Sent the moment a booking is confirmed.', cta: 'View / reschedule', hasCta: true,
    note: 'The calendar invite, .ics file and reschedule link are always included automatically.',
  },
  { id: 'reminder_24h', name: 'Reminder — 24 hours before', group: 'Confirm & remind', icon: BELL,
    desc: 'Sent the day before the appointment.', cta: '', hasCta: false },
  { id: 'reminder_1h', name: 'Reminder — 1 hour before', group: 'Confirm & remind', icon: CLOCK,
    desc: 'Sent about an hour before the appointment.', cta: '', hasCta: false },
  { id: 'reschedule_link', name: 'Reschedule link', group: 'When plans change', icon: SWAP,
    desc: 'Sent when someone needs to change their time.', cta: 'Reschedule', hasCta: true },
  { id: 'reoffer', name: 'Time no longer available', group: 'When plans change', icon: SWAP,
    desc: 'Sent when the chosen slot was taken before booking finished.', cta: 'Pick a new time', hasCta: true },
  { id: 'cancel_notice', name: 'Cancellation notice', group: 'When plans change', icon: BAN,
    desc: 'Sent when a booking is canceled.', cta: 'Book a new time', hasCta: true },
];

const GROUPS: MomentMeta['group'][] = ['Confirm & remind', 'When plans change'];

function errMessage(e: unknown): string {
  if (e instanceof SchedulingApiError) return e.message;
  return e instanceof Error ? e.message : 'Something went wrong';
}

// Seed from the OVERRIDE only — never the effective (default) copy — so "Save" on a moment the
// tenant never customized doesn't persist the platform default AS an override. (Audit row 7.)
const draftOf = (t: MomentTemplate): EditorDraft => ({
  subject: t.is_override ? t.subject : '',
  body_text: t.is_override ? t.body_text : '',
  body_html: t.is_override ? t.body_html : '',
  sms_text: t.sms_is_override ? (t.sms_text ?? '') : '',
});

export function NotificationTemplatesEditor() {
  const { user } = useAuth();
  const org = user?.company || 'Your organization';

  const [moments, setMoments] = useState<Record<string, MomentTemplate>>({});
  const [stopNote, setStopNote] = useState('');
  const [drafts, setDrafts] = useState<Record<string, EditorDraft>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savingMoment, setSavingMoment] = useState<string | null>(null);

  // Slide-over state.
  const [openId, setOpenId] = useState<NotificationMoment | null>(null);
  const [closing, setClosing] = useState(false);
  const [htmlOpen, setHtmlOpen] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  const load = useCallback(async (isActive: () => boolean, opts?: { silent?: boolean }) => {
    // `silent` re-fetch (post-save): don't flip the full-page spinner — collapsing the whole
    // section to a spinner shrinks the page and yanks the scroll to a neighboring section.
    if (!opts?.silent) setLoading(true);
    setLoadError(null);
    try {
      const data = await fetchNotificationTemplates();
      if (!isActive()) return;
      setMoments(data.moments);
      setStopNote(data.stop_footer_note);
      const d: Record<string, EditorDraft> = {};
      for (const [k, v] of Object.entries(data.moments)) d[k] = draftOf(v);
      setDrafts(d);
    } catch (e) {
      if (isActive()) setLoadError(errMessage(e));
    } finally {
      if (isActive()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    load(() => active);
    return () => {
      active = false;
    };
  }, [load]);

  const closeEditor = useCallback(() => {
    setClosing(true);
    setSaveError(null);
    window.setTimeout(() => {
      setOpenId(null);
      setClosing(false);
    }, 220);
  }, []);

  const panelRef = useFocusTrap({ isActive: openId != null && !closing, onEscape: closeEditor });

  function openEditor(id: NotificationMoment) {
    setOpenId(id);
    setClosing(false);
    setHtmlOpen(false);
    setSavedFlash(false);
    setSaveError(null);
  }

  function setField(id: NotificationMoment, field: keyof EditorDraft, value: string) {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? draftOf(moments[id])), [field]: value },
    }));
  }

  function insertVar(id: NotificationMoment, token: string) {
    const cur = drafts[id] ?? draftOf(moments[id]);
    const next = `${cur.body_text}${cur.body_text && !cur.body_text.endsWith(' ') ? ' ' : ''}${token}`;
    setField(id, 'body_text', next.trim());
    bodyRef.current?.focus();
  }

  function toggleEnabled(id: NotificationMoment, next: boolean) {
    persist(id, { enabled: next });
  }

  async function persist(id: NotificationMoment, body: NotificationTemplateWrite, flash = false) {
    setSavingMoment(id);
    setSaveError(null);
    try {
      await updateNotificationTemplate(id, body);
      await load(() => true, { silent: true });
      if (flash) {
        setSavedFlash(true);
        window.setTimeout(() => setSavedFlash(false), 1600);
      }
    } catch (e) {
      setSaveError(errMessage(e));
    } finally {
      setSavingMoment(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10" role="status" aria-live="polite">
        <div className="w-6 h-6 rounded-full animate-spin border-4 border-primary-200 border-t-primary-500" />
        <span className="sr-only">Loading messages…</span>
      </div>
    );
  }
  if (loadError) {
    return (
      <p className="text-sm text-red-600 py-8 text-center" role="alert">
        Couldn't load messages: {loadError}
      </p>
    );
  }

  // Only render moments the API actually returned (graceful against an older ADA).
  const present = MOMENT_META.filter((m) => moments[m.id]);
  const sel = openId ? MOMENT_META.find((m) => m.id === openId) : null;
  const selT = openId ? moments[openId] : null;

  return (
    <section aria-label="Messages we send" className="flex flex-col">
      <h3 className="text-[17px] font-bold text-slate-900">Messages we send</h3>
      <p className="text-[13px] text-slate-500 mt-0.5">
        Automatic emails at each step of a booking. Tap one to edit and preview it.
      </p>

      <div className="flex items-center gap-2 bg-primary-50 border border-primary-100 rounded-[10px] px-3 py-2.5 mt-3.5">
        <CheckIcon className="w-[15px] h-[15px] text-primary-700 shrink-0" />
        <span className="text-[12.5px] font-semibold text-primary-700">
          Every message already works out of the box. Editing is optional.
        </span>
      </div>
      {stopNote && <p className="text-[11.5px] text-slate-400 mt-2">{stopNote}</p>}

      {saveError && !openId && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mt-3" role="alert">
          {saveError}
        </p>
      )}

      {GROUPS.map((group) => {
        const rows = present.filter((m) => m.group === group);
        if (rows.length === 0) return null;
        return (
          <div key={group} className="mt-[18px]">
            <div className="text-[11px] font-bold tracking-[0.05em] uppercase text-slate-400 mb-2.5">{group}</div>
            <div className="flex flex-col gap-2">
              {rows.map((m) => {
                const t = moments[m.id];
                const enabled = t.enabled !== false;
                const busy = savingMoment === m.id;
                return (
                  <div
                    key={m.id}
                    className={`flex items-center gap-3 border rounded-xl px-[15px] py-3 transition-colors ${enabled ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50'}`}
                  >
                    <button
                      type="button"
                      onClick={() => openEditor(m.id)}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <span className={`w-9 h-9 rounded-[9px] flex items-center justify-center shrink-0 bg-slate-100 ${enabled ? 'text-slate-500' : 'text-slate-300'}`}>
                        <MomentIcon path={m.icon} />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className={`block text-sm font-bold ${enabled ? 'text-slate-900' : 'text-slate-400'}`}>{m.name}</span>
                        <span className="block text-xs text-slate-400">
                          {enabled ? (t.is_override ? 'Customized' : 'Default') : 'Off — not sent'} · {m.desc}
                        </span>
                      </span>
                      <ChevronIcon className="w-[18px] h-[18px] text-slate-300 shrink-0" />
                    </button>
                    <Toggle
                      checked={enabled}
                      disabled={busy}
                      onChange={(next) => toggleEnabled(m.id, next)}
                      ariaLabel={`${enabled ? 'Turn off' : 'Turn on'} ${m.name}`}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {sel && selT && (
        <Slideover
          meta={sel}
          t={selT}
          draft={drafts[sel.id] ?? draftOf(selT)}
          org={org}
          closing={closing}
          htmlOpen={htmlOpen}
          savedFlash={savedFlash}
          saving={savingMoment === sel.id}
          saveError={saveError}
          panelRef={panelRef}
          bodyRef={bodyRef}
          onClose={closeEditor}
          onToggleHtml={() => setHtmlOpen((v) => !v)}
          onField={(field, value) => setField(sel.id, field, value)}
          onInsertVar={(token) => insertVar(sel.id, token)}
          onSave={(d) => persist(sel.id, { subject: d.subject, body_text: d.body_text, body_html: d.body_html, sms_text: d.sms_text }, true)}
          onReset={() => persist(sel.id, { subject: '', body_text: '', body_html: '', sms_text: '' })}
        />
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Slide-over editor
// ---------------------------------------------------------------------------

/** Replace {{var}} with sample data for the live preview (unknown tokens are left in place). */
function resolveSample(str: string, org: string): string {
  const map: Record<string, string> = {
    firstName: 'Alex',
    org,
    apptType: 'Intro Call',
    programName: 'Family Support',
    whenLabel: 'on Sun, Jun 21 at 9:30 AM',
    when: 'on Sun, Jun 21 at 9:30 AM',
    actionUrl: '',
  };
  return (str || '')
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k: string) => (map[k] != null ? map[k] : m))
    .replace(/\s+:?\s*$/, '')
    .trim();
}

interface SlideoverProps {
  meta: MomentMeta;
  t: MomentTemplate;
  draft: EditorDraft;
  org: string;
  closing: boolean;
  htmlOpen: boolean;
  savedFlash: boolean;
  saving: boolean;
  saveError: string | null;
  panelRef: React.RefObject<HTMLDivElement | null>;
  bodyRef: React.RefObject<HTMLTextAreaElement | null>;
  onClose: () => void;
  onToggleHtml: () => void;
  onField: (field: keyof EditorDraft, value: string) => void;
  onInsertVar: (token: string) => void;
  onSave: (d: EditorDraft) => void;
  onReset: () => void;
}

function Slideover({
  meta, t, draft, org, closing, htmlOpen, savedFlash, saving, saveError,
  panelRef, bodyRef, onClose, onToggleHtml, onField, onInsertVar, onSave, onReset,
}: SlideoverProps) {
  // Trigger the enter transition one frame after mount.
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const shown = entered && !closing;

  const inputCls =
    'w-full px-3 py-2.5 text-sm border border-slate-200 rounded-[10px] text-slate-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500';

  // Preview shows the EFFECTIVE copy: the draft override when present, else the platform default.
  const eff = (field: keyof TemplateCopy) => (draft[field].trim() ? draft[field] : t.default[field]);
  const previewSubject = resolveSample(eff('subject'), org);
  const previewBody = resolveSample(eff('body_text').replace(/\{\{\s*actionUrl\s*\}\}/g, ''), org);
  // Fix #3: the CTA button renders from the template's explicit `hasCta` flag — never inferred
  // from the message id or a live {{actionUrl}} scan (both were the mock's shortcut).
  const hasCta = meta.hasCta;
  const smsText = draft.sms_text.trim() ? draft.sms_text : (t.sms_default ?? '');
  const previewSms = resolveSample(smsText, org);

  const vars = t.available_variables ?? [];
  const smsLen = draft.sms_text.length;
  const smsSegments = smsLen <= 160 ? 1 : Math.ceil(smsLen / 153);

  return (
    <div className="fixed inset-0 z-[60]">
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`absolute inset-0 bg-slate-900/40 transition-opacity duration-200 ${shown ? 'opacity-100' : 'opacity-0'}`}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Edit message: ${meta.name}`}
        className={`absolute top-0 right-0 bottom-0 w-[540px] max-w-[94vw] bg-white shadow-[-18px_0_50px_rgba(15,27,45,0.18)] flex flex-col transition-transform duration-300 ease-out ${shown ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* head */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-bold tracking-[0.08em] text-slate-400 mb-1.5">{meta.group.toUpperCase()}</div>
              <h4 className="text-xl font-bold text-slate-900 tracking-[-0.01em]">{meta.name}</h4>
              <p className="text-[13px] text-slate-500 mt-1">{meta.desc}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close editor"
              className="w-[34px] h-[34px] rounded-[9px] border border-slate-200 bg-white text-slate-600 text-base leading-none cursor-pointer shrink-0 hover:bg-slate-50"
            >
              ✕
            </button>
          </div>
        </div>

        {/* body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
          {saveError && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4" role="alert">
              {saveError}
            </p>
          )}

          <label htmlFor={`subj-${meta.id}`} className="block text-[11.5px] font-bold tracking-[0.03em] text-slate-600 mb-1.5">SUBJECT</label>
          <input
            id={`subj-${meta.id}`}
            className={inputCls}
            placeholder={t.default.subject}
            value={draft.subject}
            onChange={(e) => onField('subject', e.target.value)}
          />

          <label htmlFor={`body-${meta.id}`} className="block text-[11.5px] font-bold tracking-[0.03em] text-slate-600 mb-1.5 mt-[18px]">MESSAGE</label>
          <textarea
            id={`body-${meta.id}`}
            ref={bodyRef}
            rows={5}
            className={`${inputCls} leading-relaxed resize-y`}
            placeholder={t.default.body_text}
            value={draft.body_text}
            onChange={(e) => onField('body_text', e.target.value)}
          />

          {vars.length > 0 && (
            <div className="mt-2.5">
              <div className="text-[11px] font-semibold text-slate-400 mb-1.5">Tap to insert:</div>
              <div className="flex flex-wrap gap-1.5">
                {vars.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => onInsertVar(v)}
                    className="inline-flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-full px-2.5 py-1 text-[11.5px] text-slate-600 font-mono hover:bg-slate-200"
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          )}

          {meta.note && (
            <div className="flex gap-2 bg-slate-50 border border-slate-100 rounded-[10px] px-3 py-2.5 mt-4 text-[12.5px] text-slate-500 leading-snug">
              <InfoIcon className="w-[15px] h-[15px] text-slate-400 shrink-0 mt-px" />
              <span>{meta.note}</span>
            </div>
          )}

          {/* advanced: edit HTML */}
          <button
            type="button"
            onClick={onToggleHtml}
            aria-expanded={htmlOpen}
            className="flex items-center gap-1.5 mt-[18px] text-[13px] font-semibold text-slate-600 hover:text-slate-800"
          >
            <ChevronIcon className={`w-[15px] h-[15px] text-slate-400 transition-transform ${htmlOpen ? 'rotate-90' : ''}`} />
            Edit HTML <span className="text-slate-400 font-medium">— advanced</span>
          </button>
          {htmlOpen && (
            <>
              <textarea
                rows={4}
                className={`${inputCls} mt-2.5 text-[12.5px] font-mono leading-snug bg-slate-50 text-slate-700`}
                placeholder={t.default.body_html}
                value={draft.body_html}
                onChange={(e) => onField('body_html', e.target.value)}
              />
              <p className="text-[11.5px] text-slate-400 mt-1.5">
                Most people never need this. Leave it and we'll style the message for you.
              </p>
            </>
          )}

          {/* email live preview — directly under Edit HTML (mirrors the mock order) */}
          <div className="mt-[22px]">
            <div className="flex items-center gap-2 mb-2.5">
              <span className="text-[11px] font-bold tracking-[0.05em] uppercase text-slate-400">Live preview</span>
              <span className="text-[11px] text-slate-300">— with sample data</span>
            </div>
            <div className="border border-slate-200 rounded-[14px] overflow-hidden shadow-[0_4px_14px_rgba(15,23,42,0.05)]">
              <div className="bg-slate-50 border-b border-slate-100 px-4 py-2.5">
                <div className="text-xs text-slate-400">From <b className="text-slate-600 font-semibold">{org}</b></div>
                <div className="text-sm font-bold text-slate-900 mt-0.5">{previewSubject}</div>
              </div>
              <div className="px-4 py-4">
                <div className="text-[13.5px] leading-relaxed text-slate-700 whitespace-pre-wrap">{previewBody}</div>
                {hasCta && (
                  <div className="inline-flex mt-3.5 bg-primary-500 text-white text-[13px] font-bold rounded-full px-5 py-2.5 shadow-[0_8px_24px_rgba(80,200,120,0.28)]">
                    {meta.cta}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SMS — below the email preview; its own preview groups directly beneath the field */}
          <div className="border-t border-slate-100 mt-5 pt-[18px]">
            <div className="flex items-center justify-between mb-2">
              <label htmlFor={`sms-${meta.id}`} className="text-[11.5px] font-bold tracking-[0.03em] text-slate-600">TEXT MESSAGE (SMS)</label>
              <span className="text-[11.5px] text-slate-400">Sent alongside the email</span>
            </div>
            <textarea
              id={`sms-${meta.id}`}
              rows={3}
              maxLength={SMS_MAX}
              className={`${inputCls} text-[13.5px]`}
              placeholder={t.sms_default ?? ''}
              value={draft.sms_text}
              onChange={(e) => onField('sms_text', e.target.value)}
            />
            <div className="flex items-baseline justify-between gap-4 mt-2">
              <p className="text-[11.5px] text-slate-400">A STOP/HELP line is appended automatically.</p>
              <span className="text-[11.5px] text-slate-400 shrink-0 whitespace-nowrap">
                {smsLen}/160 · {smsSegments} segment{smsSegments > 1 ? 's' : ''}
              </span>
            </div>
            {/* SMS delivery is not live yet — state it plainly (the copy is still saved for when it goes on). */}
            <p className="text-[11.5px] font-semibold text-warning-700 mt-1.5">
              SMS delivery isn't live yet — saved copy applies once it goes on.
            </p>
            {previewSms && (
              <div className="mt-3.5">
                <div className="text-[11px] font-bold tracking-[0.05em] uppercase text-slate-400 mb-2">SMS preview</div>
                <div className="flex justify-start">
                  <div className="max-w-[78%] bg-primary-50 rounded-[16px_16px_16px_4px] px-3.5 py-2.5 text-[13px] leading-snug text-primary-900">
                    {previewSms}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* save bar */}
        <div className="shrink-0 border-t border-slate-100 px-6 py-4 flex items-center gap-3.5 bg-white">
          <button
            type="button"
            onClick={() => onSave(draft)}
            disabled={saving}
            className="bg-primary-500 text-white border-none rounded-full px-6 py-2.5 text-sm font-bold cursor-pointer shadow-[0_8px_24px_rgba(80,200,120,0.28)] disabled:opacity-50 hover:bg-primary-600"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          {t.is_override && (
            <button
              type="button"
              onClick={onReset}
              disabled={saving}
              className="bg-transparent border-none text-slate-500 text-[13.5px] font-semibold cursor-pointer hover:text-slate-700 disabled:opacity-50"
            >
              Reset to default
            </button>
          )}
          {savedFlash && (
            <span className="ml-auto text-[12.5px] font-bold text-primary-700" role="status">✓ Saved</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function MomentIcon({ path }: { path: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}
function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
function InfoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 16v-4M12 8h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
