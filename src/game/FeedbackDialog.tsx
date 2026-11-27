// The playtest feedback form (19.3.5). The player answers a few questions; the form turns them into a short report to
// copy or save as a file. Nothing leaves the browser unless the player passes it on, and the draft is kept here, so
// closing the form loses nothing.
import { useEffect, useMemo, useState } from 'react';
import { DialogFocus } from '../ui/DialogFocus';
import { Btn } from '../ui/kit';
import type { SimState } from '../sim/types';
import { QUESTIONS, feedbackReport, gameContext, hasAnswer, type Answers } from './feedback';

const DRAFT = 'forge-command-feedback-draft';
const version = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';

function loadDraft(): Answers {
  try {
    return JSON.parse(localStorage.getItem(DRAFT) ?? '{}') ?? {};
  } catch {
    return {};
  }
}

export default function FeedbackDialog({ state, onClose }: { state: SimState; onClose: () => void }) {
  const [answers, setAnswers] = useState<Answers>(loadDraft);
  const [withGame, setWithGame] = useState(true);
  const [note, setNote] = useState<string | null>(null);
  // Where the browser will not copy, the report is shown to select and copy by hand.
  const [showText, setShowText] = useState(false);
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT, JSON.stringify(answers));
    } catch {
      /* the draft is a convenience */
    }
  }, [answers]);
  const context = useMemo(() => gameContext(state, version, { w: window.innerWidth, h: window.innerHeight }), [state]);
  const report = feedbackReport(answers, withGame ? context : null);
  const ready = hasAnswer(answers);
  const set = (id: string, v: string | number) => setAnswers((a) => ({ ...a, [id]: a[id] === v ? undefined : v }));

  const refused = () => {
    setNote('Your browser would not copy it. Select the report below and copy it, or save it as a file.');
    setShowText(true);
  };
  const copy = () => {
    if (!navigator.clipboard) return refused();
    navigator.clipboard.writeText(report).then(() => setNote('Copied. Paste it where your playtest invitation asked.'), refused);
  };
  const save = () => {
    try {
      const url = URL.createObjectURL(new Blob([report], { type: 'text/plain' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `forge-command-feedback-day-${state.day}.txt`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNote('Saved as a file. Send it where your playtest invitation asked.');
    } catch {
      setNote('Your browser would not save it. Copy it instead.');
    }
  };
  const clear = () => {
    setAnswers({});
    setNote(null);
    setShowText(false);
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-ops-bg/90 p-3" role="dialog" aria-modal="true" aria-labelledby="feedback-title" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <DialogFocus labelledBy="feedback-title" />
      <div className="fc-zoom panel mx-auto mt-[4vh] max-w-2xl space-y-3 p-4 text-[12px]">
        <div className="label text-ops-amber">Playtest</div>
        <h2 id="feedback-title" className="fc-dialog-title">
          Tell us how it went
        </h2>
        <p className="text-ops-text">Answer as many as you like. Nothing is sent: copy the report or save it as a file, then pass it on. Your answers stay here until you clear them.</p>
        <ol className="space-y-3">
          {QUESTIONS.map((q, i) => (
            <li key={q.id} className="space-y-1.5 rounded border border-ops-line/60 p-3">
              <div className="text-white">
                {i + 1}. {q.text}
              </div>
              {q.kind === 'scale' && (
                <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
                  <span className="text-[10px] text-ops-dim">{q.low}</span>
                  <div className="flex gap-1" role="radiogroup" aria-label={q.text}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={answers[q.id] === n}
                        onClick={() => set(q.id, n)}
                        className={`h-8 flex-1 rounded border font-sans text-[13px] font-bold ${answers[q.id] === n ? 'border-ops-cyan bg-ops-cyan/15 text-ops-cyan' : 'border-ops-line text-ops-text hover:border-ops-dim'}`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <span className="text-[10px] text-ops-dim">{q.high}</span>
                </div>
              )}
              {q.kind === 'pick' && (
                <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={q.text}>
                  {q.options.map((o) => (
                    <button
                      key={o}
                      type="button"
                      role="radio"
                      aria-checked={answers[q.id] === o}
                      onClick={() => set(q.id, o)}
                      className={`rounded border px-3 py-1.5 ${answers[q.id] === o ? 'border-ops-cyan bg-ops-cyan/15 text-ops-cyan' : 'border-ops-line text-ops-text hover:border-ops-dim'}`}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              )}
              {q.kind === 'text' && (
                <textarea
                  className="input min-h-[3.5rem] w-full resize-y py-1"
                  aria-label={q.text}
                  placeholder={q.hint}
                  value={String(answers[q.id] ?? '')}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                />
              )}
            </li>
          ))}
        </ol>
        <section className="space-y-1 rounded border border-ops-line/60 p-3">
          <label className="flex items-center gap-2 text-white">
            <input type="checkbox" checked={withGame} onChange={(e) => setWithGame(e.target.checked)} />
            Add where you are in the game
          </label>
          <ul className="pl-6 text-[10px] text-ops-dim">
            {context.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </section>
        {note && (
          <p role="status" className={showText ? 'text-ops-amber' : 'text-ops-green'}>
            {note}
          </p>
        )}
        {showText && <textarea readOnly className="input h-40 w-full resize-y py-1 font-mono text-[11px]" aria-label="The report" value={report} onFocus={(e) => e.currentTarget.select()} />}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ops-line/60 pt-3">
          <Btn onClick={clear} why={ready ? null : 'Nothing to clear'}>
            Clear answers
          </Btn>
          <span className="flex flex-wrap gap-2">
            <Btn onClick={onClose}>Close</Btn>
            <Btn onClick={save} why={ready ? null : 'Answer a question first'}>
              Save as file
            </Btn>
            <Btn kind="primary" onClick={copy} why={ready ? null : 'Answer a question first'}>
              Copy report
            </Btn>
          </span>
        </div>
      </div>
    </div>
  );
}
