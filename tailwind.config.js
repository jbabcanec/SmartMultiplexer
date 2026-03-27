/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        terminal: {
          bg: "var(--t-bg)",
          surface: "var(--t-surface)",
          border: "var(--t-border)",
          text: "var(--t-text)",
          dim: "var(--t-dim)",
          accent: "var(--t-accent)",
          green: "var(--t-green)",
          red: "var(--t-red)",
          yellow: "var(--t-yellow)",
          purple: "var(--t-purple)",
          orange: "var(--t-orange)",
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};
