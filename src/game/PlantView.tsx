// A live schematic of one of your plants: each line's inputs, its bay and its output, with the crew below.
import { automateCost } from '../sim/build';
import { validate, type SimAction } from '../sim/actions';
import { APPRENTICE_COST, MAX_SAFETY, moraleTarget, safetyCost } from '../sim/people';
import { crewNeed, processRate } from '../sim/selectors';
import type { SimState } from '../sim/types';
import { MATERIALS, RECIPES, type MaterialId } from '../sim/world';
import { Bar, Btn, Segmented } from '../ui/kit';
import { money, qty } from '../ui/format';

const RUN_LABEL = { idle: 'idle', single: 'one shift', normal: 'two shifts', surge: 'round the clock' } as const;

function Conveyor({ load, running, automated }: { load: number; running: boolean; automated: boolean }) {
  // Belt speed follows how hard the line is working.
  const dur = running ? Math.max(0.6, 3 - 2.4 * Math.min(1, load)) : 0;
  return (
    <div className="relative h-3 overflow-hidden rounded-sm border border-ops-line bg-ops-bg" aria-hidden="true">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'repeating-linear-gradient(90deg, rgb(var(--ops-cyan) / 0.35) 0 6px, transparent 6px 12px)',
          animation: running ? `fc-belt ${dur}s linear infinite` : undefined,
          opacity: running ? 1 : 0.3,
        }}
      />
      {automated && <div className="absolute inset-y-0 right-0 w-1 bg-ops-violet" />}
    </div>
  );
}

function Gauge({ label, value, tone, hint }: { label: string; value: number; tone: string; hint: string }) {
  return (
    <div className="min-w-0" title={hint}>
      <div className="flex justify-between gap-2">
        <span className="label truncate">{label}</span>
        <span className="text-white">{Math.round(value)}</span>
      </div>
      <Bar ratio={value / 100} tone={tone} />
    </div>
  );
}

