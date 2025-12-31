/**
 * Lead Workspace Drawer
 * Premium slide-in drawer for lead processing workspace
 *
 * Phase 1: Foundation - drawer shell with slide-in animation
 * Phase 2: Header & Metadata components
 * Phase 3: Pipeline Stepper for status progression
 * Phase 4: Form Data Manifest for field display
 * Phase 5: Communications Card for quick outreach
 * Phase 6: Internal Notes for team collaboration
 * Phase 7: Terminal Actions for archive and navigation
 * Follows Premium Emerald Design System (STYLE_GUIDE.md)
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import { DrawerHeader } from './DrawerHeader';
import { MetadataGrid } from './MetadataGrid';
import { PipelineStepper } from './PipelineStepper';
import { FormDataManifest } from './FormDataManifest';
import { CommunicationsCard } from './CommunicationsCard';
import { InternalNotesSection } from './InternalNotesSection';
import { TerminalActions } from './TerminalActions';
import { useFocusTrap, useAnnounce, announcements, useSwipeGesture } from '../../hooks';
import {
  fetchLeadDetail,
  updateLeadStatus,
  updateLeadNotes,
  reactivateLead,
} from '../../services/analyticsApi';
import type { LeadWorkspaceData, PipelineStatus, SubmissionType } from '../../types/analytics';

interface LeadWorkspaceDrawerProps {
  /** Unique lead reference ID */
  leadId: string | null;
  /** Whether the drawer is open */
  isOpen: boolean;
  /** Handler to close the drawer */
  onClose: () => void;
  /** Handler to navigate to next lead (Phase 7) */
  onNext?: () => void;
  /** Handler to archive the lead (Phase 7) */
  onArchive?: () => void;
  /** Callback when lead pipeline status changes (archive/reactivate) - syncs table data */
  onStatusChange?: (leadId: string, newStatus: PipelineStatus) => void;
  /** Override pipeline status from parent (for mock data sync) */
  effectivePipelineStatus?: PipelineStatus;
  /** Visible submission IDs from the table (single source of truth for queue navigation) */
  visibleSubmissionIds?: string[];
}

/**
 * Infer submission type from form_id for badge coloring
 */
function inferSubmissionType(formId: string): SubmissionType {
  const id = formId.toLowerCase();
  if (id.includes('volunteer') || id.includes('mentor') || id.includes('foster')) {
    return 'volunteer';
  }
  if (id.includes('donor') || id.includes('donate') || id.includes('sponsor')) {
    return 'donor';
  }
  return 'general';
}

/**
 * Check if the leadId is a mock ID (simple number like '1', '2', etc.)
 */
function isMockId(leadId: string): boolean {
  return /^\d+$/.test(leadId);
}

/**
 * Mock lead data for demo/development when using mock submission IDs
 */
