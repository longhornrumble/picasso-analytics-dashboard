import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ZoomIntegrationCard } from '../ZoomIntegrationCard';

describe('ZoomIntegrationCard (placeholder)', () => {
  it('renders the Zoom placeholder with a coming-soon badge', () => {
    render(<ZoomIntegrationCard />);
    expect(screen.getByRole('heading', { name: 'Zoom' })).toBeInTheDocument();
    expect(screen.getByText('Coming soon')).toBeInTheDocument();
  });

  it('has NO connect action — it is a placeholder until self-service Zoom lands', () => {
    render(<ZoomIntegrationCard />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });
});