export default function PlantView({ state, siteId, act }: { state: SimState; siteId: string; act: (a: SimAction) => void }) {
  const site = state.sites[siteId];
  const why = (a: SimAction) => validate(state, a);
  const need = crewNeed(site);
  const building = state.network.projects.filter((p) => p.kind === 'automate' && p.target === siteId);
  return (
    <section aria-label="Plant view">
      <style>{'@keyframes fc-belt{from{background-position:0 0}to{background-position:24px 0}}@media (prefers-reduced-motion:reduce){[style*="fc-belt"]{animation:none!important}}'}</style>
      <div className="label mb-1">Plant floor</div>
      <ol className="space-y-2">
        {site.processes.map((p, i) => {
          const rec = RECIPES[p.recipe];
          const rate = processRate(state, site, p);
          const cap = p.capacity + (p.ramp ?? []).reduce((a, r) => a + r.cap * r.maturity, 0);
          const load = cap > 0 ? p.lastOutput / cap : 0;
          const inputs = (Object.keys(rec.inputs) as MaterialId[]).slice(0, 4);
          const short = typeof p.lastLimit === 'string' && p.lastLimit in MATERIALS;
          const job = building.find((b) => b.process === i);
          return (
            <li key={p.recipe} className="rounded border border-ops-line/60 p-2">
              <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,0.9fr)]">
                <ul className="min-w-0 space-y-0.5 text-[10px]">
                  {inputs.map((m) => {
                    const days = (site.stock[m] ?? 0) / Math.max(1e-9, (rate / (1 - rec.scrap)) * (rec.inputs[m] ?? 0));
                    return (
                      <li key={m} className={`truncate ${p.lastLimit === m ? 'text-ops-red' : days < 5 ? 'text-ops-amber' : 'text-ops-dim'}`}>
                        {MATERIALS[m].name} · {Number.isFinite(days) ? `${Math.round(days)}d` : '—'}
                      </li>
                    );
                  })}
                </ul>
                <div className="min-w-0">
                  <div className="mb-0.5 flex items-center justify-between gap-1 text-[10px]">
                    <span className="min-w-0 truncate text-white">{rec.name}</span>
                    <span className={`shrink-0 ${p.run === 'idle' ? 'text-ops-dim' : short ? 'text-ops-red' : 'text-ops-green'}`} aria-label={short ? 'held up' : p.run === 'idle' ? 'idle' : 'running'}>
                      ●
                    </span>
                  </div>
                  <Conveyor load={load} running={p.run !== 'idle' && p.lastOutput > 0} automated={!!p.automated} />
                  <div className="mt-0.5 truncate text-[10px] text-ops-dim">
                    {RUN_LABEL[p.run]}
                    {p.automated ? ' · automated' : ''}
                  </div>
                </div>
                <div className="min-w-0 text-[10px] sm:text-right">
                  <div className="truncate text-white">{MATERIALS[rec.output].name}</div>
                  <div className="truncate text-ops-dim">
                    {qty(p.lastOutput)} of {qty(cap)} a day
                  </div>
                </div>
              </div>
              {!p.automated && (
                <div className="mt-1 flex flex-wrap items-center justify-end gap-2 text-[10px]">
                  {job ? (
                    <span className="text-ops-amber">Automating: {job.days} days left</span>
                  ) : (
                    <Btn why={why({ type: 'build', kind: 'automate', target: siteId, process: i })} onClick={() => act({ type: 'build', kind: 'automate', target: siteId, process: i })} title="Robots and automatic inspection: 30% less crew, 20% less scrap. About six months.">
                      Automate · {money(automateCost(state, siteId, i))}
                    </Btn>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <div className="label mb-1 mt-3">Crew</div>
      <p className="mb-2 text-ops-dim">
        {Math.round(site.workers)} on the books for {Math.round(need)} posts
        {site.trainees.length > 0 && `, ${site.trainees.reduce((a, t) => a + t.count, 0)} in training`}.
      </p>
      <div className="grid grid-cols-3 gap-3">
        <Gauge label="Skill" value={site.skill} tone="bg-ops-cyan" hint="Experience: more output and less scrap. New hires bring it down for a while." />
        <Gauge label="Morale" value={site.morale} tone={site.morale >= 55 ? 'bg-ops-green' : site.morale >= 40 ? 'bg-ops-amber' : 'bg-ops-red'} hint={`Heading for ${Math.round(moraleTarget(state, site))}. Low morale slows work and invites disputes.`} />
        <Gauge label="Fatigue" value={site.fatigue} tone={site.fatigue < 30 ? 'bg-ops-green' : site.fatigue < 60 ? 'bg-ops-amber' : 'bg-ops-red'} hint="Builds up on round-the-clock shifts. Tired crews have accidents." />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-ops-text">
          Safety programme{' '}
          <span className="text-white" aria-label={`stage ${site.safety} of ${MAX_SAFETY}`}>
            {'■'.repeat(site.safety)}
            <span className="text-ops-line">{'■'.repeat(MAX_SAFETY - site.safety)}</span>
          </span>
        </span>
        {site.safety < MAX_SAFETY && (
          <Btn why={why({ type: 'safety', site: siteId })} onClick={() => act({ type: 'safety', site: siteId })} title="Fewer accidents and better morale">
            Next stage · {money(safetyCost(state, siteId))}
          </Btn>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-ops-text">Apprentices a month</span>
        <Segmented<string>
          label="Apprentices a month"
          value={String(site.apprentices)}
          onChange={(v) => act({ type: 'apprentices', site: siteId, perMonth: Number(v) })}
          options={['0', '10', '20', '40'].map((v) => ({ id: v, label: v }))}
        />
      </div>
      <p className="mt-1 text-[10px] text-ops-dim">
        Apprentices train for four and a half months, join more skilled than ordinary hires, and raise the plant's ceiling. Each costs {money(APPRENTICE_COST * state.priceIndex)}.
      </p>
    </section>
  );
}
