import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Prevents a render error in a subtree (e.g. the Phaser board) from unmounting
 * the whole app into a blank screen. Shows a contained fallback instead.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  reset = (): void => this.setState({ error: null });

  override render(): ReactNode {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex h-full min-h-[360px] w-full flex-col items-center justify-center gap-3 rounded-lg border border-white/40 bg-panel p-6 text-center shadow-game">
          <p className="font-black text-ink">เกิดข้อผิดพลาดในการแสดงกระดาน</p>
          <p className="max-w-sm text-sm text-slate-500">{this.state.error.message}</p>
          <button className="focus-ring rounded-lg bg-coral px-4 py-2 font-bold text-white" onClick={this.reset}>
            ลองใหม่
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
