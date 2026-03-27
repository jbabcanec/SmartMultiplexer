/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        terminal: {
          bg: "rgb(var(--t-bg) / <alpha-value>)",
          surface: "rgb(var(--t-surface) / <alpha-value>)",
          border: "rgb(var(--t-border) / <alpha-value>)",
          text: "rgb(var(--t-text) / <alpha-value>)",
          dim: "rgb(var(--t-dim) / <alpha-value>)",
          accent: "rgb(var(--t-accent) / <alpha-value>)",
          green: "rgb(var(--t-green) / <alpha-value>)",
          red: "rgb(var(--t-red) / <alpha-value>)",
          yellow: "rgb(var(--t-yellow) / <alpha-value>)",
          purple: "rgb(var(--t-purple) / <alpha-value>)",
          orange: "rgb(var(--t-orange) / <alpha-value>)",
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};
