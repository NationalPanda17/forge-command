import type { ReactNode } from 'react';
import { debrief, type GameState, type YearReview } from '../engine';
import { Btn } from './kit';
import { money } from './format';
import type { Prefs } from './saves';
import { version } from '../../package.json';

function Modal({ title, children, onClose, wide }: { title: string; children: ReactNode; onClose?: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ops-bg/85 p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className={`panel max-h-[90vh] w-full overflow-y-auto ${wide ? 'max-w-2xl' : 'max-w-md'}`}>
        <div className="panel-title">
          <span>{title}</span>
          {onClose && (
            <button type="button" className="text-ops-dim hover:text-white" onClick={onClose} aria-label="Close">
              ✕
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

export function ReviewModal({ review, onClose }: { review: YearReview; onClose: () => void }) {
  const up = review.newAppropriation >= review.oldAppropriation;
  return (
    <Modal title={`Fiscal year ${review.year} review`} onClose={onClose}>
      <div className="space-y-3 p-4">
        <p className="text-[12px] text-ops-text">The Defence Committee has reviewed the Board's year.</p>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded border border-ops-line/60 p-2">
            <div className="label">Readiness</div>
            <div className="font-sans text-xl font-semibold text-white">{Math.round(review.readiness * 100)}%</div>
          </div>
          <div className="rounded border border-ops-line/60 p-2">
            <div className="label">Got through</div>
            <div className="font-sans text-xl font-semibold text-white">{Math.round(review.leakers)}</div>
          </div>
          <div className="rounded border border-ops-line/60 p-2">
            <div className="label">Confidence</div>
            <div className="font-sans text-xl font-semibold text-white">{Math.round(review.confidence)}</div>
          </div>
        </div>
        <ul className="list-disc space-y-1 pl-5 text-[12px]">
          {review.notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
        <p className="text-[13px]">
          Appropriation: {money(review.oldAppropriation)} → <span className={up ? 'text-ops-green' : 'text-ops-red'}>{money(review.newAppropriation)}</span> a month.
        </p>
        <div className="flex justify-end">
          <Btn kind="primary" onClick={onClose}>
            Back to work
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

export function DebriefModal({ state, onNew, onClose }: { state: GameState; onNew: () => void; onClose: () => void }) {
  const d = debrief(state);
  const tone = { A: 'text-ops-green', B: 'text-ops-green', C: 'text-ops-amber', D: 'text-ops-red', F: 'text-ops-red' } as const;
  return (
    <Modal title={state.outcome === 'dismissed' ? 'Dismissed' : 'Campaign complete'} onClose={onClose} wide>
      <div className="space-y-4 p-4">
        <p className="text-[12px] text-ops-text">
          {state.outcome === 'dismissed'
            ? 'The Defence Committee has lost confidence in the Board. Your deputy takes over in the morning.'
            : `After ${state.months / 12} years, your term as Director ends.`}
        </p>
        <div className="text-center">
          <div className="label">Score</div>
          <div className="font-sans text-5xl font-bold text-ops-amber">{d.score}</div>
          <div className="text-[10px] text-ops-dim">out of 1000</div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {d.grades.map((g) => (
            <div key={g.label} className="flex items-center gap-3 rounded border border-ops-line/60 p-2">
              <span className={`font-sans text-3xl font-bold ${tone[g.grade]}`}>{g.grade}</span>
              <div className="min-w-0">
                <div className="text-[12px] text-white">
                  {g.label}: {g.value}
                </div>
                <div className="text-[10px] text-ops-dim">{g.note}</div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-ops-dim">
          {Math.round(d.totals.arrived).toLocaleString('en-US')} threats arrived over the campaign. {Math.round(d.totals.stopped).toLocaleString('en-US')} were stopped. You
          fired {money(d.totals.spend)} of interceptors to stop {money(d.totals.stopped$)} of threats.
        </p>
        <div className="flex justify-end gap-2">
          <Btn onClick={onClose}>Look around</Btn>
          <Btn kind="primary" onClick={onNew}>
            New campaign
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

export const SHORTCUTS: [string, string][] = [
  ['E', 'End the month'],
  ['1 to 9, 0', 'Switch tabs'],
  ['?', 'Settings and shortcuts'],
  ['Esc', 'Close this window'],
];

export function SettingsModal({ prefs, setPrefs, onClose, onReset }: { prefs: Prefs; setPrefs: (p: Prefs) => void; onClose: () => void; onReset: () => void }) {
  const row = 'flex items-center justify-between gap-3 py-1.5';
  return (
    <Modal title="Settings" onClose={onClose}>
      <div className="space-y-3 p-4 text-[12px]">
        <label className={row}>
          <span>Sound effects</span>
          <input type="checkbox" checked={prefs.sound} onChange={(e) => setPrefs({ ...prefs, sound: e.target.checked })} />
        </label>
        <label className={row}>
          <span>High-contrast colours</span>
          <input type="checkbox" checked={prefs.highContrast} onChange={(e) => setPrefs({ ...prefs, highContrast: e.target.checked })} />
        </label>
        <label className={row}>
          <span>Reduce motion</span>
          <input type="checkbox" checked={prefs.reduceMotion} onChange={(e) => setPrefs({ ...prefs, reduceMotion: e.target.checked })} />
        </label>
        <div className={row}>
          <span>Text size</span>
          <span className="flex gap-1">
            {(['small', 'normal', 'large'] as const).map((s) => (
              <Btn key={s} pressed={prefs.textSize === s} onClick={() => setPrefs({ ...prefs, textSize: s })}>
                {s}
              </Btn>
            ))}
          </span>
        </div>
        <div>
          <div className="label mb-1">Keyboard shortcuts</div>
          <ul className="space-y-0.5 text-[11px]">
            {SHORTCUTS.map(([k, v]) => (
              <li key={k} className="flex justify-between">
                <kbd className="rounded border border-ops-line px-1.5 text-ops-text">{k}</kbd>
                <span className="text-ops-dim">{v}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex justify-between gap-2 border-t border-ops-line/50 pt-3">
          <Btn kind="danger" onClick={onReset} title="Removes the autosave, save slots, achievements and settings from this browser.">
            Erase all local data
          </Btn>
          <Btn kind="primary" onClick={onClose}>
            Done
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

export function AboutModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="About Forge Command" onClose={onClose} wide>
      <div className="space-y-3 p-4 text-[12px] leading-relaxed">
        <p className="text-ops-text">
          Forge Command is a strategy game about the factories, supply chains and hard choices behind national defense. It is a game, not a model of any real
          country's industry.
        </p>
        <p className="text-ops-text">
          <b>About the data.</b> Weapon designations and manufacturers are real. Production rates are scaled from public statements by companies and governments, or
          are best guesses where none exist. Threat costs are rough public estimates. Nothing uses classified or leaked information.
        </p>
        <p className="text-ops-text">
          <b>The world is fictional.</b> Aldmere, its campuses and suppliers, partner nations, the rival power, crises, people and events are all made up.
        </p>
        <p className="text-ops-text">
          <b>Privacy.</b> No accounts, no tracking, no analytics. Your saves, achievements and settings stay in this browser.
        </p>
        <p className="text-[11px] text-ops-dim">Version {version}. Plays offline once loaded, and can be installed as an app from your browser menu.</p>
        <div className="flex justify-end">
          <Btn kind="primary" onClick={onClose}>
            Close
          </Btn>
        </div>
      </div>
    </Modal>
  );
}
