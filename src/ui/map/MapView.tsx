// Operational map of the country (classic or generated): static geography, transport network, sites, shipments.

import { Icon } from '../icons';
import { memo, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { CITIES, REGIONS, ROUTE_KEY, SITES, SITE_BY_ID, type RegionId, type SiteDef, type SiteKind } from '../../sim/world';
import * as G from './geo';
import { countryTitle, onWorldChange } from '../../sim/worldgen';
import { KIND_LABEL, SITE_KINDS, SiteIcon, SiteIconSvg } from './icons';
import { FONT_BODY, FONT_HEAD, FONT_MONO, SITE_FONT, SITE_SUB_FONT, SITE_SUB_GAP, EXIT_FIRST_GAP, EXIT_LINE_GAP, cityDot, citySize, clashes, kindLine, layoutMap, markerAt, markerPx, resetTextWidths, smallTextBox, spreadMarkers, uiScale, type Box, type ExitGroup, type Layout, type Placed } from './layout';

// ---------- Public types ----------

export interface MapMarker {
  tone?: 'ok' | 'warn' | 'bad' | 'idle';
  badge?: string;
  pulse?: boolean;
  /** Not drawn at all. */
  hidden?: boolean;
  /** Overrides for sites that change (a plant founded on a plot). */
  kind?: SiteKind;
  name?: string;
}
/** What a site's badge means, for screen readers. */
const BADGE_WORDS: Record<string, string> = { '?': 'not qualified', '!': 'rounds to retire', CP: 'chokepoint' };
export interface MapShipment {
  id: number;
  /** Site ids along the way. */
  path: string[];
  /** 0..1 along the whole path, used when there is no clock. */
  progress: number;
  /** With a clock, position follows depart and arrive days continuously. */
  depart?: number;
  arrive?: number;
  /** First-leg mode. */
  mode: string;
  color?: string;
}
export interface MapLayers { terrain: boolean; labels: boolean; rail: boolean; road: boolean; sea: boolean; air: boolean; flows: boolean; regions: boolean; weather: boolean; night: boolean }
/** What the player has built or is building, for drawing. */
export interface MapNetwork {
  built: string[];
  upgrades: Record<string, number>;
  /** Candidate links under construction. */
  building: string[];
  /** Route keys being upgraded. */
  upgrading: string[];
}
/** A brief ring at a site when something happens there. */
export interface MapRipple { key: string; site: string; tone: 'good' | 'bad' | 'warn' | 'info'; /** A big moment (20.5): larger, bronze, and longer. */ big?: boolean }

export interface MapViewProps {
  /** How far the game's overlays reach over the map on each side (18.3). The map keeps its view and furniture clear. */
  insets?: { top: number; right: number; bottom: number; left: number };
  /** Fill the box with no border or rounded corners (the full-window map). */
  bare?: boolean;
  markers: Record<string, MapMarker>;
  shipments: MapShipment[];
  routeUse?: Record<string, number>; // ROUTE_KEY -> 0..1 utilisation, tint routes that are busy
  crisisRegion?: RegionId | null; // glow the region in red
  selected: string | null;
  onSelect: (siteId: string | null) => void;
  layers: MapLayers;
  height?: number | string;
  network?: MapNetwork;
  /** Draw links that could be built. */
  showPlans?: boolean;
  /** A route key or candidate link id to pick out. */
  highlight?: string | null;
  ripples?: MapRipple[];
  /** Continuous simulated time in days, for smooth movement between days. */
  clock?: () => number;
  /** Weather to draw. */
  weather?: MapWeather;
  /** A card to show while the pointer rests on a site. */
  hoverCard?: (siteId: string) => ReactNode;
  /** Quick actions for a site, from a right-click, a long press, or the context-menu key. */
  quickMenu?: (siteId: string, close: () => void) => ReactNode;
  /** The selected site's suppliers (up) and customers (down), drawn as lines from it. */
  related?: { up: string[]; down: string[] } | null;
}

export const DEFAULT_LAYERS: MapLayers = { terrain: true, labels: true, rail: true, road: true, sea: true, air: true, flows: true, regions: false, weather: true, night: false };

// ---------- Palette ----------

const ops = (v: string, a?: number) => (a === undefined ? `rgb(var(--ops-${v}))` : `rgb(var(--ops-${v}) / ${a})`);

const SEA = '#07111f';
const LAND = '#14232b';
const COAST = 'rgba(132, 204, 236, 0.6)';
const WATER = '#12304c';
const RIVER = 'rgba(96, 178, 226, 0.8)';
const RAIL = 'rgba(176, 194, 218, 0.9)';
const ROAD = 'rgba(222, 196, 142, 0.85)';

export const MODE_COLOR: Record<string, string> = { rail: ops('amber'), road: ops('text'), sea: ops('cyan'), air: ops('violet') };
const TONE_COLOR: Record<NonNullable<MapMarker['tone']>, string> = { ok: ops('green'), warn: ops('amber'), bad: ops('red'), idle: ops('dim') };
const OWNER_COLOR: Record<SiteDef['owner'], string> = { state: ops('cyan'), private: ops('text'), foreign: ops('violet') };
// Regions have muted hues of their own: amber, green and red are for command and status, never for territory.
const REGION_COLOR: Record<RegionId, string> = { north: '#86a2c8', coast: '#72b2b4', east: '#bfa07c', isles: '#a497c6', central: '#93a6b8' };
const FIGHTING: RegionId[] = ['north', 'coast', 'east', 'isles'];


// ---------- View maths ----------

interface View { S: number; tx: number; ty: number }
/**
 * The map's box, and (18.3) how far the game's overlays reach into it on each side: the map fits, centres and clamps
 * itself, and places its own furniture, in the safe area that is left.
 */
interface Size { w: number; h: number; l?: number; t?: number; r?: number; b?: number; cover?: boolean }

/** The visible part of the map: left, top, width and height. */
const safe = (sz: Size) => ({ x: sz.l ?? 0, y: sz.t ?? 0, w: sz.w - (sz.l ?? 0) - (sz.r ?? 0), h: sz.h - (sz.t ?? 0) - (sz.b ?? 0) });

const MIN_Z = 0.85;
const MAX_Z = 14;

const fitScale = (sz: Size) => {
  const a = safe(sz);
  // The full-window map (19.3) fills what you can see, edge to edge, as a strategy map does; a boxed map fits inside.
  if (sz.cover) return Math.max(0.05, Math.max(a.w / G.FRAME_W, a.h / G.FRAME_H));
  return Math.max(0.05, Math.min((a.w - 16) / G.FRAME_W, (a.h - 16) / G.FRAME_H));
};

function fitView(sz: Size): View {
  const S = fitScale(sz);
  const a = safe(sz);
  return { S, tx: a.x + (a.w - G.FRAME_W * S) / 2 - G.FRAME.x0 * S, ty: a.y + (a.h - G.FRAME_H * S) / 2 - G.FRAME.y0 * S };
}

/** Keeps the sheet's edge within `m` of the safe area's edge, so any part of it can be brought into view. */
function clampAxis(t: number, S: number, a0: number, a1: number, lo: number, len: number): number {
  const m = 48;
  const span = (a1 - a0) * S;
  if (span <= len - 2 * m) return lo + (len - span) / 2 - a0 * S;
  return Math.max(lo + len - m - a1 * S, Math.min(lo + m - a0 * S, t));
}

function clampView(v: View, sz: Size): View {
  const s0 = fitScale(sz);
  const S = Math.max(s0 * MIN_Z, Math.min(s0 * MAX_Z, v.S));
  const a = safe(sz);
  return { S, tx: clampAxis(v.tx, S, G.FRAME.x0, G.FRAME.x1, a.x, a.w), ty: clampAxis(v.ty, S, G.FRAME.y0, G.FRAME.y1, a.y, a.h) };
}

function zoomAbout(v: View, px: number, py: number, k: number): View {
  const S = v.S * k;
  return { S, tx: px - ((px - v.tx) * S) / v.S, ty: py - ((py - v.ty) * S) / v.S };
}

/** Level of detail from pixels per km. */
const lodOf = (S: number) => (S < 1.6 ? 0 : S < 3 ? 1 : S < 6 ? 2 : 3);

const LOD_CSS = `
.fcm[data-lod="0"] .l1,.fcm[data-lod="0"] .l2,.fcm[data-lod="0"] .l3,.fcm[data-lod="1"] .l2,.fcm[data-lod="1"] .l3,.fcm[data-lod="2"] .l3{display:none}
.fcm:not([data-lod="0"]) .l0only{display:none}
@keyframes fcm-pulse{from{transform:scale(1);opacity:.9}to{transform:scale(2.4);opacity:0}}
.fcm-pulse{transform-box:fill-box;transform-origin:center;animation:fcm-pulse 1.6s ease-out infinite}
@keyframes fcm-crisis{0%,100%{opacity:.5}50%{opacity:1}}
.fcm-crisis{animation:fcm-crisis 2.4s ease-in-out infinite}
.fcm-marker{cursor:pointer;outline:none}
@keyframes fcm-build{to{stroke-dashoffset:-20}}
.fcm-build{animation:fcm-build 1.2s linear infinite}
@keyframes fcm-ripple{from{transform:scale(0.6);opacity:.9}to{transform:scale(3.2);opacity:0}}
.fcm-ripple{transform-box:fill-box;transform-origin:center;animation:fcm-ripple 1.8s ease-out 2 forwards}
.fcm-ripple-big{animation:fcm-ripple 2.2s ease-out 3 forwards}
@keyframes fcm-flow{to{stroke-dashoffset:-18}}
.fcm-flow{animation:fcm-flow 1.4s linear infinite}
.fcm-marker:hover .fcm-mbody{stroke-width:2.2}
.fc-paused .fcm-flow,.fc-paused .fcm-build,.fc-paused .fcm-pulse{animation-play-state:paused}
@media (prefers-reduced-motion:reduce){.fcm-pulse,.fcm-crisis,.fcm-build,.fcm-flow{animation:none}.fcm-ripple{display:none}}
`;

// ---------- Static layers ----------

const Defs = memo(function Defs({ uid }: { uid: string }) {
  const geo = G.geography();
  return (
    <defs>
      {/* The face of a site counter: steel lit from above (one map at a time, so a fixed id is safe). */}
      <linearGradient id="fc-plate" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#24324a" />
        <stop offset="0.55" stopColor="#111a2a" />
        <stop offset="1" stopColor="#080d16" />
      </linearGradient>
      <clipPath id={`${uid}-frame`}>
        <rect x={G.FRAME.x0} y={G.FRAME.y0} width={G.FRAME_W} height={G.FRAME_H} />
      </clipPath>
      <clipPath id={`${uid}-land`}>
        <path d={geo.land} />
      </clipPath>
      {(Object.keys(G.REGION_RINGS) as RegionId[]).map((r) => (
        <clipPath key={r} id={`${uid}-reg-${r}`}>
          <path d={G.ringPath(G.REGION_RINGS[r])} />
        </clipPath>
      ))}
      <pattern id={`${uid}-hatch`} width={5} height={5} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1={0} y1={0} x2={0} y2={5} stroke="rgba(242, 84, 91, 0.2)" strokeWidth={0.6} />
      </pattern>
      <pattern id={`${uid}-streets`} width={1.3} height={1.3} patternUnits="userSpaceOnUse" patternTransform="rotate(14)">
        <path d="M0 0H1.3M0 0V1.3" stroke="rgba(201, 216, 236, 0.32)" strokeWidth={0.12} fill="none" />
      </pattern>
      <pattern id={`${uid}-danger`} width={3} height={3} patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
        <line x1={0} y1={0} x2={0} y2={3} stroke="rgba(242, 84, 91, 0.22)" strokeWidth={0.35} />
      </pattern>
      <pattern id={`${uid}-snow`} width={7} height={7} patternUnits="userSpaceOnUse">
        <circle cx={1.5} cy={1.5} r={0.55} fill="rgba(245, 250, 255, 0.55)" />
        <circle cx={5} cy={4.5} r={0.4} fill="rgba(245, 250, 255, 0.45)" />
      </pattern>
      <pattern id={`${uid}-ice`} width={14} height={14} patternUnits="userSpaceOnUse" patternTransform="rotate(20)">
        <path d="M0 3L6 4L9 0M3 14L7 9L14 10" stroke="rgba(245, 250, 255, 0.35)" strokeWidth={0.5} fill="none" />
      </pattern>
      <clipPath id={`${uid}-seaclip`}>
        <path d={`M${G.FRAME.x0} ${G.FRAME.y0}H${G.FRAME.x1}V${G.FRAME.y1}H${G.FRAME.x0}Z${geo.land}`} clipRule="evenodd" />
      </clipPath>
      <linearGradient id={`${uid}-northgrad`} x1="0" y1={G.FRAME.y0} x2="0" y2={290} gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="rgb(235, 244, 255)" stopOpacity={0.2} />
        <stop offset="55%" stopColor="rgb(235, 244, 255)" stopOpacity={0.1} />
        <stop offset="100%" stopColor="rgb(235, 244, 255)" stopOpacity={0} />
      </linearGradient>
      <radialGradient id={`${uid}-lights`}>
        <stop offset="0%" stopColor="#ffd38a" stopOpacity={0.75} />
        <stop offset="35%" stopColor="#ffb347" stopOpacity={0.3} />
        <stop offset="100%" stopColor="#ffb347" stopOpacity={0} />
      </radialGradient>
      <radialGradient id={`${uid}-vignette`} cx="50%" cy="45%" r="70%">
        <stop offset="60%" stopColor="#000" stopOpacity={0} />
        <stop offset="100%" stopColor="#000" stopOpacity={0.45} />
      </radialGradient>
      <filter id={`${uid}-glow`} x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation={5} />
      </filter>
    </defs>
  );
});

const nss = { vectorEffect: 'non-scaling-stroke' as const };

const StaticGeo = memo(function StaticGeo({ uid, terrain, relief }: { uid: string; terrain: boolean; relief: string | null }) {
  const geo = G.geography();
  const urban = G.URBAN.map((u) => u.d).join('');
  const lakes = G.LAKES.map((l) => l.d).join('');
  const bands: [number, string][] = [
    [70, '#081525'],
    [46, '#0a192b'],
    [31, 'rgba(56, 214, 245, 0.10)'],
    [30, '#0b1d31'],
    [19, 'rgba(56, 214, 245, 0.12)'],
    [18, '#0d2238'],
    [9.8, 'rgba(56, 214, 245, 0.14)'],
    [9, '#0f2840'],
    [4.2, 'rgba(56, 214, 245, 0.16)'],
    [3.6, '#112e48'],
  ];
  return (
    <g>
      <rect x={G.FRAME.x0} y={G.FRAME.y0} width={G.FRAME_W} height={G.FRAME_H} fill={SEA} />
      <g fill="none" strokeLinejoin="round">
        {bands.map(([w, c], i) => (
          <path key={i} d={geo.land} stroke={c} strokeWidth={w} />
        ))}
      </g>
      <path d={geo.land} fill={LAND} />
      {terrain && relief && (
        <image href={relief} x={G.FRAME.x0} y={G.FRAME.y0} width={G.FRAME_W} height={G.FRAME_H} preserveAspectRatio="none" clipPath={`url(#${uid}-land)`} opacity={0.95} />
      )}
      {terrain && (
        <g clipPath={`url(#${uid}-land)`}>
          <path d={geo.fields[0]} fill="rgba(150, 170, 110, 0.055)" />
          <path d={geo.fields[1]} fill="rgba(190, 170, 110, 0.045)" />
          <path d={geo.fields[2]} fill="rgba(110, 160, 130, 0.06)" />
          {geo.contours.map((d, i) => (
            <path key={i} d={d} className={i % 2 ? 'l1' : undefined} fill="none" stroke={i % 2 ? 'rgba(210, 220, 230, 0.08)' : 'rgba(220, 225, 235, 0.15)'} strokeWidth={i % 2 ? 0.6 : 0.85} style={nss} />
          ))}
          <path d={geo.trees.shade} stroke="rgba(0, 8, 6, 0.35)" strokeWidth={0.6} fill="none" className="l1" />
          <path d={geo.trees.canopy} fill="rgba(58, 128, 92, 0.42)" stroke="rgba(110, 190, 140, 0.18)" strokeWidth={0.18} />
        </g>
      )}
      {/* Vardan Directorate */}
      <g clipPath={`url(#${uid}-land)`}>
        <path d={geo.vardan} fill="rgba(4, 8, 14, 0.5)" />
        <path d={geo.vardan} fill={`url(#${uid}-hatch)`} />
      </g>
      {/* Water */}
      <path d={lakes} fill={WATER} stroke={COAST} strokeWidth={0.7} style={nss} />
      <g clipPath={`url(#${uid}-land)`} fill="none" strokeLinecap="round" strokeLinejoin="round" stroke={RIVER}>
        {G.RIVERS.map((r, i) => (
          <path key={i} d={r.d} className={r.order === 3 ? 'l1' : undefined} strokeWidth={r.order === 1 ? 1.7 : r.order === 2 ? 1.1 : 0.75} style={nss} />
        ))}
      </g>
      {/* Salt pans, ranges, pipeline */}
      <path className="l1" d={G.SALT_PANS} fill="rgba(220, 230, 240, 0.12)" stroke="rgba(220, 230, 240, 0.3)" strokeWidth={0.5} style={nss} />
      <g className="l1">
        {G.DANGER_AREAS.map((a) => (
          <g key={a.id}>
            <path d={a.d} fill={`url(#${uid}-danger)`} />
            <path d={a.d} fill="none" stroke="rgba(242, 84, 91, 0.55)" strokeWidth={1} strokeDasharray="5 3" style={nss} />
          </g>
        ))}
      </g>
      <path className="l1" d={G.PIPELINE} fill="none" stroke="rgba(245, 177, 61, 0.55)" strokeWidth={1} strokeDasharray="1 3" strokeLinecap="round" style={nss} />
      {/* Towns */}
      <path d={urban} fill="rgba(201, 216, 236, 0.11)" stroke="rgba(201, 216, 236, 0.28)" strokeWidth={0.7} style={nss} />
      <path className="l2" d={urban} fill={`url(#${uid}-streets)`} />
      {/* Coastline */}
      <path d={geo.land} fill="none" stroke={COAST} strokeWidth={0.9} strokeLinejoin="round" style={nss} />
      {/* Close-zoom detail */}
      <g className="l2" fill="none" stroke="rgba(201, 216, 236, 0.55)" strokeWidth={1.1} strokeLinecap="round" style={nss}>
        <path d={G.HARBOURS} style={nss} />
        {G.PITS.map(([x, y, r], i) => (
          <g key={i} stroke="rgba(214, 160, 110, 0.5)">
            {[1, 0.66, 0.33].map((k) => (
              <ellipse key={k} cx={x} cy={y} rx={r * k} ry={r * k * 0.72} strokeWidth={0.7} style={nss} />
            ))}
          </g>
        ))}
        {G.RUNWAYS.map((rw, i) => (
          <g key={i} transform={`translate(${rw.x} ${rw.y}) rotate(${rw.a})`}>
            <rect x={-rw.l / 2} y={-0.35} width={rw.l} height={0.7} fill="rgba(201, 216, 236, 0.25)" strokeWidth={0.6} style={nss} />
          </g>
        ))}
      </g>
      {/* Border */}
      <path d={geo.border} fill="none" stroke="rgba(242, 84, 91, 0.18)" strokeWidth={6} style={nss} />
      <path d={geo.border} fill="none" stroke="rgba(242, 84, 91, 0.9)" strokeWidth={1.4} strokeDasharray="8 3 2 3" style={nss} />
      {/* Grid */}
      <path d={geo.graticule} fill="none" stroke="rgba(56, 214, 245, 0.07)" strokeWidth={1} style={nss} />
      <rect x={G.FRAME.x0} y={G.FRAME.y0} width={G.FRAME_W} height={G.FRAME_H} fill={`url(#${uid}-vignette)`} pointerEvents="none" />
    </g>
  );
});

// ---------- Regions ----------

const RegionLayer = memo(function RegionLayer({ uid, show, crisis }: { uid: string; show: boolean; crisis: RegionId | null }) {
  const geo = G.geography();
  if (!show && !crisis) return null;
  return (
    <g pointerEvents="none">
      {show && (
        <g clipPath={`url(#${uid}-land)`}>
          {FIGHTING.map((r) => (
            <g key={r}>
              <path d={G.ringPath(G.REGION_RINGS[r])} fill={REGION_COLOR[r]} fillOpacity={0.09} />
              <path d={G.ringPath(G.REGION_RINGS[r])} fill="none" stroke={REGION_COLOR[r]} strokeOpacity={0.55} strokeWidth={1.2} strokeDasharray="5 4" style={nss} />
            </g>
          ))}
        </g>
      )}
      {crisis && (
        <g className="fcm-crisis" clipPath={`url(#${uid}-reg-${crisis})`}>
          <path d={geo.land} fill="none" stroke={ops('red')} strokeWidth={8} strokeOpacity={0.6} filter={`url(#${uid}-glow)`} />
          <path d={geo.land} fill={ops('red')} fillOpacity={0.12} />
          <g clipPath={`url(#${uid}-land)`}>
            <path d={G.ringPath(G.REGION_RINGS[crisis])} fill="none" stroke={ops('red')} strokeWidth={2} strokeOpacity={0.9} style={nss} />
          </g>
        </g>
      )}
    </g>
  );
});

// ---------- Routes ----------

function busyColor(u: number | undefined, base: string): string {
  if (u === undefined || u < 0.6) return base;
  return u >= 0.85 ? ops('red') : ops('amber');
}

const RoutesLayer = memo(
  function RoutesLayer({ layers, use, network, showPlans, highlight }: { layers: MapLayers; use: Record<string, number> | undefined; sig: string; network?: MapNetwork; showPlans?: boolean; highlight?: string | null }) {
    const built = G.CANDIDATE_GEOMS.filter((g) => network?.built.includes(g.id));
    const live = [...G.ROUTE_GEOMS, ...built];
    const by = (m: string) => live.filter((g) => g.mode === m);
    const plans = G.CANDIDATE_GEOMS.filter((g) => !network?.built.includes(g.id) && (showPlans || network?.building.includes(g.id) || highlight === g.id));
    const upgraded = live.filter((g) => (network?.upgrades[g.key] ?? 0) > 0 || network?.upgrading.includes(g.key));
    const lit = highlight ? [...live, ...G.CANDIDATE_GEOMS].filter((g) => g.key === highlight || (g as { id?: string }).id === highlight) : [];
    return (
      <g fill="none" strokeLinecap="round" strokeLinejoin="round" pointerEvents="none">
        {lit.map((g) => (
          <path key={`h-${g.key}-${g.mode}`} d={g.d} stroke={ops('cyan', 0.35)} strokeWidth={12} style={nss} />
        ))}
        {upgraded.map((g) => {
          const lvl = network?.upgrades[g.key] ?? 0;
          return (
            <g key={`u-${g.key}-${g.mode}`}>
              {lvl > 0 && <path d={g.d} stroke={ops('text', 0.18)} strokeWidth={5 + lvl * 2.5} style={nss} />}
              {network?.upgrading.includes(g.key) && <path className="fcm-build" d={g.d} stroke={ops('amber', 0.8)} strokeWidth={6 + lvl * 2.5} strokeDasharray="2 6" style={nss} />}
            </g>
          );
        })}
        {plans.map((g) => {
          const going = network?.building.includes(g.id);
          return <path key={`p-${g.id}`} className={going ? 'fcm-build' : undefined} d={g.d} stroke={ops('amber', going ? 0.95 : 0.55)} strokeWidth={going ? 2.2 : 1.5} strokeDasharray={going ? '6 4' : '3 5'} style={nss} />;
        })}
        {layers.sea &&
          by('sea').map((g) => {
            const u = use?.[g.key];
            return (
              <g key={`s-${g.key}`}>
                {u !== undefined && u >= 0.6 && <path d={g.d} stroke={busyColor(u, '')} strokeOpacity={0.25} strokeWidth={5} style={nss} />}
                <path d={g.d} stroke={busyColor(u, ops('cyan', 0.7))} strokeWidth={1.3} strokeDasharray="7 5" style={nss} />
              </g>
            );
          })}
        {layers.road &&
          by('road').map((g) => {
            const u = use?.[g.key];
            return (
              <g key={`r-${g.key}`}>
                <path d={g.d} stroke="rgba(6, 11, 20, 0.85)" strokeWidth={u !== undefined && u >= 0.6 ? 4.6 : 3.6} style={nss} />
                <path d={g.d} stroke={busyColor(u, ROAD)} strokeWidth={u !== undefined && u >= 0.6 ? 2.4 : 1.7} style={nss} />
              </g>
            );
          })}
        {layers.rail &&
          by('rail').map((g) => {
            const u = use?.[g.key];
            const c = busyColor(u, RAIL);
            const busy = u !== undefined && u >= 0.6;
            return (
              <g key={`t-${g.key}`}>
                <path d={g.d} stroke="rgba(6, 11, 20, 0.8)" strokeWidth={busy ? 4.5 : 3.6} style={nss} />
                {busy && <path d={g.d} stroke={c} strokeOpacity={0.25} strokeWidth={7} style={nss} />}
                <path d={g.d} stroke={c} strokeWidth={busy ? 1.8 : 1.3} style={nss} />
                <path d={g.d} stroke={c} strokeWidth={5} strokeDasharray="1 5" strokeLinecap="butt" style={nss} />
              </g>
            );
          })}
        {layers.air &&
          by('air').map((g) => {
            const u = use?.[g.key];
            return <path key={`a-${g.key}`} d={g.d} stroke={busyColor(u, ops('violet', 0.7))} strokeWidth={1} strokeDasharray="2 3" style={nss} />;
          })}
      </g>
    );
  },
  (a, b) => a.layers === b.layers && a.sig === b.sig,
);

// ---------- Labels ----------

const halo = (w: number) => ({ stroke: 'rgba(6, 11, 20, 0.88)', strokeWidth: w, paintOrder: 'stroke' as const, strokeLinejoin: 'round' as const });

interface LabelsProps { S: number; geo: Layout['geo']; regions: Layout['regions']; exits: ExitGroup[] }

const LabelsLayer = memo(function LabelsLayer({ S, geo, regions, exits }: LabelsProps) {
  const u = uiScale(S);
  const k = 1 / S;
  return (
    <g pointerEvents="none">
      {G.GEO_LABELS.map((l, i) => {
        const at = geo[i];
        if (!at) return null;
        const fill =
          l.kind === 'sea' ? 'rgba(96, 178, 226, 0.55)' : l.kind === 'water' ? 'rgba(120, 190, 235, 0.85)' : l.kind === 'nation' ? 'rgba(242, 84, 91, 0.7)' : l.kind === 'island' ? 'rgba(201, 216, 236, 0.75)' : 'rgba(201, 216, 236, 0.5)';
        const italic = l.kind === 'sea' || l.kind === 'water' || l.kind === 'relief';
        const mono = l.kind === 'water' || l.kind === 'island';
        return (
          <g key={i} transform={`translate(${l.at[0]} ${l.at[1]}) scale(${k}) translate(${at[0]} ${at[1]})${l.rot ? ` rotate(${l.rot})` : ''}`}>
            <text
              textAnchor="middle"
              fontFamily={mono ? FONT_MONO : FONT_HEAD}
              fontWeight={mono ? 400 : 600}
              fontStyle={italic ? 'italic' : undefined}
              fontSize={(l.size + (l.kind === 'sea' || l.kind === 'nation' ? 1 : 0)) * u}
              letterSpacing={l.spacing ? `${l.spacing}em` : undefined}
              fill={fill}
              {...halo(l.kind === 'water' ? 2.5 : 3)}
            >
              {l.text}
            </text>
          </g>
        );
      })}
      {(Object.keys(regions) as RegionId[]).map((r) => {
        const d = regions[r]!;
        return (
          <g key={r} transform={`translate(${G.REGION_LABEL_AT[r][0]} ${G.REGION_LABEL_AT[r][1]}) scale(${k})`}>
            <text x={d[0]} y={d[1]} textAnchor="middle" fontFamily={FONT_HEAD} fontWeight={700} fontSize={14 * u} letterSpacing="0.2em" fill={r === 'central' ? ops('dim') : REGION_COLOR[r]} fillOpacity={0.9} {...halo(3)}>
              {REGIONS[r].name.toUpperCase()}
            </text>
          </g>
        );
      })}
      {/* Off-map suppliers: an arrow where each lane leaves the sheet, one caption per nation and edge. */}
      {G.OFF_MAP_EXITS.map((e) => (
        <g key={e.siteId} transform={`translate(${e.at[0]} ${e.at[1]}) scale(${u * k}) rotate(${(e.angle * 180) / Math.PI})`}>
          <path className="fcm-exit" d="M-14 0H-2M-7 -5L0 0L-7 5" fill="none" stroke={ops('violet')} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </g>
      ))}
      {exits.map((g) =>
        g.placed ? (
          <g key={g.key} transform={`translate(${g.at[0]} ${g.at[1]}) scale(${k})`}>
            <text x={g.placed.x} y={g.placed.y} textAnchor={g.placed.anchor} fontFamily={FONT_HEAD} fontWeight={700} fontSize={12 * u} letterSpacing="0.12em" fill={ops('violet')} {...halo(3)}>
              {g.arrow}
            </text>
            {g.showNames &&
              g.names.map((n, i) => (
                <text key={n} x={g.placed!.x} y={g.placed!.y + (EXIT_FIRST_GAP + EXIT_LINE_GAP * i) * u} textAnchor={g.placed!.anchor} fontFamily={FONT_MONO} fontSize={9.5 * u} fill={ops('dim')} {...halo(2.5)}>
                  {n}
                </text>
              ))}
          </g>
        ) : null,
      )}
    </g>
  );
});

// ---------- Sites and cities ----------

const CitiesLayer = memo(function CitiesLayer({ S, placed }: { S: number; placed: (Placed | null)[] }) {
  const u = uiScale(S);
  const k = u / S;
  return (
    <g pointerEvents="none">
      {CITIES.map((c, i) => {
        const r = cityDot(c.pop);
        const fs = citySize(c.pop);
        const p = placed[i];
        const big = c.pop >= 200;
        return (
          <g key={c.name} transform={`translate(${c.x} ${c.y}) scale(${k})`}>
            {c.capital && (
              <>
                <circle r={r + 3.2} fill="none" stroke="rgba(6, 11, 20, 0.9)" strokeWidth={3} />
                <circle r={r + 3.2} fill="none" stroke="#e8f0fa" strokeWidth={1.2} />
              </>
            )}
            <circle className="fcm-city" r={r} fill={c.capital ? ops('amber') : '#dce6f2'} stroke="rgba(6, 11, 20, 0.9)" strokeWidth={1.3} />
            {p && <text
              x={p.x / u}
              y={p.y / u}
              textAnchor={p.anchor}
              fontFamily={FONT_HEAD}
              fontWeight={big ? 700 : 600}
              fontSize={fs}
              letterSpacing={big ? '0.08em' : '0.02em'}
              fill={c.capital ? '#f4f8fd' : '#d4dfec'}
              {...halo(3.2)}
            >
              {big ? c.name.toUpperCase() : c.name}
            </text>}
          </g>
        );
      })}
    </g>
  );
});

interface SitesLayerProps {
  S: number;
  markers: Record<string, MapMarker>;
  selected: string | null;
  focused: string | null;
  hovered: string | null;
  labelIds: Record<string, Placed>;
  spread: Record<string, [number, number]>;
  onActivate: (id: string, e: ReactMouseEvent | ReactKeyboardEvent) => void;
  onFocusSite: (id: string | null) => void;
  onHover: (id: string | null) => void;
  onMenu: (id: string, at: { clientX: number; clientY: number } | null) => void;
  onPress: (id: string, e: ReactPointerEvent) => void;
}

/**
 * How big a site's marker is (19.3): arsenals at full size, plants, depots and bases a step down, and the mines, wells,
 * ranges and ports that feed them smallest, so the map reads from the important sites down. Never larger than full
 * size, so the spacing that keeps markers apart (which assumes full size) still holds.
 */
const MINOR_KINDS = new Set<SiteKind>(['mine', 'quarry', 'well', 'forestry', 'plot', 'testRange', 'demil', 'port', 'airfield']);
const tierScale = (kind: SiteKind) => (kind === 'arsenal' ? 1 : MINOR_KINDS.has(kind) ? 0.76 : 0.88);

const SitesLayer = memo(function SitesLayer({ S, markers, selected, focused, hovered, labelIds, spread, onActivate, onFocusSite, onHover, onMenu, onPress }: SitesLayerProps) {
  const k = 1 / S;
  const m = markerPx(S);
  const h = m / 2;
  const order = SITES.filter((s) => !markers[s.id]?.hidden).sort((a, b) => (a.id === selected ? 1 : b.id === selected ? -1 : 0));
  return (
    <g>
      {/* Leaders from where a site really is to where its marker was moved to keep it clear of its neighbours. */}
      <g pointerEvents="none">
        {SITES.map((s) => {
          if (markers[s.id]?.hidden) return null;
          const d = spread[s.id];
          if (!d || Math.hypot(d[0], d[1]) < h * 0.6) return null;
          const [x, y] = G.SITE_POS[s.id];
          return <line key={s.id} x1={x} y1={y} x2={x + d[0] * k} y2={y + d[1] * k} stroke={ops('text', 0.55)} strokeWidth={1} style={{ vectorEffect: 'non-scaling-stroke' }} />;
        })}
      </g>
      {order.map((s) => {
        const [mx, my] = markerAt(s.id, S, spread);
        const x = mx * k;
        const y = my * k;
        const mk = markers[s.id];
        const col = mk?.tone ? TONE_COLOR[mk.tone] : OWNER_COLOR[s.owner];
        const sel = s.id === selected;
        const kind = mk?.kind ?? s.kind;
        // A selected or hovered site shows at full size, whatever its rank.
        const t = sel || hovered === s.id ? 1 : tierScale(kind);
        // A plated counter (17.2): a shadow under it, a steel face lit from above, the owner's rim, and a bevel inside it.
        const shape = (inset: number, props: Record<string, unknown>) =>
          s.owner === 'state' ? (
            <rect x={-h + inset} y={-h + inset} width={m - inset * 2} height={m - inset * 2} rx={Math.max(1, 3.5 - inset)} {...props} />
          ) : s.owner === 'foreign' ? (
            <path d={`M0 ${-h - 2 + inset * 1.4}L${h + 2 - inset * 1.4} 0L0 ${h + 2 - inset * 1.4}L${-h - 2 + inset * 1.4} 0Z`} {...props} />
          ) : (
            <circle r={h + 0.5 - inset} {...props} />
          );
        const body = (
          <>
            <g transform="translate(0 1.4)">{shape(0, { fill: 'rgba(0, 0, 0, 0.55)' })}</g>
            {shape(0, { className: 'fcm-mbody', fill: 'url(#fc-plate)', stroke: col, strokeWidth: 1.6 })}
            {shape(1.7, { fill: 'none', stroke: 'rgba(255, 255, 255, 0.14)', strokeWidth: 0.8 })}
          </>
        );
        return (
          <g
            key={s.id}
            className="fcm-marker"
            transform={`translate(${x} ${y}) scale(${k * t})`}
            tabIndex={0}
            role="button"
            aria-label={`${mk?.name ?? s.name}, ${KIND_LABEL[mk?.kind ?? s.kind]}${s.nation ? `, ${s.nation}` : ''}${mk?.badge ? `, ${BADGE_WORDS[mk.badge] ?? mk.badge}` : ''}`}
            aria-pressed={sel}
            onClick={(e) => onActivate(s.id, e)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onActivate(s.id, e);
              } else if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) {
                e.preventDefault();
                onMenu(s.id, null);
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onMenu(s.id, e);
            }}
            onPointerDown={(e) => onPress(s.id, e)}
            onFocus={() => onFocusSite(s.id)}
            onBlur={() => onFocusSite(null)}
            onPointerEnter={() => onHover(s.id)}
            onPointerLeave={() => onHover(null)}
          >
            <circle r={h + 6} fill="transparent" />
            {mk?.pulse && <circle className="fcm-pulse" r={h + 1} fill="none" stroke={col} strokeWidth={2} />}
            {sel && (
              <g stroke={ops('amber')} strokeWidth={2} fill="none" strokeLinecap="round">
                <circle r={h + 7} stroke={ops('amber', 0.25)} strokeWidth={6} />
                <path d={`M${-h - 6} ${-h + 1}V${-h - 6}H${-h + 1}M${h - 1} ${-h - 6}H${h + 6}V${-h + 1}M${h + 6} ${h - 1}V${h + 6}H${h - 1}M${-h + 1} ${h + 6}H${-h - 6}V${h - 1}`} />
              </g>
            )}
            {focused === s.id && !sel && <circle r={h + 5} fill="none" stroke={ops('text')} strokeWidth={1.5} strokeDasharray="3 2" />}
            <g filter={undefined}>
              {s.owner === 'state' ? (
                <rect x={-h - 1.5} y={-h - 1.5} width={m + 3} height={m + 3} rx={4.5} fill="rgba(6, 11, 20, 0.6)" />
              ) : (
                <circle r={h + 2.5} fill="rgba(6, 11, 20, 0.6)" />
              )}
              {body}
              {/* An arsenal carries a bronze outer ring: the sites the whole chain feeds. */}
              {kind === 'arsenal' && <rect x={-h - 3.5} y={-h - 3.5} width={m + 7} height={m + 7} rx={5.5} fill="none" stroke="rgb(var(--fc-bronze))" strokeOpacity={0.85} strokeWidth={1.3} />}
            </g>
            <SiteIcon kind={mk?.kind ?? s.kind} size={m * 0.68} color={col} strokeWidth={1.9} fillOpacity={0.25} />
            {mk?.badge && (
              <g transform={`translate(${h - 2} ${-h - 3})`}>
                <rect x={0} y={-6.5} width={8 + mk.badge.length * 5.6} height={13} rx={6.5} fill={col} stroke="rgba(6, 11, 20, 0.9)" strokeWidth={1.2} />
                <text x={4 + mk.badge.length * 2.8} y={3.2} textAnchor="middle" fontFamily={FONT_MONO} fontWeight={700} fontSize={9} fill="#06111f">
                  {mk.badge}
                </text>
              </g>
            )}
          </g>
        );
      })}
      <g pointerEvents="none">
        {Object.entries(labelIds).map(([id, p]) => {
          const s = SITE_BY_ID[id];
          const mk = markers[id];
          const [mx, my] = markerAt(id, S, spread);
          const x = mx * k;
          const y = my * k;
          const hot = id === selected || id === hovered || id === focused;
          return (
            <g key={id} transform={`translate(${x} ${y}) scale(${k})`}>
              {p.lead && (
                <line
                  x1={(p.x / Math.hypot(p.x, p.y - SITE_FONT * 0.35)) * (m / 2 + 3)}
                  y1={((p.y - SITE_FONT * 0.35) / Math.hypot(p.x, p.y - SITE_FONT * 0.35)) * (m / 2 + 3)}
                  x2={p.x - (p.anchor === 'start' ? 2 : p.anchor === 'end' ? -2 : 0)}
                  y2={p.y - SITE_FONT * 0.35}
                  stroke={ops('cyan', 0.7)}
                  strokeWidth={1}
                />
              )}
              <text x={p.x} y={p.y} textAnchor={p.anchor} fontFamily={FONT_BODY} fontWeight={hot ? 700 : 500} fontSize={SITE_FONT} fill={id === selected ? ops('amber') : hot ? '#ffffff' : ops('text', 0.92)} {...halo(3)}>
                {mk?.name ?? s.name}
              </text>
              {hot && (
                <text x={p.x} y={p.y + SITE_SUB_GAP} textAnchor={p.anchor} fontFamily={FONT_BODY} fontWeight={500} fontSize={SITE_SUB_FONT} letterSpacing="0.1em" fill={ops('dim')} {...halo(2.5)}>
                  {kindLine(id, mk?.kind)}
                </text>
              )}
            </g>
          );
        })}
      </g>
    </g>
  );
});

