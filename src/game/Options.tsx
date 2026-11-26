// Display options and keyboard help, used on the title screen and in the game.
import { DialogFocus } from '../ui/DialogFocus';
import { useState } from 'react';
import type { AudioPrefs } from '../ui/music';
import { DEFAULT_PAUSE, EVENT_KINDS, EVENT_KIND_IDS, type PauseRules } from './events';
import { loadPrefs, savePrefs, type DisplayPrefs } from '../ui/prefs';
import { Btn, Segmented } from '../ui/kit';

export function DisplayOptions() {
  const [p, setP] = useState<DisplayPrefs>(loadPrefs);
  const set = (next: Partial<DisplayPrefs>) => {
    const v = { ...p, ...next };
    setP(v);
    savePrefs(v);
  };
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="label">Colours</span>
        <Segmented<DisplayPrefs['palette']>
          label="Colour palette"
          value={p.palette}
          onChange={(palette) => set({ palette })}
          options={[
            { id: 'default', label: 'Standard' },
            { id: 'cb', label: 'Colour-blind safe' },
          ]}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="label">Text</span>
        <Segmented<DisplayPrefs['text']>
          label="Text size"
          value={p.text}
          onChange={(text) => set({ text })}
          options={[
            { id: 'normal', label: 'Normal' },
            { id: 'large', label: 'Large' },
            { id: 'larger', label: 'Larger' },
          ]}
        />
      </div>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={p.reduceMotion} onChange={(e) => set({ reduceMotion: e.target.checked })} />
        Reduce motion
      </label>
    </div>
  );
}

export const SHORTCUTS: [string, string][] = [
  ['Space', 'Pause or resume'],
  ['1 – 4', 'Speed 1×, 2×, 4×, 8×'],
  ['Ctrl K or /', 'Search: go to any tab, site, material or town, or run a command'],
  ['[ and ]', 'Previous or next tab'],
  ['M', 'Go to the map'],
  ['Arrows, + and −, 0', 'On the map: pan, zoom, reset'],
  ['Tab', 'On the map: step between sites; Enter opens one'],
  ['Escape', 'Close a dialog, or clear the selection on the map'],
  ['?', 'Open or close settings'],
  ['Right-click or long-press', 'On a map site: quick actions'],
];

