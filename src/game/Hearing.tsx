// The budget hearing: three questions from the Committee, then your request.
import { DialogFocus } from '../ui/DialogFocus';
import { validate, type SimAction } from '../sim/actions';
import { REQUESTS, requestOdds, support, type RequestLevel } from '../sim/hearings';
import { FACTIONS } from '../sim/strategy';
import type { SimState } from '../sim/types';
import { Btn, Chip, ChoiceCard, ChoiceOption } from '../ui/kit';
import { Icon } from '../ui/icons';
import { pct } from '../ui/format';

const SWAY_WORD = (v: number) => (v >= 5 ? 'pleased' : v > 0 ? 'warmer' : v <= -5 ? 'angry' : 'cooler');

export function Hearing({ state, act }: { state: SimState; act: (a: SimAction) => void }) {
  const h = state.hearing;
  if (!h || state.over) return null;
  const done = h.questions.every((q) => h.answers[q.id]);
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-ops-bg/90 p-3" role="dialog" aria-modal="true" aria-labelledby="hearing-title">
      <DialogFocus labelledBy="hearing-title" />
      <div className="fc-zoom panel mx-auto mt-[4vh] max-w-2xl space-y-3 p-4 text-[12px]">
        <div className="label text-ops-amber">Defence Committee · fiscal year review</div>
        <h2 id="hearing-title" className="fc-dialog-title">
          Budget hearing
        </h2>
        <p className="text-ops-text">
          The provisional budget is <span className="text-white">${state.appropriation}M a month</span>. Answer the members' questions, then make your request. Promises are checked a year from now:
          keep them and the Committee warms to you; break them and it will not forget.
        </p>
        <ol className="space-y-3">
          {h.questions.map((q, i) => {
            const chosen = h.answers[q.id];
            return (
              <ChoiceCard
                key={q.id}
                as="li"
                tone={chosen ? 'quiet' : 'amber'}
                eyebrow={`Question ${i + 1} of ${h.questions.length}`}
                right={FACTIONS[q.faction].name}
                icon={<Icon name="people" size={16} />}
                title={q.member}
              >
                <p className="mt-1 text-[12px] text-ops-text">“{q.text}”</p>
                <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                  {q.options.map((o) => (
                    <ChoiceOption
                      key={o.id}
                      label={o.label}
                      detail={o.detail}
                      picked={chosen === o.id}
                      disabled={!!chosen && chosen !== o.id}
                      marks={o.promise ? <Chip tone="border-ops-amber/60 text-ops-amber">A promise</Chip> : undefined}
                      after={
                        chosen === o.id
                          ? Object.entries(o.sway)
                              .map(([f, v]) => `${FACTIONS[f as keyof typeof FACTIONS].name}: ${SWAY_WORD(v)}`)
                              .join(' · ')
                          : undefined
                      }
                      onClick={() => {
                        if (!chosen)
                          act({
                            type: 'hearingAnswer',
                            question: q.id,
                            option: o.id,
                          });
                      }}
                    />
                  ))}
                </div>
              </ChoiceCard>
            );
          })}
        </ol>
        <section className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="label">Your request</span>
            <span className="text-[10px] text-ops-dim">Committee support {pct(support(state))}</span>
          </div>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {(Object.keys(REQUESTS) as RequestLevel[]).map((level) => {
              const r = REQUESTS[level];
              const a: SimAction = { type: 'hearingRequest', level };
              const why = validate(state, a);
              const odds = requestOdds(state, level);
              return (
                <Btn
                  key={level}
                  kind={level === 'accept' ? 'primary' : undefined}
                  why={why}
                  onClick={() => act(a)}
                  className="flex flex-col items-start gap-0.5 p-2 text-left normal-case tracking-normal"
                >
                  <span className="text-[12px]">
                    {r.label} · ${Math.round(state.appropriation * (1 + r.change))}M
                  </span>
                  <span className="text-[10px] text-ops-dim">{level === 'modest' || level === 'bold' ? `About ${pct(odds)} odds. ${r.detail}` : r.detail}</span>
                </Btn>
              );
            })}
          </div>
          {!done && <p className="text-[10px] text-ops-amber">Answer every question before you make your request.</p>}
        </section>
      </div>
    </div>
  );
}
