import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  cacheDir: path.resolve(process.env.LOCALAPPDATA || "", "smartterm-vite-cache"),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:4800",
      "/socket.io": {
        target: "http://localhost:4800",
        ws: true,
      },
    },
  },
});
