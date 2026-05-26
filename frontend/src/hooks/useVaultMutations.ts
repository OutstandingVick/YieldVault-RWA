import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../lib/queryClient";

/**
 * Simulated deposit mutation with optimistic UI updates.
 * In production, this would call the actual contract interaction.
 */
export function useDepositMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { walletAddress: string; amount: number }) => {
      // Simulate tx broadcast + confirmation delay
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return { success: true, ...params };
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.balance.usdc(variables.walletAddress),
      });

      const previousBalance = queryClient.getQueryData<number>(
        queryKeys.balance.usdc(variables.walletAddress),
      );

      const nextBalance = (previousBalance ?? 0) + variables.amount;
      queryClient.setQueryData(
        queryKeys.balance.usdc(variables.walletAddress),
        nextBalance,
      );

      return { previousBalance };
    },
    onSuccess: (_, variables) => {
      // Refresh related queries after confirmation
      queryClient.invalidateQueries({
        queryKey: queryKeys.portfolio.holdings(variables.walletAddress),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.vault.summary(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.transactions.list(variables.walletAddress),
      });
    },
    onError: (_err, variables, context) => {
      if (context?.previousBalance !== undefined) {
        queryClient.setQueryData(
          queryKeys.balance.usdc(variables.walletAddress),
          context.previousBalance,
        );
      }
    },
  });
}

/**
 * Simulated withdrawal mutation with optimistic UI updates.
 * In production, this would call the actual contract interaction.
 */
export function useWithdrawMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { walletAddress: string; amount: number }) => {
      // Simulate tx broadcast + confirmation delay
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return { success: true, ...params };
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.balance.usdc(variables.walletAddress),
      });

      const previousBalance = queryClient.getQueryData<number>(
        queryKeys.balance.usdc(variables.walletAddress),
      );

      const nextBalance = Math.max((previousBalance ?? 0) - variables.amount, 0);
      queryClient.setQueryData(
        queryKeys.balance.usdc(variables.walletAddress),
        nextBalance,
      );

      return { previousBalance };
    },
    onSuccess: (_, variables) => {
      // Refresh related queries after confirmation
      queryClient.invalidateQueries({
        queryKey: queryKeys.portfolio.holdings(variables.walletAddress),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.vault.summary(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.transactions.list(variables.walletAddress),
      });
    },
    onError: (_err, variables, context) => {
      if (context?.previousBalance !== undefined) {
        queryClient.setQueryData(
          queryKeys.balance.usdc(variables.walletAddress),
          context.previousBalance,
        );
      }
    },
  });
}
