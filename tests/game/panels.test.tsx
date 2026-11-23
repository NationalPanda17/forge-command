// Every panel and modal renders, in a busy mid-game state, without crashing and without NaN, undefined or Infinity.
import { beforeAll, describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import type { ReactElement } from 'react';
import { apply } from '../../src/sim/actions';
import { openHearing } from '../../src/sim/hearings';
import { unionClaim } from '../../src/sim/unions';
import { newSim } from '../../src/sim/setup';
import { advanceDays, feed, openCampaign } from '../../src/sim/tick';
import type { SimState } from '../../src/sim/types';
import { MATERIALS, SITES, type MaterialId } from '../../src/sim/world';
import MarketsPanel from '../../src/game/MarketsPanel';
import BuildPanel from '../../src/game/BuildPanel';
import NewsPanel from '../../src/game/NewsPanel';
import SandboxPanel from '../../src/game/SandboxPanel';
import IntelPanel from '../../src/game/IntelPanel';
import IndustryPanel from '../../src/game/IndustryPanel';
import TestingPanel from '../../src/game/TestingPanel';
import TownsPanel from '../../src/game/TownsPanel';
import AlliesPanel from '../../src/game/AlliesPanel';
import PowerPanel from '../../src/game/PowerPanel';
import StatsPanel from '../../src/game/StatsPanel';
import { Hearing } from '../../src/game/Hearing';
import { Handover, HotseatChip } from '../../src/game/Hotseat';
import StoryPanel, { Briefing } from '../../src/game/StoryPanel';
import { KeyboardHelp } from '../../src/game/Options';
import PolicyPanel from '../../src/game/PolicyPanel';
import AdvisorCard from '../../src/game/AdvisorCard';
import PlanPanel from '../../src/game/PlanPanel';
import TermReport from '../../src/game/TermReport';
import { TutorialCard } from '../../src/game/Tutorial';
import MaterialPanel from '../../src/game/MaterialPanel';
import { Feed, FightPanel, LogisticsPanel, MoneyPanel, StockpilePanel } from '../../src/game/OpsPanels';
import SitePanel from '../../src/game/SitePanel';
import StrategyPanel from '../../src/game/StrategyPanel';
import { GuidePanel, WatchPanel } from '../../src/game/WatchGuide';

// A browser-like localStorage for the panels that remember things.
beforeAll(() => {
  const store = new Map<string, string>();
  (globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
});

const noop = () => {};
const BAD = /\bNaN\b|\bundefined\b|\bInfinity\b|\[object Object\]/;

function check(name: string, el: ReactElement) {
  let html = '';
  expect(() => (html = renderToString(el)), name).not.toThrow();
  const text = html.replace(/<[^>]+>/g, ' ');
  const m = text.match(BAD);
  expect(m ? `${name}: …${text.slice(Math.max(0, m.index! - 60), m.index! + 20)}…` : null).toBeNull();
}

/** A busy campaign on a generated world: deals, a hearing, a union claim, a blackout, an audit, promises. */
function busy(): SimState {
  let s = { ...openCampaign(newSim({ seed: 11, world: 4242 })), treasury: 5000 };
  s = advanceDays(s, 400);
  s.allies.merrow = 80;
  s = apply(s, { type: 'coproduce', ally: 'merrow', line: 'pac3' });
  s = apply(s, { type: 'seekExport', line: 'stinger' });
  s = apply(s, { type: 'housing', town: 0 });
  s = apply(s, { type: 'generator', site: 'corranWorks' });
  s = apply(s, { type: 'auditTeam' });
  s = apply(s, { type: 'cyberDefence', area: 'plants' });
  s.energy.grids.east.outage = 2;
  s.energy.shock = { size: 0.4, days: 90 };
  s.cyber.railDays = 5;
  s.oversight.findings.push({ month: 10, waste: 40, spend: 900, verdict: 'concerns', worst: 'spot' });
  s.promises.push({ id: 999, kind: 'readiness', text: 'Average readiness of 80% or better over the next year.', faction: 'hawks', made: s.day, due: s.day + 360 });
  unionClaim(s, feed);
  openHearing(s, s.appropriation, feed);
  return s;
}

describe('every panel renders cleanly', () => {
  const s = busy();
  const act = noop;
  it('the side panels', () => {
    check('plan', <PlanPanel state={s} onMaterial={noop} onSite={noop} />);
    check('markets', <MarketsPanel state={s} act={act} onSite={noop} />);
    check('build', <BuildPanel state={s} act={act} onHighlight={noop} onSite={noop} />);
    check('news', <NewsPanel state={s} />);
    check('industry', <IndustryPanel state={s} act={act} onSite={noop} onHighlight={noop} />);
    check('testing', <TestingPanel state={s} act={act} onSite={noop} />);
    check('towns', <TownsPanel state={s} act={act} onSite={noop} />);
    check('allies', <AlliesPanel state={s} act={act} />);
    check('power', <PowerPanel state={s} act={act} onSite={noop} />);
    check('stats', <StatsPanel state={s} onSite={noop} />);
    check('intel', <IntelPanel state={s} act={act} />);
    check('policy', <PolicyPanel state={s} act={act} />);
    check('stockpile', <StockpilePanel state={s} act={act} onMaterial={noop} />);
    check('logistics', <LogisticsPanel state={s} act={act} onSite={noop} />);
    check('fight', <FightPanel state={s} act={act} />);
    check('board', <StrategyPanel state={s} act={act} />);
    check('money', <MoneyPanel state={s} act={act} />);
    check('feed', <Feed state={s} onSite={noop} />);
    check('advisor', <AdvisorCard state={s} act={act} onPanel={noop} onSite={noop} onMaterial={noop} />);
    check('watch', <WatchPanel state={s} onSite={noop} onMaterial={noop} onPanel={noop} />);
    check('guide', <GuidePanel />);
  });

  it('the site panel for every site', () => {
    for (const d of SITES) check(`site ${d.id}`, <SitePanel state={s} siteId={d.id} act={act} onMaterial={noop} />);
  });

  it('the material panel for every material', () => {
    for (const m of Object.keys(MATERIALS) as MaterialId[]) check(`material ${m}`, <MaterialPanel state={s} material={m} onMaterial={noop} onSite={noop} />);
  });

  it('the modals: hearing, keyboard help, term report with a career', () => {
    check('hearing', <Hearing state={s} act={act} />);
    check('keys', <KeyboardHelp onClose={noop} />);
    let c = openCampaign(newSim({ seed: 8, months: 12 }));
    c = advanceDays(c, 12 * 30 + 1);
    c = apply(c, { type: 'secondTerm' });
    c = advanceDays(c, 48 * 30 + 1);
    check('term report', <TermReport state={c} onClose={noop} onMenu={noop} onSecondTerm={noop} />);
  });

  it('the sandbox, story, tutorial and two-player screens', () => {
    const sb = advanceDays(openCampaign(newSim({ seed: 5, mode: 'sandbox' })), 60);
    check('sandbox', <SandboxPanel state={sb} act={act} selected="corranWorks" />);
    const st = openCampaign(newSim({ seed: 5, story: true }));
    check('briefing', <Briefing state={st} act={act} />);
    check('story', <StoryPanel state={advanceDays({ ...st, story: { ...st.story!, briefing: null } }, 90)} />);
    const tu = openCampaign(newSim({ seed: 5, scenario: 'tutorial' }));
    check('tutorial', <TutorialCard state={tu} onStep={noop} />);
    const hs = openCampaign(newSim({ seed: 5, hotseat: ['Ana', 'Ben'] }));
    check('handover', <Handover state={hs} act={act} />);
    check('chip', <HotseatChip state={hs} />);
    const hsDone = advanceDays({ ...hs, hotseat: { ...hs.hotseat!, handover: false } }, 24 * 30);
    check('two-player report', <TermReport state={{ ...hsDone, over: true, outcome: 'complete' }} onClose={noop} onMenu={noop} />);
  });
});
