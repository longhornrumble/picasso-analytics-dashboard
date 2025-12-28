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

import { useEffect, useCallback, useState } from 'react';
import { DrawerHeader } from './DrawerHeader';
import { MetadataGrid } from './MetadataGrid';
import { PipelineStepper } from './PipelineStepper';
import { FormDataManifest } from './FormDataManifest';
import { CommunicationsCard } from './CommunicationsCard';
import { InternalNotesSection } from './InternalNotesSection';
import { TerminalActions } from './TerminalActions';
import type { LeadWorkspaceData, PipelineStatus } from '../../types/analytics';

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
}

/**
 * Generate mock lead data for testing
 * Will be replaced with API call in Phase 3+
 */
function getMockLeadData(leadId: string): LeadWorkspaceData {
  // Create deterministic mock data based on leadId
  const hash = leadId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const types = ['volunteer', 'donor', 'general'] as const;
  const statuses = ['new', 'reviewing', 'contacted'] as const;

  return {
    submission_id: leadId,
    session_id: `session_${leadId}`,
    form_id: 'volunteer_application',
    form_label: 'Volunteer Application',
    submitted_at: new Date(Date.now() - (hash % 7) * 24 * 60 * 60 * 1000).toISOString(),
    submitted_date: 'Dec 28',
    duration_seconds: 120 + (hash % 180),
    fields_completed: 8 + (hash % 5),
    fields: {
      name: ['Sarah Jenkins', 'Michael Chen', 'Jessica Ford', 'Robert Smith'][hash % 4],
      email: ['sarah.j@email.com', 'm.chen@email.com', 'jess.ford@email.com', 'rob.smith@email.com'][hash % 4],
      phone: '(555) 123-4567',
      zip: ['78701', '90210', '10001', '60601'][hash % 4],
      comments: 'I have experience working with youth programs and would love to contribute.',
    },
    pipeline_status: statuses[hash % statuses.length],
    submission_type: types[hash % types.length],
    program_id: ['mentorship', 'foster_care', 'youth_programs'][hash % 3],
    zip_code: ['78701', '90210', '10001', '60601'][hash % 4],
  };
}

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
}: LeadWorkspaceDrawerProps) {
  // Lead data state (will be fetched from API in later phases)
  const [leadData, setLeadData] = useState<LeadWorkspaceData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [notesLastSaved, setNotesLastSaved] = useState<string | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);

  // Mock queue data (will be replaced with real data in later phases)
  const hasNextLead = true; // Mock: always has next lead
  const queueCount = 12; // Mock: 12 leads in queue

  // Handle pipeline status change
  const handleStatusChange = useCallback((newStatus: PipelineStatus) => {
    if (!leadData) return;

    setIsSavingStatus(true);
    // Simulate API call (will be replaced with real API in later phases)
    setTimeout(() => {
      setLeadData((prev) => prev ? { ...prev, pipeline_status: newStatus } : null);
      setIsSavingStatus(false);
    }, 500);
  }, [leadData]);

  // Handle notes change
  const handleNotesChange = useCallback((newNotes: string) => {
    if (!leadData) return;

    setIsSavingNotes(true);
    // Simulate API call (will be replaced with real API in later phases)
    setTimeout(() => {
      setLeadData((prev) => prev ? { ...prev, internal_notes: newNotes } : null);
      setIsSavingNotes(false);
      setNotesLastSaved(new Date().toISOString());
    }, 500);
  }, [leadData]);

  // Handle archive action
  const handleArchive = useCallback(() => {
    if (!leadData) return;

    setIsArchiving(true);
    // Simulate API call (will be replaced with real API in later phases)
    setTimeout(() => {
      setLeadData((prev) => prev ? { ...prev, pipeline_status: 'archived' } : null);
      setIsArchiving(false);
      onArchive?.();
    }, 800);
  }, [leadData, onArchive]);

  // Handle next lead navigation
  const handleNextLead = useCallback(() => {
    onNext?.();
  }, [onNext]);

  // ESC key handler
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && isOpen) {
      onClose();
    }
  }, [isOpen, onClose]);

  // Body scroll lock and ESC key listener
  useEffect(() => {
    if (isOpen) {
      // Lock body scroll
      document.body.style.overflow = 'hidden';
      // Add ESC key listener
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
      // Simulate API call delay
      const timer = setTimeout(() => {
        setLeadData(getMockLeadData(leadId));
        setIsLoading(false);
      }, 300);
      return () => clearTimeout(timer);
    } else if (!isOpen) {
      // Clear data when drawer closes (after animation)
      const timer = setTimeout(() => setLeadData(null), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen, leadId]);

  return (
    <>
      {/* Backdrop with blur */}
      <div
        className={`drawer-backdrop ${isOpen ? 'open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        className={`lead-workspace-drawer ${isOpen ? 'open' : ''}`}
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
          />

          {/* Main Content Area */}
          <div className="flex-1 p-6 space-y-6">
            {/* Phase 2: MetadataGrid Component */}
            <MetadataGrid
              lead={leadData}
              isLoading={isLoading}
            />

            {/* Phase 3: PipelineStepper Component */}
            {leadData && (
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

            {/* Phase 4: FormDataManifest Component */}
            <FormDataManifest
              lead={leadData}
              isLoading={isLoading}
            />

            {/* Phase 5: CommunicationsCard Component */}
            <CommunicationsCard
              lead={leadData}
              isLoading={isLoading}
              tenantName={leadData?.tenant_name}
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
              onNextLead={handleNextLead}
              onClose={onClose}
              isArchiving={isArchiving}
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