/** Volume for the music and the sound effects. */
export function AudioOptions({ prefs, set }: { prefs: AudioPrefs; set: (p: Partial<AudioPrefs>) => void }) {
  const slider = (label: string, value: number, on: boolean, key: 'volume' | 'sfxVolume') => (
    <label className="flex flex-wrap items-center gap-2">
      <span className="w-24 text-ops-text">{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={Math.round(value * 100)}
        onChange={(e) => set({ [key]: Number(e.target.value) / 100 })}
        aria-label={`${label} volume`}
        className="min-w-0 flex-1"
        disabled={!on}
      />
      <span className="w-10 text-right text-ops-dim">{on ? `${Math.round(value * 100)}%` : 'off'}</span>
    </label>
  );
  return (
    <div className="space-y-1.5">
      {slider('Music', prefs.volume, prefs.music, 'volume')}
      {slider('Sounds', prefs.sfxVolume, prefs.sfx, 'sfxVolume')}
      <p className="text-[10px] text-ops-dim">The music follows the game: calm, uneasy before a crisis, tense during one, stately at a hearing.</p>
    </div>
  );
}

export type SettingsTab = 'clock' | 'sound' | 'display' | 'keys';

/** What pauses the clock, and the field notes. */
export function PauseOptions({ rules, set }: { rules: PauseRules; set: (r: PauseRules) => void }) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-white">
        <input type="checkbox" checked={rules.on} onChange={(e) => set({ ...rules, on: e.target.checked })} />
        Pause the clock for important events
      </label>
      <ul className={`grid gap-x-4 gap-y-1 sm:grid-cols-2 ${rules.on ? '' : 'opacity-50'}`}>
        {EVENT_KIND_IDS.map((k) => (
          <li key={k}>
            <label className="flex items-start gap-2">
              <input type="checkbox" className="mt-0.5" disabled={!rules.on} checked={rules.kinds[k]} onChange={(e) => set({ ...rules, kinds: { ...rules.kinds, [k]: e.target.checked } })} />
              <span className="min-w-0">
                <span className="text-ops-text">{EVENT_KINDS[k].label}</span>
                <span className="block text-[10px] text-ops-dim">{EVENT_KINDS[k].blurb}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <label className={`flex items-center gap-2 ${rules.on ? '' : 'opacity-50'}`}>
        <input type="checkbox" disabled={!rules.on} checked={rules.monthEnd} onChange={(e) => set({ ...rules, monthEnd: e.target.checked })} />
        <span className="text-ops-text">Pause at the end of every month</span>
      </label>
      <div className="flex flex-wrap gap-1">
        <Btn onClick={() => set(structuredClone(DEFAULT_PAUSE))}>Restore the defaults</Btn>
      </div>
      <p className="text-[10px] text-ops-dim">Hearings, handovers and story briefings always hold the clock until you answer them.</p>
    </div>
  );
}

export function SettingsDialog({
  onClose,
  initial = 'clock',
  audio,
  pause,
  tips,
}: {
  onClose: () => void;
  initial?: SettingsTab;
  audio?: { prefs: AudioPrefs; set: (p: Partial<AudioPrefs>) => void };
  pause?: { rules: PauseRules; set: (r: PauseRules) => void };
  tips?: { on: boolean; set: (on: boolean) => void };
}) {
  const tabs: { id: SettingsTab; label: string }[] = [
    ...(pause || tips ? [{ id: 'clock' as SettingsTab, label: 'Clock and tips' }] : []),
    ...(audio ? [{ id: 'sound' as SettingsTab, label: 'Sound' }] : []),
    { id: 'display', label: 'Display' },
    { id: 'keys', label: 'Keyboard' },
  ];
  const [tab, setTab] = useState<SettingsTab>(tabs.some((t) => t.id === initial) ? initial : tabs[0].id);
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-ops-bg/85 p-3" role="dialog" aria-modal="true" aria-labelledby="settings-title" onClick={onClose}>
      <DialogFocus labelledBy="settings-title" />
      <div className="fc-zoom panel mx-auto mt-[8vh] max-w-lg p-4 text-[12px]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 id="settings-title" className="font-sans text-[20px] font-bold uppercase tracking-[0.12em] text-white">
            Settings
          </h2>
          <button type="button" onClick={onClose} aria-label="Close settings" title="Close (Esc)" className="grid h-7 w-7 place-items-center rounded text-ops-dim transition-colors hover:bg-ops-panel2 hover:text-white">
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="mb-3">
          <Segmented<SettingsTab> label="Settings section" value={tab} onChange={setTab} options={tabs} />
        </div>
        {tab === 'clock' && (
          <div className="space-y-4">
            {pause && <PauseOptions rules={pause.rules} set={pause.set} />}
            {tips && (
              <div>
                <div className="label mb-1">Field notes</div>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={tips.on} onChange={(e) => tips.set(e.target.checked)} />
                  <span className="text-ops-text">Show a tip the first time each system shows up</span>
                </label>
              </div>
            )}
          </div>
        )}
        {tab === 'sound' && audio && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1">
              <Btn pressed={audio.prefs.music} onClick={() => audio.set({ music: !audio.prefs.music })}>
                Music {audio.prefs.music ? 'on' : 'off'}
              </Btn>
              <Btn pressed={audio.prefs.sfx} onClick={() => audio.set({ sfx: !audio.prefs.sfx })}>
                Sounds {audio.prefs.sfx ? 'on' : 'off'}
              </Btn>
            </div>
            <AudioOptions prefs={audio.prefs} set={audio.set} />
          </div>
        )}
        {tab === 'display' && <DisplayOptions />}
        {tab === 'keys' && (
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1">
            {SHORTCUTS.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="whitespace-nowrap text-ops-cyan">{k}</dt>
                <dd className="text-ops-text">{v}</dd>
              </div>
            ))}
          </dl>
        )}
        <div className="mt-4 flex justify-end">
          <Btn kind="primary" onClick={onClose}>
            Close
          </Btn>
        </div>
      </div>
    </div>
  );
}
