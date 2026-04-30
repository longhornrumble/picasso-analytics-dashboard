/**
 * TenantManagement — unit + integration tests
 *
 * Covers:
 *  - Loading skeleton shown while fetch is in-flight
 *  - Tenant list rendered after successful fetch
 *  - Error alert shown when fetch fails
 *  - Row click expands TenantDetailPanel (tenantId forwarded)
 *  - Second row click on the same tenant collapses the panel
 *  - Row click on a different tenant switches the panel
 *  - Success message displayed after an update propagates from child
 *  - Success message auto-clears after 3 s (timer mock)
 *  - Accessibility: error role="alert", success role="status" aria-live
 *
 * Runner: Vitest + @testing-library/react
 *
 * Setup (package.json devDependencies):
 *   "vitest": "^2", "@testing-library/react": "^16",
 *   "@testing-library/user-event": "^14", "@testing-library/jest-dom": "^6",
 *   "jsdom": "^25"
 *
 * vite.config.ts / vitest.config.ts:
 *   test: { environment: 'jsdom', setupFiles: ['./src/setupTests.ts'] }
 *
 * src/setupTests.ts:
 *   import '@testing-library/jest-dom'
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import type { AdminTenant } from '../../types/analytics';

// ---------------------------------------------------------------------------
// Module mocks — hoisted before component import
// ---------------------------------------------------------------------------

vi.mock('../../services/analyticsApi', () => ({
  fetchAdminTenants: vi.fn(),
}));

// TenantDetailPanel makes its own API calls; stub it so tests stay isolated
vi.mock('../admin/TenantDetailPanel', () => ({
  default: ({ tenantId, onClose, onUpdated }: {
    tenantId: string;
    onClose: () => void;
    onUpdated: (t: AdminTenant) => void;
  }) => (
    <div data-testid="detail-panel" data-tenant-id={tenantId}>
      <button onClick={onClose}>Close</button>
      <button
        onClick={() =>
          onUpdated({ tenantId, companyName: 'Updated Co', status: 'active', subscriptionTier: 'premium', networkId: null, networkName: null, tenantHash: 'abc', s3ConfigPath: 's3', onboardedAt: '', updatedAt: '', has_stripe: true, has_clerk: true })
        }
      >
        Trigger Update
      </button>
    </div>
  ),
}));

import TenantManagement from '../admin/TenantManagement';
import { fetchAdminTenants } from '../../services/analyticsApi';

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

const MOCK_TENANTS = [
  {
    tenantId: 'T001',
    tenantHash: 'ha001',
    companyName: 'Acme Corp',
    status: 'active',
    subscriptionTier: 'standard',
    networkId: 'NET1',
    networkName: 'Alpha Network',
    s3ConfigPath: 's3://configs/T001',
    onboardedAt: '2024-01-15T00:00:00Z',
    updatedAt: '2024-06-01T00:00:00Z',
    has_stripe: true,
    has_clerk: true,
  },
  {
    tenantId: 'T002',
    tenantHash: 'ha002',
    companyName: 'Beta LLC',
    status: 'suspended',
    subscriptionTier: 'free',
    networkId: null,
    networkName: null,
    s3ConfigPath: 's3://configs/T002',
    onboardedAt: '2024-03-20T00:00:00Z',
    updatedAt: '2024-07-01T00:00:00Z',
    has_stripe: false,
    has_clerk: false,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockFetch = fetchAdminTenants as ReturnType<typeof vi.fn>;

function renderComponent() {
  return render(<TenantManagement />);
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('TenantManagement', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  // ── Loading state ──────────────────────────────────────────────────────────

  it('shows loading skeleton while fetch is in-flight', () => {
    // Never resolves during this test
    mockFetch.mockReturnValue(new Promise(() => {}));
    renderComponent();

    // Skeletons rendered as aria-busy container
    const container = document.querySelector('[aria-busy="true"]');
    expect(container).toBeTruthy();
  });

  // ── Successful render ──────────────────────────────────────────────────────

  it('renders tenant rows after successful fetch', async () => {
    mockFetch.mockResolvedValue(MOCK_TENANTS);
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
      expect(screen.getByText('Beta LLC')).toBeInTheDocument();
    });
  });

  it('renders status badges for each tenant', async () => {
    mockFetch.mockResolvedValue(MOCK_TENANTS);
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('active')).toBeInTheDocument();
      expect(screen.getByText('suspended')).toBeInTheDocument();
    });
  });

  it('renders subscription tier for each tenant', async () => {
    mockFetch.mockResolvedValue(MOCK_TENANTS);
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('standard')).toBeInTheDocument();
      expect(screen.getByText('free')).toBeInTheDocument();
    });
  });

  it('displays em-dash for tenants with no network', async () => {
    mockFetch.mockResolvedValue(MOCK_TENANTS);
    renderComponent();

    await waitFor(() => {
      // Beta LLC has no networkName
      const dashes = screen.getAllByText('\u2014');
      expect(dashes.length).toBeGreaterThan(0);
    });
  });

  // ── Error state ────────────────────────────────────────────────────────────

  it('shows error alert when fetch fails', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('dismisses error alert when close button is clicked', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    renderComponent();

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());

    const dismissBtn = screen.getByLabelText('Dismiss error');
    fireEvent.click(dismissBtn);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  // ── Row interaction ────────────────────────────────────────────────────────

  it('expands detail panel when a row is clicked', async () => {
    mockFetch.mockResolvedValue(MOCK_TENANTS);
    renderComponent();

    await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument());

    // Click the row containing "Acme Corp"
    const acmeCell = screen.getByText('Acme Corp');
    const row = acmeCell.closest('tr');
    expect(row).toBeTruthy();
    fireEvent.click(row!);

    await waitFor(() => {
      const panel = screen.getByTestId('detail-panel');
      expect(panel).toBeInTheDocument();
      expect(panel).toHaveAttribute('data-tenant-id', 'T001');
    });
  });

  it('collapses detail panel when the same row is clicked again', async () => {
    mockFetch.mockResolvedValue(MOCK_TENANTS);
    renderComponent();

    await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument());

    const row = screen.getByText('Acme Corp').closest('tr')!;
    // First click: expand
    fireEvent.click(row);
    await waitFor(() => expect(screen.getByTestId('detail-panel')).toBeInTheDocument());

    // Second click: collapse
    fireEvent.click(row);
    await waitFor(() => expect(screen.queryByTestId('detail-panel')).not.toBeInTheDocument());
  });

  it('switches detail panel tenant when a different row is clicked', async () => {
    mockFetch.mockResolvedValue(MOCK_TENANTS);
    renderComponent();

    await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument());

    const acmeRow = screen.getByText('Acme Corp').closest('tr')!;
    fireEvent.click(acmeRow);
    await waitFor(() => expect(screen.getByTestId('detail-panel')).toHaveAttribute('data-tenant-id', 'T001'));

    const betaRow = screen.getByText('Beta LLC').closest('tr')!;
    fireEvent.click(betaRow);
    await waitFor(() => expect(screen.getByTestId('detail-panel')).toHaveAttribute('data-tenant-id', 'T002'));
  });

  it('closes detail panel when TenantDetailPanel calls onClose', async () => {
    mockFetch.mockResolvedValue(MOCK_TENANTS);
    renderComponent();

    await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument());

    const row = screen.getByText('Acme Corp').closest('tr')!;
    fireEvent.click(row);
    await waitFor(() => expect(screen.getByTestId('detail-panel')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Close'));
    await waitFor(() => expect(screen.queryByTestId('detail-panel')).not.toBeInTheDocument());
  });

  // ── Update propagation ─────────────────────────────────────────────────────

  it('shows success message when TenantDetailPanel reports an update', async () => {
    mockFetch.mockResolvedValue(MOCK_TENANTS);
    renderComponent();

    await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument());

    const row = screen.getByText('Acme Corp').closest('tr')!;
    fireEvent.click(row);
    await waitFor(() => expect(screen.getByTestId('detail-panel')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Trigger Update'));

    await waitFor(() => {
      const status = screen.getByRole('status');
      expect(status).toBeInTheDocument();
      expect(status).toHaveTextContent('Updated Updated Co');
    });
  });

  it('success message auto-clears after 3 seconds', async () => {
    mockFetch.mockResolvedValue(MOCK_TENANTS);
    renderComponent();

    await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument());

    const row = screen.getByText('Acme Corp').closest('tr')!;
    fireEvent.click(row);
    await waitFor(() => expect(screen.getByTestId('detail-panel')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Trigger Update'));
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());

    // Advance fake timers by 3 s
    vi.advanceTimersByTime(3000);

    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  });

  // ── Accessibility ──────────────────────────────────────────────────────────

  it('error message uses role="alert"', async () => {
    mockFetch.mockRejectedValue(new Error('Oops'));
    renderComponent();
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });

  it('success message uses role="status" with aria-live="polite"', async () => {
    mockFetch.mockResolvedValue(MOCK_TENANTS);
    renderComponent();

    await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument());

    const row = screen.getByText('Acme Corp').closest('tr')!;
    fireEvent.click(row);
    await waitFor(() => expect(screen.getByTestId('detail-panel')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Trigger Update'));

    await waitFor(() => {
      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('aria-live', 'polite');
    });
  });

  it('Stripe and Clerk indicators carry accessible aria-label attributes', async () => {
    mockFetch.mockResolvedValue(MOCK_TENANTS);
    renderComponent();

    await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument());

    expect(screen.getByLabelText('Stripe connected')).toBeInTheDocument();
    expect(screen.getByLabelText('Clerk connected')).toBeInTheDocument();
    expect(screen.getByLabelText('Stripe not connected')).toBeInTheDocument();
    expect(screen.getByLabelText('Clerk not connected')).toBeInTheDocument();
  });
});
