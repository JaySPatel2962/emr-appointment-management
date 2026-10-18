import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

export interface ErrorFallbackProps {
  error: Error;
  /** Renders the children again, for errors that a second try may not hit. */
  reset: () => void;
}

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: (props: ErrorFallbackProps) => ReactNode;
  /** When this changes (the route, say), a caught error is cleared and the children render again. */
  resetKey?: string | undefined;
  onError?: ((error: Error, info: ErrorInfo) => void) | undefined;
}

interface ErrorBoundaryState {
  error: Error | null;
  resetKey: string | undefined;
}

/**
 * Catches errors thrown while rendering its children and shows `fallback` instead of a blank
 * screen. React only supports this as a class component, so it is the app's one class.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null, resetKey: this.props.resetKey };

  static getDerivedStateFromError(error: unknown): Partial<ErrorBoundaryState> {
    return { error: error instanceof Error ? error : new Error('Something went wrong') };
  }

  static getDerivedStateFromProps(
    props: ErrorBoundaryProps,
    state: ErrorBoundaryState,
  ): Partial<ErrorBoundaryState> | null {
    return props.resetKey === state.resetKey ? null : { error: null, resetKey: props.resetKey };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info);
  }

  private readonly reset = (): void => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    const { error } = this.state;
    return error ? this.props.fallback({ error, reset: this.reset }) : this.props.children;
  }
}
