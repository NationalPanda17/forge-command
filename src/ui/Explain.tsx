// "Explain this number": any figure wrapped in Explain opens a short breakdown on hover, focus or tap.
import { useId, useRef, useState, type ReactNode } from 'react';

export function Explain({ children, title, lines }: { children: ReactNode; title: string; lines: () => string[] }) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [side, setSide] = useState<'left' | 'right'>('left');
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();
  const show = () => {
    // Open towards the side with more room, so the box stays on screen.
    const r = ref.current?.getBoundingClientRect();
    if (r) setSide(r.left > window.innerWidth / 2 ? 'right' : 'left');
    setOpen(true);
  };
  const visible = open || pinned;
  return (
    <span
      ref={ref}
      className="relative inline-block cursor-help border-b border-dotted border-ops-dim/70 outline-none focus-visible:border-ops-cyan"
      tabIndex={0}
      role="button"
      aria-describedby={visible ? id : undefined}
      title={`${title}: press to explain`}
      onMouseEnter={show}
      onMouseLeave={() => setOpen(false)}
      onFocus={show}
      onBlur={() => {
        setOpen(false);
        setPinned(false);
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (!pinned) show();
        setPinned(!pinned);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          setOpen(false);
          setPinned(false);
        }
      }}
    >
      {children}
      {visible && (
        <span
          id={id}
          role="tooltip"
          className={`fc-hud absolute top-full z-50 mt-1 block w-64 max-w-[80vw] p-2 text-left font-body text-[11.5px] font-normal normal-case leading-snug tracking-normal text-ops-text ${side === 'left' ? 'left-0' : 'right-0'}`}
        >
          <span className="label mb-1 block !text-ops-amber">{title}</span>
          {lines().map((l, i) => (
            <span key={i} className="block">
              {l}
            </span>
          ))}
        </span>
      )}
    </span>
  );
}
