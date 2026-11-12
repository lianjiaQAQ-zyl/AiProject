import { copyFile, mkdir } from "node:fs/promises";
import { build } from "esbuild";

const source = "src/extension";
const extension = "dist/extension";
await mkdir(extension, { recursive: true });
await Promise.all([
  build({
    entryPoints: ["background", "page", "popup"].map(name => `${source}/${name}.ts`),
    outdir: extension,
    bundle: true,
    target: "chrome120"
  }),
  build({
    entryPoints: ["src/server/index.ts"],
    outfile: "dist/server.js",
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22"
  }),
  ...["manifest.json", "popup.html", "popup.css", "page.css"]
    .map(file => copyFile(`${source}/${file}`, `${extension}/${file}`))
]);
