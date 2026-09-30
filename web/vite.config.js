// The client is static files; the remote is the Phoenix app in ../server. In development and preview, /api is proxied
// to it, so the browser sees one origin and the server needs no CORS. Where the two are served together in production
// is a hosting decision (M11).
import { defineConfig } from "vite";
import { name, domain } from "./src/brand.js";

const api = { "/api": { target: "http://localhost:4000", changeOrigin: true } };

// The PWA manifest and the page title carry the name, which is defined once in src/brand.js (docs/branding.md).
const manifest = () =>
  JSON.stringify({
    name,
    short_name: name,
    description: `A card game about Git · ${domain}`,
    start_url: ".",
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

export default defineConfig({
  plugins: [brand],
  // the cards read rules/deck.json, one level up
  server: { proxy: api, fs: { allow: [".."] } },
  preview: { proxy: api },
  test: { environment: "node" },
});
