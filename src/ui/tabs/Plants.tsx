import {
  CAMPUSES,
  CAMPUS_IDS,
  COMPONENTS,
  LINES,
  MAX_UPGRADE,
  UPGRADE,
  buildCost,
  effectiveCapacity,
  expandCost,
  expansions,
  freeBays,
  installedCapacity,
  lineOverhead,
  linesAt,
  plannedOutput,
  productivity,
  retoolCost,
  reworkCost,
  staffing,
  upgradeCost,
  usedBays,
  validateAction,
  type Action,
  type CampusId,
  type ComponentId,
  type GameState,
  type LineId,
  type Priority,
  type RunMode,
  type UpgradeKind,
} from '../../engine';
import { Bar, Btn, Chip, Panel, Segmented } from '../kit';
import { money, pct, qty, toneFor } from '../format';

function limitText(state: GameState, id: LineId): { text: string; tone: string } {
  const l = state.lines[id].last.limit;
  switch (l) {
    case null:
      return { text: 'not run yet', tone: 'text-ops-dim' };
    case 'idle':
      return { text: 'idle', tone: 'text-ops-dim' };
    case 'capacity':
      return { text: 'at capacity', tone: 'text-ops-green' };
    case 'crew':
      return { text: `understaffed (${pct(state.lines[id].last.staffing)})`, tone: 'text-ops-amber' };
    case 'strike':
      return { text: 'on strike', tone: 'text-ops-red' };
    default:
      return { text: `short of ${COMPONENTS[l].name.toLowerCase()}`, tone: 'text-ops-red' };
  }
}

