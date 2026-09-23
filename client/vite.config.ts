import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  envDir: fileURLToPath(new URL("..", import.meta.url)),
  plugins: [react() as any],
  resolve: {
    alias: {
      "@physics-monopoly/shared": fileURLToPath(new URL("../shared/src/index.ts", import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
  preview: {
    port: 4173,
  },
  build: {
    emptyOutDir: true,
  },
});
