// Planning tools: forecasts of each round's stock, and the weakest links in the supply chain.
import { CRISES } from './fight';
import { DAYS_PER_MONTH, inputRates, isLine, lotQty, nationalDailyDraw, nationalStock, processRate, reserveTarget } from './selectors';
import { recipeInputs, recipeScrap } from './strategy';
import type { SimState } from './types';
import { FINISHED, MATERIALS, RECIPES, SITES, SITE_BY_ID, type LineId, type MaterialId } from './world';

export interface ForecastPoint {
  month: number;
  stock: number;
  target: number;
  made: number;
  used: number;
  retired: number;
}

/** Daily output of a line from your arsenals, as planned today. */
export function lineOutput(s: SimState, line: LineId): number {
  let n = 0;
  for (const def of SITES) {
    if (def.owner !== 'state') continue;
    const site = s.sites[def.id];
    for (const p of site.processes) if (RECIPES[p.recipe].output === line) n += processRate(s, site, p);
  }
  // What the arsenals actually managed last month, if it was less (inputs ran short).
  const last = s.history.at(-1)?.made[line];
  return last !== undefined ? Math.min(n, Math.max(last / DAYS_PER_MONTH, n * 0.5)) : n;
}

/** Extra draw expected from a crisis, by month from now. */
function crisisFactor(s: SimState, line: LineId, monthAhead: number): number {
  const c = s.crisis;
  if (!c) return 1;
  const start = c.phase === 'warning' ? c.days : 0;
  const end = c.phase === 'warning' ? c.days + 210 : c.days;
  const mid = monthAhead * DAYS_PER_MONTH + 15;
  if (mid < start || mid > end) return 1;
  const def = CRISES.find((x) => x.id === c.id);
  const land = ['gmlrs', 'shell155', 'javelin'].includes(line);
  if ((c.family === 'land') !== land) return 1.1;
  const mix = Math.max(1, ...Object.values(def?.mix ?? { x: 1.5 }));
  return 1 + (mix - 1) * c.intensity * 0.6;
}

/** Month-by-month projection of national stock for a line. */
export function forecast(s: SimState, line: LineId, months = 12): ForecastPoint[] {
  const out: ForecastPoint[] = [];
  let stock = nationalStock(s, line);
  const made = lineOutput(s, line) * DAYS_PER_MONTH;
  const draw = nationalDailyDraw(s, line) * DAYS_PER_MONTH;
  const exportsPerMonth = s.exports.filter((x) => x.line === line).reduce((a, x) => a + ((x.qty - x.delivered) / Math.max(1, x.endDay - s.day)) * DAYS_PER_MONTH, 0);
  // Lots reaching the end of their life; surveillance will save about half of those still eligible.
  const lots = Object.values(s.sites).flatMap((site) => site.lots[line] ?? []);
  const target = reserveTarget(s, line);
  out.push({ month: 0, stock, target, made: 0, used: 0, retired: 0 });
  for (let m = 1; m <= months; m++) {
    const a = s.day + (m - 1) * DAYS_PER_MONTH;
    const b = a + DAYS_PER_MONTH;
    const retiring = lots.filter((l) => l.until > a && l.until <= b).reduce((x, l) => x + l.qty * (s.policy.surveillance && (l.ext ?? 0) < 2 ? 0.5 : 1), 0);
    const used = draw * crisisFactor(s, line, m - 1) + (m * DAYS_PER_MONTH <= Math.max(0, ...s.exports.filter((x) => x.line === line).map((x) => x.endDay - s.day)) ? exportsPerMonth : 0);
    stock = Math.max(0, stock + made - used - retiring);
    out.push({ month: m, stock, target, made, used, retired: retiring });
  }
  return out;
}

/** Months until a line's stock falls below a fraction of target, or null if it never does within the horizon. */
export function monthsTo(s: SimState, line: LineId, frac = 0.5, months = 12): number | null {
  const f = forecast(s, line, months);
  const hit = f.find((p) => p.month > 0 && p.stock < p.target * frac);
  return hit ? hit.month : null;
}

// ---------- Supply and demand across the chain ----------

export interface Balance {
  material: MaterialId;
  /** Units a day the country can make or import. */
  supply: number;
  /** Units a day the plan needs. */
  demand: number;
  ratio: number;
  /** The biggest source today. */
  top: string | null;
}

