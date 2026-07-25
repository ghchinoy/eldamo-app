import { defineConfig } from "vite";

export default defineConfig({
  clearScreen: false,
  resolve: {
    dedupe: ["lit"],
  },
  server: {
    port: 1425,
    strictPort: true,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: ["es2022", "chrome105", "safari15"],
  },
});
