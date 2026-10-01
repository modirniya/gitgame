// The feedback box (M13b): on the scoreboard, once a game is over, up to 1000 characters on what broke, what confused,
// what was fun. One note per player and game, which they may rewrite; the maintainer reads them through the beta
// report, and no other player ever sees them.
import { el } from "./dom.js";

const MAX = 1000;

/** The box for game `id`: empty, or holding the note this player already left, which they can change. */
export function feedbackBox(remote, id) {
  const text = el("textarea", {
    id: "feedback",
    maxlength: MAX,
    rows: 4,
    placeholder: "what broke, what confused you, what was fun",
    oninput: () => update(),
  });
  const count = el("span", { class: "count" }, `0/${MAX}`);
  const button = el("button", { type: "submit", disabled: true }, "send");
  const status = el("p", { class: "muted", role: "status" });
  // the note as the remote holds it: nothing to send while the box still says exactly that
  let kept = null;

  function update() {
    count.textContent = `${text.value.length}/${MAX}`;
    button.disabled = !text.value.trim() || text.value.trim() === kept;
    button.textContent = kept ? "update" : "send";
  }

  async function submit(e) {
    e.preventDefault();
    button.disabled = true;
    try {
      kept = (await remote.sendFeedback(id, text.value)).body;
      status.className = "muted";
      status.textContent = "# thanks: your note is in, and the maintainer reads every one";
    } catch (err) {
      status.className = "error";
      status.textContent = err.message;
    }
    update();
  }

  remote.feedback(id).then(
    ({ body }) => {
      if (!body || text.value) return;
      kept = text.value = body;
      status.textContent = "# your note is in; change it any time";
      update();
    },
    () => {},
  );

  return el(
    "form",
    { class: "feedback", onsubmit: submit },
    el("label", { for: "feedback" }, "how was it? a note for the maintainer"),
    text,
    el("div", { class: "feedback-send" }, count, button),
    status,
  );
}
