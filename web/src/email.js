// Reminders by email (ADR-0006), on the start screen: an address given for them, confirmed by the link the remote
// sends before anything else goes to it, and either one email per game or one digest a day. Shown only where the
// remote can send email at all.
import { el } from "./dom.js";

export function emailSettings(remote) {
  // hidden until the remote says it can send: an empty <details> still shows the browser's own "Details"
  const node = el("details", { class: "more email", hidden: true });
  let error = "";

  const act = (f) =>
    f().then(show, (e) => {
      error = e.message;
      remote.emailSettings().then(show);
    });

  function show(state) {
    node.hidden = !state.available;
    if (!state.available) return node.replaceChildren();
    const e = state.email;
    const body = e
      ? [
          el(
            "p",
            {},
            e.confirmed
              ? `# reminders go to ${e.address}, ${e.digest ? "in one digest a day" : "one per game"}`
              : `# check ${e.address}: confirm the link we sent, and reminders start`,
          ),
          el("button", { class: "link", onclick: () => act(() => remote.removeEmail()) }, "stop email reminders"),
        ]
      : form();

    node.replaceChildren(
      el("summary", {}, "reminders by email"),
      ...[body].flat(),
      el("p", { class: "error", role: "alert" }, error),
    );
    error = "";
  }

  function form() {
    const address = el("input", {
      id: "email-address",
      type: "email",
      autocomplete: "email",
      placeholder: "you@example.com",
    });
    const digest = el("input", { id: "email-digest", type: "checkbox" });
    return el(
      "form",
      { onsubmit: (e) => (e.preventDefault(), act(() => remote.setEmail(address.value, digest.checked))) },
      el("label", { for: "email-address" }, 'an address for "your pack is due"'),
      address,
      el("label", { class: "check" }, digest, " one digest a day instead of one email per game"),
      el("button", { type: "submit" }, "send me a confirmation link"),
    );
  }

  remote.emailSettings().then(show, () => show({ available: false }));
  return node;
}
