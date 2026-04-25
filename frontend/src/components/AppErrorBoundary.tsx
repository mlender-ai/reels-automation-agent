import type { ErrorInfo, ReactNode } from "react";
import { Component } from "react";

import { ErrorState } from "./ErrorState";

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  error: Error | null;
};

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("AppErrorBoundary caught an error", error, errorInfo);
  }

  private reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-app px-6 py-10 text-slate-100">
          <div className="mx-auto max-w-3xl">
            <ErrorState
              title="화면을 불러오다 오류가 발생했습니다"
              description="예상치 못한 런타임 오류가 발생했습니다. 새로고침하거나 다시 시도하면 대부분 복구됩니다."
              actionLabel="다시 시도"
              onAction={this.reset}
            />
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