const MOCK_LEADS: Record<string, LeadWorkspaceData> = {
  '1': {
    submission_id: '1',
    session_id: 'session_mock_1',
    form_id: 'volunteer_application',
    form_label: 'Volunteer Application',
    submitted_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    submitted_date: 'Dec 01',
    duration_seconds: 245,
    fields_completed: 12,
    fields: {
      name: 'Sarah Jenkins',
      email: 'sarah.j@email.com',
      phone: '(555) 123-4567',
      zip: '78701',
      comments: 'I have 5 years of experience working with youth programs and would love to contribute to your mentorship initiative.',
    },
    pipeline_status: 'new',
    submission_type: 'volunteer',
    program_id: 'mentorship',
    zip_code: '78701',
    internal_notes: '',
  },
  '2': {
    submission_id: '2',
    session_id: 'session_mock_2',
    form_id: 'donation_request',
    form_label: 'Donation Request',
    submitted_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    submitted_date: 'Dec 01',
    duration_seconds: 180,
    fields_completed: 8,
    fields: {
      name: 'Michael Chen',
      email: 'm.chen@email.com',
      phone: '(555) 234-5678',
      zip: '90210',
      comments: 'Looking to donate office supplies and furniture from our company that is relocating. Can arrange pickup or delivery.',
    },
    pipeline_status: 'reviewing',
    submission_type: 'donor',
    program_id: 'donations',
    zip_code: '90210',
    internal_notes: '',
  },
  '3': {
    submission_id: '3',
    session_id: 'session_mock_3',
    form_id: 'event_registration',
    form_label: 'Event Registration',
    submitted_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    submitted_date: 'Nov 30',
    duration_seconds: 120,
    fields_completed: 6,
    fields: {
      name: 'Jessica Ford',
      email: 'jess.ford@email.com',
      phone: '(555) 345-6789',
      zip: '10001',
      comments: 'Dietary restriction: Please note I am vegetarian and allergic to nuts. Will need accommodation for the lunch portion.',
    },
    pipeline_status: 'archived',
    submission_type: 'general',
    program_id: 'events',
    zip_code: '10001',
    internal_notes: '[System] Archived by admin on Nov 30\nDuplicate submission - original processed under ID #42',
  },
  '4': {
    submission_id: '4',
    session_id: 'session_mock_4',
    form_id: 'general_inquiry',
    form_label: 'General Inquiry',
    submitted_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    submitted_date: 'Nov 30',
    duration_seconds: 90,
    fields_completed: 5,
    fields: {
      name: 'Robert Smith',
      email: 'rob.smith@email.com',
      phone: '(555) 456-7890',
      zip: '60601',
      comments: 'What are your opening hours on weekends? I work during the week and can only visit on Saturdays or Sundays.',
    },
    pipeline_status: 'contacted',
    submission_type: 'general',
    program_id: 'general',
    zip_code: '60601',
    internal_notes: 'Sent hours info via email.',
  },
  '5': {
    submission_id: '5',
    session_id: 'session_mock_5',
    form_id: 'volunteer_application',
    form_label: 'Volunteer Application',
    submitted_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    submitted_date: 'Nov 29',
    duration_seconds: 310,
    fields_completed: 14,
    fields: {
      name: 'Emily Davis',
      email: 'emily.d@email.com',
      phone: '(555) 567-8901',
      zip: '33101',
      comments: 'Interested in the mentorship program. I am a retired teacher with 30 years of experience in elementary education.',
    },
    pipeline_status: 'archived',
    submission_type: 'volunteer',
    program_id: 'mentorship',
    zip_code: '33101',
    internal_notes: '[System] Archived by admin on Nov 29\nApplicant withdrew interest',
  },
};

/**
 * LeadWorkspaceDrawer - Main drawer container
 *
 * Features:
 * - Slide-in animation from right (576px width)
 * - Backdrop blur overlay (8px blur, 40% opacity)
 * - Body scroll lock when open
 * - ESC key to close
 * - Click backdrop to close
 * - Transition timing: 300ms cubic-bezier(0.4, 0, 0.2, 1)
 */
