import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { localApi } from "./scripts/local-api";
export default defineConfig({
  plugins: [
    localApi(),
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],
  server: {
    host: "127.0.0.1",
    port: Number(process.env["PORT"] || 5173),
    allowedHosts: [
    	process.env["RENDER_EXTERNAL_HOSTNAME"] || "foodymob.onrender.com",
    ],
  },
  build: { outDir: "dist/client" },
});
