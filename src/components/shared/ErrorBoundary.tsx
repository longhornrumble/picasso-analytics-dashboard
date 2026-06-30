/**
 * ErrorBoundary — the "Layer 0" safety net. Catches uncaught render-time throws
 * in its subtree and shows an on-brand banner <Alert> with a Reload action,
 * instead of white-screening the app. componentDidCatch is the hook where
 * telemetry (PostHog, etc.) can be wired later.
 *
 * Wrap the app (or a major section) once. For async/API errors use errorToAlert
 * + <Alert>/useToast at the call site — a boundary only catches render throws.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Alert } from './Alert';

interface Props {
  children: ReactNode;
  /** Names the failing area in the fallback copy, e.g. "Scheduling". */
  section?: string;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Last-resort log; telemetry hook goes here.
    console.error('[ErrorBoundary] uncaught render error:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (error) {
      return (
        <div className="max-w-3xl mx-auto p-4">
          <Alert
            severity="error"
            placement="banner"
            title={this.props.section ? `Something went wrong in ${this.props.section}` : 'Something went wrong'}
            description="This part of the page failed to load. Reloading usually fixes it."
            action={{ label: 'Reload', onClick: () => window.location.reload() }}
          />
        </div>
      );
    }
    return this.props.children;
  }
}
