/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    // Art bible: corners are 2–3px; circles only for dials and slider thumbs (rounded-full).
    borderRadius: { none: '0', sm: '1px', DEFAULT: '2px', md: '3px', lg: '3px', xl: '3px', '2xl': '3px', full: '9999px' },
    extend: {
      colors: {
        ops: {
          bg: 'rgb(var(--ops-bg) / <alpha-value>)',
          panel: 'rgb(var(--ops-panel) / <alpha-value>)',
          panel2: 'rgb(var(--ops-panel2) / <alpha-value>)',
          line: 'rgb(var(--ops-line) / <alpha-value>)',
          dim: 'rgb(var(--ops-dim) / <alpha-value>)',
          text: 'rgb(var(--ops-text) / <alpha-value>)',
          cyan: 'rgb(var(--ops-cyan) / <alpha-value>)',
          blue: 'rgb(var(--ops-blue) / <alpha-value>)',
          green: 'rgb(var(--ops-green) / <alpha-value>)',
          amber: 'rgb(var(--ops-amber) / <alpha-value>)',
          red: 'rgb(var(--ops-red) / <alpha-value>)',
          violet: 'rgb(var(--ops-violet) / <alpha-value>)',
          bronze: 'rgb(var(--fc-bronze) / <alpha-value>)',
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        // Display: headings, buttons, tabs and labels.
        sans: ['"Barlow Condensed"', '"Arial Narrow"', 'system-ui', 'sans-serif'],
        // Reading text.
        body: ['"Inter"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
