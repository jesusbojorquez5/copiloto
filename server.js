// Copiloto — servidor estático mínimo, cero dependencias.
// Sirve ./public y respeta el PORT que asigna Railway.
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, "public");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".map": "application/json",
};

const server = http.createServer((req, res) => {
  try {
    let urlPath = decodeURIComponent(req.url.split("?")[0]);
    if (urlPath === "/") urlPath = "/index.html";

    // Evita path traversal.
    const safePath = path
      .normalize(urlPath)
      .replace(/^(\.\.[/\\])+/, "");
    let filePath = path.join(ROOT, safePath);
    if (!filePath.startsWith(ROOT)) filePath = path.join(ROOT, "index.html");

    fs.stat(filePath, (err, stat) => {
      if (err || !stat.isFile()) {
        // Fallback SPA: cualquier ruta desconocida -> index.
        filePath = path.join(ROOT, "index.html");
      }
      const ext = path.extname(filePath).toLowerCase();
      const type = MIME[ext] || "application/octet-stream";
      res.setHeader("Content-Type", type);
      // Código y shell siempre frescos (evita mezclar versiones al actualizar);
      // el service worker es quien cachea para offline. Solo imágenes se cachean.
      if (ext === ".png" || ext === ".jpg" || ext === ".svg" || ext === ".ico") {
        res.setHeader("Cache-Control", "public, max-age=86400");
      } else {
        res.setHeader("Cache-Control", "no-cache");
      }
      fs.createReadStream(filePath)
        .on("error", () => {
          res.statusCode = 500;
          res.end("error");
        })
        .pipe(res);
    });
  } catch (e) {
    res.statusCode = 500;
    res.end("error");
  }
});

server.listen(PORT, () => {
  console.log(`Copiloto en http://0.0.0.0:${PORT}`);
});
