/**
 * InternalNotesSection Component
 * Editable internal notes for lead processing
 *
 * Phase 6: Internal Notes
 * Follows Premium Emerald Design System (STYLE_GUIDE.md)
 */

import { useState, useEffect, useCallback, useRef } from 'react';

interface InternalNotesSectionProps {
  /** Current notes value */
  notes: string;
  /** Handler when notes change */
  onNotesChange?: (notes: string) => void;
  /** Whether notes are being saved */
  isSaving?: boolean;
  /** Last saved timestamp */
  lastSaved?: string | null;
  /** Loading state */
  isLoading?: boolean;
  /** Disable editing */
  disabled?: boolean;
}

/** Maximum character limit for notes */
const MAX_CHARS = 2000;

/** Auto-save debounce delay in ms */
const AUTO_SAVE_DELAY = 1500;

/**
 * Format relative time for "last saved" display
 */
function formatLastSaved(timestamp: string | null | undefined): string {
  if (!timestamp) return '';

  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

/**
 * Skeleton loader (light theme)
 */
function NotesSkeleton() {
  return (
    <div className="drawer-card">
      <div className="h-3 w-24 bg-gray-200 rounded mb-4 animate-pulse" />
      <div className="h-32 bg-gray-200 rounded-lg animate-pulse" />
    </div>
  );
}

/**
 * Save indicator component
 */
function SaveIndicator({
  isSaving,
  lastSaved,
  hasChanges,
}: {
  isSaving: boolean;
  lastSaved: string | null | undefined;
  hasChanges: boolean;
}) {
  if (isSaving) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-slate-400">
        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        Saving...
      </span>
    );
  }

  if (hasChanges) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-amber-400">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        Unsaved changes
      </span>
    );
  }

  if (lastSaved) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-slate-500">
        <svg className="w-3.5 h-3.5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        Saved {formatLastSaved(lastSaved)}
      </span>
    );
  }

  return null;
}

export function InternalNotesSection({
  notes,
  onNotesChange,
  isSaving = false,
  lastSaved,
  isLoading = false,
  disabled = false,
}: InternalNotesSectionProps) {
  const [localNotes, setLocalNotes] = useState(notes);
  const [hasChanges, setHasChanges] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync local notes with prop when it changes externally
  useEffect(() => {
    if (!hasChanges) {
      setLocalNotes(notes);
    }
  }, [notes, hasChanges]);

  // Auto-save logic
  const triggerSave = useCallback(() => {
    if (localNotes !== notes && onNotesChange) {
      onNotesChange(localNotes);
      setHasChanges(false);
    }
  }, [localNotes, notes, onNotesChange]);

  // Handle text change with auto-save debounce
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;

    // Enforce character limit
    if (value.length > MAX_CHARS) return;

    setLocalNotes(value);
    setHasChanges(value !== notes);

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new auto-save timeout
    saveTimeoutRef.current = setTimeout(() => {
      if (value !== notes && onNotesChange) {
        onNotesChange(value);
        setHasChanges(false);
      }
    }, AUTO_SAVE_DELAY);
  }, [notes, onNotesChange]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Manual save on blur
  const handleBlur = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    triggerSave();
  }, [triggerSave]);

  // Character count
  const charCount = localNotes.length;
  const charPercentage = (charCount / MAX_CHARS) * 100;
  const isNearLimit = charPercentage > 80;

  if (isLoading) {
    return <NotesSkeleton />;
  }

  return (
    <div className="drawer-card">
      <div className="flex items-center justify-between mb-4">
        <p className="label-aviation-muted">INTERNAL NOTES</p>
        <SaveIndicator
          isSaving={isSaving}
          lastSaved={lastSaved}
          hasChanges={hasChanges}
        />
      </div>

      {/* Textarea */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={localNotes}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={disabled || isSaving}
          placeholder="Add notes about this lead..."
          className={`
            w-full h-32 px-4 py-3 rounded-lg resize-none
            bg-white border border-gray-200
            text-sm text-slate-700 placeholder-gray-400
            focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors duration-200
          `}
          aria-label="Internal notes"
        />

        {/* Character counter */}
        <div className="absolute bottom-2 right-2 flex items-center gap-2">
          <span className={`text-xs ${isNearLimit ? 'text-amber-500' : 'text-gray-400'}`}>
            {charCount}/{MAX_CHARS}
          </span>
        </div>
      </div>

      {/* Helper text */}
      <p className="mt-2 text-xs text-gray-500">
        Notes auto-save after you stop typing. Only visible to your team.
      </p>

      {/* Quick note templates */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500 mb-2">Quick add:</p>
        <div className="flex flex-wrap gap-2">
          {[
            'Left voicemail',
            'Sent follow-up email',
            'Scheduled callback',
            'Needs more info',
          ].map((template) => (
            <button
              key={template}
              type="button"
              onClick={() => {
                const timestamp = new Date().toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                });
                const newNote = localNotes
                  ? `${localNotes}\n\n[${timestamp}] ${template}`
                  : `[${timestamp}] ${template}`;

                if (newNote.length <= MAX_CHARS) {
                  setLocalNotes(newNote);
                  setHasChanges(true);
                  // Trigger auto-save
                  if (saveTimeoutRef.current) {
                    clearTimeout(saveTimeoutRef.current);
                  }
                  saveTimeoutRef.current = setTimeout(() => {
                    if (onNotesChange) {
                      onNotesChange(newNote);
                      setHasChanges(false);
                    }
                  }, AUTO_SAVE_DELAY);
                }
              }}
              disabled={disabled || isSaving}
              className="px-2.5 py-1 text-xs font-medium text-gray-500 hover:text-gray-700 bg-white hover:bg-gray-50 rounded-md border border-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              + {template}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
