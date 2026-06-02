import { useState, useCallback, useRef } from 'react';
import type { TransactionSummary } from '../types/transaction';
import { TransactionConfirmationModal } from '../components/TransactionConfirmationModal';
import React from 'react';

interface ConfirmationState {
  isOpen: boolean;
  summary: TransactionSummary | null;
  isLoading: boolean;
  resolve: ((value: boolean) => void) | null;
}

interface UseTransactionConfirmationReturn {
  /**
   * Shows the modal and returns a Promise that resolves to true if confirmed
   * or false if cancelled.
   *
   * The Promise is resolved when the user clicks Confirm or Cancel,
   * or when pressing Escape.
   */
  requestConfirmation(summary: TransactionSummary): Promise<boolean>;

  /**
   * React element to render the modal in the component tree.
   * Must be placed at an appropriate level (not inside form or overflow:hidden).
   */
  modal: React.ReactNode;

  /**
   * Whether the modal is currently open.
   */
  isOpen: boolean;
}

export function useTransactionConfirmation(): UseTransactionConfirmationReturn {
  const [state, setState] = useState<ConfirmationState>({
    isOpen: false,
    summary: null,
    isLoading: false,
    resolve: null,
  });

  const resolveRef = useRef<(value: boolean) => void | null>(null);

  const handleConfirm = useCallback(() => {
    setState((prev) => ({ ...prev, isLoading: true }));
    // Calling resolve in the next tick allows setState to complete
    if (resolveRef.current) {
      setTimeout(() => {
        resolveRef.current?.(true);
        setState({ isOpen: false, summary: null, isLoading: false, resolve: null });
        resolveRef.current = null;
      }, 0);
    }
  }, []);

  const handleCancel = useCallback(() => {
    if (resolveRef.current) {
      resolveRef.current(false);
      setState({ isOpen: false, summary: null, isLoading: false, resolve: null });
      resolveRef.current = null;
    }
  }, []);

  const requestConfirmation = useCallback(
    (summary: TransactionSummary): Promise<boolean> => {
      return new Promise((resolve) => {
        resolveRef.current = resolve;
        setState({
          isOpen: true,
          summary,
          isLoading: false,
          resolve,
        });
      });
    },
    []
  );

  const modal = state.summary && (
    <TransactionConfirmationModal
      isOpen={state.isOpen}
      summary={state.summary}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
      isLoading={state.isLoading}
    />
  );

  return {
    requestConfirmation,
    modal,
    isOpen: state.isOpen,
  };
}