// ---------- Shipments ----------

interface Leg { pts: G.Pt[]; cum: number[]; len: number; mode: string }
const legCache = new Map<string, { legs: Leg[]; total: number }>();
// Routes move with the world: forget the old ones.
onWorldChange(() => legCache.clear());

function legsFor(path: string[], mode: string): { legs: Leg[]; total: number } {
  const key = `${mode}:${path.join('>')}`;
  const hit = legCache.get(key);
  if (hit) return hit;
  const legs: Leg[] = [];
  let prev = mode;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const gs = G.GEOMS_BY_KEY.get(ROUTE_KEY(a, b));
    const g = gs?.find((x) => x.mode === prev) ?? gs?.[0];
    let pts: G.Pt[];
    let m = prev;
    if (g) {
      pts = g.a === a ? g.pts : g.pts.slice().reverse();
      m = g.mode;
    } else {
      const A = SITE_BY_ID[a];
      const B = SITE_BY_ID[b];
      pts = A && B ? [[A.x, A.y], [B.x, B.y]] : [];
    }
    if (pts.length < 2) continue;
    const cum = [0];
    for (let j = 1; j < pts.length; j++) cum.push(cum[j - 1] + Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]));
    legs.push({ pts, cum, len: cum[cum.length - 1], mode: m });
    prev = m;
  }
  const out = { legs, total: legs.reduce((s, l) => s + l.len, 0) };
  if (legCache.size > 500) legCache.clear();
  legCache.set(key, out);
  return out;
}

