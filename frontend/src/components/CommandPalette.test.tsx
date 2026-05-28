import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CommandPalette from './CommandPalette';
import * as ctx from '../context/KeyboardShortcutContext';
import type { ShortcutDefinition } from '../hooks/useKeyboardShortcuts';

const mockClose = vi.fn();
const mockAction = vi.fn();

const shortcuts: ShortcutDefinition[] = [
  { key: 'g', description: 'Go to Vaults', scope: 'Navigation', action: mockAction },
  { key: 'p', description: 'Go to Portfolio', scope: 'Navigation', action: mockAction },
  { key: 's', description: 'Open Settings', scope: 'Actions', action: mockAction },
  { key: '?', shiftKey: true, description: 'Show keyboard shortcuts', scope: 'General', action: mockAction },
  // These should be excluded from the palette list
  { key: 'Escape', description: 'Close modal', scope: 'General', action: mockAction },
  { key: 'k', metaKey: true, description: 'Open command palette', scope: 'General', action: mockAction },
];

function mockContext(isPaletteOpen: boolean) {
  vi.spyOn(ctx, 'useKeyboardShortcutContext').mockReturnValue({
    shortcuts,
    isPaletteOpen,
    closePalette: mockClose,
    openPalette: vi.fn(),
    isHelpModalOpen: false,
    openHelpModal: vi.fn(),
    closeHelpModal: vi.fn(),
    formatShortcut: (s) => s.key.toUpperCase(),
  });
}

describe('CommandPalette', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when closed', () => {
    mockContext(false);
    const { container } = render(<CommandPalette />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the search input when open', () => {
    mockContext(true);
    render(<CommandPalette />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('shows all actionable shortcuts (excludes Escape and Cmd+K)', () => {
    mockContext(true);
    render(<CommandPalette />);
    expect(screen.getByText('Go to Vaults')).toBeInTheDocument();
    expect(screen.getByText('Go to Portfolio')).toBeInTheDocument();
    expect(screen.getByText('Open Settings')).toBeInTheDocument();
    expect(screen.queryByText('Close modal')).not.toBeInTheDocument();
    expect(screen.queryByText('Open command palette')).not.toBeInTheDocument();
  });

  it('filters results by fuzzy search', () => {
    mockContext(true);
    render(<CommandPalette />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'port' } });
    expect(screen.getByText('Go to Portfolio')).toBeInTheDocument();
    expect(screen.queryByText('Go to Vaults')).not.toBeInTheDocument();
  });

  it('shows no-results message when query matches nothing', () => {
    mockContext(true);
    render(<CommandPalette />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'zzzzz' } });
    expect(screen.getByText('No matching actions')).toBeInTheDocument();
  });

  it('closes on Escape key', () => {
    mockContext(true);
    render(<CommandPalette />);
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' });
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it('closes on backdrop click', () => {
    mockContext(true);
    render(<CommandPalette />);
    const dialog = screen.getByRole('dialog');
    fireEvent.click(dialog);
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it('runs action and closes on Enter', () => {
    mockContext(true);
    render(<CommandPalette />);
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' });
    expect(mockAction).toHaveBeenCalledTimes(1);
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it('runs action and closes on item click', () => {
    mockContext(true);
    render(<CommandPalette />);
    fireEvent.click(screen.getByText('Go to Vaults'));
    expect(mockAction).toHaveBeenCalledTimes(1);
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it('navigates list with ArrowDown / ArrowUp', () => {
    mockContext(true);
    render(<CommandPalette />);
    const input = screen.getByRole('combobox');

    // First item is active by default (index 0)
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('has accessible dialog role and listbox', () => {
    mockContext(true);
    render(<CommandPalette />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });
});
