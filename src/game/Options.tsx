// Display options and keyboard help, used on the title screen and in the game.
import { useState } from 'react';
import type { AudioPrefs } from '../ui/music';
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
  ['[ and ]', 'Previous or next tab'],
  ['M', 'Go to the map'],
  ['Arrows, + and −, 0', 'On the map: pan, zoom, reset'],
  ['Tab', 'On the map: step between sites; Enter opens one'],
  ['Escape', 'Close a dialog, or clear the selection on the map'],
  ['?', 'Show or hide this list'],
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
      <p className="text-[10px] text-ops-dim">The music follows the game: calm, uneasy before a crisis, tense during one, stately at a hearing. Turn music and sounds on or off with the buttons at the top.</p>
    </div>
  );
}

export function KeyboardHelp({ onClose, audio }: { onClose: () => void; audio?: { prefs: AudioPrefs; set: (p: Partial<AudioPrefs>) => void } }) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-ops-bg/85 p-3" role="dialog" aria-modal="true" aria-labelledby="keys-title" onClick={onClose}>
      <div className="fc-zoom panel mx-auto mt-[10vh] max-w-md p-4 text-[12px]" onClick={(e) => e.stopPropagation()}>
        <h2 id="keys-title" className="mb-2 font-sans text-[18px] font-semibold text-white">
          Keyboard
        </h2>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1">
          {SHORTCUTS.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="whitespace-nowrap text-ops-cyan">{k}</dt>
              <dd className="text-ops-text">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4">
          <div className="label mb-2">Display</div>
          <DisplayOptions />
        </div>
        {audio && (
          <div className="mt-4">
            <div className="label mb-2">Sound</div>
            <AudioOptions prefs={audio.prefs} set={audio.set} />
          </div>
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
