// The country brief (19.0b): on a generated map, before the clock first runs, one line for each of the country's
// features and what it means for you.
import { featureLines } from '../sim/features';
import type { SimState } from '../sim/types';
import { countryTitle } from '../sim/worldgen';
import { DialogFocus } from '../ui/DialogFocus';
import { Btn } from '../ui/kit';

/** Whether a game should open with the brief: a generated country with features, not yet under way. */
export const wantsBrief = (s: SimState) => !!s.features && featureLines(s.features).length > 0 && s.history.length === 0 && !s.over;

export function CountryBrief({ state, onClose }: { state: SimState; onClose: () => void }) {
  const lines = featureLines(state.features);
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-ops-bg/90 p-3" role="dialog" aria-modal="true" aria-labelledby="country-brief-title">
      <DialogFocus labelledBy="country-brief-title" />
      <div className="panel mx-auto mt-[10vh] max-w-xl space-y-3 p-4 text-[12px]">
        <div className="label text-ops-amber">Country brief</div>
        <h2 id="country-brief-title" className="fc-dialog-title">
          {countryTitle()}
        </h2>
        <p className="text-ops-dim">Every country is built differently. Your staff have marked what sets this one apart.</p>
        <ul className="space-y-2">
          {lines.map((l) => (
            <li key={l.short} className="rounded border border-ops-line/60 p-2 leading-relaxed text-ops-text">
              {l.long}
            </li>
          ))}
        </ul>
        <div className="flex justify-end">
          <Btn kind="primary" onClick={onClose}>
            To work →
          </Btn>
        </div>
      </div>
    </div>
  );
}
