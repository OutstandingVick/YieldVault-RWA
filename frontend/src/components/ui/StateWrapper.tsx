import React from "react";
import LoadingState, { type LoadingStateProps } from "./LoadingState";
import ErrorState, { type ErrorStateProps } from "./ErrorState";
import EmptyState, { type EmptyStateProps } from "./EmptyState";

export interface StateWrapperProps {
  isLoading?: boolean;
  isError?: boolean;
  isEmpty?: boolean;
  error?: Error | string | null;
  loadingMessage?: string;
  loadingProps?: Partial<LoadingStateProps>;
  loadingFallback?: React.ReactNode;
  errorProps?: Partial<ErrorStateProps>;
  errorFallback?: React.ReactNode;
  emptyProps?: Partial<EmptyStateProps>;
  emptyFallback?: React.ReactNode;
  onRetry?: () => void;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const StateWrapper: React.FC<StateWrapperProps> = ({
  isLoading = false,
  isError = false,
  isEmpty = false,
  error,
  loadingMessage,
  loadingProps,
  loadingFallback,
  errorProps,
  errorFallback,
  emptyProps,
  emptyFallback,
  onRetry,
  children,
  className = "",
  style,
}) => {
  if (isLoading) {
    if (loadingFallback) {
      return <>{loadingFallback}</>;
    }
    return (
      <LoadingState
        message={loadingMessage ?? loadingProps?.message}
        className={className}
        style={style}
        {...loadingProps}
      />
    );
  }

  if (isError) {
    if (errorFallback) {
      return <>{errorFallback}</>;
    }
    return (
      <ErrorState
        error={error ?? errorProps?.error}
        onRetry={onRetry ?? errorProps?.onRetry}
        className={className}
        style={style}
        {...errorProps}
      />
    );
  }

  if (isEmpty) {
    if (emptyFallback) {
      return <>{emptyFallback}</>;
    }
    return (
      <EmptyState
        className={className}
        kind={emptyProps?.kind ?? "no-data"}
        {...emptyProps}
      />
    );
  }

  return <div className={`state-wrapper-content ${className}`.trim()} style={style}>{children}</div>;
};

export default StateWrapper;
