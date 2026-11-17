// Site icons: one per SiteKind, drawn on a 24x24 grid with currentColor strokes.

import type { ReactNode } from 'react';
import type { SiteKind } from '../../sim/world';

export const KIND_LABEL: Record<SiteKind, string> = {
  mine: 'Mine',
  quarry: 'Quarry',
  well: 'Well',
  forestry: 'Forestry',
  steelworks: 'Steelworks',
  smelter: 'Smelter',
  refinery: 'Refinery',
  chemical: 'Chemical plant',
  explosives: 'Energetics',
  fab: 'Chip fab',
  components: 'Components',
  motors: 'Rocket motors',
  arsenal: 'Arsenal',
  testRange: 'Test range',
  depot: 'Depot',
  adBase: 'Air defense',
  artillery: 'Artillery',
  airBase: 'Air base',
  port: 'Port',
  airfield: 'Airlift hub',
  demil: 'Demilitarization',
  foreign: 'Foreign supplier',
};

export const SITE_KINDS = Object.keys(KIND_LABEL) as SiteKind[];

function gearPath(cx: number, cy: number, ro: number, ri: number, n: number): string {
  const w = Math.PI / n;
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const pts = [
      [a - w * 0.62, ri],
      [a - w * 0.32, ro],
      [a + w * 0.32, ro],
      [a + w * 0.62, ri],
    ];
    for (const [ang, r] of pts) d += `${d ? 'L' : 'M'}${(cx + Math.cos(ang) * r).toFixed(2)} ${(cy + Math.sin(ang) * r).toFixed(2)}`;
  }
  return d + 'Z';
}
const GEAR = gearPath(12, 12, 9.5, 7, 8);

// F marks a lightly filled shape, S a stroke-only one.
const F = ({ d }: { d: string }) => <path d={d} />;
const S = ({ d }: { d: string }) => <path d={d} fill="none" />;

