/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        terminal: {
          bg: "#0a0e14",
          surface: "#111820",
          border: "#1e2530",
          text: "#c5cdd9",
          dim: "#6b7a8d",
          accent: "#39bae6",
          green: "#7fd962",
          red: "#ff6b6b",
          yellow: "#ffb454",
          purple: "#c792ea",
          orange: "#ff8f40",
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};
