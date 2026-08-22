import { mkdirSync, cpSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(".");
const pagesDir = resolve("dist/pages");

rmSync(pagesDir, { recursive: true, force: true });
mkdirSync(pagesDir, { recursive: true });

// Copier les assets client à la racine du dossier Pages
cpSync(resolve("dist/client"), pagesDir, { recursive: true });

// Copier le serveur SSR (utilisé via pages_build_output_dir + main du wrangler.json)
cpSync(resolve("dist/server"), resolve(pagesDir, "_server"), { recursive: true });

console.log("✅ Sortie Cloudflare Pages prête :", pagesDir);