function shipPoint(legs: Leg[], s: number): { p: G.Pt; mode: string } | null {
  if (!legs.length) return null;
  let rest = Math.max(0, s);
  for (const l of legs) {
    if (rest <= l.len) return { p: G.pointAt(l, rest), mode: l.mode };
    rest -= l.len;
  }
  const last = legs[legs.length - 1];
  return { p: last.pts[last.pts.length - 1], mode: last.mode };
}

/** Vehicle outlines in screen pixels, pointing along +x. */
const VEHICLE: Record<string, string> = {
  // Locomotive and two wagons.
  rail: 'M6 -2.4H-1V2.4H6L7.5 1V-1ZM-2.5 -2.2H-8.5V2.2H-2.5ZM-10 -2.2H-16V2.2H-10Z',
  // A cargo ship: pointed bow, bridge aft.
  sea: 'M9 0L4 -3.4H-7L-8 -1.6V1.6L-7 3.4H4Z',
  // A truck: cab ahead of a box body.
  road: 'M6 -2.2H2.5V2.2H6L7 1V-1ZM1.5 -2.6H-7V2.6H1.5Z',
  // A transport aircraft.
  air: 'M8 0L5 -1H1L-3 -7H-5L-2.5 -1H-6L-8 -3H-9L-8 0L-9 3H-8L-6 1H-2.5L-5 7H-3L1 1H5Z',
};
const BRIDGE = 'M-5 -2H-2V2H-5Z';

