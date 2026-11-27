// A small line-icon set for the header and the title menu. Each icon is a 16px stroke drawing in currentColor.

const PATHS = {
  pause: 'M6 4v8M10 4v8',
  play: 'M5.5 3.5l7 4.5-7 4.5z',
  step: 'M4 3.5l6 4.5-6 4.5zM12 3.5v9',
  save: 'M3 3h8l2 2v8H3zM5.5 3v3h5V3M5 13V9h6v4',
  search: 'M7 11.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM10.3 10.3L13.5 13.5',
  settings:
    'M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 1.8v1.7M8 12.5v1.7M1.8 8h1.7M12.5 8h1.7M3.6 3.6l1.2 1.2M11.2 11.2l1.2 1.2M3.6 12.4l1.2-1.2M11.2 4.8l1.2-1.2',
  sound: 'M3 6h2.5L9 3v10L5.5 10H3zM11.5 5.5a3.5 3.5 0 0 1 0 5M13 4a5.5 5.5 0 0 1 0 8',
  mute: 'M3 6h2.5L9 3v10L5.5 10H3zM11.5 6.5l3 3M14.5 6.5l-3 3',
  music: 'M6 12V3.5l7-1.5V10.5M6 12a1.8 1.8 0 1 1-3.6 0 1.8 1.8 0 0 1 3.6 0zM13 10.5a1.8 1.8 0 1 1-3.6 0 1.8 1.8 0 0 1 3.6 0z',
  report: 'M4 2.5h6l2.5 2.5v8.5H4zM6 7h4.5M6 9.5h4.5M6 12h3',
  continue: 'M3.5 8h8M8.5 4.5L12 8l-3.5 3.5',
  plus: 'M8 3v10M3 8h10',
  folder: 'M2 4h4.5l1.5 1.5H14V13H2z',
  trophy: 'M5 2.5h6v3a3 3 0 0 1-6 0zM5 3.5H2.5a2.5 2.5 0 0 0 2.6 2.6M11 3.5h2.5a2.5 2.5 0 0 1-2.6 2.6M8 8.5v3M5.5 13.5h5M6.5 11.5h3',
  back: 'M12.5 8h-9M7 4.5L3.5 8 7 11.5',
  coin: 'M8 14a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM9.8 5.6C9.4 5 8.8 4.8 8 4.8c-1.1 0-1.9.6-1.9 1.4 0 1.9 3.8 1 3.8 3 0 .9-.8 1.5-1.9 1.5-.8 0-1.5-.3-1.9-.9M8 3.6v1.2M8 11.2v1.2',
  shield: 'M8 1.8l5 1.9v3.9c0 3.1-2.1 5.6-5 6.6-2.9-1-5-3.5-5-6.6V3.7zM5.6 7.9l1.7 1.7 3.2-3.4',
  star: 'M8 1.8l1.8 3.9 4.2.5-3.1 2.9.8 4.2L8 11.2l-3.7 2.1.8-4.2L2 6.2l4.2-.5z',
  winter: 'M8 1.5v13M2.4 4.8l11.2 6.4M2.4 11.2l11.2-6.4M6.3 2.6L8 4.2l1.7-1.6M6.3 13.4L8 11.8l1.7 1.6',
  spring: 'M8 14.5V7M8 7C8 4.5 6 2.5 3 2.5c0 2.8 2 4.5 5 4.5zM8 9c0-2.3 1.8-4 4.8-4 0 2.6-1.8 4-4.8 4z',
  summer: 'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1',
  autumn: 'M3 13c0-5.5 3.5-9.5 10-10.5C12.5 9 8.5 13 3 13zM3 13l5-5',
  alert: 'M8 2l6.5 11.5h-13zM8 6.5v3.2M8 11.6v.1',
  people: 'M5.5 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM11 7.5a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4zM1.8 13c0-2.2 1.7-3.8 3.7-3.8s3.7 1.6 3.7 3.8M9.6 9.6c.4-.1.9-.2 1.4-.2 1.8 0 3.2 1.4 3.2 3.4',
  factory: 'M1.8 13.5V7l3.6 2.2V7l3.6 2.2V4.5h1.8V2.5h1.8v11zM4 11.5h1M7 11.5h1M10 11.5h1',
  truck: 'M1.5 4.5h8v6.5h-8zM9.5 7h2.8l2.2 2.2V11h-5M4.2 12.8a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4zM11.8 12.8a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4z',
  bolt: 'M9 1.5L3.5 9h4L7 14.5 12.5 7h-4z',
  flask: 'M6.2 2h3.6M6.8 2v4.2L3 12.6c-.4.7.1 1.4.9 1.4h8.2c.8 0 1.3-.7.9-1.4L9.2 6.2V2M4.8 10h6.4',
  crosshair: 'M8 13.5a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11zM8 1v3M8 12v3M1 8h3M12 8h3',
  zoomIn: 'M7 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM10.6 10.6L14 14M7 4.8v4.4M4.8 7h4.4',
  zoomOut: 'M7 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM10.6 10.6L14 14M4.8 7h4.4',
  recenter: 'M8 2v2.5M8 11.5V14M2 8h2.5M11.5 8H14M8 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
} as const;

export type IconName = keyof typeof PATHS;

/** A decorative icon: the button or link around it carries the name. */
export function Icon({ name, size = 14, className = '' }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 ${className}`}
    >
      <path d={PATHS[name]} fill={name === 'play' || name === 'step' ? 'currentColor' : 'none'} />
    </svg>
  );
}

/** The Board's insignia: a bronze hexagon with a forge flame over two rank chevrons. */
export function Insignia({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false" className="shrink-0">
      <defs>
        <linearGradient id="fc-ins-bronze" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f3d28c" />
          <stop offset="0.5" stopColor="#c08a43" />
          <stop offset="1" stopColor="#7a5226" />
        </linearGradient>
        <linearGradient id="fc-ins-flame" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#ff8a2a" />
          <stop offset="1" stopColor="#ffd98a" />
        </linearGradient>
      </defs>
      <path d="M16 1.5l12.6 7.25v14.5L16 30.5 3.4 23.25V8.75z" fill="#0d131d" stroke="url(#fc-ins-bronze)" strokeWidth="1.6" />
      <path d="M16 4.6l9.9 5.7v11.4L16 27.4 6.1 21.7V10.3z" fill="none" stroke="#c08a43" strokeOpacity="0.35" strokeWidth="0.8" />
      <path d="M16 6.8c1.9 2.6 3.6 4.4 3.6 6.9 0 2.2-1.6 3.8-3.6 3.8s-3.6-1.6-3.6-3.8c0-1.4.7-2.5 1.6-3.4-.1 1.3.4 2.2 1.2 2.6-.4-2.1.1-4 .8-6.1z" fill="url(#fc-ins-flame)" />
      <path d="M9.5 20l6.5 3.6 6.5-3.6M9.5 23.2l6.5 3.6 6.5-3.6" fill="none" stroke="url(#fc-ins-bronze)" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
