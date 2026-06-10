/**
 * NotificationTemplatesEditor — E14 (ui_plan Surface 7): per-tenant overrides of the
 * scheduling lifecycle-notice EMAIL copy. Admin-only (the §E14 endpoints enforce it).
 *
 * v1 moments (§E14): reschedule_link · reoffer · cancel_notice. Each = subject + body_text
 * + body_html, upsert-merge via PATCH; clearing a field (empty) resets it to the platform
 * default. The STOP/unsubscribe line is appended automatically by notify.js and is NOT
 * editable (stop_footer_note shown read-only). Variables are per-moment.
 */
import { useCallback, useEffect, useState } from 'react';
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

const MOMENTS: { id: NotificationMoment; label: string; hint: string }[] = [
  { id: 'reschedule_link', label: 'Reschedule link', hint: 'Sent when a booking can be rescheduled.' },
  { id: 'reoffer', label: 'Reoffer (slot taken)', hint: 'Sent when the chosen time is no longer available.' },
  { id: 'cancel_notice', label: 'Cancellation notice', hint: 'Sent when a booking is canceled.' },
];

function errMessage(e: unknown): string {
  if (e instanceof SchedulingApiError) return e.message;
  return e instanceof Error ? e.message : 'Something went wrong';
}

const draftOf = (t: MomentTemplate): EditorDraft => ({
  subject: t.subject,
  body_text: t.body_text,
  body_html: t.body_html,
  sms_text: t.sms_text ?? '',
});

export function NotificationTemplatesEditor() {
  const [moments, setMoments] = useState<Record<string, MomentTemplate>>({});
  const [stopNote, setStopNote] = useState('');
  const [smsNote, setSmsNote] = useState('');
  const [drafts, setDrafts] = useState<Record<string, EditorDraft>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savingMoment, setSavingMoment] = useState<string | null>(null);

  const load = useCallback(async (isActive: () => boolean) => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await fetchNotificationTemplates();
      if (!isActive()) return;
      setMoments(data.moments);
      setStopNote(data.stop_footer_note);
      setSmsNote(data.sms_footer_note ?? '');
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

  async function persist(moment: NotificationMoment, body: NotificationTemplateWrite) {
    setSavingMoment(moment);
    setSaveError(null);
    try {
      await updateNotificationTemplate(moment, body);
      await load(() => true);
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
        <span className="sr-only">Loading templates…</span>
      </div>
    );
  }
  if (loadError) {
    return (
      <p className="text-sm text-red-600 py-8 text-center" role="alert">
        Couldn't load templates: {loadError}
      </p>
    );
  }

  const inputCls =
    'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500';

  return (
    <section aria-label="Notification templates" className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-bold text-slate-900">Notification templates</h3>
        <p className="text-xs text-slate-500">Customize the email copy for scheduling notices. Leave a field blank to use the default.</p>
      </div>
      {stopNote && <p className="text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">{stopNote}</p>}
      {saveError && <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2" role="alert">{saveError}</p>}

      {MOMENTS.filter((m) => moments[m.id]).map((m) => {
        const t = moments[m.id];
        const d = drafts[m.id] ?? draftOf(t);
        const setField = (field: keyof EditorDraft, value: string) =>
          setDrafts((prev) => ({ ...prev, [m.id]: { ...(prev[m.id] ?? draftOf(t)), [field]: value } }));
        const busy = savingMoment === m.id;
        return (
          <div key={m.id} className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-slate-800">{m.label}</h4>
                <p className="text-xs text-slate-400">{m.hint}</p>
              </div>
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${t.is_override ? 'bg-primary-50 text-primary-700' : 'bg-slate-100 text-slate-500'}`}>
                {t.is_override ? 'Customized' : 'Default'}
              </span>
            </div>

            <div>
              <label htmlFor={`subj-${m.id}`} className="block text-xs font-medium text-slate-600 mb-1">Subject</label>
              <input id={`subj-${m.id}`} className={inputCls} value={d.subject} onChange={(e) => setField('subject', e.target.value)} />
            </div>
            <div>
              <label htmlFor={`text-${m.id}`} className="block text-xs font-medium text-slate-600 mb-1">Body (plain text)</label>
              <textarea id={`text-${m.id}`} rows={4} className={inputCls} value={d.body_text} onChange={(e) => setField('body_text', e.target.value)} />
            </div>
            <div>
              <label htmlFor={`html-${m.id}`} className="block text-xs font-medium text-slate-600 mb-1">Body (HTML)</label>
              <textarea id={`html-${m.id}`} rows={4} className={`${inputCls} font-mono text-xs`} value={d.body_html} onChange={(e) => setField('body_html', e.target.value)} />
            </div>

            <p className="text-[11px] text-slate-400">
              Variables: {t.available_variables.map((v) => (
                <code key={v} className="bg-slate-100 rounded px-1 mx-0.5">{v}</code>
              ))}
            </p>

            <div className="flex gap-2">
              <button onClick={() => persist(m.id, { subject: d.subject, body_text: d.body_text, body_html: d.body_html })} disabled={busy}
                className="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-lg disabled:opacity-50">
                {busy ? 'Saving…' : 'Save'}
              </button>
              {t.is_override && (
                <button onClick={() => persist(m.id, { subject: '', body_text: '', body_html: '' })} disabled={busy}
                  className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700">
                  Reset to default
                </button>
              )}
            </div>

            {/* SMS override (§E14 G7a) — EDITOR SURFACE: delivery is held until the SMS sender lands. */}
            <div className="border-t border-slate-100 pt-3 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label htmlFor={`sms-${m.id}`} className="text-xs font-medium text-slate-600">SMS text</label>
                {t.sms_is_override && (
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary-50 text-primary-700">Customized</span>
                )}
              </div>
              <textarea id={`sms-${m.id}`} rows={3} maxLength={SMS_MAX} className={inputCls}
                value={d.sms_text} onChange={(e) => setField('sms_text', e.target.value)} />
              <p className="text-[11px] text-slate-400">
                {d.sms_text.length}/{SMS_MAX} · ~{Math.max(1, Math.ceil(d.sms_text.length / 160))} segment{d.sms_text.length > 160 ? 's' : ''}
                {t.sms_available_variables?.length ? (
                  <> · vars: {t.sms_available_variables.map((v) => (
                    <code key={v} className="bg-slate-100 rounded px-1 mx-0.5">{v}</code>
                  ))}</>
                ) : null}
              </p>
              {smsNote && <p className="text-[11px] text-slate-400">{smsNote}</p>}
              <p className="text-[11px] text-amber-600">SMS delivery isn't enabled yet — saved copy applies once it goes live.</p>
              <div className="flex gap-2 mt-1">
                <button onClick={() => persist(m.id, { sms_text: d.sms_text })} disabled={busy}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-lg disabled:opacity-50">
                  {busy ? 'Saving…' : 'Save SMS'}
                </button>
                {t.sms_is_override && (
                  <button onClick={() => persist(m.id, { sms_text: '' })} disabled={busy}
                    className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700">
                    Reset SMS
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}
