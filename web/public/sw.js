// The service worker that makes the client installable and lets it open offline. It keeps a copy of the app's own
// files as they are fetched and serves that copy only when the network fails, so a new deploy is picked up on the
// next load. The remote's /api is never cached: a game is always fetched fresh (charter decision 9).
const CACHE = "shell-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((hit) => hit || caches.match("/index.html"))),
  );
});

// Reminders (ADR-0006): a push carries nothing, so the worker fetches this player's games and shows what waits on
// them; every push must show a notification (userVisibleOnly), so there is a plain one if nothing is found.
self.addEventListener("push", (event) => event.waitUntil(remind()));

async function remind() {
  let games = [];
  try {
    const response = await fetch("/api/games", { headers: { accept: "application/json" } });
    if (response.ok) games = (await response.json()).games;
  } catch {
    // offline: the plain notification below still says something happened
  }

  const due = games.find((g) => g.waiting_on_you.length > 0);
  const done = !due && games.find((g) => g.released);
  const game = due || done;
  const title = due ? "your pack is due" : done ? "v1.0 has shipped" : "news from your games";
  const body = due
    ? `day ${due.day} of ${due.final_day}: send your pack before the day closes`
    : done
      ? "the game is over: see how it went, and replay it"
      : "open the game to see";

  return self.registration.showNotification(title, {
    body,
    icon: "/icon.svg",
    tag: game ? game.id : "games",
    data: { url: game ? `/?via=notification#/g/${game.id}` : "/?via=notification" },
  });
}

// Tapping a reminder opens its game, in a window of the game if one is open.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(open(event.notification.data.url));
});

async function open(url) {
  for (const client of await self.clients.matchAll({ type: "window" })) {
    if ("navigate" in client) return (await client.navigate(url)).focus();
  }
  return self.clients.openWindow(url);
}
