import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toggle } from '../Toggle';

afterEach(cleanup);

describe('Toggle', () => {
  it('renders a switch with the accessible name and checked state', () => {
    render(<Toggle checked ariaLabel="Turn off Reminders" onChange={() => {}} />);
    const sw = screen.getByRole('switch', { name: 'Turn off Reminders' });
    expect(sw).toHaveAttribute('aria-checked', 'true');
  });

  it('calls onChange with the toggled value on click', async () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} ariaLabel="Turn on Reminders" onChange={onChange} />);
    await userEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('does not fire onChange when disabled', async () => {
    const onChange = vi.fn();
    render(<Toggle checked ariaLabel="Locked" disabled onChange={onChange} />);
    const sw = screen.getByRole('switch');
    expect(sw).toBeDisabled();
    await userEvent.click(sw);
    expect(onChange).not.toHaveBeenCalled();
  });
});
