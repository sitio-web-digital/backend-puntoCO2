// Copia el worker de qr-scanner a public/ en cada install: next start sirve
// public/ leyendo el disco directamente, así que el archivo tiene que vivir
// ahí (no alcanza con que esté en node_modules). Correr esto a mano cada vez
// que se actualiza la versión de qr-scanner sería fácil de olvidar, por eso
// es un postinstall en vez de un archivo commiteado a mano.
const { copyFileSync, existsSync, mkdirSync } = require("node:fs");
const { join } = require("node:path");

const src = join(__dirname, "..", "node_modules", "qr-scanner", "qr-scanner-worker.min.js");
const destDir = join(__dirname, "..", "public");
const dest = join(destDir, "qr-scanner-worker.min.js");

if (!existsSync(src)) {
  console.warn("[copy-qr-worker] no se encontró qr-scanner en node_modules, se omite la copia.");
  process.exit(0);
}

mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log("[copy-qr-worker] public/qr-scanner-worker.min.js actualizado.");
