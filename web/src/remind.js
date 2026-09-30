// "Remind me" (ADR-0006): the one place the client asks for permission to notify, after a pack has been sent in a
// 24-hour game, never on a first visit, when a prompt is most likely to be refused for good. Subscribing hands the
// browser's push subscription to the remote, which wakes it when a pack is due.
import { el } from "./dom.js";

/** The VAPID public key as the PushManager takes it. */
export function keyBytes(base64url) {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const supported = () =>
  typeof navigator !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in globalThis &&
  "Notification" in globalThis;

/** An element that becomes the button, "reminders are on", or nothing, once it knows which this browser allows. */
export function remindButton(remote) {
  const node = el("p", { class: "remind" });
  if (!supported()) return node;

  (async () => {
    const key = await remote.pushKey();
    if (!key) return;
    const registration = await navigator.serviceWorker.ready;
    if (await registration.pushManager.getSubscription()) return node.replaceChildren("# reminders are on");
    if (Notification.permission === "denied") return node.replaceChildren("# reminders are blocked in this browser");

    node.replaceChildren(
      el(
        "button",
        {
          onclick: async () => {
            if ((await Notification.requestPermission()) !== "granted")
              return node.replaceChildren("# reminders are blocked in this browser");
            const subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: keyBytes(key),
            });
            await remote.subscribePush(subscription.toJSON());
            node.replaceChildren("# reminders are on: you'll hear when a pack is due");
          },
        },
        "remind me when my pack is due",
      ),
    );
  })().catch(() => node.replaceChildren());

  return node;
}
