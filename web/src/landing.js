// The landing page's one script (ADR-0009). Links from before the game moved to /play that carry only a hash, a
// room's (`/#/room/<code>`) or a game's (`/#/g/<id>`), never reach the server, so they're sent on from here. The page's
// own anchors (`#faq`) don't start with a slash, and stay.

/** Where an address from before the move belongs now, or null if it belongs here. */
export const moved = ({ hash, search }) => (hash.startsWith("#/") ? `/play${search}${hash}` : null);

const to = typeof location !== "undefined" && moved(location);
if (to) location.replace(to);
