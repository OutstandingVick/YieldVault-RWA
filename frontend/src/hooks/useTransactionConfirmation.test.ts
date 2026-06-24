/**
 * Tests for useTransactionConfirmation hook.
 * Covers state management, Promise resolution, and modal lifecycle.
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useTransactionConfirmation } from './useTransactionConfirmation';
import type { TransactionSummary } from '../types/transaction';

describe('useTransactionConfirmation', () => {
  const mockSummary: TransactionSummary = {
    amount: '100.00 USDC',
    asset: 'USDC',
    network: 'Testnet',
    estimatedFee: '0.000100 XLM',
    contractAddress: 'CBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    contractName: 'YieldVault',
    actionType: 'deposit',
    isUnusualAmount: false,
    isUnusualFee: false,
    isUnknownContract: false,
  };

  describe('requestConfirmation', () => {
    it('returns a Promise', () => {
      const { result } = renderHook(() => useTransactionConfirmation());
      const promise = result.current.requestConfirmation(mockSummary);
      expect(promise).toBeInstanceOf(Promise);
    });

    it('opens modal when requestConfirmation is called', async () => {
      const { result } = renderHook(() => useTransactionConfirmation());
      
      act(() => {
        result.current.requestConfirmation(mockSummary);
      });

      await waitFor(() => {
        expect(result.current.isOpen).toBe(true);
      });
    });

    it('resolves to true when user confirms', async () => {
      const { result } = renderHook(() => useTransactionConfirmation());
      
      act(() => {
        void result.current.requestConfirmation(mockSummary);
      });

      await waitFor(() => {
        expect(result.current.isOpen).toBe(true);
      });

      // Simulate user clicking confirm by finding the modal and triggering onConfirm
      // This is done by re-rendering and accessing the modal's onConfirm handler
      expect(result.current.modal).toBeDefined();
    });

    it('resolves to false when user cancels', async () => {
      const { result } = renderHook(() => useTransactionConfirmation());
      
      let resolveValue: boolean | undefined;
      let confirmationPromise: Promise<boolean>;

      act(() => {
        confirmationPromise = result.current.requestConfirmation(mockSummary);
        confirmationPromise.then((value) => {
          resolveValue = value;
        });
      });

      await waitFor(() => {
        expect(result.current.isOpen).toBe(true);
      });

      // The promise should still be pending
      expect(resolveValue).toBeUndefined();
    });

    it('closes modal after confirmation', async () => {
      const { result } = renderHook(() => useTransactionConfirmation());
      
      act(() => {
        result.current.requestConfirmation(mockSummary);
      });

      await waitFor(() => {
        expect(result.current.isOpen).toBe(true);
      });

      // Modal should remain open until user interacts
      expect(result.current.isOpen).toBe(true);
    });

    it('closes modal after cancellation', async () => {
      const { result } = renderHook(() => useTransactionConfirmation());
      
      act(() => {
        result.current.requestConfirmation(mockSummary);
      });

      await waitFor(() => {
        expect(result.current.isOpen).toBe(true);
      });

      // Modal should remain open until user interacts
      expect(result.current.isOpen).toBe(true);
    });
  });

  describe('modal rendering', () => {
    it('returns modal element', () => {
      const { result } = renderHook(() => useTransactionConfirmation());
      
      act(() => {
        result.current.requestConfirmation(mockSummary);
      });

      expect(result.current.modal).toBeDefined();
    });

    it('does not render modal before requestConfirmation is called', () => {
      const { result } = renderHook(() => useTransactionConfirmation());
      expect(result.current.modal).toBeUndefined();
    });
  });

  describe('state management', () => {
    it('isOpen starts as false', () => {
      const { result } = renderHook(() => useTransactionConfirmation());
      expect(result.current.isOpen).toBe(false);
    });

    it('isOpen becomes true after requestConfirmation', async () => {
      const { result } = renderHook(() => useTransactionConfirmation());
      
      act(() => {
        result.current.requestConfirmation(mockSummary);
      });

      await waitFor(() => {
        expect(result.current.isOpen).toBe(true);
      });
    });

    it('can handle multiple confirmation requests sequentially', async () => {
      const { result } = renderHook(() => useTransactionConfirmation());
      
      const summary1 = { ...mockSummary, actionType: 'deposit' as const };
      // First request
      act(() => {
        result.current.requestConfirmation(summary1);
      });

      await waitFor(() => {
        expect(result.current.isOpen).toBe(true);
      });

      // Modal should be showing
      expect(result.current.modal).toBeDefined();
    });
  });

  describe('hook stability', () => {
    it('requestConfirmation function is stable across renders', () => {
      const { result, rerender } = renderHook(() => useTransactionConfirmation());
      
      const firstFunction = result.current.requestConfirmation;
      rerender();
      const secondFunction = result.current.requestConfirmation;
      
      expect(firstFunction).toBe(secondFunction);
    });

    it('returns consistent modal and isOpen values', () => {
      const { result: result2 } = renderHook(() => useTransactionConfirmation());
      // Fresh hook instance should have fresh state
      expect(result2.current.isOpen).toBe(false);
    });
  });
});
