// The client is static files; the remote is the Phoenix app in ../server. In development and preview, /api is proxied
// to it, so the browser sees one origin and the server needs no CORS; in production the server serves both (M11).
// The pages: the landing page at /, the game at /play (ADR-0009), the maintainer's pulse at /stats (M13e), and the
// pages about Git's output under /git (M16), listed in src/pages.js.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { name, domain } from "./src/brand.js";
import { pages } from "./src/pages.js";

const api = { "/api": { target: "http://localhost:4000", changeOrigin: true } };
const page = (path) => fileURLToPath(new URL(path, import.meta.url));

// The PWA manifest, the pages, robots.txt and the sitemap carry the name and the domain, which are defined once in
// src/brand.js (docs/branding.md).
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
  transformIndexHtml: (html) => html.replaceAll("%BRAND%", name).replaceAll("%DOMAIN%", domain),
  configureServer(server) {
    server.middlewares.use("/manifest.webmanifest", (_req, res) => {
      res.setHeader("Content-Type", "application/manifest+json");
      res.end(manifest());
    });
  },
  generateBundle() {
    this.emitFile({ type: "asset", fileName: "manifest.webmanifest", source: manifest() });
    // Search engines index the landing page and the pages under /git: the game is a page with no words until it runs
    // (play/index.html says noindex, and robots.txt must let it be fetched to be read), and /api is no page at all.
    this.emitFile({
      type: "asset",
      fileName: "robots.txt",
      source: `User-agent: *\nDisallow: /api/\n\nSitemap: https://${domain}/sitemap.xml\n`,
    });
    const urls = ["", ...pages.map((p) => p.path)].map((p) => `  <url><loc>https://${domain}/${p}</loc></url>`);
    this.emitFile({
      type: "asset",
      fileName: "sitemap.xml",
      source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`,
    });
  },
};

// Git's words are captured, never typed (docs/design/website-content.md): a page holds %CAPTURE:<scenario>% where
// scripts/git-output.sh's capture of that scenario goes, read from captures/<scenario>.txt without its two header
// lines, and %GIT_VERSION% where the Git that printed it is named. A capture the script never wrote fails the build.
const captures = {
  name: "captures",
  transformIndexHtml(html) {
    let version;
    const escape = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
    const quoted = html.replaceAll(/%CAPTURE:([a-z0-9-]+)%/g, (_, scenario) => {
      const [header, , ...lines] = readFileSync(page(`captures/${scenario}.txt`), "utf8")
        .trimEnd()
        .split("\n");
      version ??= header.replace(/^# git version /, "");
      return lines.map((l) => (l.startsWith("$ ") ? `<span class="prompt">${escape(l)}</span>` : escape(l))).join("\n");
    });
    return quoted.replaceAll("%GIT_VERSION%", version ?? "");
  },
};

// The server serves the pages at their addresses without a trailing slash (/play, /git/non-fast-forward); Vite's own
// addresses for them end in one.
const addresses = {
  name: "addresses",
  configureServer(server) {
    const clean = ["/play", "/stats", ...pages.map((p) => `/${p.path}`)];
    server.middlewares.use((req, _res, next) => {
      for (const address of clean)
        if (req.url === address || req.url.startsWith(`${address}?`)) req.url = req.url.replace(address, `${address}/`);
      next();
    });
  },
};

// Files the site serves from elsewhere in the repository: the print-and-play deck, built in ../tabletop and handed out
// at /teach, so there is one copy of it (docs/design/website-content.md). The server lists it in static_paths.
const deck = page("../tabletop/print-and-play.pdf");
const files = {
  name: "files",
  configureServer(server) {
    server.middlewares.use("/print-and-play.pdf", (_req, res) => {
      res.setHeader("Content-Type", "application/pdf");
      res.end(readFileSync(deck));
    });
  },
  generateBundle() {
    this.emitFile({ type: "asset", fileName: "print-and-play.pdf", source: readFileSync(deck) });
  },
};

export default defineConfig({
  plugins: [brand, captures, addresses, files],
  build: {
    rollupOptions: {
      input: {
        landing: page("index.html"),
        play: page("play/index.html"),
        stats: page("stats/index.html"),
        ...Object.fromEntries(pages.map((p) => [p.path.replaceAll("/", "-"), page(`${p.path}/index.html`)])),
      },
    },
  },
  // the cards read rules/deck.json, one level up
  server: { proxy: api, fs: { allow: [".."] } },
  preview: { proxy: api },
  test: { environment: "node" },
});
