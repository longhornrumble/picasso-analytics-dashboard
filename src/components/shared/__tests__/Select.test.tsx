import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { Select } from '../Select';

const OPTIONS = [
  { value: 'a', label: 'Apple' },
  { value: 'b', label: 'Banana' },
  { value: 'c', label: 'Cherry' },
];

afterEach(cleanup);

function renderSelect(props: Partial<ComponentProps<typeof Select>> = {}) {
  const onChange = vi.fn();
  render(
    <>
      <Select label="Fruit" value="a" onChange={onChange} options={OPTIONS} {...props} />
      <button type="button">outside</button>
    </>,
  );
  return { onChange };
}

describe('Select', () => {
  it('renders the label, hint, and the selected option in the trigger', () => {
    renderSelect({ hint: 'Pick one' });
    const trigger = screen.getByRole('combobox', { name: 'Fruit' });
    expect(trigger).toHaveTextContent('Apple');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Pick one')).toBeInTheDocument();
    // menu is closed → no options in the tree
    expect(screen.queryByRole('option')).toBeNull();
  });

  it('falls back to the placeholder when the value matches no option', () => {
    renderSelect({ value: 'zzz', placeholder: 'Choose a fruit…' });
    expect(screen.getByRole('combobox', { name: 'Fruit' })).toHaveTextContent('Choose a fruit…');
  });

  it('opens on click and lists every option, marking the selected one', async () => {
    renderSelect();
    await userEvent.click(screen.getByRole('combobox', { name: 'Fruit' }));
    const listbox = screen.getByRole('listbox');
    const opts = within(listbox).getAllByRole('option');
    expect(opts).toHaveLength(3);
    expect(screen.getByRole('combobox', { name: 'Fruit' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('option', { name: 'Apple' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('option', { name: 'Banana' })).toHaveAttribute('aria-selected', 'false');
  });

  it('selecting an option calls onChange with its value and closes the menu', async () => {
    const { onChange } = renderSelect();
    await userEvent.click(screen.getByRole('combobox', { name: 'Fruit' }));
    await userEvent.click(screen.getByRole('option', { name: 'Banana' }));
    expect(onChange).toHaveBeenCalledWith('b');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('closes on an outside click without selecting', async () => {
    const { onChange } = renderSelect();
    await userEvent.click(screen.getByRole('combobox', { name: 'Fruit' }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'outside' }));
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('closes on Escape', async () => {
    renderSelect();
    await userEvent.click(screen.getByRole('combobox', { name: 'Fruit' }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('keyboard: ArrowDown opens then moves active, Enter selects', async () => {
    const { onChange } = renderSelect();
    const trigger = screen.getByRole('combobox', { name: 'Fruit' });
    trigger.focus();
    await userEvent.keyboard('{ArrowDown}'); // opens, active = selected (Apple, idx 0)
    await userEvent.keyboard('{ArrowDown}'); // active → Banana (idx 1)
    await userEvent.keyboard('{Enter}');     // select Banana
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('does not open when disabled', async () => {
    renderSelect({ disabled: true });
    await userEvent.click(screen.getByRole('combobox', { name: 'Fruit' }));
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});
