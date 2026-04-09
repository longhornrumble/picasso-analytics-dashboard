/**
 * Profile Settings Page
 * Phase 3 — Personal profile management backed by Clerk API
 */

import { useState, useEffect } from 'react';
import { fetchProfile, updateProfile } from '../services/analyticsApi';
import type { UserProfile } from '../types/analytics';

export function ProfileSettings() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchProfile();
        setProfile(data);
        setFirstName(data.first_name);
        setLastName(data.last_name);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (profile) {
      setHasChanges(
        firstName.trim() !== profile.first_name ||
        lastName.trim() !== profile.last_name
      );
    }
  }, [firstName, lastName, profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setSaving(true);

    try {
      await updateProfile({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      });
      setProfile((prev) => prev ? { ...prev, first_name: firstName.trim(), last_name: lastName.trim() } : prev);
      setSuccessMsg('Profile updated');
      setHasChanges(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-lg">
        <div className="bg-white rounded-xl border border-slate-200 p-6 animate-pulse">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-slate-200" />
            <div className="space-y-2">
              <div className="h-4 bg-slate-200 rounded w-32" />
              <div className="h-3 bg-slate-100 rounded w-48" />
            </div>
          </div>
          <div className="space-y-4">
            <div className="h-10 bg-slate-100 rounded" />
            <div className="h-10 bg-slate-100 rounded" />
          </div>
        </div>
      </div>
    );
  }

  const initials = profile
    ? `${(profile.first_name || '')[0] || ''}${(profile.last_name || '')[0] || ''}`.toUpperCase() || '?'
    : '?';

  return (
    <div className="max-w-lg space-y-6">
      {/* Feedback messages */}
      {error && (
        <div className="flex items-center justify-between px-4 py-3 bg-red-50 border border-red-200 rounded-lg" role="alert">
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
      {successMsg && (
        <div className="flex items-center justify-between px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg" role="status">
          <p className="text-sm text-emerald-700">{successMsg}</p>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Profile Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-4 mb-6">
          {profile?.image_url ? (
            <img src={profile.image_url} alt="" className="w-16 h-16 rounded-full object-cover" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center">
              <span className="text-xl font-semibold text-primary-700">{initials}</span>
            </div>
          )}
          <div>
            <p className="text-base font-semibold text-slate-800">
              {profile?.first_name} {profile?.last_name}
            </p>
            <p className="text-sm text-slate-500">{profile?.email}</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label htmlFor="first-name" className="block text-sm font-medium text-slate-700 mb-1">
              First Name
            </label>
            <input
              id="first-name"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          <div>
            <label htmlFor="last-name" className="block text-sm font-medium text-slate-700 mb-1">
              Last Name
            </label>
            <input
              id="last-name"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={profile?.email || ''}
              disabled
              className="w-full px-3 py-2 border border-slate-100 rounded-lg text-sm text-slate-400 bg-slate-50 cursor-not-allowed"
            />
            <p className="text-xs text-slate-400 mt-1">Email cannot be changed here</p>
          </div>

          <button
            type="submit"
            disabled={!hasChanges || saving}
            className="w-full px-4 py-2.5 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>

      {/* Notification Preferences — placeholder for future */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-slate-700">Notification Preferences</h3>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-50 text-primary-600">
            Coming Soon
          </span>
        </div>
        <p className="text-sm text-slate-500">
          Configure how you receive notifications — email digests, real-time alerts, and channel preferences.
        </p>
      </div>
    </div>
  );
}