/** National supply against demand for every material in the chain. */
export function balances(s: SimState): Record<MaterialId, Balance> {
  const supply: Partial<Record<MaterialId, number>> = {};
  const top: Partial<Record<MaterialId, { id: string; v: number }>> = {};
  const demand: Partial<Record<MaterialId, number>> = {};
  for (const def of SITES) {
    const site = s.sites[def.id];
    if (site.status === 'closed') continue;
    if (def.owner === 'foreign' && site.embargoDays > 0) continue;
    for (const p of site.processes) {
      const rec = RECIPES[p.recipe];
      const rate = processRate(s, site, p) * (def.owner === 'foreign' ? 1 : 1);
      const add = (m: MaterialId, v: number) => {
        supply[m] = (supply[m] ?? 0) + v;
        if (!top[m] || top[m]!.v < v) top[m] = { id: def.id, v };
      };
      add(rec.output, rate);
      for (const [m, q] of Object.entries(rec.extra ?? {}) as [MaterialId, number][]) add(m, (rate / (1 - recipeScrap(s, p.recipe, def.owner))) * q);
    }
    for (const [m, v] of Object.entries(inputRates(s, site)) as [MaterialId, number][]) demand[m] = (demand[m] ?? 0) + v;
  }
  for (const l of FINISHED as LineId[]) if (s.lines[l].unlocked) demand[l] = (demand[l] ?? 0) + nationalDailyDraw(s, l);
  const out = {} as Record<MaterialId, Balance>;
  for (const m of Object.keys(MATERIALS) as MaterialId[]) {
    const sp = supply[m] ?? 0;
    const dm = demand[m] ?? 0;
    out[m] = { material: m, supply: sp, demand: dm, ratio: dm > 0 ? sp / dm : Infinity, top: top[m]?.id ?? null };
  }
  return out;
}

export interface TraceStep extends Balance {
  depth: number;
  /** Why this link was followed. */
  reason: string;
}

/** Follows a round's bill of materials down to the tightest link at each level. */
export function trace(s: SimState, line: LineId, bal = balances(s)): TraceStep[] {
  const steps: TraceStep[] = [];
  const seen = new Set<MaterialId>();
  let m: MaterialId | null = line;
  let depth = 0;
  while (m && !seen.has(m) && depth < 10) {
    seen.add(m);
    const b = bal[m];
    steps.push({ ...b, depth, reason: depth === 0 ? 'output against expected use' : 'tightest input one level down' });
    const recipe = Object.keys(RECIPES).find((k) => RECIPES[k].output === m);
    if (!recipe) break;
    const inputs = Object.keys(recipeInputs(s, recipe)) as MaterialId[];
    if (!inputs.length) break;
    m = inputs.sort((a, c) => bal[a].ratio - bal[c].ratio)[0];
    depth++;
  }
  return steps;
}

/** The single worst link under a line: the step with the lowest supply ratio. */
export function bottleneck(s: SimState, line: LineId, bal = balances(s)): TraceStep | null {
  const t = trace(s, line, bal).filter((x) => x.depth > 0 || isLine(x.material));
  return t.length ? t.reduce((a, b) => (b.ratio < a.ratio ? b : a)) : null;
}

/** Materials the country cannot make enough of, worst first. */
export function weakLinks(s: SimState, bal = balances(s)): Balance[] {
  return Object.values(bal)
    .filter((b) => b.demand > 1e-6 && b.ratio < 1.05 && !isLine(b.material))
    .sort((a, b) => a.ratio - b.ratio);
}

/** Stock of a material held across all sites (finished rounds count their lots). */
export const stockAcross = (s: SimState, m: MaterialId) => Object.values(s.sites).reduce((a, site) => a + (isLine(m) ? lotQty(site.lots[m]) : site.stock[m] ?? 0), 0);

export const siteName = (id: string | null) => (id ? SITE_BY_ID[id]?.name ?? id : '—');

// ---------- End of term ----------

export interface TermReport {
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  score: number;
  avgReadiness: number;
  minReadiness: number;
  finalConfidence: number;
  stopped: number;
  leaked: number;
  spend: number;
  income: number;
  made: number;
  exported: number;
  research: number;
  objectives: number;
  lines: { line: LineId; stock: number; target: number }[];
}

export function termReport(s: SimState): TermReport {
  const h = s.history.slice(s.termMonth ?? 0);
  const avg = h.length ? h.reduce((a, x) => a + x.readiness, 0) / h.length : 0;
  const min = h.length ? Math.min(...h.map((x) => x.readiness)) : 0;
  const sum = (f: (x: (typeof h)[number]) => number) => h.reduce((a, x) => a + f(x), 0);
  const stopped = sum((x) => Object.values(x.stopped).reduce((a, b) => a + b, 0));
  const leaked = sum((x) => Object.values(x.leaked).reduce((a, b) => a + b, 0));
  const spend = sum((x) => Object.values(x.spend).reduce((a, b) => a + b, 0));
  const income = sum((x) => x.income.appropriation + x.income.sales);
  const made = sum((x) => (FINISHED as LineId[]).reduce((a, l) => a + (x.made[l] ?? 0), 0));
  const objectives = s.strategy.objectives.filter((o) => o.status === 'done').length;
  const score = Math.round(avg * 50 + (s.confidence / 100) * 25 + (stopped / Math.max(1, stopped + leaked)) * 15 + objectives * 2 + (s.outcome === 'dismissed' ? -30 : 0));
  const grade = score >= 80 ? 'A' : score >= 68 ? 'B' : score >= 55 ? 'C' : score >= 42 ? 'D' : 'F';
  return {
    grade,
    score,
    avgReadiness: avg,
    minReadiness: min,
    finalConfidence: s.confidence,
    stopped,
    leaked,
    spend,
    income,
    made,
    exported: sum((x) => x.exported ?? 0),
    research: s.strategy.research.done.length,
    objectives,
    lines: (FINISHED as LineId[]).filter((l) => s.lines[l].unlocked).map((l) => ({ line: l, stock: nationalStock(s, l), target: reserveTarget(s, l) })),
  };
}
