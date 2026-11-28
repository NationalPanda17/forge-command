// Which icon goes with a piece of advice or a moment of the term (19.3.3). Icons are drawn as well as named, so a list
// can be scanned by kind before it is read; the text always says the same thing, so nothing depends on the icon alone.
import type { IconName } from './icons';

const ADVICE: [RegExp, IconName][] = [
  [/^(fund|tender|award|pay|deficit)/, 'coin'],
  [/^(gen|pc)-/, 'bolt'],
  [/^housing/, 'house'],
  [/^(hire|engineers|academy|keep)/, 'people'],
  [/^counter/, 'crosshair'],
  [/^(research|doctrine)/, 'flask'],
  [/^depot/, 'truck'],
  [/^(cyber|vet|intel|safety)/, 'shield'],
  [/^(line|over|upgrade|rest)/, 'factory'],
];

/** The icon for an advisor item, from its id. */
export function adviceIcon(id: string): IconName {
  return ADVICE.find(([re]) => re.test(id))?.[1] ?? 'report';
}

const MOMENT: [RegExp, IconName][] = [
  [/^Crisis|has begun/, 'alert'],
  [/^Doctrine adopted/, 'star'],
  [/ fields |^Intel:/, 'crosshair'],
  [/^Objective complete|The Committee (grants|votes)/, 'trophy'],
  [/^Research complete/, 'flask'],
  [/opens to traffic/, 'truck'],
  [/^Accepted:|opens and starts|has closed/, 'factory'],
  [/^Strike at|spreads/, 'people'],
  [/black out|^A blackout/, 'bolt'],
  [/^Operation succeeds|operation is exposed|Ransomware|^Hackers|^Sabotage|stolen/, 'shield'],
  [/^Promise (kept|broken)|programme (ends|is cancelled)|Auditor-General/, 'report'],
];

/** The icon for a moment of the term, from its text and tone. */
export function momentIcon(text: string, tone: string): IconName {
  return MOMENT.find(([re]) => re.test(text))?.[1] ?? (tone === 'good' ? 'check' : tone === 'bad' ? 'alert' : 'report');
}

const DECISION: Record<string, IconName> = {
  bailout: 'coin',
  budget: 'coin',
  reprice: 'coin',
  supplement: 'coin',
  budgetRound: 'coin',
  broker: 'coin',
  allyRequest: 'people',
  allyOffer: 'people',
  export: 'truck',
  labour: 'people',
  poach: 'people',
  recall: 'factory',
  inspection: 'factory',
  testFailure: 'flask',
  permit: 'report',
  audit: 'report',
  fraud: 'report',
  spyRing: 'shield',
  ransom: 'shield',
};

/** The icon for a decision on the Board, from its kind. */
export function decisionIcon(kind: string): IconName {
  return DECISION[kind] ?? 'report';
}
