// The story: this chapter's goals, how earlier chapters went, and the briefing that opens each one.
import type { SimAction } from '../sim/actions';
import { CHAPTERS, CHAPTER_DAYS, CHARACTERS, chapterGoals } from '../sim/story';
import type { SimState } from '../sim/types';
import { Btn } from '../ui/kit';

export function Briefing({ state, act }: { state: SimState; act: (a: SimAction) => void }) {
  const i = state.story?.briefing;
  if (i === null || i === undefined) return null;
  const ch = CHAPTERS[i];
  const who = CHARACTERS[ch.speaker];
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-ops-bg/90 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="brief-title">
      <div className="panel mx-auto mt-[8vh] max-w-xl space-y-3 p-4 text-[12px]">
        <div className="label text-ops-amber">
          Chapter {i + 1} of {CHAPTERS.length}
        </div>
        <h2 id="brief-title" className="font-sans text-2xl font-bold tracking-[0.1em] text-white">
          {ch.title}
        </h2>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-ops-cyan/60 font-sans text-[14px] font-bold text-ops-cyan" aria-hidden="true">
            {who.name
              .split(' ')
              .filter((w) => /^[A-Z]/.test(w) && !['Dame', 'Colonel', 'General'].includes(w))
              .map((w) => w[0])
              .join('')}
          </span>
          <span className="min-w-0">
            <span className="block text-white">{who.name}</span>
            <span className="block text-[11px] text-ops-dim">{who.role}</span>
          </span>
        </div>
        <div className="space-y-2 leading-relaxed text-ops-text">
          {ch.briefing(state).map((p, k) => (
            <p key={k}>“{p}”</p>
          ))}
        </div>
        <div>
          <div className="label mb-1">Goals for the year</div>
          <ul className="list-disc space-y-0.5 pl-5 text-ops-text">
            {ch.goals.map((g) => (
              <li key={g.id}>{g.text}</li>
            ))}
          </ul>
        </div>
        <div className="flex justify-end">
          <Btn kind="primary" onClick={() => act({ type: 'storyBriefed' })}>
            To work →
          </Btn>
        </div>
      </div>
    </div>
  );
}

export default function StoryPanel({ state }: { state: SimState }) {
  const st = state.story;
  if (!st) return <p className="p-3 text-[11px] text-ops-dim">This is not a story game.</p>;
  const ch = CHAPTERS[Math.min(st.chapter, CHAPTERS.length - 1)];
  const goals = chapterGoals(state);
  const left = Math.max(0, st.started + CHAPTER_DAYS - state.day);
  return (
    <div className="space-y-4 p-3 text-[11px]">
      {st.chapter < CHAPTERS.length && (
        <section>
          <div className="label text-ops-amber">
            Chapter {st.chapter + 1} of {CHAPTERS.length} · {Math.ceil(left / 30)} months left
          </div>
          <h3 className="font-sans text-[18px] font-semibold text-white">{ch.title}</h3>
          <p className="text-ops-dim">
            Briefed by {CHARACTERS[ch.speaker].name}, {CHARACTERS[ch.speaker].role}.
          </p>
          <ul className="mt-2 space-y-1">
            {goals.map((g) => (
              <li key={g.id} className={g.ok ? 'text-ops-green' : 'text-ops-text'}>
                {g.ok ? '✓' : '○'} {g.text}
                {g.ok ? '' : <span className="text-ops-dim"> · not yet</span>}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[10px] text-ops-dim">Goals are judged on the last day of the chapter: a tick now can still slip.</p>
        </section>
      )}
      {st.results.length > 0 && (
        <section>
          <h3 className="label mb-1">Earlier chapters</h3>
          <ul className="space-y-2">
            {st.results.map((r) => (
              <li key={r.chapter}>
                <div className="text-white">
                  {r.chapter + 1}. {CHAPTERS[r.chapter].title} · {r.met.length} of {CHAPTERS[r.chapter].goals.length}
                </div>
                <ul className="text-[10px]">
                  {CHAPTERS[r.chapter].goals.map((g) => (
                    <li key={g.id} className={r.met.includes(g.id) ? 'text-ops-green' : 'text-ops-amber'}>
                      {r.met.includes(g.id) ? '✓' : '✗'} {g.text}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section>
        <h3 className="label mb-1">The people</h3>
        <ul className="space-y-0.5">
          {Object.values(CHARACTERS).map((c) => (
            <li key={c.name}>
              <span className="text-white">{c.name}</span> <span className="text-ops-dim">· {c.role}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
