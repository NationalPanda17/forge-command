import { Component, type ReactNode } from 'react';
import { lastPlayed, saveSim } from '../game/useSim';

/** If anything in the interface breaks, offer the player their save and a way back. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch() {
    // Keep the game exactly as it was the moment before the screen broke.
    if (lastPlayed) saveSim(lastPlayed);
  }

  download = () => {
    try {
      const raw = localStorage.getItem('forge-command-2-autosave');
      if (!raw) return;
      const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'forge-command-save.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      /* nothing to save */
    }
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto max-w-lg p-6">
        <div className="panel space-y-3 p-4 text-[12px]">
          <h1 className="font-sans text-xl font-semibold text-ops-amber">Something went wrong</h1>
          <p className="text-ops-text">Forge Command hit an unexpected error. Your game was saved as it stood just before; reload to carry on.</p>
          <pre className="max-h-32 overflow-auto rounded bg-ops-bg p-2 text-[10px] text-ops-dim">{String(this.state.error.message)}</pre>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn" onClick={this.download}>
              Download my save
            </button>
            <button type="button" className="btn btn-primary" onClick={() => location.reload()}>
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}

/** Around one tab: if that tab breaks, the rest of the game keeps running and the player can go elsewhere. */
export class PanelBoundary extends Component<{ children: ReactNode; resetKey: string; onHome: () => void }, { error: Error | null; key: string }> {
  state = { error: null as Error | null, key: this.props.resetKey };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  static getDerivedStateFromProps(props: { resetKey: string }, state: { error: Error | null; key: string }) {
    // Opening another tab clears the error.
    return props.resetKey !== state.key ? { error: null, key: props.resetKey } : null;
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="space-y-2 p-3 text-[12px]">
        <p className="text-ops-amber">This tab hit an unexpected error. The rest of the game is still running, and your game is saved.</p>
        <pre className="max-h-24 overflow-auto rounded bg-ops-bg p-2 text-[10px] text-ops-dim">{String(this.state.error.message)}</pre>
        <button type="button" className="btn btn-primary" onClick={this.props.onHome}>
          Back to Home
        </button>
      </div>
    );
  }
}
