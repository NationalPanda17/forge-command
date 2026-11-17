// Sandbox controls: change the rules and the world while you play.
import { validate, type SandboxOp, type SimAction } from '../sim/actions';
import type { SimState } from '../sim/types';
import { FIGHTING_REGIONS, REGIONS, SITE_BY_ID } from '../sim/world';
import { Btn, Segmented } from '../ui/kit';

export default function SandboxPanel({ state, act, selected }: { state: SimState; act: (a: SimAction) => void; selected: string | null }) {
  const op = (o: SandboxOp) => act({ type: 'sandbox', op: o });
  const why = (o: SandboxOp) => validate(state, { type: 'sandbox', op: o });
  const r = state.settings;
  const toggle = (k: 'inflation' | 'seasons' | 'crises' | 'endless' | 'dismissal', label: string, hint: string) => (
    <label className="flex items-start gap-2" title={hint}>
      <input type="checkbox" className="mt-0.5" checked={r[k]} onChange={(e) => op({ kind: 'rules', settings: { [k]: e.target.checked } })} />
      <span>
        <span className="text-white">{label}</span>
        <span className="block text-[10px] text-ops-dim">{hint}</span>
      </span>
    </label>
  );
  const site = selected ? SITE_BY_ID[selected] : null;
  return (
    <div className="space-y-4 p-3 text-[11px]">
      <p className="text-ops-dim">This is a sandbox: no score and no achievements. Change anything, at any time.</p>

      <section>
        <h3 className="label mb-2">Rules</h3>
        <div className="space-y-2">
          {toggle('inflation', 'Inflation', 'Prices, wages and running costs rise about 3% a year.')}
          {toggle('seasons', 'Seasons', 'Winter ice, spring floods and summer heat.')}
          {toggle('crises', 'Crises', 'Fighting can break out in a region, with two months of warning.')}
          {toggle('dismissal', 'Dismissal', 'The Committee can end the game when confidence reaches zero.')}
          {toggle('endless', 'No end date', 'Play for as long as you like.')}
        </div>
        <div className="mt-3">
          <div className="label mb-1">Disruptions and events</div>
          <Segmented<string>
            label="Disruptions and events"
            value={String(r.events)}
            onChange={(v) => op({ kind: 'rules', settings: { events: Number(v) } })}
            options={[
              { id: '0', label: 'None' },
              { id: '0.5', label: 'Rare' },
              { id: '1', label: 'Normal' },
              { id: '2', label: 'Often' },
            ]}
          />
        </div>
      </section>

      <section>
        <h3 className="label mb-2">Money</h3>
        <div className="flex flex-wrap gap-1">
          {[100, 500, 2000].map((m) => (
            <Btn key={m} onClick={() => op({ kind: 'money', amount: m })}>
              +${m.toLocaleString('en-US')}M
            </Btn>
          ))}
        </div>
      </section>

      <section>
        <h3 className="label mb-2">Crisis</h3>
        {state.crisis ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-ops-text">
              {state.crisis.name} ({state.crisis.phase === 'active' ? 'fighting' : 'warning'}, {REGIONS[state.crisis.region].name})
            </span>
            <Btn why={why({ kind: 'endCrisis' })} onClick={() => op({ kind: 'endCrisis' })}>
              Call it off
            </Btn>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1">
            {FIGHTING_REGIONS.map((reg) => (
              <Btn key={reg} why={why({ kind: 'crisis', region: reg })} onClick={() => op({ kind: 'crisis', region: reg })}>
                Start in {REGIONS[reg].name}
              </Btn>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="label mb-2">Events</h3>
        <div className="flex flex-wrap gap-1">
          <Btn why={selected ? why({ kind: 'disrupt', site: selected }) : 'Select a site on the map first'} onClick={() => selected && op({ kind: 'disrupt', site: selected })}>
            Disrupt {site ? site.name : 'the selected site'}
          </Btn>
          <Btn onClick={() => op({ kind: 'calm' })}>Lift every disruption and ban</Btn>
          <Btn why={why({ kind: 'finishResearch' })} onClick={() => op({ kind: 'finishResearch' })}>
            Finish research now
          </Btn>
        </div>
      </section>
    </div>
  );
}
