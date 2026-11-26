// Title-screen key art: the Board's industry at dusk. Two silhouette layers (far haze, near works) drawn from simple
// shapes, lit windows, forge glow on the horizon and smoke from the stacks. Pure SVG, no image files.
import { useMemo } from 'react';

const W = 1600;
const H = 360;
const BASE = H;

/** A small deterministic generator, so the skyline is the same on every visit. */
function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

interface Art {
  far: string;
  near: string;
  windows: { x: number; y: number; w: number; h: number; o: number }[];
  stacks: { x: number; top: number }[];
  launcher: string;
  missile: string;
  lights: { x: number; y: number }[];
}

function build(): Art {
  const r = rng(1917);
  // Far layer: blocky haze of plants and hills.
  let far = `M0 ${BASE} L0 ${BASE - 120}`;
  for (let x = 0; x < W; ) {
    const w = 30 + r() * 90;
    const h = 70 + r() * 110;
    far += ` L${x} ${BASE - h} L${x + w} ${BASE - h}`;
    if (r() < 0.25) far += ` L${x + w} ${BASE - h - 40 - r() * 60} L${x + w + 8} ${BASE - h - 40 - r() * 60} L${x + w + 8} ${BASE - h}`;
    x += w;
  }
  far += ` L${W} ${BASE} Z`;

  // Near layer: works halls with saw-tooth roofs, tanks, cranes and stacks.
  const parts: string[] = [];
  const windows: Art['windows'] = [];
  const stacks: Art['stacks'] = [];
  const lights: Art['lights'] = [];
  let x = -20;
  while (x < W - 260) {
    const kind = r();
    if (kind < 0.45) {
      // Saw-tooth hall.
      const w = 140 + r() * 160;
      const h = 60 + r() * 50;
      const teeth = Math.max(3, Math.round(w / 34));
      const tw = w / teeth;
      let d = `M${x} ${BASE} L${x} ${BASE - h}`;
      for (let i = 0; i < teeth; i++) d += ` L${x + i * tw + tw * 0.75} ${BASE - h - 22} L${x + i * tw + tw * 0.75} ${BASE - h} L${x + (i + 1) * tw} ${BASE - h}`;
      d += ` L${x + w} ${BASE} Z`;
      parts.push(d);
      for (let wx = x + 10; wx < x + w - 14; wx += 16)
        for (let wy = BASE - h + 14; wy < BASE - 16; wy += 15) if (r() < 0.32) windows.push({ x: wx, y: wy, w: 7, h: 5, o: 0.35 + r() * 0.6 });
      x += w + 6 + r() * 20;
    } else if (kind < 0.65) {
      // A pair of stacks on a plinth.
      const n = 1 + Math.floor(r() * 3);
      const plinth = 34 + r() * 20;
      parts.push(`M${x} ${BASE} L${x} ${BASE - plinth} L${x + n * 26 + 10} ${BASE - plinth} L${x + n * 26 + 10} ${BASE} Z`);
      for (let i = 0; i < n; i++) {
        const sx = x + 8 + i * 26;
        const top = BASE - 170 - r() * 110;
        parts.push(`M${sx} ${BASE - plinth} L${sx + 2} ${top} L${sx + 13} ${top} L${sx + 15} ${BASE - plinth} Z`);
        parts.push(`M${sx} ${top + 10} h15 v4 h-15 Z`);
        stacks.push({ x: sx + 7.5, top });
        lights.push({ x: sx + 7.5, y: top - 3 });
      }
      x += n * 26 + 24;
    } else if (kind < 0.8) {
      // Storage tanks.
      const n = 2 + Math.floor(r() * 2);
      for (let i = 0; i < n; i++) {
        const tw = 44 + r() * 20;
        const th = 40 + r() * 26;
        parts.push(`M${x} ${BASE} L${x} ${BASE - th} Q${x + tw / 2} ${BASE - th - 14} ${x + tw} ${BASE - th} L${x + tw} ${BASE} Z`);
        x += tw + 4;
      }
      x += 14;
    } else {
      // A gantry crane over a yard.
      const h = 150 + r() * 60;
      const reach = 90 + r() * 60;
      parts.push(`M${x} ${BASE} L${x + 4} ${BASE - h} L${x + 10} ${BASE - h} L${x + 14} ${BASE} Z`);
      parts.push(`M${x - 24} ${BASE - h - 2} L${x + reach} ${BASE - h - 2} L${x + reach} ${BASE - h + 5} L${x - 24} ${BASE - h + 5} Z`);
      parts.push(`M${x + reach - 30} ${BASE - h + 5} h2 v${h * 0.45} h-2 Z`);
      parts.push(`M${x + reach - 42} ${BASE - h * 0.55 + 5} h26 v14 h-26 Z`);
      lights.push({ x: x + reach, y: BASE - h - 3 });
      x += reach + 30;
    }
  }
  // The launcher on the right: a tracked carrier with a missile raised on its rail.
  const lx = W - 230;
  const launcher = `M${lx} ${BASE} L${lx} ${BASE - 34} L${lx + 40} ${BASE - 34} L${lx + 52} ${BASE - 58} L${lx + 92} ${BASE - 58} L${lx + 100} ${BASE - 34} L${lx + 200} ${BASE - 34} L${lx + 200} ${BASE} Z M${lx + 120} ${BASE - 34} L${lx + 186} ${BASE - 150} L${lx + 196} ${BASE - 144} L${lx + 136} ${BASE - 34} Z`;
  const missile = `M${lx + 128} ${BASE - 52} L${lx + 190} ${BASE - 160} L${lx + 196} ${BASE - 178} L${lx + 200} ${BASE - 156} L${lx + 138} ${BASE - 46} Z`;
  return { far, near: parts.join(' '), windows, stacks, launcher, missile, lights };
}

