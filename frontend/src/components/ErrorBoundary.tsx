import { Component, type ErrorInfo, type ReactNode } from "react";
import ErrorFallback from "./ErrorFallback";

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (props: { error: Error; resetError: () => void }) => ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * React error boundary with a user-safe fallback UI.
 * Works without Sentry so render failures never blank the app.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info);
  }

  resetError = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback({ error, resetError: this.resetError });
    }

    return <ErrorFallback error={error} resetError={this.resetError} />;
  }
}

export default ErrorBoundary;