function LineCard({ state, id, act }: { state: GameState; id: LineId; act: (a: Action) => void }) {
  const def = LINES[id];
  const line = state.lines[id];
  const limit = limitText(state, id);
  const siblings = linesAt(def.campus).filter((x) => x !== id);
  const held = line.quarantine.reduce((a, q) => a + q.qty, 0);
  const why = (a: Action) => validateAction(state, a);
  return (
    <article className="rounded border border-ops-line/70 bg-ops-panel2/40 p-3">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-sans text-[16px] font-semibold text-white">{def.name}</h3>
          <div className="text-[10px] text-ops-dim">
            {def.maker} · {def.role}
          </div>
          <div className="text-[10px] text-ops-dim" title="Public reference rate. The game runs about a fifth of it.">
            ref. {def.publicRate} · {money(def.unitCost)} a round
          </div>
        </div>
        <div className="text-right">
          <div className="font-sans text-[20px] font-semibold text-white">{qty(plannedOutput(state, id))}</div>
          <div className="text-[10px] text-ops-dim">planned this month</div>
        </div>
      </header>

      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        <div>
          <div className="label">Capacity</div>
          <div className="text-white">
            {qty(effectiveCapacity(line))} <span className="text-ops-dim">/ {qty(installedCapacity(line))}</span>
          </div>
          <div className="mt-1 flex gap-0.5" title="Each block is a bay; the fill shows ramp-up">
            {line.tranches.map((t, i) => (
              <div key={i} className="bar flex-1" style={{ flexGrow: t.capacity }}>
                <span className={t.maturity >= 1 ? 'bg-ops-green' : 'bg-ops-cyan'} style={{ width: `${t.maturity * 100}%` }} />
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="label">Wear</div>
          <div className="text-white">{Math.round(line.wear)}</div>
          <Bar ratio={line.wear / 100} tone={toneFor(1 - line.wear / 100)} className="mt-1" />
        </div>
        <div>
          <div className="label">Learning</div>
          <div className="text-white">+{Math.round((productivity(line) - 1) * 100)}%</div>
          <div className="text-[10px] text-ops-dim">{qty(line.experience)} built</div>
        </div>
        <div>
          <div className="label">Overhead</div>
          <div className="text-white">{money(lineOverhead(state, id))}/mo</div>
          <div className="text-[10px] text-ops-dim">plus wages</div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Segmented<RunMode>
          label={`${def.name} shifts`}
          value={line.run}
          onChange={(run) => act({ type: 'setRun', line: id, run })}
          options={[
            { id: 'idle', label: 'Idle' },
            { id: 'normal', label: 'Normal' },
            { id: 'surge', label: 'Surge' },
          ]}
          tones={{ surge: 'border-ops-amber bg-ops-amber/20 text-white' }}
        />
        <label className="flex items-center gap-1 text-[10px] text-ops-dim">
          Parts priority
          <select className="input py-0.5" value={line.priority} onChange={(e) => act({ type: 'setPriority', line: id, priority: e.target.value as Priority })}>
            <option value="high">high</option>
            <option value="normal">normal</option>
            <option value="low">low</option>
          </select>
        </label>
        <label className="flex items-center gap-1 text-[10px] text-ops-dim" title="Share of output fired in lot-acceptance tests and crew training. Below 3%, latent defects slip through.">
          Test share
          <select className="input py-0.5" value={line.testShare} onChange={(e) => act({ type: 'setTestShare', line: id, share: Number(e.target.value) })}>
            {[0, 0.02, 0.03, 0.05, 0.08, 0.1].map((v) => (
              <option key={v} value={v}>
                {Math.round(v * 100)}%
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1">
        <span className="label mr-1">Substitutes</span>
        {(Object.keys(def.bom) as ComponentId[]).map((c) => {
          const on = !!line.substitutes[c];
          return (
            <button
              key={c}
              type="button"
              className={`chip ${on ? 'border-ops-amber/70 text-ops-amber' : 'border-ops-line text-ops-dim'}`}
              aria-pressed={on}
              title={`${COMPONENTS[c].substitute.name}: ${COMPONENTS[c].substitute.blurb} Used only when ${COMPONENTS[c].name.toLowerCase()} run short.`}
              onClick={() => act({ type: 'setSubstitute', line: id, component: c, on: !on })}
            >
              {COMPONENTS[c].name.replace('Gallium & germanium', 'Ga/Ge')}
            </button>
          );
        })}
      </div>

      <div className="mt-3 rounded border border-ops-line/50 p-2 text-[11px]">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span>
            Last month: <span className="text-white">{qty(line.last.output)}</span> built
            {line.last.degraded > 0 && <span className="text-ops-amber"> ({qty(line.last.degraded)} degraded)</span>}
            {line.last.quarantined > 0 && <span className="text-ops-red"> · {qty(line.last.quarantined)} quarantined</span>}
          </span>
          <span className={limit.tone}>{limit.text}</span>
        </div>
        {line.last.output > 0 && (
          <div className="text-[10px] text-ops-dim">
            {qty(line.last.tested)} to test · {qty(line.last.toPartners)} to partners · {qty(line.last.toReserve)} to the reserve
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Btn why={why({ type: 'expandLine', line: id })} title="Adds +25% capacity in one more bay. Starts at about 30% and ramps up." onClick={() => act({ type: 'expandLine', line: id })}>
          Expand +25% · {money(expandCost(id))}
        </Btn>
        {(['automation', 'quality'] as UpgradeKind[]).map((k) => (
          <Btn
            key={k}
            why={why({ type: 'upgradeLine', line: id, kind: k })}
            title={`${UPGRADE[k].blurb} Installs over ${UPGRADE[k].months} months at 85% capacity.`}
            onClick={() => act({ type: 'upgradeLine', line: id, kind: k })}
          >
            {UPGRADE[k].name} {line.upgrades[k]}/{MAX_UPGRADE}
            {line.upgrades[k] < MAX_UPGRADE && ` · ${money(upgradeCost(id, k))}`}
          </Btn>
        ))}
        {held > 0 && (
          <Btn kind="warn" why={why({ type: 'reworkQuarantine', line: id })} title="Recovers 80% of quarantined rounds. Otherwise they are scrapped after 3 months." onClick={() => act({ type: 'reworkQuarantine', line: id })}>
            Rework {qty(held)} · {money(reworkCost(state, id))}
          </Btn>
        )}
        {expansions(line) > 0 &&
          siblings.map((to) => (
            <Btn
              key={to}
              why={why({ type: 'retoolBay', from: id, to })}
              title={`Moves one ${def.name} expansion bay to ${LINES[to].name}. Takes 2 months, then ramps up from 30%.`}
              onClick={() => act({ type: 'retoolBay', from: id, to })}
            >
              Retool bay → {LINES[to].name} · {money(retoolCost(to))}
            </Btn>
          ))}
      </div>
      {line.installing && (
        <div className="mt-2 text-[10px] text-ops-cyan">
          Installing {UPGRADE[line.installing.kind].name.toLowerCase()}: {line.installing.monthsLeft} month{line.installing.monthsLeft === 1 ? '' : 's'} left (line at 85%).
        </div>
      )}
    </article>
  );
}

function CampusSection({ state, campus, act }: { state: GameState; campus: CampusId; act: (a: Action) => void }) {
  const def = CAMPUSES[campus];
  const cs = state.campuses[campus];
  const used = usedBays(state, campus);
  const free = freeBays(state, campus);
  return (
    <Panel
      title={def.name}
      right={
        <>
          {used}/{cs.bays} bays · <span className={free > 0 ? 'text-ops-green' : 'text-ops-amber'}>{free} free</span> · staffing {pct(staffing(state, campus))}
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-ops-line/50 px-3 py-2 text-[11px]">
        <span className="text-ops-dim">{def.blurb}</span>
        <span className="ml-auto flex flex-wrap items-center gap-2">
          {cs.construction.map((b, i) => (
            <Chip key={i} tone="border-ops-cyan/60 text-ops-cyan">
              building +{b.bays} bays · {b.monthsLeft} mo
            </Chip>
          ))}
          {cs.retooling.map((r, i) => (
            <Chip key={i} tone="border-ops-cyan/60 text-ops-cyan">
              retooling → {LINES[r.to].name} · {r.monthsLeft} mo
            </Chip>
          ))}
          {cs.strikeMonths > 0 && <Chip tone="border-ops-red/60 text-ops-red">strike · {cs.strikeMonths} mo</Chip>}
          <Btn why={validateAction(state, { type: 'buildBays', campus })} title={`Adds ${def.buildBays} bays after construction.`} onClick={() => act({ type: 'buildBays', campus })}>
            New building +{def.buildBays} bays · {money(buildCost(campus))}
          </Btn>
        </span>
      </div>
      <div className="grid gap-3 p-3 2xl:grid-cols-2">
        {linesAt(campus).map((id) => (
          <LineCard key={id} state={state} id={id} act={act} />
        ))}
      </div>
    </Panel>
  );
}

export default function Plants({ state, act }: { state: GameState; act: (a: Action) => void }) {
  return (
    <div className="space-y-3">
      {CAMPUS_IDS.map((c) => (
        <CampusSection key={c} state={state} campus={c} act={act} />
      ))}
    </div>
  );
}
