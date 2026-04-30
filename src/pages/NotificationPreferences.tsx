/**
 * Notification Preferences Page
 * Phase 4 — SMS opt-in, phone number, quiet hours configuration
 * Each user manages their own preferences, stored in Clerk unsafeMetadata
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/useAuth';
import { fetchPreferences, updatePreferences, fetchNotificationSettings } from '../services/analyticsApi';
import type { NotificationPreferences as NotificationPreferencesType } from '../types/analytics';

// Common US timezones for the dropdown
const TIMEZONE_OPTIONS = [
  { value: 'America/New_York', label: 'Eastern (ET)' },
  { value: 'America/Chicago', label: 'Central (CT)' },
  { value: 'America/Denver', label: 'Mountain (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific (PT)' },
  { value: 'America/Anchorage', label: 'Alaska (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii (HT)' },
];

// Time options for quiet hours pickers (30-min increments)
const TIME_OPTIONS: { value: string; label: string }[] = [];
for (let h = 0; h < 24; h++) {
  for (const m of ['00', '30']) {
    const hh = String(h).padStart(2, '0');
    const period = h < 12 ? 'AM' : 'PM';
    const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
    TIME_OPTIONS.push({ value: `${hh}:${m}`, label: `${displayH}:${m} ${period}` });
  }
}

function detectTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (TIMEZONE_OPTIONS.some(o => o.value === tz)) return tz;
  } catch { /* ignore */ }
  return 'America/Chicago';
}