const ShipmentsLayer = memo(function ShipmentsLayer({ S, shipments, clock, paused, aggregate }: { S: number; shipments: MapShipment[]; clock?: () => number; paused?: boolean; aggregate?: boolean }) {
  const k = 1 / S;
  // Redraw every frame while time is moving, so shipments glide instead of hopping a day at a time.
  const [now, setNow] = useState(() => clock?.() ?? 0);
  useEffect(() => {
    if (!clock || paused || aggregate) return;
    let raf = 0;
    let prev = -1;
    const loop = () => {
      const t = clock();
      if (Math.abs(t - prev) > 1e-4) {
        prev = t;
        setNow(t);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [clock, paused, aggregate]);

  if (aggregate) {
    // Zoomed out or on a small screen: one moving flow line per busy route instead of every vehicle.
    const count = new Map<string, { n: number; mode: string; d: string }>();
    for (const sh of shipments) {
      for (let i = 0; i < sh.path.length - 1; i++) {
        const gs = G.GEOMS_BY_KEY.get(ROUTE_KEY(sh.path[i], sh.path[i + 1]));
        const g = gs?.[0];
        if (!g) continue;
        const c = count.get(g.key) ?? { n: 0, mode: g.mode, d: g.d };
        c.n++;
        count.set(g.key, c);
      }
    }
    return (
      <g pointerEvents="none" fill="none" strokeLinecap="round">
        {[...count.entries()].map(([key, c]) => (
          <path key={key} className="fcm-flow" d={c.d} stroke={MODE_COLOR[c.mode] ?? ops('text')} strokeOpacity={0.85} strokeWidth={1.2 + Math.log2(1 + c.n) * 1.1} strokeDasharray="2 7" style={nss} />
        ))}
      </g>
    );
  }

  return (
    <g pointerEvents="none">
      {shipments.map((sh) => {
        const { legs, total } = legsFor(sh.path, sh.mode);
        const prog = clock && sh.depart !== undefined && sh.arrive !== undefined ? (now - sh.depart) / Math.max(0.5, sh.arrive - sh.depart) : sh.progress;
        const at = Math.max(0, Math.min(1, prog)) * total;
        const head = shipPoint(legs, at);
        if (!head) return null;
        const color = sh.color ?? MODE_COLOR[head.mode] ?? ops('text');
        const p = G.clampToFrame(head.p);
        const back = shipPoint(legs, Math.max(0, at - 3 * k))!.p;
        const ahead = at < total - 1e-6 ? shipPoint(legs, Math.min(total, at + 3 * k))!.p : p;
        const deg = (Math.atan2(ahead[1] - back[1], ahead[0] - back[0]) * 180) / Math.PI;
        const wake = head.mode === 'sea' ? [at - 22 * k, at - 10 * k, at].map((v) => G.clampToFrame(shipPoint(legs, v)!.p)) : null;
        return (
          <g key={sh.id}>
            {wake && <path d={G.linePath(wake)} fill="none" stroke="rgba(220, 236, 250, 0.35)" strokeWidth={2 * k} strokeLinecap="round" />}
            <g className="fcm-vehicle" transform={`translate(${p[0]} ${p[1]}) rotate(${deg}) scale(${k * 1.3})`}>
              <path d={VEHICLE[head.mode] ?? VEHICLE.road} fill={color} stroke="rgba(6, 11, 20, 0.95)" strokeWidth={1} strokeLinejoin="round" />
              {head.mode === 'sea' && <path d={BRIDGE} fill="rgba(6, 11, 20, 0.85)" />}
            </g>
          </g>
        );
      })}
    </g>
  );
});

// ---------- Weather, night and the minimap ----------

export type MapWeather = 'snow' | 'flood' | 'heat' | null;

const WeatherLayer = memo(function WeatherLayer({ uid, weather }: { uid: string; weather: MapWeather }) {
  if (!weather) return null;
  if (weather === 'snow')
    return (
      <g pointerEvents="none">
        {/* Snow lies thickest in the far north and thins out southwards. Gradients and clips only: masks are slow to draw. */}
        <g clipPath={`url(#${uid}-land)`}>
          <rect x={G.FRAME.x0} y={G.FRAME.y0} width={G.FRAME_W} height={300} fill={`url(#${uid}-northgrad)`} />
          <rect x={G.FRAME.x0} y={G.FRAME.y0} width={G.FRAME_W} height={170} fill={`url(#${uid}-snow)`} />
        </g>
        {/* Sea ice along the northern coast. */}
        <g clipPath={`url(#${uid}-seaclip)`}>
          <path d="M120 -10H800V40Q640 58 470 52T120 40Z" fill="rgba(220, 236, 250, 0.2)" />
          <path d="M120 -10H800V40Q640 58 470 52T120 40Z" fill={`url(#${uid}-ice)`} />
        </g>
      </g>
    );
  if (weather === 'flood')
    return (
      <g pointerEvents="none" clipPath={`url(#${uid}-land)`} fill="none" strokeLinecap="round" strokeLinejoin="round">
        {G.RIVERS.map((r, i) => (
          <path key={i} d={r.d} stroke="rgba(70, 160, 230, 0.3)" strokeWidth={r.order === 1 ? 9 : r.order === 2 ? 6 : 4} />
        ))}
        {G.LAKES.map((l, i) => (
          <path key={`l${i}`} d={l.d} fill="rgba(70, 160, 230, 0.25)" stroke="rgba(70, 160, 230, 0.3)" strokeWidth={4} />
        ))}
      </g>
    );
  return <path pointerEvents="none" d={G.geography().land} fill="rgba(255, 150, 70, 0.07)" />;
});

/** City lights for the night look. */
const NightLayer = memo(function NightLayer({ uid }: { uid: string }) {
  return (
    <g pointerEvents="none">
      {CITIES.map((c) => (
        <circle key={c.name} cx={c.x} cy={c.y} r={5 + Math.sqrt(c.pop) * 0.55} fill={`url(#${uid}-lights)`} />
      ))}
    </g>
  );
});

function Minimap({ view, size, onCenter }: { view: View; size: Size; onCenter: (x: number, y: number) => void }) {
  const w = size.w < 640 ? 96 : 144;
  const h = (w * G.FRAME_H) / G.FRAME_W;
  const vx = -view.tx / view.S;
  const vy = -view.ty / view.S;
  const vw = size.w / view.S;
  const vh = size.h / view.S;
  const drag = useRef(false);
  const at = (e: ReactPointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    onCenter(G.FRAME.x0 + ((e.clientX - r.left) / r.width) * G.FRAME_W, G.FRAME.y0 + ((e.clientY - r.top) / r.height) * G.FRAME_H);
  };
  return (
    <div data-hud="" className="fc-hud absolute p-1" style={{ right: (size.r ?? 0) + 12, bottom: (size.b ?? 0) + 32 }}>
      <svg
        width={w}
        height={h}
        viewBox={`${G.FRAME.x0} ${G.FRAME.y0} ${G.FRAME_W} ${G.FRAME_H}`}
        role="img"
        aria-label="Overview map. Click or drag to move the view."
        className="block cursor-pointer"
        onPointerDown={(e) => {
          e.stopPropagation();
          drag.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          at(e);
        }}
        onPointerMove={(e) => drag.current && at(e)}
        onPointerUp={() => (drag.current = false)}
        onPointerCancel={() => (drag.current = false)}
        onClick={(e) => e.stopPropagation()}
      >
        <rect x={G.FRAME.x0} y={G.FRAME.y0} width={G.FRAME_W} height={G.FRAME_H} fill={SEA} />
        <path d={G.geography().land} fill="#2b4654" stroke={COAST} strokeWidth={4} />
        <path d={G.ringPath(G.VARDAN_RING)} fill="rgba(242, 84, 91, 0.12)" />
        <rect x={vx} y={vy} width={vw} height={vh} fill="rgb(var(--ops-cyan) / 0.1)" stroke="rgb(var(--ops-cyan))" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

// ---------- Screen furniture ----------

function niceKm(target: number): number {
  for (const v of [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500]) if (v >= target) return v;
  return 500;
}

/** The fog the full-window map fades into (19.3): soft at the world's edge, solid beyond it to the screen's edges. */
const FOG = '#050a12';
const FOG_FADE = 46;
const FOG_REACH = 6000;
function EdgeFog({ uid }: { uid: string }) {
  const { x0, y0, x1, y1 } = G.FRAME;
  const R = FOG_REACH;
  const F = FOG_FADE;
  const fade = (id: string, x1g: string, y1g: string, x2g: string, y2g: string) => (
    <linearGradient id={`${uid}-${id}`} x1={x1g} y1={y1g} x2={x2g} y2={y2g}>
      <stop offset="0" stopColor={FOG} stopOpacity={1} />
      <stop offset="1" stopColor={FOG} stopOpacity={0} />
    </linearGradient>
  );
  return (
    <g pointerEvents="none">
      <defs>
        {fade('fogT', '0', '0', '0', '1')}
        {fade('fogB', '0', '1', '0', '0')}
        {fade('fogL', '0', '0', '1', '0')}
        {fade('fogR', '1', '0', '0', '0')}
      </defs>
      <path d={`M${x0 - R} ${y0 - R}H${x1 + R}V${y1 + R}H${x0 - R}Z M${x0} ${y0}V${y1}H${x1}V${y0}Z`} fill={FOG} fillRule="evenodd" />
      <rect x={x0} y={y0} width={x1 - x0} height={F} fill={`url(#${uid}-fogT)`} />
      <rect x={x0} y={y1 - F} width={x1 - x0} height={F} fill={`url(#${uid}-fogB)`} />
      <rect x={x0} y={y0} width={F} height={y1 - y0} fill={`url(#${uid}-fogL)`} />
      <rect x={x1 - F} y={y0} width={F} height={y1 - y0} fill={`url(#${uid}-fogR)`} />
    </g>
  );
}

const Furniture = memo(function Furniture({ view, size, boxes, quiet }: { view: View; size: Size; boxes: Box[]; quiet?: boolean }) {
  const { S, tx, ty } = view;
  const L = size.l ?? 0;
  const T = size.t ?? 0;
  const RR = size.r ?? 0;
  const B = size.b ?? 0;
  const ticks: { x?: number; y?: number; v: number }[] = [];
  const step = S < 0.6 ? 200 : S < 3 ? 100 : S < 6 ? 50 : 25;
  for (let v = 0; v <= G.FRAME.x1; v += step) {
    const x = v * S + tx;
    // On a narrow map the zoom buttons sit in a row along the top right: no ruler number under them.
    if (!quiet && x > L + 34 && x < size.w - RR - (size.w < 520 ? 170 : 60) && !clashes(smallTextBox(String(v), x + 3, T + 13, 8.5), boxes, tx, ty)) ticks.push({ x, v });
  }
  for (let v = 0; v <= G.FRAME.y1; v += step) {
    const y = v * S + ty;
    if (!quiet && y > T + 64 && y < size.h - B - 70 && !clashes(smallTextBox(String(v), L + 7, y - 3, 8.5), boxes, tx, ty)) ticks.push({ y, v });
  }
  // A short bar: on a phone a long one covers a corner of the country.
  const km = niceKm(60 / S);
  const bar = km * S;
  return (
    <g pointerEvents="none" fontFamily={FONT_MONO}>
      {ticks.map((t, i) =>
        t.x !== undefined ? (
          <g key={i}>
            <line x1={t.x} x2={t.x} y1={T} y2={T + 5} stroke={ops('cyan', 0.45)} />
            <text x={t.x + 3} y={T + 13} fontSize={8.5} fill={ops('dim')} {...halo(2.5)}>
              {t.v}
            </text>
          </g>
        ) : (
          <g key={i}>
            <line x1={L} x2={L + 5} y1={t.y} y2={t.y} stroke={ops('cyan', 0.45)} />
            <text x={L + 7} y={t.y! - 3} fontSize={8.5} fill={ops('dim')} {...halo(2.5)}>
              {t.v}
            </text>
          </g>
        ),
      )}
      {/* Scale and north arrow sit on a plate, so nothing on the map runs underneath their text. */}
      <g data-hud="">
      <rect x={L + 6} y={size.h - B - 52} width={Math.max(bar + 52, 120) + 22} height={46} rx={2} fill={ops('panel', 0.94)} stroke={ops('line', 0.9)} />
      <g transform={`translate(${L + 16} ${size.h - B - 22})`}>
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={(bar / 4) * i} y={0} width={bar / 4} height={4} fill={i % 2 ? 'rgba(6, 11, 20, 0.9)' : ops('text', 0.9)} stroke={ops('text', 0.9)} strokeWidth={0.8} />
        ))}
        <text x={0} y={-5} fontSize={9} fill={ops('dim')} {...halo(2.5)}>
          0
        </text>
        <text x={bar} y={-5} fontSize={9} textAnchor="middle" fill={ops('text')} {...halo(2.5)}>
          {km} km
        </text>
      </g>
      <g transform={`translate(${L + Math.max(bar + 52, 120)} ${size.h - B - 30})`}>
        <circle r={13} fill="rgba(6, 11, 20, 0.7)" stroke="rgb(var(--fc-bronze))" strokeOpacity={0.6} />
        <path d="M0 -10L4 3L0 0.5L-4 3Z" fill="#e8c68a" />
        <path d="M0 10L4 3L0 0.5L-4 3Z" fill="none" stroke="rgb(var(--fc-bronze))" strokeWidth={0.8} />
        <text y={-16} textAnchor="middle" fontFamily={FONT_HEAD} fontWeight={700} fontSize={11} fill="#e8c68a" {...halo(2.5)}>
          N
        </text>
      </g>
      </g>
    </g>
  );
});

const NO_LABELS: Record<string, Placed> = {};
const NO_CITY_LABELS: (Placed | null)[] = CITIES.map(() => null);

// ---------- The map ----------

export default function MapView(props: MapViewProps): JSX.Element {
  const { markers, shipments, routeUse, crisisRegion = null, selected, onSelect, layers, height = 560, network, showPlans = false, highlight = null, ripples = [], clock, weather = null } = props;
  const uid = `fcm${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const readoutRef = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState<Size>({ w: 0, h: 0 });
  const [view, setView] = useState<View>({ S: 1, tx: 0, ty: 0 });
  const viewRef = useRef(view);
  const sizeRef = useRef(size);
  const [relief, setRelief] = useState<string | null>(() => G.cachedRelief());
  const [focused, setFocused] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  /** The quick-action menu: which site, and where (in the map's own pixels). */
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const press = useRef<{ timer: number; x: number; y: number } | null>(null);
  const { hoverCard, quickMenu, related = null } = props;

  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  const apply = useCallback((v: View) => {
    const c = clampView(v, sizeRef.current);
    viewRef.current = c;
    setView(c);
  }, []);

  // Size and refit.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      const prev = sizeRef.current;
      const next = { ...prev, w: Math.round(r.width), h: Math.round(r.height) };
      if (next.w === prev.w && next.h === prev.h) return;
      sizeRef.current = next;
      setSize(next);
      if (prev.w === 0 || prev.h === 0) {
        apply(fitView(next));
      } else {
        // Keep the centre and relative zoom.
        const v = viewRef.current;
        const z = v.S / fitScale(prev);
        const a = safe(prev);
        const b = safe(next);
        const cx = (a.x + a.w / 2 - v.tx) / v.S;
        const cy = (a.y + a.h / 2 - v.ty) / v.S;
        const S = fitScale(next) * z;
        apply({ S, tx: b.x + b.w / 2 - cx * S, ty: b.y + b.h / 2 - cy * S });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [apply]);

  // The overlays moved (the panel opened or closed): take the new safe area, and keep the selected site in sight.
  const ins = props.insets;
  const insKey = ins ? `${ins.top},${ins.right},${ins.bottom},${ins.left}` : '';
  useEffect(() => {
    const next = { ...sizeRef.current, l: ins?.left ?? 0, t: ins?.top ?? 0, r: ins?.right ?? 0, b: ins?.bottom ?? 0, cover: !!props.bare };
    sizeRef.current = next;
    setSize(next);
    if (!next.w) return;
    const v = clampView(viewRef.current, next);
    const sel = selectedRef.current;
    if (sel && G.SITE_POS[sel]) {
      const [x, y] = markerAt(sel, v.S, spreadRef.current);
      const a = safe(next);
      const sx = x + v.tx;
      const sy = y + v.ty;
      if (sx < a.x + 24 || sx > a.x + a.w - 24 || sy < a.y + 24 || sy > a.y + a.h - 24) {
        animateTo({ S: v.S, tx: a.x + a.w / 2 - x, ty: a.y + a.h / 2 - y });
        return;
      }
    }
    apply(v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insKey]);

  // Relief is built after first paint.
  useEffect(() => {
    if (relief) return;
    let live = true;
    const t = window.setTimeout(() => {
      G.reliefImage().then((url) => {
        if (live) setRelief(url);
      });
    }, 30);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [relief]);

  // Animated moves for buttons and keyboard.
  const anim = useRef(0);
  const animateTo = useCallback(
    (target: View, ms = 220) => {
      cancelAnimationFrame(anim.current);
      const from = viewRef.current;
      const to = clampView(target, sizeRef.current);
      const t0 = performance.now();
      const step = (now: number) => {
        const p = Math.min(1, (now - t0) / ms);
        const e = 1 - Math.pow(1 - p, 3);
        const S = from.S * Math.pow(to.S / from.S, e);
        // Interpolate the screen centre in world space so zooms feel anchored.
        const { w, h } = sizeRef.current;
        const fx = (w / 2 - from.tx) / from.S;
        const fy = (h / 2 - from.ty) / from.S;
        const gx = (w / 2 - to.tx) / to.S;
        const gy = (h / 2 - to.ty) / to.S;
        const cx = fx + (gx - fx) * e;
        const cy = fy + (gy - fy) * e;
        const v = { S, tx: w / 2 - cx * S, ty: h / 2 - cy * S };
        viewRef.current = v;
        setView(v);
        if (p < 1) anim.current = requestAnimationFrame(step);
        else apply(to);
      };
      anim.current = requestAnimationFrame(step);
    },
    [apply],
  );
  useEffect(() => () => cancelAnimationFrame(anim.current), []);

  const zoomBy = useCallback((k: number) => {
    const a = safe(sizeRef.current);
    animateTo(zoomAbout(viewRef.current, a.x + a.w / 2, a.y + a.h / 2, k));
  }, [animateTo]);
  const reset = useCallback(() => animateTo(fitView(sizeRef.current), 300), [animateTo]);

  // Wheel zoom toward the cursor (non-passive so the page does not scroll).
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    // Wheel notches set a target; the view glides towards it a little each frame.
    let target: View | null = null;
    let raf = 0;
    const glide = () => {
      if (!target) return;
      const v = viewRef.current;
      const f = 0.28;
      const next = { S: v.S + (target.S - v.S) * f, tx: v.tx + (target.tx - v.tx) * f, ty: v.ty + (target.ty - v.ty) * f };
      const done = Math.abs(next.S / target.S - 1) < 0.002 && Math.abs(next.tx - target.tx) < 0.5 && Math.abs(next.ty - target.ty) < 0.5;
      apply(done ? target : next);
      if (done) target = null;
      else raf = requestAnimationFrame(glide);
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cancelAnimationFrame(anim.current);
      const r = el.getBoundingClientRect();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
      const k = Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0018));
      target = clampView(zoomAbout(target ?? viewRef.current, e.clientX - r.left, e.clientY - r.top, k), sizeRef.current);
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(glide);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('wheel', onWheel);
    };
  }, [apply, size.w > 0]);

  // Drag to pan, two pointers to pinch.
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ v: View; x: number; y: number; d: number } | null>(null);
  const moved = useRef(false);
  const captured = useRef(new Set<number>());

  const local = (e: { clientX: number; clientY: number }) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const startGesture = () => {
    const ps = [...ptrs.current.values()];
    if (ps.length === 0) {
      gesture.current = null;
      return;
    }
    const x = ps.reduce((s, p) => s + p.x, 0) / ps.length;
    const y = ps.reduce((s, p) => s + p.y, 0) / ps.length;
    const d = ps.length > 1 ? Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y) : 0;
    gesture.current = { v: viewRef.current, x, y, d };
  };
  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    cancelAnimationFrame(anim.current);
    if (ptrs.current.size === 0) moved.current = false;
    ptrs.current.set(e.pointerId, local(e));
    startGesture();
  };
  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const p = local(e);
    if (press.current && Math.hypot(p.x - press.current.x, p.y - press.current.y) > 8) {
      window.clearTimeout(press.current.timer);
      press.current = null;
    }
    const v = viewRef.current;
    if (readoutRef.current) {
      const wx = (p.x - v.tx) / v.S;
      const wy = (p.y - v.ty) / v.S;
      readoutRef.current.textContent = G.inFrame(wx, wy) ? `E ${wx.toFixed(0).padStart(3, '0')} · S ${Math.max(0, wy).toFixed(0).padStart(3, '0')} km` : 'off sheet';
    }
    if (!ptrs.current.has(e.pointerId)) return;
    ptrs.current.set(e.pointerId, p);
    const g = gesture.current;
    if (!g) return;
    const ps = [...ptrs.current.values()];
    const x = ps.reduce((s, q) => s + q.x, 0) / ps.length;
    const y = ps.reduce((s, q) => s + q.y, 0) / ps.length;
    if (!moved.current && Math.hypot(x - g.x, y - g.y) < 4 && ps.length < 2) return;
    if (!moved.current) {
      moved.current = true;
      setDragging(true);
    }
    for (const id of ptrs.current.keys()) {
      if (!captured.current.has(id)) {
        try {
          svgRef.current?.setPointerCapture(id);
          captured.current.add(id);
        } catch {
          // Pointer already gone.
        }
      }
    }
    let k = 1;
    if (ps.length > 1 && g.d > 0) k = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y) / g.d;
    const S = g.v.S * k;
    const wx = (g.x - g.v.tx) / g.v.S;
    const wy = (g.y - g.v.ty) / g.v.S;
    apply({ S, tx: x - wx * S, ty: y - wy * S });
  };
  const onPointerEnd = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (press.current) {
      window.clearTimeout(press.current.timer);
      press.current = null;
    }
    ptrs.current.delete(e.pointerId);
    if (captured.current.has(e.pointerId)) {
      captured.current.delete(e.pointerId);
      try {
        svgRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        // Already released.
      }
    }
    if (ptrs.current.size === 0) setDragging(false);
    startGesture();
  };
  const onBackgroundClick = () => {
    if (moved.current) return;
    onSelectRef.current(null);
  };
  const onDoubleClick = (e: ReactMouseEvent<SVGSVGElement>) => {
    const p = local(e);
    animateTo(zoomAbout(viewRef.current, p.x, p.y, 1.8));
  };

  const onActivate = useCallback((id: string, e: ReactMouseEvent | ReactKeyboardEvent) => {
    e.stopPropagation();
    if ('button' in e && moved.current) return;
    onSelectRef.current(id);
  }, []);
  const onFocusSite = useCallback(
    (id: string | null) => {
      setFocused(id);
      if (!id) return;
      // Bring a keyboard-focused marker into view.
      const [x, y] = G.SITE_POS[id];
      const v = viewRef.current;
      const { w, h } = sizeRef.current;
      const sx = x * v.S + v.tx;
      const sy = y * v.S + v.ty;
      if (sx < 40 || sy < 40 || sx > w - 40 || sy > h - 40) animateTo({ S: v.S, tx: w / 2 - x * v.S, ty: h / 2 - y * v.S });
    },
    [animateTo],
  );
  const onHover = useCallback((id: string | null) => setHovered(id), []);
  // The quick-action menu opens at the pointer, or beside the marker from the keyboard.
  const quickRef = useRef(quickMenu);
  quickRef.current = quickMenu;
  const onMenu = useCallback((id: string, at: { clientX: number; clientY: number } | null) => {
    if (!quickRef.current) return;
    const box = wrapRef.current?.getBoundingClientRect();
    if (!box) return;
    if (at) {
      setMenu({ id, x: at.clientX - box.left, y: at.clientY - box.top });
    } else {
      const v = viewRef.current;
      const [mx, my] = markerAt(id, v.S, spreadRef.current);
      setMenu({ id, x: mx + v.tx + 12, y: my + v.ty + 12 });
    }
  }, []);
  // A long press on a touch screen opens the menu too.
  const onPress = useCallback(
    (id: string, e: ReactPointerEvent) => {
      if (e.pointerType === 'mouse') return;
      if (press.current) window.clearTimeout(press.current.timer);
      const at = { clientX: e.clientX, clientY: e.clientY };
      const box = wrapRef.current?.getBoundingClientRect();
      press.current = {
        x: box ? at.clientX - box.left : 0,
        y: box ? at.clientY - box.top : 0,
        timer: window.setTimeout(() => {
          press.current = null;
          moved.current = true;
          onMenu(id, at);
        }, 550),
      };
    },
    [onMenu],
  );
  const closeMenu = useCallback(() => setMenu(null), []);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuFrom = useRef<HTMLElement | null>(null);
  // Open: keep the menu inside the map, and move the keyboard into it. Close: give focus back.
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!menu || !el) return;
    const { w, h } = sizeRef.current;
    el.style.left = `${Math.max(4, Math.min(w - el.offsetWidth - 4, menu.x))}px`;
    el.style.top = `${Math.max(4, Math.min(h - el.offsetHeight - 4, menu.y))}px`;
  }, [menu]);
  const menuId = menu?.id ?? null;
  useEffect(() => {
    if (!menuId) return;
    menuFrom.current = document.activeElement as HTMLElement | null;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')?.focus();
    return () => {
      const back = menuFrom.current;
      if (back && document.contains(back) && back.closest('.fcm-marker')) back.focus();
    };
  }, [menuId]);
  // Moving the map closes the menu: it would no longer point at its site.
  const viewSig = `${view.S}|${view.tx}|${view.ty}`;
  const menuView = useRef(viewSig);
  useEffect(() => {
    if (menu && menuView.current !== viewSig) setMenu(null);
    menuView.current = viewSig;
  }, [viewSig, menu]);
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(null);
    const onDown = (e: PointerEvent) => {
      if (!(e.target as HTMLElement | null)?.closest('[data-map-menu]')) setMenu(null);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown, true);
    };
  }, [menu]);

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const v = viewRef.current;
    const pan = (dx: number, dy: number) => animateTo({ S: v.S, tx: v.tx + dx, ty: v.ty + dy }, 140);
    switch (e.key) {
      case 'ArrowLeft': pan(80, 0); break;
      case 'ArrowRight': pan(-80, 0); break;
      case 'ArrowUp': pan(0, 80); break;
      case 'ArrowDown': pan(0, -80); break;
      case '+': case '=': zoomBy(1.6); break;
      case '-': case '_': zoomBy(1 / 1.6); break;
      case '0': reset(); break;
      case 'Escape':
        // With the quick menu open, Escape only closes it.
        if (menu) setMenu(null);
        else onSelectRef.current(null);
        break;
      default: return;
    }
    e.preventDefault();
  };

  const lod = lodOf(view.S);
  const S = view.S;
  // Labels are laid out for a settled zoom: while the view is zooming they rest, then reappear, collision-free.
  const [settledS, setSettledS] = useState(S);
  useEffect(() => {
    if (S === settledS) return;
    const t = setTimeout(() => setSettledS(S), 140);
    return () => clearTimeout(t);
  }, [S, settledS]);
  const zooming = Math.abs(S / settledS - 1) > 1e-6;
  const lodSettled = lodOf(settledS);

  // Web fonts change text widths: lay out again once they have loaded.
  const [fontsReady, setFontsReady] = useState(0);
  useEffect(() => {
    let live = true;
    document.fonts?.ready.then(() => {
      if (!live) return;
      resetTextWidths();
      setFontsReady((n) => n + 1);
    });
    return () => {
      live = false;
    };
  }, []);

  const hiddenSig = SITES.filter((s) => markers[s.id]?.hidden).map((s) => s.id).join(',');
  // Labels to show: hot sites always, the rest from medium zoom.
  const labelOrder = useMemo(() => {
    const hot = [selected, focused, hovered].filter((x, i, a): x is string => !!x && a.indexOf(x) === i && !!SITE_BY_ID[x]);
    if (!layers.labels) return hot;
    if (lodSettled < 1) return hot;
    const rank = (s: SiteDef) => (s.owner === 'state' ? (s.kind === 'arsenal' ? 0 : s.kind === 'depot' ? 1 : 2) : 3);
    const rest = SITES.filter((s) => !hot.includes(s.id) && !markers[s.id]?.hidden).sort((a, b) => rank(a) - rank(b)).map((s) => s.id);
    return [...hot, ...rest];
  }, [selected, focused, hovered, layers.labels, lodSettled, hiddenSig]);
  const hotIds = useMemo(() => [selected, focused, hovered].filter((x, i, a): x is string => !!x && a.indexOf(x) === i && !!SITE_BY_ID[x]), [selected, focused, hovered]);
  const badgeSig = SITES.map((s) => markers[s.id]?.badge ?? '').join('|');
  const hidden = useMemo(() => new Set(hiddenSig ? hiddenSig.split(',') : []), [hiddenSig]);
  const nameSig = SITES.map((s) => `${markers[s.id]?.name ?? ''}:${markers[s.id]?.kind ?? ''}`).join('|');
  // Labels are laid out for the settled zoom; markers are spaced at the live zoom every frame, so they never touch.
  const spread = useMemo(() => spreadMarkers(settledS, Object.fromEntries(SITES.map((s) => [s.id, markers[s.id]?.badge])), hidden), [settledS, badgeSig, hidden]);
  // While a pinch or wheel zoom is moving, the spacing is worked out for a zoom just below the live one (in steps of
  // about 9%) and kept: a little more room than needed, never less, without redoing the whole layout every frame.
  const spreadCache = useRef(new Map<string, Record<string, [number, number]>>());
  const liveSpread = useMemo(() => {
    if (S === settledS) return spread;
    const q = 2 ** (Math.floor(Math.log2(S) * 8) / 8);
    const key = `${q}#${badgeSig}#${hiddenSig}`;
    const cache = spreadCache.current;
    let hit = cache.get(key);
    if (!hit) {
      if (cache.size > 48) cache.clear();
      hit = spreadMarkers(q, Object.fromEntries(SITES.map((s) => [s.id, markers[s.id]?.badge])), hidden);
      cache.set(key, hit);
    }
    return hit;
  }, [S, settledS, spread, badgeSig, hidden, hiddenSig]);
  const spreadRef = useRef(liveSpread);
  spreadRef.current = liveSpread;
  const placement = useMemo(
    () =>
      layoutMap({
        S: settledS,
        lod: lodSettled,
        labels: layers.labels,
        regions: layers.regions,
        order: labelOrder,
        hot: hotIds,
        selected,
        badges: Object.fromEntries(SITES.map((s) => [s.id, markers[s.id]?.badge])),
        spread,
        hidden,
        names: Object.fromEntries(SITES.filter((s) => markers[s.id]?.name).map((s) => [s.id, markers[s.id]!.name!])),
        kinds: Object.fromEntries(SITES.filter((s) => markers[s.id]?.kind).map((s) => [s.id, markers[s.id]!.kind!])),
      }),
    [settledS, lodSettled, layers.labels, layers.regions, labelOrder, hotIds, selected, badgeSig, spread, fontsReady, hidden, nameSig],
  );

  const netSig = network ? `${network.built.join(',')}|${Object.entries(network.upgrades).map(([k, v]) => `${k}=${v}`).join(',')}|${network.building.join(',')}|${network.upgrading.join(',')}` : '';
  const useSig = `${routeUse ? Object.entries(routeUse).map(([k, v]) => `${k}:${v >= 0.85 ? 2 : v >= 0.6 ? 1 : 0}`).join(',') : ''}#${netSig}#${showPlans ? 1 : 0}#${highlight ?? ''}`;

  return (
    <div
      ref={wrapRef}
      className={`relative w-full select-none overflow-hidden ${props.bare ? 'bg-[#050a12]' : 'bg-[#040912]'} outline-none ${props.bare ? 'focus-visible:shadow-[inset_0_0_0_2px_rgb(var(--ops-cyan)/0.6)]' : 'rounded-md border border-ops-line focus-visible:ring-1 focus-visible:ring-ops-cyan/60'}`}
      style={{ height }}
      tabIndex={0}
      role="region"
      aria-label={`Map of the ${countryTitle()}. Arrow keys pan, plus and minus zoom, 0 resets, Tab moves between sites.`}
      onKeyDown={onKeyDown}
    >
      <style>{LOD_CSS}</style>
      {size.w > 0 && (
        <svg
          ref={svgRef}
          className="fcm absolute inset-0 block"
          data-lod={lod}
          width={size.w}
          height={size.h}
          style={{ touchAction: 'none', cursor: dragging ? 'grabbing' : 'grab' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onPointerLeave={() => {
            if (readoutRef.current) readoutRef.current.textContent = '';
          }}
          onClick={onBackgroundClick}
          onDoubleClick={onDoubleClick}
        >
          <Defs uid={uid} />
          <g transform={`translate(${view.tx} ${view.ty}) scale(${S})`}>
            <g clipPath={`url(#${uid}-frame)`}>
              <g style={layers.night ? { filter: 'brightness(0.5) saturate(0.75)' } : undefined}>
                <StaticGeo uid={uid} terrain={layers.terrain} relief={relief} />
              </g>
              {layers.weather && <WeatherLayer uid={uid} weather={weather} />}
              {layers.night && <NightLayer uid={uid} />}
              <RegionLayer uid={uid} show={layers.regions} crisis={crisisRegion} />
              <RoutesLayer layers={layers} use={routeUse} sig={useSig} network={network} showPlans={showPlans} highlight={highlight} />
            </g>
            {/* The full-window map (19.3) has no sheet: the world fades into fog at its edges and the fog runs to the screen's. */}
            {props.bare && <EdgeFog uid={uid} />}
            {/* The sheet's frame (17.2): a bronze double neatline with brackets at the corners, a constant size on screen. */}
            {!props.bare && (
            <>
            <rect x={G.FRAME.x0} y={G.FRAME.y0} width={G.FRAME_W} height={G.FRAME_H} fill="none" stroke="rgb(var(--fc-bronze))" strokeOpacity={0.55} strokeWidth={1} style={nss} />
            <rect x={G.FRAME.x0 - 5 / S} y={G.FRAME.y0 - 5 / S} width={G.FRAME_W + 10 / S} height={G.FRAME_H + 10 / S} fill="none" stroke="rgb(var(--fc-bronze))" strokeOpacity={0.3} strokeWidth={1} style={nss} />
            <path
              d={(() => {
                const L = 22 / S;
                const o = 5 / S;
                const [x0, y0, x1, y1] = [G.FRAME.x0 - o, G.FRAME.y0 - o, G.FRAME.x1 + o, G.FRAME.y1 + o];
                return `M${x0} ${y0 + L}V${y0}H${x0 + L}M${x1 - L} ${y0}H${x1}V${y0 + L}M${x1} ${y1 - L}V${y1}H${x1 - L}M${x0 + L} ${y1}H${x0}V${y1 - L}`;
              })()}
              fill="none"
              stroke="#e0b874"
              strokeWidth={2}
              strokeLinecap="square"
              style={nss}
              pointerEvents="none"
            />
            </>
            )}
            {layers.flows && <ShipmentsLayer S={S} shipments={shipments} clock={clock} paused={dragging || zooming} aggregate={size.w < 640 ? lod <= 1 : S < 0.9} />}
            {!zooming && <LabelsLayer S={S} geo={placement.geo} regions={placement.regions} exits={placement.exits} />}
            <CitiesLayer S={S} placed={zooming ? NO_CITY_LABELS : placement.cities} />
            <g pointerEvents="none" style={dragging || zooming ? { display: 'none' } : undefined}>
              {ripples.map((r) => {
                if (!G.SITE_POS[r.site]) return null;
                const [x, y] = markerAt(r.site, S, liveSpread);
                if (r.big) return <circle key={r.key} className="fcm-ripple fcm-ripple-big" cx={x / S} cy={y / S} r={(markerPx(S) * 1.4) / S} fill="none" stroke="rgb(var(--fc-bronze))" strokeWidth={3} style={nss} />;
                return <circle key={r.key} className="fcm-ripple" cx={x / S} cy={y / S} r={markerPx(S) / S} fill="none" stroke={r.tone === 'bad' ? ops('red') : r.tone === 'good' ? ops('green') : r.tone === 'warn' ? ops('amber') : ops('cyan')} strokeWidth={2} style={nss} />;
              })}
            </g>
            {related && selected && G.SITE_POS[selected] && !zooming && (
              <g pointerEvents="none" aria-hidden="true">
                {(['up', 'down'] as const).flatMap((dir) =>
                  related[dir].map((id) => {
                    if (!G.SITE_POS[id] || markers[id]?.hidden) return null;
                    const [ax, ay] = markerAt(selected, S, liveSpread);
                    const [bx, by] = markerAt(id, S, liveSpread);
                    const col = dir === 'up' ? ops('amber', 0.8) : ops('cyan', 0.8);
                    return (
                      <g key={`${dir}-${id}`}>
                        <line x1={ax / S} y1={ay / S} x2={bx / S} y2={by / S} stroke={col} strokeWidth={1.4} strokeDasharray="5 4" style={nss} />
                        <circle cx={bx / S} cy={by / S} r={(markerPx(S) / 2 + 5) / S} fill="none" stroke={col} strokeWidth={1.5} style={nss} />
                      </g>
                    );
                  }),
                )}
              </g>
            )}
            <SitesLayer S={S} markers={markers} selected={selected} focused={focused} hovered={hovered} labelIds={zooming ? NO_LABELS : placement.sites} spread={liveSpread} onActivate={onActivate} onFocusSite={onFocusSite} onHover={onHover} onMenu={onMenu} onPress={onPress} />
          </g>
          <Furniture view={view} size={size} boxes={placement.boxes} quiet={zooming || !!props.bare} />
        </svg>
      )}
      <div data-hud="" className={`fc-hud pointer-events-none absolute px-2.5 py-1.5 ${size.w < 520 ? 'hidden' : ''}`} style={{ left: (size.l ?? 0) + 12, top: (size.t ?? 0) + 12 }}>
        <div className="font-sans text-[14px] font-bold uppercase leading-none tracking-[0.16em] text-ops-amber">{countryTitle()}</div>
        <div className="mt-1 text-[9px] uppercase tracking-[0.14em] text-ops-dim">Defence logistics · grid km</div>
      </div>
      {hoverCard && hovered && !markers[hovered]?.hidden && !menu && !dragging && !zooming && G.SITE_POS[hovered] && size.w >= 480 && (() => {
        const [mx, my] = markerAt(hovered, S, liveSpread);
        const x = mx + view.tx;
        const y = my + view.ty;
        // Beside the marker, on whichever side has room; above it in the lower half of the map.
        const left = x > size.w - 280 ? undefined : x + 16;
        const right = x > size.w - 280 ? size.w - x + 16 : undefined;
        const top = y < size.h / 2 ? Math.max(8, y - 20) : undefined;
        const bottom = y < size.h / 2 ? undefined : Math.max(8, size.h - y - 20);
        return (
          <div className="pointer-events-none absolute z-20 max-h-[calc(100%-16px)] overflow-hidden fc-hud p-2" style={{ left, right, top, bottom }} role="tooltip">
            {hoverCard(hovered)}
          </div>
        );
      })()}
      {quickMenu && menu && (
        <div
          ref={menuRef}
          data-map-menu=""
          role="menu"
          aria-label="Quick actions"
          className="absolute z-30 max-h-[calc(100%-8px)] min-w-[180px] max-w-[260px] overflow-y-auto fc-hud p-1"
          style={{ left: menu.x, top: menu.y }}
          onKeyDown={(e) => {
            // Up and down move between the actions; Escape and Tab close the menu.
            const items = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? [])];
            const i = items.indexOf(document.activeElement as HTMLElement);
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              e.stopPropagation();
              items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % Math.max(1, items.length)]?.focus();
            } else if (e.key === 'Escape' || e.key === 'Tab') {
              e.preventDefault();
              e.stopPropagation();
              setMenu(null);
            }
          }}
        >
          {quickMenu(menu.id, closeMenu)}
        </div>
      )}
      {/* On a narrow map the buttons sit in a row, in the strip of sea above the country, so they never cover a label. */}
      <div data-hud="" className={`absolute flex gap-1 ${size.w < 520 ? 'flex-row' : 'flex-col'}`} style={{ right: (size.r ?? 0) + 12, top: (size.t ?? 0) + 12 }}>
        <button type="button" className="btn h-7 w-7 px-0" onClick={() => zoomBy(1.6)} aria-label="Zoom in" title="Zoom in (+)">
          <Icon name="zoomIn" />
        </button>
        <button type="button" className="btn h-7 w-7 px-0" onClick={() => zoomBy(1 / 1.6)} aria-label="Zoom out" title="Zoom out (−)">
          <Icon name="zoomOut" />
        </button>
        <button type="button" className="btn h-7 w-7 px-0" onClick={reset} aria-label="Reset view" title="Reset view (0)">
          <Icon name="recenter" />
        </button>
      </div>
      {size.w >= 420 && size.w > 0 && (
        <Minimap
          view={view}
          size={size}
          onCenter={(x, y) => {
            const v = viewRef.current;
            const a = safe(sizeRef.current);
            apply(clampView({ S: v.S, tx: a.x + a.w / 2 - x * v.S, ty: a.y + a.h / 2 - y * v.S }, sizeRef.current));
          }}
        />
      )}
      <div data-hud="" className="fc-hud pointer-events-none absolute px-1.5 py-0.5 font-mono text-[9.5px] tracking-wider text-ops-dim" style={{ right: (size.r ?? 0) + 12, bottom: (size.b ?? 0) + 8 }}>
        <span ref={readoutRef} />
        <span className="ml-2 text-ops-dim">×{(S / Math.max(0.0001, fitScale(size))).toFixed(1)}</span>
      </div>
    </div>
  );
}

