import { build } from "esbuild";
await build({
  entryPoints: ["server/index.ts"],
  outfile: "dist/server/index.js",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
});
await build({
  entryPoints: ["services/payments/index.ts"],
  outfile: "dist/payments/index.js",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
});
