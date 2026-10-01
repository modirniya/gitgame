// @vitest-environment jsdom
import { expect, it } from "vitest";
import { feedbackBox } from "./feedback.js";

const settle = () => new Promise((r) => setTimeout(r));

function box(note = null, send = async (id, body) => ({ body: body.trim() })) {
  const sent = [];
  const remote = {
    feedback: async () => ({ body: note, max: 1000 }),
    sendFeedback: (id, body) => (sent.push([id, body]), send(id, body)),
  };
  const node = feedbackBox(remote, "g1");
  const text = node.querySelector("textarea");
  const button = node.querySelector("button");
  const type = (value) => ((text.value = value), text.dispatchEvent(new Event("input")));
  const submit = () => node.dispatchEvent(new Event("submit"));
  return { node, text, button, type, submit, sent };
}

it("takes up to 1000 characters, counts them, and sends the note once there is one", async () => {
  const { node, text, button, type, submit, sent } = box();
  await settle();
  expect(text.getAttribute("maxlength")).toBe("1000");
  expect(button.disabled).toBe(true);

  type("the conflicts were confusing");
  expect(node.querySelector(".count").textContent).toBe("28/1000");
  expect(button.disabled).toBe(false);

  submit();
  await settle();
  expect(sent).toEqual([["g1", "the conflicts were confusing"]]);
  expect(node.querySelector("[role=status]").textContent).toMatch(/thanks/);
  // nothing new to send until the note changes
  expect(button.textContent).toBe("update");
  expect(button.disabled).toBe(true);
});

it("shows the note already left, to change", async () => {
  const { text, button, type } = box("fun");
  await settle();
  expect(text.value).toBe("fun");
  expect(button.textContent).toBe("update");
  expect(button.disabled).toBe(true);
  type("fun, but long");
  expect(button.disabled).toBe(false);
});

it("says why a note wasn't kept, and keeps what was typed", async () => {
  const refused = async () => Promise.reject(new Error("fatal: the game isn't over yet"));
  const { node, text, type, submit } = box(null, refused);
  await settle();
  type("hi");
  submit();
  await settle();
  expect(node.querySelector("[role=status]").textContent).toBe("fatal: the game isn't over yet");
  expect(text.value).toBe("hi");
});