/** The skyline, anchored to the bottom of its box and cropped at the sides to fit. */
export default function Skyline({ className = '' }: { className?: string }) {
  const art = useMemo(build, []);
  return (
    <svg className={className} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="fc-sky-far" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0f1622" />
          <stop offset="1" stopColor="#080c13" />
        </linearGradient>
        <linearGradient id="fc-sky-near" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b1019" />
          <stop offset="1" stopColor="#05080d" />
        </linearGradient>
        <radialGradient id="fc-sky-glow" cx="0.5" cy="1" r="0.75">
          <stop offset="0" stopColor="#ff8a2a" stopOpacity="0.42" />
          <stop offset="0.45" stopColor="#c2541c" stopOpacity="0.16" />
          <stop offset="1" stopColor="#c2541c" stopOpacity="0" />
        </radialGradient>
        <filter id="fc-sky-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>
      <rect x="0" y={H * 0.2} width={W} height={H * 0.8} fill="url(#fc-sky-glow)" />
      <path d={art.far} fill="url(#fc-sky-far)" opacity="0.8" />
      {/* Smoke from the stacks drifts up and away. */}
      <g filter="url(#fc-sky-blur)" className="fc-smoke">
        {art.stacks.map((st, i) => (
          <g key={i} style={{ animationDelay: `${-i * 1.7}s` }}>
            <ellipse cx={st.x + 10} cy={st.top - 26} rx="18" ry="12" fill="#5c6675" opacity="0.35" />
            <ellipse cx={st.x + 34} cy={st.top - 58} rx="28" ry="16" fill="#4a5361" opacity="0.25" />
            <ellipse cx={st.x + 70} cy={st.top - 92} rx="40" ry="20" fill="#3c4450" opacity="0.15" />
          </g>
        ))}
      </g>
      <path d={art.near} fill="url(#fc-sky-near)" />
      <path d={art.launcher} fill="url(#fc-sky-near)" />
      <path d={art.missile} fill="#0e141f" stroke="#c08a43" strokeOpacity="0.35" strokeWidth="1" />
      <g fill="#ffb55c">
        {art.windows.map((w, i) => (
          <rect key={i} x={w.x} y={w.y} width={w.w} height={w.h} opacity={w.o * 0.55} />
        ))}
      </g>
      <g fill="#ff4d3d" className="fc-beacon">
        {art.lights.map((l, i) => (
          <circle key={i} cx={l.x} cy={l.y} r="2.2" style={{ animationDelay: `${(i % 4) * 0.45}s` }} />
        ))}
      </g>
      <rect x="0" y={H - 2} width={W} height="2" fill="#ff8a2a" opacity="0.25" />
    </svg>
  );
}