export function NotificationPreferences() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Form state — email is always on, no toggle needed
  const [smsProvisioned, setSmsProvisioned] = useState(false);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietStart, setQuietStart] = useState('19:00');
  const [quietEnd, setQuietEnd] = useState('07:00');
  const [quietTimezone, setQuietTimezone] = useState(detectTimezone());
  // Email fallback during quiet hours is always on — no toggle needed

  const loadPreferences = useCallback(async () => {
    try {
      const [data, settingsData] = await Promise.all([
        fetchPreferences(),
        fetchNotificationSettings().catch(() => null),
      ]);
      setSmsProvisioned(settingsData?.sms_provisioned === true);
      const prefs = data.preferences;
      setSmsEnabled(prefs.sms);
      setPhone(prefs.phone || '');
      setQuietHoursEnabled(prefs.sms_quiet_hours.enabled);
      setQuietStart(prefs.sms_quiet_hours.start || '19:00');
      setQuietEnd(prefs.sms_quiet_hours.end || '07:00');
      setQuietTimezone(prefs.sms_quiet_hours.timezone || detectTimezone());
      // fallback_to_email is always true — no state needed
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preferences');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  // Clear success message after 3 seconds
  useEffect(() => {
    if (!successMsg) return;
    const timer = setTimeout(() => setSuccessMsg(null), 3000);
    return () => clearTimeout(timer);
  }, [successMsg]);

  function normalizePhone(raw: string): string {
    const digits = raw.replace(/[\s\-().+]/g, '');
    if (!digits) return '';
    if (digits.startsWith('1') && digits.length === 11) return `+${digits}`;
    if (digits.length === 10) return `+1${digits}`;
    return `+${digits}`;
  }

  function validatePhone(value: string): string | null {
    if (!value.trim()) return 'Phone number is required when SMS is enabled';
    const normalized = normalizePhone(value);
    if (!/^\+1\d{10}$/.test(normalized)) {
      return 'Enter a valid US phone number (e.g. 512-555-1234)';
    }
    return null;
  }

  const handleSave = async () => {
    setError(null);
    setSuccessMsg(null);

    // Validate phone if SMS is on
    if (smsEnabled) {
      const phoneErr = validatePhone(phone);
      if (phoneErr) {
        setPhoneError(phoneErr);
        return;
      }
    }

    setSaving(true);
    try {
      const prefs: Partial<NotificationPreferencesType> = {
        email: true,
        sms: smsEnabled,
        phone: smsEnabled ? normalizePhone(phone) : null,
        sms_quiet_hours: {
          enabled: smsEnabled && quietHoursEnabled,
          start: quietHoursEnabled ? quietStart : undefined,
          end: quietHoursEnabled ? quietEnd : undefined,
          timezone: quietHoursEnabled ? quietTimezone : undefined,
          fallback_to_email: true,
        },
      };

      const data = await updatePreferences(prefs);
      // Sync local state with server response
      const updated = data.preferences;
      setSmsEnabled(updated.sms);
      setPhone(updated.phone || '');
      setQuietHoursEnabled(updated.sms_quiet_hours.enabled);
      if (updated.sms_quiet_hours.start) setQuietStart(updated.sms_quiet_hours.start);
      if (updated.sms_quiet_hours.end) setQuietEnd(updated.sms_quiet_hours.end);
      if (updated.sms_quiet_hours.timezone) setQuietTimezone(updated.sms_quiet_hours.timezone);
      // fallback_to_email always true

      setIsDirty(false);
      setSuccessMsg('Preferences saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const markDirty = () => setIsDirty(true);

  if (loading) {
    return (
      <div className="space-y-4">
        {/* Skeleton cards */}
        {[1, 2].map(i => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-6 animate-pulse">
            <div className="h-5 bg-slate-200 rounded w-48 mb-4" />
            <div className="h-4 bg-slate-100 rounded w-64" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Notification Preferences</h2>
        <p className="text-sm text-slate-500 mt-1">
          Choose how you receive notifications when form submissions arrive.
        </p>
      </div>

      {/* Feedback messages */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
          {successMsg}
        </div>
      )}

      {/* Card 1: Email Notifications (always on) */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Email Notifications</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              You'll always receive form submission alerts at{' '}
              <span className="font-medium text-slate-700">{user?.email || '—'}</span>
            </p>
          </div>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
            Always on
          </span>
        </div>
      </div>

      {/* Card 2: SMS Notifications */}
      <div className={`bg-white rounded-xl border border-slate-200 p-6 ${!smsProvisioned ? 'opacity-60' : ''}`}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">SMS Notifications</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {smsProvisioned
                ? 'Receive text messages for urgent form submissions'
                : 'SMS is not enabled for your organization. Contact us to get started.'}
            </p>
          </div>
          {smsProvisioned ? (
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={smsEnabled}
                onChange={(e) => {
                  setSmsEnabled(e.target.checked);
                  setPhoneError(null);
                  markDirty();
                }}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-500" />
            </label>
          ) : (
            <span className="text-xs text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-200">
              Contact us to enable
            </span>
          )}
        </div>

        {smsProvisioned && smsEnabled && (
          <div className="mt-4 space-y-4 pt-4 border-t border-slate-100">
            {/* Phone number input */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setPhoneError(null);
                  markDirty();
                }}
                placeholder="(512) 555-1234"
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300 ${
                  phoneError ? 'border-red-300 bg-red-50' : 'border-slate-300'
                }`}
              />
              {phoneError && (
                <p className="text-xs text-red-600 mt-1">{phoneError}</p>
              )}
              <p className="text-xs text-slate-400 mt-1">US numbers only. We'll format it automatically.</p>
            </div>

            {/* Quiet hours */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <label className="text-sm font-medium text-slate-700">SMS Quiet Hours</label>
                  <p className="text-xs text-slate-500">Pause text messages during off-hours</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={quietHoursEnabled}
                    onChange={(e) => { setQuietHoursEnabled(e.target.checked); markDirty(); }}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-500" />
                </label>
              </div>

              {quietHoursEnabled && (
                <div className="mt-3 space-y-3 pl-0 sm:pl-4">
                  <div className="flex flex-wrap gap-3 items-end">
                    <div className="flex-1 min-w-[120px]">
                      <label className="block text-xs font-medium text-slate-600 mb-1">Start (no SMS after)</label>
                      <select
                        value={quietStart}
                        onChange={(e) => { setQuietStart(e.target.value); markDirty(); }}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300"
                      >
                        {TIME_OPTIONS.map(t => (
                          <option key={`start-${t.value}`} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1 min-w-[120px]">
                      <label className="block text-xs font-medium text-slate-600 mb-1">End (resume SMS at)</label>
                      <select
                        value={quietEnd}
                        onChange={(e) => { setQuietEnd(e.target.value); markDirty(); }}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300"
                      >
                        {TIME_OPTIONS.map(t => (
                          <option key={`end-${t.value}`} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Timezone</label>
                    <select
                      value={quietTimezone}
                      onChange={(e) => { setQuietTimezone(e.target.value); markDirty(); }}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300"
                    >
                      {TIMEZONE_OPTIONS.map(tz => (
                        <option key={tz.value} value={tz.value}>{tz.label}</option>
                      ))}
                    </select>
                  </div>

                  <p className="text-xs text-slate-500">
                    During quiet hours, you'll receive email instead of SMS.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Save button */}
      {isDirty && (
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
          <button
            onClick={() => {
              setIsDirty(false);
              loadPreferences();
            }}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
