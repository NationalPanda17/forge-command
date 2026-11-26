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
