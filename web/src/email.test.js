// @vitest-environment jsdom
import { expect, it } from "vitest";
import { emailSettings } from "./email.js";

const settle = () => new Promise((r) => setTimeout(r));

it("offers a form where the remote can email, and says what's pending once an address is given", async () => {
  const calls = [];
  const remote = {
    emailSettings: async () => ({ email: null, available: true }),
    setEmail: async (address, digest) => (
      calls.push([address, digest]),
      { email: { address, confirmed: false, digest }, available: true }
    ),
  };
  const node = emailSettings(remote);
  await settle();
  expect(node.hidden).toBe(false);

  node.querySelector("#email-address").value = "ana@example.com";
  node.querySelector("#email-digest").checked = true;
  node.querySelector("form").dispatchEvent(new Event("submit"));
  await settle();

  expect(calls).toEqual([["ana@example.com", true]]);
  expect(node.textContent).toContain("confirm the link we sent");
});

it("shows nothing where the remote can't send email, not even an empty disclosure", async () => {
  const node = emailSettings({ emailSettings: async () => ({ email: null, available: false }) });
  expect(node.hidden).toBe(true);
  await settle();
  expect(node.textContent).toBe("");
  expect(node.hidden).toBe(true);
});

it("shows nothing when the remote can't be asked", async () => {
  const node = emailSettings({ emailSettings: async () => Promise.reject(new Error("offline")) });
  await settle();
  expect(node.hidden).toBe(true);
});
