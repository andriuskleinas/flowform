import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
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
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        this.props.fallback ?? (
          <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-ink/5 bg-white p-8 text-center">
            <div>
              <p className="font-semibold text-ink">Something went wrong</p>
              <p className="mt-1 text-sm text-ink/60">Refresh the page to try again.</p>
            </div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
