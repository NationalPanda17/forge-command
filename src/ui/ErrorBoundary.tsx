import { Component, type ReactNode } from 'react';

/** If anything in the interface breaks, offer the player their save and a way back. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
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
          <p className="text-ops-text">Forge Command hit an unexpected error. Your game is autosaved every month.</p>
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
