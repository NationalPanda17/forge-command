// In-house plants: build, expand and run your own component production.
import { CAMPUSES, COMPONENTS, FACILITIES, FACILITY_IDS, facilityBuildMonths, facilityCap, validateAction, type Action, type GameState } from '../engine';
import { Btn, Chip, Panel, Segmented } from './kit';
import { money, qty } from './format';

const LIMIT = (l: string | null) => {
  if (!l) return '—';
  if (l === 'capacity') return 'at capacity';
  if (l === 'crew') return 'understaffed';
  if (l === 'idle') return 'idle';
  return `short of ${COMPONENTS[l as keyof typeof COMPONENTS]?.name.toLowerCase() ?? l}`;
};

export default function Facilities({ state, act }: { state: GameState; act: (a: Action) => void }) {
  return (
    <Panel title="In-house production" right="make your own parts instead of buying them">
      <div className="grid gap-3 p-3 lg:grid-cols-3">
        {FACILITY_IDS.map((f) => {
          const def = FACILITIES[f];
          const st = state.facilities[f];
          const installed = st.tranches.reduce((a, t) => a + t.capacity, 0);
          const inspecting = st.tranches.some((t) => t.faiMonths > 0);
          const build: Action = { type: 'buildFacility', facility: f };
          const expand: Action = { type: 'expandFacility', facility: f };
          return (
            <article key={f} className="rounded border border-ops-line/70 p-3 text-[11px]">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-sans text-[15px] font-semibold text-white">{def.name}</h3>
                {st.status === 'running' ? (
                  <Chip tone="border-ops-green/60 text-ops-green">running</Chip>
                ) : st.status === 'building' ? (
                  <Chip tone="border-ops-cyan/60 text-ops-cyan">building · {st.monthsLeft} mo</Chip>
                ) : (
                  <Chip>not built</Chip>
                )}
              </div>
              <div className="text-[10px] text-ops-dim">
                {CAMPUSES[def.campus].name} · makes {COMPONENTS[def.component].name.toLowerCase()}
              </div>
              <p className="mt-1 leading-snug text-ops-text">{def.blurb}</p>
              <p className="mt-1 text-[10px] text-ops-dim">
                {qty(def.baseCap)} {COMPONENTS[def.component].unit}/month to start · crew {def.crew} · materials {money(def.unitCost)} per unit (market list {money(COMPONENTS[def.component].price)})
                {Object.keys(def.inputs).length > 0 &&
                  ` · uses ${Object.entries(def.inputs)
                    .map(([c, q]) => `${q} ${COMPONENTS[c as keyof typeof COMPONENTS].unit} ${COMPONENTS[c as keyof typeof COMPONENTS].name.toLowerCase()}`)
                    .join(', ')} each`}
              </p>
              {st.status === 'running' && (
                <div className="mt-2 space-y-1">
                  <div>
                    Last month: <span className="text-white">{qty(st.lastOutput)}</span> of {qty(facilityCap(state, f))} possible · {LIMIT(st.lastLimit)}
                    {inspecting && <span className="text-ops-cyan"> · first articles under inspection</span>}
                  </div>
                  <div className="text-[10px] text-ops-dim">Installed {qty(installed)}/month</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Segmented
                      label={`${def.name} running`}
                      value={st.run}
                      onChange={(run) => act({ type: 'setFacilityRun', facility: f, run })}
                      options={[
                        { id: 'idle', label: 'Idle' },
                        { id: 'normal', label: 'Run' },
                      ]}
                    />
                    <Btn why={validateAction(state, expand)} onClick={() => act(expand)}>
                      Expand +{qty(def.expandCap)} · {money(def.expandCost)}
                    </Btn>
                  </div>
                </div>
              )}
              {st.status === 'none' && (
                <Btn className="mt-2" kind="primary" why={validateAction(state, build)} title={`Takes ${facilityBuildMonths(state)} months, then first articles are inspected and output ramps up.`} onClick={() => act(build)}>
                  Build · {money(def.buildCost)} · {facilityBuildMonths(state)} mo
                </Btn>
              )}
            </article>
          );
        })}
      </div>
    </Panel>
  );
}
