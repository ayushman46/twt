import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Changing this (for example the current screen) clears a previous error. */
  resetKey: string;
}

/**
 * Keeps one crashing screen from blanking the whole dashboard. The library data
 * lives in IndexedDB, so "Try again" re-mounts the screen without losing anything.
 */
export class ScreenErrorBoundary extends Component<Props, { error: Error | null }> {
  override state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidCatch(error: Error) {
    console.error('[twtdash] screen crashed', error);
  }

  override componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="mx-auto flex w-full max-w-md flex-col items-center gap-3 px-6 pt-24 text-center">
        <h2 className="text-[18px] font-semibold tracking-tight">This screen hit a problem</h2>
        <p className="text-[13.5px] text-muted">Your library is safe on this device. Try again to reload this screen.</p>
        <button
          type="button"
          onClick={() => this.setState({ error: null })}
          className="mt-2 h-9 rounded-full bg-panel-2 px-4 text-[13px] font-medium ring-1 ring-line hover:bg-panel-3"
        >
          Try again
        </button>
      </div>
    );
  }
}
