// Building DOM without a framework or innerHTML. Player names and commit messages come from other people, so text
// only ever reaches the page as text nodes, never as markup.

/**
 * `el("button", { class: "primary", onclick }, "Push")`. Props starting with `on` are listeners; `class`, `data-*`,
 * `aria-*` and the rest are attributes (false or null leaves one out). Children are nodes, strings, or arrays of them.
 */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? "" : value);
  }
  append(node, children);
  return node;
}

function append(node, children) {
  for (const child of children) {
    if (child == null || child === false) continue;
    if (Array.isArray(child)) append(node, child);
    else node.append(child instanceof Node ? child : String(child));
  }
}

/** Replace everything in `root` with `children`. */
export function mount(root, ...children) {
  root.replaceChildren();
  append(root, children);
}
