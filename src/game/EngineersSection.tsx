// Your engineers: how many the work needs, how many you have, the national market, academies and pay.
import { validate, type SimAction } from '../sim/actions';
import { ACADEMY_DAYS, academyCost, academyTowns, coverage, engineerNeed, engineerPay, signCost, type PayLevel } from '../sim/engineers';
import type { SimState } from '../sim/types';
import { CITIES } from '../sim/world';
import { Btn, Segmented } from '../ui/kit';
import { money, pct } from '../ui/format';

export default function EngineersSection({ state, act }: { state: SimState; act: (a: SimAction) => void }) {
  const e = state.engineers;
  const need = engineerNeed(state);
  const cov = coverage(state);
  const gap = Math.max(0, need.total - e.staff);
  const hireN = Math.max(1, Math.min(Math.floor(e.market), gap || 10));
  const hire: SimAction = { type: 'hireEngineers', count: hireN };
  const towns = academyTowns(state).filter((t) => !e.academies.some((a) => a.town === t));
  const parts: [string, number][] = [
    ['Plant lines', need.plants],
    ['Building and fitting out', need.building],
    ['Research', need.research],
    ['Design', need.design],
  ];
  return (
    <section>
      <h3 className="label mb-1">Engineers</h3>
      <p className="mb-2 text-ops-dim">
        Plant lines, automation, research, design and new plants all need engineers. Too few and plants lose up to 15% of their output, while research and design slow down. Private firms hire from the same market, and overworked or underpaid engineers leave.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="min-w-0 rounded border border-ops-line/60 p-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-white">
              {e.staff} on staff · {need.total} needed
            </span>
            <span className={cov >= 1 ? 'text-ops-green' : cov >= 0.9 ? 'text-ops-amber' : 'text-ops-red'}>{pct(cov)} covered</span>
          </div>
          <ul className="mt-1 space-y-0.5">
            {parts.map(([label, n]) => (
              <li key={label} className="flex justify-between gap-2">
                <span className="text-ops-dim">{label}</span>
                <span className="text-ops-text">{n}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[10px] text-ops-dim">
            The Board's budget pays for {e.funded} engineers. Beyond them{e.pay === 'premium' ? ', and for the premium,' : ''} you pay {money(engineerPay(state))} a month.
          </p>
        </div>
        <div className="min-w-0 space-y-2 rounded border border-ops-line/60 p-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-ops-text">{Math.floor(e.market)} looking for work</span>
            <Btn kind={gap > 0 ? 'primary' : undefined} why={validate(state, hire)} onClick={() => act(hire)}>
              Hire {hireN} · {money(hireN * signCost(state))}
            </Btn>
          </div>
          <div>
            <div className="label mb-1">Pay</div>
            <Segmented<PayLevel>
              label="Engineer pay"
              value={e.pay}
              onChange={(v) => act({ type: 'engineerPay', level: v })}
              options={[
                { id: 'standard', label: 'Standard' },
                { id: 'premium', label: 'Premium +30%' },
              ]}
            />
            <p className="mt-1 text-[10px] text-ops-dim">A premium keeps more of them from leaving for private firms, at 30% more on every salary.</p>
          </div>
        </div>
      </div>
      <div className="mt-2">
        <div className="label mb-1">Academies</div>
        {e.academies.length > 0 && (
          <ul className="mb-1 space-y-0.5">
            {e.academies.map((a) => (
              <li key={a.town} className="flex flex-wrap justify-between gap-2">
                <span className="text-ops-text">{CITIES[a.town].name}</span>
                <span className={a.days === 0 ? 'text-ops-green' : 'text-ops-amber'}>{a.days === 0 ? 'open: 4 graduates a month' : `opens in ${Math.ceil(a.days / 30)} months`}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mb-1 text-[10px] text-ops-dim">
          An academy takes about {Math.round(ACADEMY_DAYS / 30)} months to open, then adds graduates to the market every month. The town is grateful.
        </p>
        <div className="flex flex-wrap gap-1">
          {towns.map((t) => {
            const a: SimAction = { type: 'academy', town: t };
            return (
              <Btn key={t} why={validate(state, a)} onClick={() => act(a)}>
                Academy in {CITIES[t].name} · {money(academyCost(state))}
              </Btn>
            );
          })}
          {towns.length === 0 && <span className="text-ops-dim">Every plant town has an academy.</span>}
        </div>
      </div>
    </section>
  );
}
