import { readdirSync, writeFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const clientDir = resolve("dist/client");
const assetsDir = resolve(clientDir, "assets");
const files = readdirSync(assetsDir);

// CSS principal
const styleFile = files.find(
  (f) => f.startsWith("styles-") && f.endsWith(".css"),
);

// Entrée JS principale = le plus gros chunk index-*.js
const indexFiles = files.filter((f) => f.startsWith("index-") && f.endsWith(".js"));
let mainEntry = indexFiles[0];
let mainSize = -1;
for (const f of indexFiles) {
  const size = statSync(resolve(assetsDir, f)).size;
  if (size > mainSize) {
    mainSize = size;
    mainEntry = f;
  }
}

if (!mainEntry) {
  console.error("❌ Aucun fichier d'entrée index-*.js trouvé dans dist/client/assets");
  process.exit(1);
}

const mode = process.argv[2] || "client";
const title = mode === "admin" ? "Vendly Admin" : "Vendly Store";
const manifest = mode === "admin" ? "/manifest-admin.json" : "/manifest.json";

const html = `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>${title}</title>
    <meta name="theme-color" content="#5C2D91" />
    <link rel="manifest" href="${manifest}" />
    <link rel="icon" type="image/png" href="/icons/icon-192.png" />
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
    ${styleFile ? `<link rel="stylesheet" href="/assets/${styleFile}" />` : ""}
  </head>
  <body>
    <div id="root"></div>
    <script type="module" async>import("/assets/${mainEntry}")</script>
  </body>
</html>
`;

writeFileSync(resolve(clientDir, "index.html"), html);
writeFileSync(resolve(clientDir, "_redirects"), "/*    /index.html   200\n");

console.log(`✅ index.html généré (entrée: ${mainEntry}) + _redirects dans ${clientDir}`);
