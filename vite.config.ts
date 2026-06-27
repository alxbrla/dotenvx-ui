import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  root: "src/ui/app",
  plugins: [tailwindcss(), react()],
  build: {
    outDir: "../../../dist/ui",
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
});