const GLYPHS: Record<SiteKind, ReactNode> = {
  mine: (
    <>
      <S d="M5 19L15 9" />
      <S d="M10.8 4.8Q19.2 4.8 19.2 13.2" />
      <S d="M19 19L9.5 9.5" />
      <F d="M11.6 6.7L9.3 4.4L4.4 9.3L6.7 11.6Z" />
    </>
  ),
  quarry: (
    <>
      <S d="M2 6.5H5.5V10H9V13.5H15V10H18.5V6.5H22" />
      <F d="M9 13.5H15V17.5H9Z" />
      <S d="M4 21H20" />
    </>
  ),
  well: (
    <>
      <S d="M7 21L12 3L17 21" />
      <S d="M4.5 21H19.5" />
      <S d="M9.1 14H14.9M10.4 9H13.6M9.1 14L13.6 9M14.9 14L10.4 9" />
    </>
  ),
  forestry: (
    <>
      <F d="M12 2.5L6.5 10H9.5L5 16H19L14.5 10H17.5Z" />
      <S d="M12 16V21.5" />
    </>
  ),
  steelworks: <F d="M5 4H19V7.5H14V16.5H19V20H5V16.5H10V7.5H5Z" />,
  smelter: (
    <>
      <F d="M4 6.5H17L15.6 15C15.4 16.2 14.4 17 13.2 17H7.8C6.6 17 5.6 16.2 5.4 15Z" />
      <S d="M17 6.5L20.5 4.5M20.5 8V12" />
      <S d="M5 21H19" />
    </>
  ),
  refinery: (
    <>
      <F d="M5 21V9A2.5 2.5 0 0 1 10 9V21Z" />
      <F d="M14 21V5.5A2.5 2.5 0 0 1 19 5.5V21Z" />
      <S d="M2.5 21H21.5M10 14H14M5 13H10M14 10.5H19" />
    </>
  ),
  chemical: (
    <>
      <S d="M9.5 3H14.5M10.5 3V9L5 18.5C4.4 19.6 5.2 21 6.5 21H17.5C18.8 21 19.6 19.6 19 18.5L13.5 9V3" />
      <F d="M7.3 15H16.7L19 18.5C19.6 19.6 18.8 21 17.5 21H6.5C5.2 21 4.4 19.6 5 18.5Z" />
    </>
  ),
  explosives: <F d="M12 2L14 8L20 5L16.3 10.5L22 13L15.6 14.2L17 20.5L12 16.3L7 20.5L8.4 14.2L2 13L7.7 10.5L4 5L10 8Z" />,
  fab: (
    <>
      <S d="M7.5 6.5H16.5A1 1 0 0 1 17.5 7.5V16.5A1 1 0 0 1 16.5 17.5H7.5A1 1 0 0 1 6.5 16.5V7.5A1 1 0 0 1 7.5 6.5Z" />
      <F d="M9.75 9.75H14.25V14.25H9.75Z" />
      <S d="M9.5 3V6.5M14.5 3V6.5M9.5 17.5V21M14.5 17.5V21M3 9.5H6.5M3 14.5H6.5M17.5 9.5H21M17.5 14.5H21" />
    </>
  ),
  components: (
    <>
      <F d={GEAR} />
      <S d="M12 8.8A3.2 3.2 0 1 1 11.99 8.8Z" />
    </>
  ),
  motors: (
    <>
      <F d="M9 3H15V7C15 10 17.8 13 18.8 17H5.2C6.2 13 9 10 9 7Z" />
      <S d="M8.5 20L9.5 22M12 20V22.5M15.5 20L14.5 22" />
    </>
  ),
  arsenal: (
    <>
      <F d="M12 2C13.6 3.6 14 5.5 14 7.5V16L17 19.5V21H7V19.5L10 16V7.5C10 5.5 10.4 3.6 12 2Z" />
      <S d="M10 8.5H14" />
    </>
  ),
  testRange: (
    <>
      <S d="M12 4A8 8 0 1 1 11.99 4Z" />
      <S d="M12 8.5A3.5 3.5 0 1 1 11.99 8.5Z" />
      <S d="M12 1.5V5.5M12 18.5V22.5M1.5 12H5.5M18.5 12H22.5" />
    </>
  ),
  depot: (
    <>
      <F d="M3.5 19C3.5 13.2 7.3 9 12 9C16.7 9 20.5 13.2 20.5 19Z" />
      <S d="M10 19V15.5H14V19M1.5 19H22.5" />
      <S d="M7 6.5L8 8M12 4.5V6.5M17 6.5L16 8" />
    </>
  ),
  adBase: (
    <>
      <F d="M12 2.5L19.5 5.5V11C19.5 15.8 16.4 19.6 12 21.5C7.6 19.6 4.5 15.8 4.5 11V5.5Z" />
      <S d="M8.5 14.5L12 11L15.5 14.5M8.5 10L12 6.5L15.5 10" />
    </>
  ),
  artillery: (
    <>
      <F d="M5.2 14.4L19 5.4L20.6 7.8L6.8 16.8Z" />
      <S d="M8.5 14.5A3.2 3.2 0 1 1 8.49 14.5Z" />
      <S d="M11.5 18.5L21 20.5" />
    </>
  ),
  airBase: <F d="M12 2C13 2 13.5 3 13.5 5V9.2L21 13.8V16L13.5 13.6V18L16 20V21.6L12 20.6L8 21.6V20L10.5 18V13.6L3 16V13.8L10.5 9.2V5C10.5 3 11 2 12 2Z" />,
  port: (
    <>
      <S d="M12 6.5V21M8 9.5H16" />
      <S d="M12 2.5A2 2 0 1 1 11.99 2.5Z" />
      <S d="M4.5 14C4.5 18 7.8 21 12 21C16.2 21 19.5 18 19.5 14" />
      <S d="M2.5 15.5L4.5 13.5L6.5 15.5M17.5 15.5L19.5 13.5L21.5 15.5" />
    </>
  ),
  airfield: (
    <>
      <F d="M3.5 13.5L18.6 8.2C20.4 7.6 21.6 8.9 20.2 9.9L6 15.2Z" />
      <S d="M10 11.2L12.6 5.5H14.6L13.8 10M10.4 14L12.5 17H14L13.4 13" />
      <S d="M2 20.5H22" />
    </>
  ),
  demil: (
    <>
      <F d="M9 21V10C9 6.4 10.4 3.8 12 2.6C13.6 3.8 15 6.4 15 10V21Z" />
      <S d="M9 16H15" />
      <S d="M3.5 20.5L20.5 3.5" />
    </>
  ),
  foreign: (
    <>
      <S d="M12 3A9 9 0 1 1 11.99 3Z" />
      <S d="M12 3C9 5.5 8 9 8 12C8 15 9 18.5 12 21C15 18.5 16 15 16 12C16 9 15 5.5 12 3Z" />
      <S d="M3.5 9H20.5M3.5 15H20.5" />
    </>
  ),
};

export interface SiteIconProps {
  kind: SiteKind;
  /** Rendered size in user units (px when placed in screen space). */
  size?: number;
  /** Centre of the icon. */
  x?: number;
  y?: number;
  color?: string;
  strokeWidth?: number;
  /** Opacity of the light fill on solid parts. */
  fillOpacity?: number;
  className?: string;
}

/** An icon as an SVG group, centred on (x, y). Use inside an <svg>. */
export function SiteIcon({ kind, size = 20, x = 0, y = 0, color = 'currentColor', strokeWidth = 1.7, fillOpacity = 0.22, className }: SiteIconProps) {
  const k = size / 24;
  return (
    <g
      className={className}
      transform={`translate(${x - size / 2} ${y - size / 2}) scale(${k})`}
      stroke={color}
      fill={color}
      fillOpacity={fillOpacity}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {GLYPHS[kind]}
    </g>
  );
}

/** A standalone icon for use in HTML (legends, lists). */
export function SiteIconSvg({ kind, size = 16, className, title, strokeWidth = 1.7 }: { kind: SiteKind; size?: number; className?: string; title?: string; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <SiteIcon kind={kind} size={24} x={12} y={12} strokeWidth={strokeWidth} />
    </svg>
  );
}