export function LeadWorkspaceDrawer({
  leadId,
  isOpen,
  onClose,
  onNext,
  onArchive,
  onStatusChange,
  effectivePipelineStatus,
  visibleSubmissionIds = [],
}: LeadWorkspaceDrawerProps) {
  // Lead data state
  const [leadData, setLeadData] = useState<LeadWorkspaceData | null>(null);
  const [tenantName, setTenantName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [notesLastSaved, setNotesLastSaved] = useState<string | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isReactivating, setIsReactivating] = useState(false);
  const [showBloom, setShowBloom] = useState(false);

  // Queue data for Next Lead navigation
  const [nextLeadId, setNextLeadId] = useState<string | null>(null);
  const [queueCount, setQueueCount] = useState(0);
  const hasNextLead = nextLeadId !== null;

  // Track mounted state to prevent state updates after unmount
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // Ref for close button (initial focus target)
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Screen reader announcements (WCAG 4.1.3)
  const announce = useAnnounce();

  // Focus trap (WCAG 2.4.3) - traps Tab focus within drawer when open
  const focusTrapRef = useFocusTrap({
    isActive: isOpen,
    initialFocusRef: closeButtonRef,
    onEscape: onClose,
  });

  // Swipe-to-close gesture for mobile (PRD: Mobile UX)
  const swipeRef = useSwipeGesture({
    isActive: isOpen,
    direction: 'right',
    threshold: 80,
    onSwipe: onClose,
  });

  // Handle pipeline status change
  const handleStatusChange = useCallback(async (newStatus: PipelineStatus) => {
    if (!leadData) return;

    setIsSavingStatus(true);

    // For mock IDs, just update local state
    if (isMockId(leadData.submission_id)) {
      setTimeout(() => {
        if (isMountedRef.current) {
          setLeadData((prev) => prev ? { ...prev, pipeline_status: newStatus } : null);
          setIsSavingStatus(false);
          // Announce status change for screen readers (WCAG 4.1.3)
          announce(announcements.statusChanged(newStatus));
        }
      }, 300);
      return;
    }

    try {
      await updateLeadStatus(leadData.submission_id, newStatus);
      if (isMountedRef.current) {
        setLeadData((prev) => prev ? { ...prev, pipeline_status: newStatus } : null);
        // Announce status change for screen readers (WCAG 4.1.3)
        announce(announcements.statusChanged(newStatus));
        // Queue will auto-update via visibleSubmissionIds from parent
      }
    } catch (error) {
      console.error('Failed to update status:', error);
    } finally {
      if (isMountedRef.current) {
        setIsSavingStatus(false);
      }
    }
  }, [leadData, announce]);

  // Handle notes change (with debounce for autosave)
  const handleNotesChange = useCallback(async (newNotes: string) => {
    if (!leadData) return;

    // Optimistically update local state
    setLeadData((prev) => prev ? { ...prev, internal_notes: newNotes } : null);
    setIsSavingNotes(true);
    // Announce saving for screen readers (WCAG 4.1.3)
    announce(announcements.notesSaving(), { politeness: 'polite' });

    // For mock IDs, just simulate save
    if (isMockId(leadData.submission_id)) {
      setTimeout(() => {
        if (isMountedRef.current) {
          setNotesLastSaved(new Date().toISOString());
          setIsSavingNotes(false);
          announce(announcements.notesSaved(), { politeness: 'polite' });
        }
      }, 300);
      return;
    }

    try {
      const response = await updateLeadNotes(leadData.submission_id, newNotes);
      if (isMountedRef.current) {
        setNotesLastSaved(response.updated_at);
        announce(announcements.notesSaved(), { politeness: 'polite' });
      }
    } catch (error) {
      console.error('Failed to save notes:', error);
    } finally {
      if (isMountedRef.current) {
        setIsSavingNotes(false);
      }
    }
  }, [leadData, announce]);

  // Handle archive action
  const handleArchive = useCallback(async () => {
    if (!leadData) return;

    setIsArchiving(true);

    // For mock IDs, just simulate archive
    if (isMockId(leadData.submission_id)) {
      setTimeout(() => {
        if (isMountedRef.current) {
          setLeadData((prev) => prev ? { ...prev, pipeline_status: 'archived' } : null);
          setIsArchiving(false);
          // Announce for screen readers (WCAG 4.1.3)
          announce(announcements.leadArchived());
          onArchive?.();
          // Notify parent to sync table data
          onStatusChange?.(leadData.submission_id, 'archived');
        }
      }, 500);
      return;
    }

    try {
      await updateLeadStatus(leadData.submission_id, 'archived');
      if (isMountedRef.current) {
        setLeadData((prev) => prev ? { ...prev, pipeline_status: 'archived' } : null);
        // Announce for screen readers (WCAG 4.1.3)
        announce(announcements.leadArchived());
        onArchive?.();
        // Notify parent to sync table data
        onStatusChange?.(leadData.submission_id, 'archived');
      }
    } catch (error) {
      console.error('Failed to archive lead:', error);
    } finally {
      if (isMountedRef.current) {
        setIsArchiving(false);
      }
    }
  }, [leadData, onArchive, onStatusChange, announce]);

  // Handle reactivation (per PRD: Emerald Lead Reactivation Engine)
  const handleReactivate = useCallback(async () => {
    if (!leadData || leadData.pipeline_status !== 'archived') return;

    setIsReactivating(true);

    // For mock IDs, simulate reactivation
    if (isMockId(leadData.submission_id)) {
      setTimeout(() => {
        if (isMountedRef.current) {
          setLeadData((prev) => prev ? { ...prev, pipeline_status: 'new' } : null);
          setIsReactivating(false);
          // Trigger saturation bloom animation (per PRD)
          setShowBloom(true);
          setTimeout(() => setShowBloom(false), 600);
          // Announce for screen readers (WCAG 4.1.3)
          announce(announcements.leadReactivated());
          // Notify parent to sync table data
          onStatusChange?.(leadData.submission_id, 'new');
        }
      }, 800);
      return;
    }

    try {
      const response = await reactivateLead(leadData.submission_id);
      if (isMountedRef.current) {
        // Update local state with reactivated status
        setLeadData((prev) => prev ? {
          ...prev,
          pipeline_status: response.pipeline_status,
          // Prepend system note if present
          internal_notes: response.reactivated_at
            ? `[System] Restored from Archive at ${new Date(response.reactivated_at).toLocaleString()}\n${prev.internal_notes || ''}`
            : prev.internal_notes,
        } : null);

        // Trigger saturation bloom animation (per PRD)
        setShowBloom(true);
        setTimeout(() => setShowBloom(false), 600);

        // Announce for screen readers (WCAG 4.1.3)
        announce(announcements.leadReactivated());

        // Notify parent to sync table data (queue auto-updates via visibleSubmissionIds)
        onStatusChange?.(leadData.submission_id, response.pipeline_status);
      }
    } catch (error) {
      console.error('Failed to reactivate lead:', error);
    } finally {
      if (isMountedRef.current) {
        setIsReactivating(false);
      }
    }
  }, [leadData, onStatusChange, announce]);

  // Handle next lead navigation
  const handleNextLead = useCallback(() => {
    if (hasNextLead) {
      onNext?.();
    } else {
      // Announce when no more leads (WCAG 4.1.3)
      announce(announcements.noMoreLeads());
    }
  }, [onNext, hasNextLead, announce]);

  // Keyboard shortcut handler (Arrow keys for navigation)
  // Note: ESC is handled by useFocusTrap hook
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't trigger when typing in input/textarea
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      return;
    }

    // → = Next Lead
    if (e.key === 'ArrowRight' && isOpen && hasNextLead) {
      e.preventDefault();
      handleNextLead();
    }
    // ← = Could be used for Previous Lead in future
  }, [isOpen, hasNextLead, handleNextLead]);

  // Body scroll lock and keyboard shortcuts
  // Note: ESC key is handled by useFocusTrap hook
  useEffect(() => {
    if (isOpen) {
      // Lock body scroll
      document.body.style.overflow = 'hidden';
      // Add keyboard shortcut listener (Cmd/Ctrl + →)
      document.addEventListener('keydown', handleKeyDown);
    } else {
      // Restore body scroll
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  // Load lead data when drawer opens
  useEffect(() => {
    if (isOpen && leadId) {
      setIsLoading(true);
      setLoadError(null);

      const loadData = async () => {
        // Check if this is a mock ID (simple number like '1', '2', etc.)
        // Unified queue calculation from visibleSubmissionIds (passed from Dashboard)
        // This works the same for both mock and real data
        const calculateQueueFromVisibleIds = () => {
          if (visibleSubmissionIds.length > 1) {
            const currentIndex = visibleSubmissionIds.indexOf(leadId);
            if (currentIndex !== -1) {
              const nextIndex = (currentIndex + 1) % visibleSubmissionIds.length;
              setNextLeadId(visibleSubmissionIds[nextIndex]);
              setQueueCount(visibleSubmissionIds.length - 1); // Exclude current lead from count
            } else {
              setNextLeadId(null);
              setQueueCount(0);
            }
          } else {
            setNextLeadId(null);
            setQueueCount(0);
          }
        };

        if (isMockId(leadId)) {
          // Use mock data for demo/development
          const mockLead = MOCK_LEADS[leadId];
          if (mockLead && isMountedRef.current) {
            // Apply effective pipeline status override from parent (for mock data sync)
            const leadWithEffectiveStatus = effectivePipelineStatus
              ? { ...mockLead, pipeline_status: effectivePipelineStatus }
              : mockLead;
            setLeadData(leadWithEffectiveStatus);
            setTenantName('Demo Organization');

            // Calculate queue from visible IDs (same as real data)
            calculateQueueFromVisibleIds();
            setIsLoading(false);
            return;
          }
        }

        try {
          // Fetch lead detail from API
          const response = await fetchLeadDetail(leadId);

          if (isMountedRef.current) {
            // Transform API response to include submission_type
            const lead: LeadWorkspaceData = {
              ...response.lead,
              submission_type: inferSubmissionType(response.lead.form_id),
            };
            setLeadData(lead);
            setTenantName(response.tenant_name);

            // Calculate queue from visible IDs (same as mock data - unified behavior)
            calculateQueueFromVisibleIds();
          }
        } catch (error) {
          console.error('Failed to load lead:', error);
          if (isMountedRef.current) {
            setLoadError(error instanceof Error ? error.message : 'Failed to load lead');
          }
        } finally {
          if (isMountedRef.current) {
            setIsLoading(false);
          }
        }
      };

      loadData();
    } else if (!isOpen) {
      // Clear data when drawer closes (after animation)
      const timer = setTimeout(() => {
        setLeadData(null);
        setTenantName('');
        setLoadError(null);
        setNextLeadId(null);
        setQueueCount(0);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen, leadId, effectivePipelineStatus, visibleSubmissionIds]);

  // Vault Mode: Check if lead is archived (per PRD: Emerald Lead Reactivation Engine)
  const isArchived = leadData?.pipeline_status === 'archived';

  // Combine refs for focus trap and swipe gesture
  const setDrawerRefs = useCallback((node: HTMLDivElement | null) => {
    // Assign to both refs using type assertion for mutable assignment
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (focusTrapRef as any).current = node;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (swipeRef as any).current = node;
  }, [focusTrapRef, swipeRef]);

  return (
    <>
      {/* Backdrop with blur */}
      <div
        className={`drawer-backdrop ${isOpen ? 'open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer - applies vault mode styling when archived, bloom on reactivation */}
      {/* Focus trap and swipe gesture applied via combined ref */}
      <aside
        ref={setDrawerRefs}
        className={`lead-workspace-drawer ${isOpen ? 'open' : ''} ${isArchived ? 'vault-mode' : ''} ${showBloom ? 'reactivation-bloom' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        aria-hidden={!isOpen}
      >
        {/* Drawer Content */}
        <div className="flex flex-col h-full overflow-y-auto">
          {/* Phase 2: DrawerHeader Component */}
          <DrawerHeader
            lead={leadData}
            isLoading={isLoading}
            onClose={onClose}
            closeButtonRef={closeButtonRef}
          />

          {/* Main Content Area */}
          <div className="flex-1 p-6 space-y-6">
            {/* Error State */}
            {loadError && !isLoading && (
              <div className="drawer-card border-danger-200 bg-danger-50">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-danger-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="font-medium text-danger-800">Failed to load lead</p>
                    <p className="text-sm text-danger-600 mt-1">{loadError}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Phase 2: MetadataGrid Component */}
            <MetadataGrid
              lead={leadData}
              isLoading={isLoading}
            />

            {/* Phase 3: PipelineStepper Component */}
            {leadData && !isArchived && (
              <PipelineStepper
                currentStatus={leadData.pipeline_status}
                onStatusChange={handleStatusChange}
                isSaving={isSavingStatus}
              />
            )}
            {isLoading && (
              <div className="drawer-card">
                <div className="animate-pulse">
                  <div className="h-3 w-24 bg-gray-200 rounded mb-3" />
                  <div className="flex items-center gap-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="w-20 h-7 bg-gray-200 rounded-lg" />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Vault Mode: Archived State Callout (per PRD: Emerald Lead Reactivation Engine) */}
            {isArchived && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-amber-800 text-sm">ARCHIVED STATE</h4>
                    <p className="text-sm text-amber-700 mt-1">
                      This lead is currently read-only and removed from active queues.
                      Reactivate to continue engagement.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Phase 4: FormDataManifest Component */}
            <FormDataManifest
              lead={leadData}
              isLoading={isLoading}
            />

            {/* Phase 5: CommunicationsCard Component */}
            <CommunicationsCard
              lead={leadData}
              isLoading={isLoading}
              tenantName={tenantName || leadData?.tenant_name}
              isArchived={isArchived}
            />

            {/* Phase 6: InternalNotesSection Component */}
            <InternalNotesSection
              notes={leadData?.internal_notes || ''}
              onNotesChange={handleNotesChange}
              isSaving={isSavingNotes}
              lastSaved={notesLastSaved}
              isLoading={isLoading}
            />
          </div>

          {/* Phase 7: Terminal Actions Footer */}
          {leadData && (
            <TerminalActions
              currentStatus={leadData.pipeline_status}
              onArchive={handleArchive}
              onReactivate={handleReactivate}
              onNextLead={handleNextLead}
              onClose={onClose}
              isArchiving={isArchiving}
              isReactivating={isReactivating}
              hasNextLead={hasNextLead}
              queueCount={queueCount}
            />
          )}
          {isLoading && (
            <footer className="sticky bottom-0 px-6 py-5 border-t border-gray-200 bg-white">
              <div className="flex items-center justify-between gap-4 mb-3">
                <div className="h-11 w-24 bg-gray-200 rounded-xl animate-pulse" />
                <div className="h-11 w-32 bg-gray-200 rounded-xl animate-pulse" />
              </div>
              <div className="h-11 w-full bg-gray-200 rounded-xl animate-pulse" />
            </footer>
          )}
        </div>
      </aside>
    </>
  );
}
