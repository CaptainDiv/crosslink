import { build, context } from "esbuild";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const harnessDir = path.join(__dirname, "..", "harness");
const entry = path.join(harnessDir, "browser-entry.ts");
const outfile = path.join(harnessDir, "dist", "bundle.js");

const PORT = 5173;

const ctx = await context({
  entryPoints: [entry],
  outfile,
  bundle: true,
  format: "esm",
  platform: "browser",
  sourcemap: true,
  logLevel: "info",
});

await ctx.rebuild();
await ctx.watch();

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".map": "application/json",
};

const server = createServer(async (req, res) => {
  const urlPath = req.url === "/" ? "/index.html" : req.url ?? "/index.html";
  const filePath = path.join(harnessDir, decodeURIComponent(urlPath.split("?")[0] ?? ""));

  if (!filePath.startsWith(harnessDir)) {
    res.writeHead(403);
    res.end("forbidden");
    return;
  }

  try {
    const body = await readFile(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, { "content-type": MIME_TYPES[ext] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Harness running at http://127.0.0.1:${PORT}`);
  console.log("No network calls, no localStorage — entirely client-side.");
});

process.on("SIGINT", async () => {
  await ctx.dispose();
  server.close();
  process.exit(0);
});
