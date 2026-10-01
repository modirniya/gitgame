// The client is static files; the remote is the Phoenix app in ../server. In development and preview, /api is proxied
// to it, so the browser sees one origin and the server needs no CORS; in production the server serves both (M11).
// Two pages (ADR-0009): the landing page at /, and the game at /play.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { name, domain } from "./src/brand.js";

const api = { "/api": { target: "http://localhost:4000", changeOrigin: true } };

// The PWA manifest and the page title carry the name, which is defined once in src/brand.js (docs/branding.md).
const manifest = () =>
  JSON.stringify({
    name,
    short_name: name,
    description: `A card game about Git · ${domain}`,
    // the game, not the landing page; `id` keeps the identity installs had when the game was at /
    id: "/",
    start_url: "/play",
    display: "standalone",
    background_color: "#14161a",
    theme_color: "#14161a",
    icons: [{ src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  });

const brand = {
  name: "brand",
  transformIndexHtml: (html) => html.replaceAll("%BRAND%", name),
  configureServer(server) {
    server.middlewares.use("/manifest.webmanifest", (_req, res) => {
      res.setHeader("Content-Type", "application/manifest+json");
      res.end(manifest());
    });
  },
  generateBundle() {
    this.emitFile({ type: "asset", fileName: "manifest.webmanifest", source: manifest() });
  },
};

// The server serves the game at /play; Vite's own address for that page is /play/.
const pages = {
  name: "pages",
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (req.url === "/play" || req.url.startsWith("/play?")) req.url = req.url.replace("/play", "/play/");
      next();
    });
  },
};

const page = (path) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  plugins: [brand, pages],
  build: { rollupOptions: { input: { landing: page("index.html"), play: page("play/index.html") } } },
  // the cards read rules/deck.json, one level up
  server: { proxy: api, fs: { allow: [".."] } },
  preview: { proxy: api },
  test: { environment: "node" },
});