// ---------- Layer toggles and legend ----------

const LAYER_LABEL: [keyof MapLayers, string, string | null][] = [
  ['terrain', 'Terrain', null],
  ['labels', 'Labels', null],
  ['rail', 'Rail', RAIL],
  ['road', 'Road', ROAD],
  ['sea', 'Sea', ops('cyan')],
  ['air', 'Air', ops('violet')],
  ['flows', 'Flows', ops('amber')],
  ['regions', 'Regions', ops('blue')],
  ['weather', 'Weather', null],
  ['night', 'Night', null],
];

export function MapLayerToggles({ layers, onChange, className = '' }: { layers: MapLayers; onChange: (next: MapLayers) => void; className?: string }) {
  // Two groups: how the map is drawn, and which networks are on it.
  const groups: [string, (keyof MapLayers)[]][] = [
    ['Map', ['terrain', 'labels', 'weather', 'night']],
    ['Networks', ['rail', 'road', 'sea', 'air', 'flows', 'regions']],
  ];
  return (
    <div className={`flex min-w-0 max-w-full items-center gap-x-3 gap-y-1 overflow-x-auto md:flex-wrap md:overflow-visible ${className}`} role="group" aria-label="Map layers">
      {groups.map(([name, keys]) => (
        <div key={name} className="flex shrink-0 items-center gap-1.5">
          <span className="label hidden min-[1280px]:inline">{name}</span>
          <div className="seg" role="group" aria-label={`${name} layers`}>
            {keys.map((k) => {
              const [, label, c] = LAYER_LABEL.find(([id]) => id === k)!;
              return (
                <button key={k} type="button" className={`btn min-h-[24px] px-2 py-0.5 text-[10px] md:min-h-0 ${layers[k] ? 'btn-active' : 'text-ops-dim'}`} aria-pressed={layers[k]} onClick={() => onChange({ ...layers, [k]: !layers[k] })}>
                  {c && <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: c, opacity: layers[k] ? 1 : 0.4 }} />}
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function RouteSwatch({ mode }: { mode: 'rail' | 'road' | 'sea' | 'air' }) {
  return (
    <svg width={34} height={10} aria-hidden="true">
      {mode === 'rail' && (
        <>
          <path d="M2 5H32" stroke="rgba(6, 11, 20, 0.8)" strokeWidth={3.6} />
          <path d="M2 5H32" stroke={RAIL} strokeWidth={1.3} />
          <path d="M2 5H32" stroke={RAIL} strokeWidth={5} strokeDasharray="1 5" />
        </>
      )}
      {mode === 'road' && (
        <>
          <path d="M2 5H32" stroke="rgba(6, 11, 20, 0.9)" strokeWidth={3.6} strokeLinecap="round" />
          <path d="M2 5H32" stroke={ROAD} strokeWidth={1.7} strokeLinecap="round" />
        </>
      )}
      {mode === 'sea' && <path d="M2 5H32" stroke={ops('cyan', 0.75)} strokeWidth={1.3} strokeDasharray="7 5" />}
      {mode === 'air' && <path d="M2 8Q17 0 32 8" fill="none" stroke={ops('violet', 0.8)} strokeWidth={1} strokeDasharray="2 3" />}
    </svg>
  );
}

export function MapLegend({ className = 'panel p-3' }: { className?: string }) {
  return (
    <div className={`text-[11px] ${className}`}>
      <div className="label mb-1.5">Sites</div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3">
        {SITE_KINDS.map((k) => (
          <div key={k} className="flex items-center gap-1.5 text-ops-text">
            <SiteIconSvg kind={k} size={16} className="shrink-0 text-ops-cyan" />
            <span className="truncate">{KIND_LABEL[k]}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <div className="label mb-1.5">Transport</div>
          {(['rail', 'road', 'sea', 'air'] as const).map((m) => (
            <div key={m} className="flex items-center gap-2 text-ops-text">
              <RouteSwatch mode={m} />
              <span className="capitalize">{m}</span>
            </div>
          ))}
          <div className="mt-1 flex items-center gap-2 text-ops-dim">
            <span className="inline-block h-1 w-[34px] rounded bg-ops-amber" /> busy
            <span className="inline-block h-1 w-3 rounded bg-ops-red" /> jammed
          </div>
        </div>
        <div>
          <div className="label mb-1.5">Status</div>
          {(
            [
              ['ok', 'Running'],
              ['warn', 'Strained'],
              ['bad', 'Down'],
              ['idle', 'Idle'],
            ] as const
          ).map(([t, l]) => (
            <div key={t} className="flex items-center gap-2 text-ops-text">
              <span className="inline-block h-2.5 w-2.5 rounded-sm border" style={{ borderColor: TONE_COLOR[t], background: `color-mix(in srgb, ${TONE_COLOR[t]} 25%, transparent)` }} />
              {l}
            </div>
          ))}
          {(
            [
              ['?', 'Not qualified'],
              ['!', 'Rounds to retire'],
              ['CP', 'Chokepoint'],
            ] as const
          ).map(([b, l]) => (
            <div key={b} className="flex items-center gap-2 text-ops-text">
              <span className="inline-block rounded-full px-1 font-mono text-[9px] font-bold leading-[13px] text-[#06111f]" style={{ background: TONE_COLOR.ok }}>{b}</span>
              {l}
            </div>
          ))}
        </div>
        <div>
          <div className="label mb-1.5">Owner</div>
          <div className="flex items-center gap-2 text-ops-text">
            <svg width={12} height={12} aria-hidden="true"><rect x={1} y={1} width={10} height={10} rx={2} fill="none" stroke={OWNER_COLOR.state} strokeWidth={1.5} /></svg>
            State
          </div>
          <div className="flex items-center gap-2 text-ops-text">
            <svg width={12} height={12} aria-hidden="true"><circle cx={6} cy={6} r={5} fill="none" stroke={OWNER_COLOR.private} strokeWidth={1.5} /></svg>
            Private
          </div>
          <div className="flex items-center gap-2 text-ops-text">
            <svg width={12} height={12} aria-hidden="true"><path d="M6 0.8L11.2 6L6 11.2L0.8 6Z" fill="none" stroke={OWNER_COLOR.foreign} strokeWidth={1.5} /></svg>
            Foreign
          </div>
          <div className="mt-1 flex items-center gap-2 text-ops-text">
            <svg width={12} height={12} aria-hidden="true"><circle cx={6} cy={6} r={3} fill={ops('amber')} /><circle cx={6} cy={6} r={5.2} fill="none" stroke="#e8f0fa" /></svg>
            Capital
          </div>
        </div>
      </div>
    </div>
  );
}
