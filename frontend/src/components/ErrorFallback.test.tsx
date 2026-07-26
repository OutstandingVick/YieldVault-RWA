import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorFallback from './ErrorFallback';
import * as ErrorNavigation from './errorNavigation';

describe('ErrorFallback', () => {
  const mockError = new Error('Test error message');
  const mockResetError = vi.fn();

  it('renders a user-safe message without exposing technical errors by default', () => {
    render(
      <ErrorFallback
        error={new Error('TypeError: Cannot read properties of null')}
        resetError={mockResetError}
        showErrorDetail={false}
      />,
    );

    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByText('Something went wrong')).toBeDefined();
    expect(screen.queryByTestId('error-fallback-detail')).toBeNull();
    expect(screen.queryByText(/TypeError/)).toBeNull();
  });

  it('calls resetError when Try Again is clicked', () => {
    render(<ErrorFallback error={mockError} resetError={mockResetError} showErrorDetail={false} />);

    fireEvent.click(screen.getByText('Try Again'));
    expect(mockResetError).toHaveBeenCalled();
  });

  it('calls reload when reload button is clicked', () => {
    const reloadSpy = vi.spyOn(ErrorNavigation, 'reloadPage').mockImplementation(() => undefined);

    render(
      <ErrorFallback
        error={mockError}
        resetError={mockResetError}
        onReload={reloadSpy}
        showErrorDetail={false}
      />,
    );

    fireEvent.click(screen.getByText('Reload Page'));
    expect(reloadSpy).toHaveBeenCalled();
    reloadSpy.mockRestore();
  });

  it('navigates to home when Go Home button is clicked', () => {
    const assignSpy = vi.spyOn(ErrorNavigation, 'goHome').mockImplementation(() => undefined);

    render(
      <ErrorFallback
        error={mockError}
        resetError={mockResetError}
        onGoHome={assignSpy}
        showErrorDetail={false}
      />,
    );

    fireEvent.click(screen.getByText('Go Home'));
    expect(assignSpy).toHaveBeenCalled();
    assignSpy.mockRestore();
  });
});
