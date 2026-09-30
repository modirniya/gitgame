# ADR-0005: Sign-in written fresh: GitHub OAuth and anonymous players, no Firebase

*Status: Proposed · Date: 2026-09-29*

## Context

The [charter](0000-project-charter.md) settles who can play: **GitHub sign-in first, anonymous play as the fallback, with a nudge to link** (decision 15). It also says how: Firebase Auth as the provider layer, lifted from RPS's `firebase_auth.ex` (decisions 15 and 17). That second half assumed the RPS code was at hand and fit. It isn't at hand: the [Phase 1 plan](../design/phase-1-plan.md) has carried "where RPS is" as an open item, and M8 can't start on it. So the maintainer decided on 2026-09-29 to write sign-in fresh, and this ADR is how.

Four facts from Phase 1 shape it:
- The server is an API-only Phoenix app.
- The client is a static PWA that today reaches `/api` through a proxy on its own origin.
- Until now a request names its player (`?player=ana`), which is fine for hotseat and nothing else.
- A game's log refers to seats by name, and the log must never be rewritten ([ADR-0004](0004-the-event-log-stores-inputs.md)).

Charter priority 2 is "a game in five seconds": signing in must never stand between a new visitor and their first game.

## Decision

The server owns identity itself: **GitHub OAuth for accounts, anonymous players for everyone else, and server-side sessions in an HttpOnly cookie.** There is no Firebase and nothing is lifted from RPS.

1. **A player is a row, and anonymous is the default.**
   - A first visit calls `POST /api/players`, which creates a player with a generated handle (`quiet-otter-42`) and signs that device in. The first game follows in the same five seconds.
   - An anonymous player can do everything a signed-in one can. What they lack is a way back from another device, and the client says so: after their first finished game, and in the menu.
2. **GitHub is linked, not required.**
   - `GET /api/auth/github` starts the web-application flow, with a `state` value and PKCE, requesting **no scopes**. We need only the public profile.
   - The callback takes the GitHub user's id, login and avatar URL, then **discards GitHub's access token**. We never call GitHub on a player's behalf, so we keep nothing that could.
   - If that GitHub account is new to us, it is attached to the current player, anonymous or not, and their games stay theirs.
   - If it already belongs to another player (the same person on a second device), the device signs in as that player. The anonymous player's seats move over where that doesn't seat one player twice in the same game.
   - The OAuth client is the [Assent](https://hex.pm/packages/assent) library (it does `state` and PKCE), because the protocol is not something to write by hand. Players, sessions and linking are our own code.
   - We use Assent's generic OAuth2 strategy pointed at GitHub's endpoints, not its GitHub strategy. That one always fetches `/user/emails`, which fails without the `user:email` scope we don't ask for.
3. **Sessions are opaque tokens in the database.**
   - A session is 32 random bytes. The cookie holds them, and the `sessions` table holds only their SHA-256.
   - That makes a session revocable (sign out, sign out everywhere) and gives JavaScript nothing to steal: the cookie is `HttpOnly; Secure; SameSite=Lax`.
   - Anonymous sessions last a year and are extended on use, since losing one loses the account. Linked sessions last 60 days, also extended on use.
4. **Writes are safe from other sites by construction.**
   - Every write is a JSON `POST` or `DELETE`. From another origin that needs a CORS preflight, which the API never grants.
   - The server also checks `Origin` on every write, and the OAuth `state` lives in a short-lived signed cookie.
5. **Seats belong to players; the log keeps its names.**
   - A new `game_seats` table maps each seat of a game to a player, or to a bot. The seat's name in the log is the name it was created with and never changes.
   - The API stops trusting `?player=`. You see a game as the seat your session holds, and a pack is written for that seat.
   - Hotseat stays as an explicit kind of game: its creator's session holds every human seat, and the client passes the device as it does today.
6. **Client and API are served from one origin.** The cookie depends on it. The dev proxy already works this way, and [M11](../design/phase-1-plan.md)'s hosting choice has to keep it (a path, `/api`, not a subdomain).

The GitHub OAuth app's id and secret come from the environment (`GITGAME_GITHUB_CLIENT_ID`, `GITGAME_GITHUB_CLIENT_SECRET`), read in `config/runtime.exs`, never committed. Without them the server runs with anonymous play only, which is also how CI and local development run.

## Alternatives considered

- **Firebase Auth, as the charter planned, written fresh instead of lifted.**
  - What it would add: a Google project, a client SDK in a bundle that is 13 KB gzipped today, and verifying Google's ID tokens on every request.
  - What it would give us: GitHub sign-in, which we can do in one flow ourselves, and anonymous accounts, which for us are one database row.
  - It would also put a second vendor between a developer audience and their GitHub identity. Rejected.
- **Lift RPS's `firebase_auth.ex` later, when RPS is found.** That would block M8 on an unknown, and carry the Firebase costs above. Rejected; the FCM notifier (M10) is a separate question and still open.
- **Stateless signed tokens (JWT or `Phoenix.Token`) in `localStorage`.** No sessions table, and the API could live on any origin. But any script on the page could read the token, and a token can't be revoked before it expires. Rejected: one table is the cheaper price.
- **Hand-written OAuth instead of Assent.** It's only three requests, but `state`, PKCE and the edge cases are where sign-in bugs live. A small, maintained library that does only the protocol is the better trade. Ueberauth was the other candidate; it is built around server-rendered Phoenix pipelines, which this app doesn't have.
- **GitHub required, no anonymous play.** It breaks "a game in five seconds" (charter priority 2) and decision 15. Rejected.
- **Asking GitHub for the player's email** (`user:email`), for M10's digests. Not now: M10 asks for email itself, with its own consent, when a player turns digests on.

## Consequences

- **M8 can start now.** It is a migration (`players`, `sessions`, `game_seats`), a small `Players` context, four endpoints (`POST /api/players`, the GitHub start and callback, `DELETE /api/session`), and the API reading the session instead of `?player=`.
- **M11 is constrained:** the client and the API must share an origin. A host that can't serve both is ruled out, or needs a proxy in front.
- **A lost anonymous cookie is a lost account,** and its unfinished games become absences (charter decision 6 already covers that). The nudge to link is the mitigation. A recovery code shown once could be another, later.
- **The games tables change shape but not their log.** Existing games in development databases have no `game_seats` rows; M8's migration treats them as hotseat games of their creator.
- **We hold less about players than Firebase would:** a GitHub id, login and avatar URL, and hashed session tokens. We don't have email or GitHub tokens. Deleting a player is a later, small change: their seats keep their names in logs, which name seats, not people.
- **Abuse controls are open.** Anyone can create anonymous players. A rate limit on `POST /api/players` and on game creation belongs in M11 (hosting) or M12 (beta telemetry), before strangers arrive in M13.
- **The Phase 1 plan's open item "RPS and PlayLounge"** no longer blocks M8. It still matters for M10 (FCM) and for any client pieces we'd reuse.

## Supersedes / superseded by

Amends [ADR-0000](0000-project-charter.md):
- **Decision 15's provider layer:** "Firebase Auth (RPS's `firebase_auth.ex`) as the provider layer" is replaced by the server's own GitHub OAuth and sessions. "GitHub OAuth primary, anonymous play as fallback with a nudge to link" stands.
- **Decision 17's "RPS — Firebase auth":** it is no longer lifted.

The rest of the charter stands.
