import { lazy, type ComponentType } from 'react';

/**
 * A part of the game loaded the first time it is opened. If its file cannot be fetched (offline before it was cached,
 * or a newer version was published while the game was open), it shows a way to reload instead of breaking the game.
 */
export function lazyPart<P extends object>(load: () => Promise<{ default: ComponentType<P> }>) {
  return lazy(() =>
    load().catch(() => ({
      default: (() => (
        <div className="space-y-2 p-3 text-[12px]">
          <p className="text-ops-amber">This part of the game could not be loaded. A newer version may have been published.</p>
          <button type="button" className="btn btn-primary" onClick={() => location.reload()}>
            Reload (your game is saved)
          </button>
        </div>
      )) as ComponentType<P>,
    })),
  );
}
