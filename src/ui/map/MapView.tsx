// Operational map of the Commonwealth of Aldmere: static geography, transport network, sites, shipments.

import { memo, useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { CITIES, REGIONS, ROUTE_KEY, SITES, SITE_BY_ID, type RegionId, type SiteDef, type SiteKind } from '../../sim/world';
import * as G from './geo';
import { KIND_LABEL, SITE_KINDS, SiteIcon, SiteIconSvg } from './icons';
import { FONT_HEAD, FONT_MONO, SITE_FONT, SITE_SUB_FONT, SITE_SUB_GAP, EXIT_FIRST_GAP, EXIT_LINE_GAP, cityDot, citySize, clashes, kindLine, layoutMap, markerAt, markerPx, resetTextWidths, smallTextBox, spreadMarkers, uiScale, type Box, type ExitGroup, type Layout, type Placed } from './layout';

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
export interface MapRipple { key: string; site: string; tone: 'good' | 'bad' | 'warn' | 'info' }

export interface MapViewProps {
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
const REGION_COLOR: Record<RegionId, string> = { north: ops('blue'), coast: ops('cyan'), east: ops('amber'), isles: ops('violet'), central: ops('green') };
const FIGHTING: RegionId[] = ['north', 'coast', 'east', 'isles'];


// ---------- View maths ----------

interface View { S: number; tx: number; ty: number }
interface Size { w: number; h: number }

const MIN_Z = 0.85;
const MAX_Z = 14;

const fitScale = (sz: Size) => Math.max(0.05, Math.min((sz.w - 16) / G.FRAME_W, (sz.h - 16) / G.FRAME_H));

function fitView(sz: Size): View {
  const S = fitScale(sz);
  return { S, tx: (sz.w - G.FRAME_W * S) / 2 - G.FRAME.x0 * S, ty: (sz.h - G.FRAME_H * S) / 2 - G.FRAME.y0 * S };
}

function clampAxis(t: number, S: number, a0: number, a1: number, len: number): number {
  const m = 48;
  const span = (a1 - a0) * S;
  if (span <= len - 2 * m) return (len - span) / 2 - a0 * S;
  return Math.max(len - m - a1 * S, Math.min(m - a0 * S, t));
}

function clampView(v: View, sz: Size): View {
  const s0 = fitScale(sz);
  const S = Math.max(s0 * MIN_Z, Math.min(s0 * MAX_Z, v.S));
  return { S, tx: clampAxis(v.tx, S, G.FRAME.x0, G.FRAME.x1, sz.w), ty: clampAxis(v.ty, S, G.FRAME.y0, G.FRAME.y1, sz.h) };
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
@keyframes fcm-flow{to{stroke-dashoffset:-18}}
.fcm-flow{animation:fcm-flow 1.4s linear infinite}
.fcm-marker:hover .fcm-mbody{stroke-width:2.2}
@media (prefers-reduced-motion:reduce){.fcm-pulse,.fcm-crisis,.fcm-build,.fcm-flow{animation:none}.fcm-ripple{display:none}}
`;

// ---------- Static layers ----------

const Defs = memo(function Defs({ uid }: { uid: string }) {
  const geo = G.geography();
  return (
    <defs>
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
}

const SitesLayer = memo(function SitesLayer({ S, markers, selected, focused, hovered, labelIds, spread, onActivate, onFocusSite, onHover }: SitesLayerProps) {
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
        const body =
          s.owner === 'state' ? (
            <rect className="fcm-mbody" x={-h} y={-h} width={m} height={m} rx={3.5} fill="#0a1322" stroke={col} strokeWidth={1.5} />
          ) : s.owner === 'foreign' ? (
            <path className="fcm-mbody" d={`M0 ${-h - 2}L${h + 2} 0L0 ${h + 2}L${-h - 2} 0Z`} fill="#0a1322" stroke={col} strokeWidth={1.5} />
          ) : (
            <circle className="fcm-mbody" r={h + 0.5} fill="#0a1322" stroke={col} strokeWidth={1.5} />
          );
        return (
          <g
            key={s.id}
            className="fcm-marker"
            transform={`translate(${x} ${y}) scale(${k})`}
            tabIndex={0}
            role="button"
            aria-label={`${mk?.name ?? s.name}, ${KIND_LABEL[mk?.kind ?? s.kind]}${s.nation ? `, ${s.nation}` : ''}${mk?.badge ? `, ${mk.badge}` : ''}`}
            aria-pressed={sel}
            onClick={(e) => onActivate(s.id, e)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onActivate(s.id, e);
              }
            }}
            onFocus={() => onFocusSite(s.id)}
            onBlur={() => onFocusSite(null)}
            onPointerEnter={() => onHover(s.id)}
            onPointerLeave={() => onHover(null)}
          >
            <circle r={h + 6} fill="transparent" />
            {mk?.pulse && <circle className="fcm-pulse" r={h + 1} fill="none" stroke={col} strokeWidth={2} />}
            {sel && (
              <g stroke={ops('cyan')} strokeWidth={2} fill="none" strokeLinecap="round">
                <circle r={h + 7} stroke={ops('cyan', 0.25)} strokeWidth={6} />
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
              <text x={p.x} y={p.y} textAnchor={p.anchor} fontFamily={FONT_MONO} fontWeight={hot ? 700 : 500} fontSize={SITE_FONT} fill={id === selected ? ops('cyan') : hot ? '#ffffff' : ops('text', 0.92)} {...halo(3)}>
                {mk?.name ?? s.name}
              </text>
              {hot && (
                <text x={p.x} y={p.y + SITE_SUB_GAP} textAnchor={p.anchor} fontFamily={FONT_MONO} fontSize={SITE_SUB_FONT} letterSpacing="0.1em" fill={ops('dim')} {...halo(2.5)}>
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
    <div data-hud="" className="absolute bottom-8 right-3 rounded border border-ops-line/80 bg-ops-bg p-1">
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

const Furniture = memo(function Furniture({ view, size, boxes, quiet }: { view: View; size: Size; boxes: Box[]; quiet?: boolean }) {
  const { S, tx, ty } = view;
  const ticks: { x?: number; y?: number; v: number }[] = [];
  const step = S < 0.6 ? 200 : S < 3 ? 100 : S < 6 ? 50 : 25;
  for (let v = 0; v <= G.FRAME.x1; v += step) {
    const x = v * S + tx;
    if (!quiet && x > 34 && x < size.w - 60 && !clashes(smallTextBox(String(v), x + 3, 13, 8.5), boxes, tx, ty)) ticks.push({ x, v });
  }
  for (let v = 0; v <= G.FRAME.y1; v += step) {
    const y = v * S + ty;
    if (!quiet && y > 64 && y < size.h - 70 && !clashes(smallTextBox(String(v), 7, y - 3, 8.5), boxes, tx, ty)) ticks.push({ y, v });
  }
  const km = niceKm(90 / S);
  const bar = km * S;
  return (
    <g pointerEvents="none" fontFamily={FONT_MONO}>
      {ticks.map((t, i) =>
        t.x !== undefined ? (
          <g key={i}>
            <line x1={t.x} x2={t.x} y1={0} y2={5} stroke={ops('cyan', 0.45)} />
            <text x={t.x + 3} y={13} fontSize={8.5} fill={ops('dim')} {...halo(2.5)}>
              {t.v}
            </text>
          </g>
        ) : (
          <g key={i}>
            <line x1={0} x2={5} y1={t.y} y2={t.y} stroke={ops('cyan', 0.45)} />
            <text x={7} y={t.y! - 3} fontSize={8.5} fill={ops('dim')} {...halo(2.5)}>
              {t.v}
            </text>
          </g>
        ),
      )}
      {/* Scale and north arrow sit on a plate, so nothing on the map runs underneath their text. */}
      <g data-hud="">
      <rect x={6} y={size.h - 52} width={Math.max(bar + 52, 120) + 22} height={46} rx={4} fill="#060b14" stroke={ops('line', 0.8)} />
      <g transform={`translate(16 ${size.h - 22})`}>
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
      <g transform={`translate(${Math.max(bar + 52, 120)} ${size.h - 30})`}>
        <circle r={13} fill="rgba(6, 11, 20, 0.7)" stroke={ops('cyan', 0.4)} />
        <path d="M0 -10L4 3L0 0.5L-4 3Z" fill={ops('cyan')} />
        <path d="M0 10L4 3L0 0.5L-4 3Z" fill="none" stroke={ops('cyan', 0.6)} strokeWidth={0.8} />
        <text y={-16} textAnchor="middle" fontFamily={FONT_HEAD} fontWeight={700} fontSize={11} fill={ops('cyan')} {...halo(2.5)}>
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

  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

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
      const next = { w: Math.round(r.width), h: Math.round(r.height) };
      const prev = sizeRef.current;
      if (next.w === prev.w && next.h === prev.h) return;
      sizeRef.current = next;
      setSize(next);
      if (prev.w === 0 || prev.h === 0) {
        apply(fitView(next));
      } else {
        // Keep the centre and relative zoom.
        const v = viewRef.current;
        const z = v.S / fitScale(prev);
        const cx = (prev.w / 2 - v.tx) / v.S;
        const cy = (prev.h / 2 - v.ty) / v.S;
        const S = fitScale(next) * z;
        apply({ S, tx: next.w / 2 - cx * S, ty: next.h / 2 - cy * S });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [apply]);

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
    const { w, h } = sizeRef.current;
    animateTo(zoomAbout(viewRef.current, w / 2, h / 2, k));
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
      case 'Escape': onSelectRef.current(null); break;
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

  // Labels to show: hot sites always, the rest from medium zoom.
  const labelOrder = useMemo(() => {
    const hot = [selected, focused, hovered].filter((x, i, a): x is string => !!x && a.indexOf(x) === i && !!SITE_BY_ID[x]);
    if (!layers.labels) return hot;
    if (lodSettled < 1) return hot;
    const rank = (s: SiteDef) => (s.owner === 'state' ? (s.kind === 'arsenal' ? 0 : s.kind === 'depot' ? 1 : 2) : 3);
    const rest = SITES.filter((s) => !hot.includes(s.id) && !markers[s.id]?.hidden).sort((a, b) => rank(a) - rank(b)).map((s) => s.id);
    return [...hot, ...rest];
  }, [selected, focused, hovered, layers.labels, lodSettled, markers]);
  const hotIds = useMemo(() => [selected, focused, hovered].filter((x, i, a): x is string => !!x && a.indexOf(x) === i && !!SITE_BY_ID[x]), [selected, focused, hovered]);
  const badgeSig = SITES.map((s) => markers[s.id]?.badge ?? '').join('|');
  const hiddenSig = SITES.filter((s) => markers[s.id]?.hidden).map((s) => s.id).join(',');
  const hidden = useMemo(() => new Set(hiddenSig ? hiddenSig.split(',') : []), [hiddenSig]);
  const nameSig = SITES.map((s) => `${markers[s.id]?.name ?? ''}:${markers[s.id]?.kind ?? ''}`).join('|');
  // Labels are laid out for the settled zoom; markers are spaced at the live zoom every frame, so they never touch.
  const spread = useMemo(() => spreadMarkers(settledS, Object.fromEntries(SITES.map((s) => [s.id, markers[s.id]?.badge])), hidden), [settledS, badgeSig, hidden]);
  const liveSpread = useMemo(() => (S === settledS ? spread : spreadMarkers(S, Object.fromEntries(SITES.map((s) => [s.id, markers[s.id]?.badge])), hidden)), [S, settledS, spread, badgeSig, hidden]);
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
      className="relative w-full select-none overflow-hidden rounded-md border border-ops-line bg-[#040912] outline-none focus-visible:ring-1 focus-visible:ring-ops-cyan/60"
      style={{ height }}
      tabIndex={0}
      role="region"
      aria-label="Map of the Commonwealth of Aldmere. Arrow keys pan, plus and minus zoom, 0 resets, Tab moves between sites."
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
            <rect x={G.FRAME.x0} y={G.FRAME.y0} width={G.FRAME_W} height={G.FRAME_H} fill="none" stroke={ops('cyan', 0.35)} strokeWidth={1} style={nss} />
            <rect x={G.FRAME.x0 - 4 / S} y={G.FRAME.y0 - 4 / S} width={G.FRAME_W + 8 / S} height={G.FRAME_H + 8 / S} fill="none" stroke={ops('cyan', 0.12)} strokeWidth={1} style={nss} />
            {layers.flows && <ShipmentsLayer S={S} shipments={shipments} clock={clock} paused={dragging || zooming} aggregate={size.w < 640 ? lod <= 1 : S < 0.9} />}
            {!zooming && <LabelsLayer S={S} geo={placement.geo} regions={placement.regions} exits={placement.exits} />}
            <CitiesLayer S={S} placed={zooming ? NO_CITY_LABELS : placement.cities} />
            <g pointerEvents="none" style={dragging || zooming ? { display: 'none' } : undefined}>
              {ripples.map((r) => {
                if (!G.SITE_POS[r.site]) return null;
                const [x, y] = markerAt(r.site, S, liveSpread);
                return <circle key={r.key} className="fcm-ripple" cx={x / S} cy={y / S} r={markerPx(S) / S} fill="none" stroke={r.tone === 'bad' ? ops('red') : r.tone === 'good' ? ops('green') : r.tone === 'warn' ? ops('amber') : ops('cyan')} strokeWidth={2} style={nss} />;
              })}
            </g>
            <SitesLayer S={S} markers={markers} selected={selected} focused={focused} hovered={hovered} labelIds={zooming ? NO_LABELS : placement.sites} spread={liveSpread} onActivate={onActivate} onFocusSite={onFocusSite} onHover={onHover} />
          </g>
          <Furniture view={view} size={size} boxes={placement.boxes} quiet={zooming} />
        </svg>
      )}
      <div data-hud="" className="pointer-events-none absolute left-3 top-3 rounded border border-ops-line/80 bg-ops-bg px-2.5 py-1.5">
        <div className="font-sans text-[13px] font-bold uppercase leading-none tracking-[0.16em] text-ops-cyan">Commonwealth of Aldmere</div>
        <div className="mt-1 text-[9px] uppercase tracking-[0.14em] text-ops-dim">Defence logistics · grid km</div>
      </div>
      <div data-hud="" className="absolute right-3 top-3 flex flex-col gap-1">
        <button type="button" className="btn h-7 w-7 px-0 text-[14px]" onClick={() => zoomBy(1.6)} aria-label="Zoom in" title="Zoom in">
          +
        </button>
        <button type="button" className="btn h-7 w-7 px-0 text-[14px]" onClick={() => zoomBy(1 / 1.6)} aria-label="Zoom out" title="Zoom out">
          −
        </button>
        <button type="button" className="btn h-7 w-7 px-0 text-[12px]" onClick={reset} aria-label="Reset view" title="Reset view">
          ⟲
        </button>
      </div>
      {size.w >= 420 && size.w > 0 && (
        <Minimap
          view={view}
          size={size}
          onCenter={(x, y) => {
            const v = viewRef.current;
            apply(clampView({ S: v.S, tx: size.w / 2 - x * v.S, ty: size.h / 2 - y * v.S }, sizeRef.current));
          }}
        />
      )}
      <div data-hud="" className="pointer-events-none absolute bottom-2 right-3 rounded border border-ops-line/80 bg-ops-bg px-1.5 py-0.5 text-[9.5px] tracking-wider text-ops-dim">
        <span ref={readoutRef} />
        <span className="ml-2 text-ops-dim/70">×{(S / Math.max(0.0001, fitScale(size))).toFixed(1)}</span>
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
  return (
    <div className={`flex flex-wrap gap-1 ${className}`} role="group" aria-label="Map layers">
      {LAYER_LABEL.map(([k, label, c]) => (
        <button key={k} type="button" className={`btn px-2 py-0.5 text-[10px] ${layers[k] ? 'btn-active' : ''}`} aria-pressed={layers[k]} onClick={() => onChange({ ...layers, [k]: !layers[k] })}>
          {c && <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: c, opacity: layers[k] ? 1 : 0.4 }} />}
          {label}
        </button>
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
