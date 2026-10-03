# server

The remote: the Elixir and Phoenix app that holds the rules, the resolver and every game's event log. It is built milestone by milestone from [docs/design/phase-1-plan.md](../docs/design/phase-1-plan.md). Every game is an append-only log of inputs in Postgres, folded through the pure resolver on every read ([ADR-0004](../docs/adr/0004-the-event-log-stores-inputs.md)); Oban closes each day at its deadline.

## Run it

You need Elixir 1.20 on OTP 29, and a Postgres you can log in to. The dev and test configs read the standard `PGUSER`, `PGPASSWORD` and `PGHOST` variables. They default to your OS user on `localhost`, which is what a Homebrew Postgres lets in without a password.

```bash
mix setup          # deps, create and migrate the dev database
mix phx.server     # http://localhost:4000/api/health
mix test           # creates and migrates the test database first
```

## The API

JSON, under `/api`. Errors are `{"error": message}` in Git's words where Git has them. Making players (per address) and games and rooms (per player) is capped per hour (`config :gitgame, :rate_limits`); past the cap, `429` with `retry-after`. A device is signed in by an `HttpOnly` session cookie ([ADR-0005](../docs/adr/0005-sign-in-written-fresh.md)); writes from another site's pages are refused. You see and write a game only as a seat you hold; anyone else gets the table's view.

| | |
|---|---|
| `POST /players` | An anonymous player with a generated handle, and this device signed in as them (`201`); a device already signed in gets its player back (`200`) |
| `GET /session` | Who this device is signed in as, and whether this server can link GitHub (`link_github`), or `401` |
| `GET /auth/github` | A page navigation, not an API call: sends the browser to GitHub to link an account (no scopes asked), and GitHub back to `/auth/github/callback`, which signs the device in as the account's player and returns to the client |
| `DELETE /session` | Signs this device out (`204`) |
| `GET /games` | Signed in: your games (M9c), each with its day, your seats, `waiting_on_you` (your seats whose pack isn't in today) and scores; those waiting on you first, finished ones last |
| `POST /games` | Signed in: `{"hotseat": [...], "bots": [...], "day_length": "live" \| "lunch" \| "correspondence", "seed": n, "guided": true}`. You take the first seat, under your handle, and hold the seats of the `hotseat` people at your device → the game from your seat. `guided`, for a player's first game, has the remote choose a seed whose first push lands (M15h, `GitGame.Games.Guided`); a `seed` given as well wins |
| `GET /games/:id` | The game from your seat: your own cards, branch and traps, every day log as you may see it, each closed day with the table as it opened (`opened`: `main`, every pointer and how far behind it is, and the scores), and `yours`, the seats you hold (`?seat=` picks one in a hotseat game). A device holding no seat gets the table's view |
| `GET /games/:id/days/:day` | A replay: the view as it stood when `day` closed (`0`: as created), folded from the log up to there; seats as above |
| `POST /games/:id/packs` | Signed in: `{"version", "ops", "discard"}`, and `"seat"` if you hold several, sends or replaces today's pack for a seat you hold (an op may carry a one-line `"why"`, which the whole table reads: bots explain themselves with it); `409` if the day has moved on (`fetch first`) |
| `GET /games/:id/hint` | Signed in: a hint (M15k), `{"ops": [...]}`, the pack the bot's policy would write today for a seat you hold (`?seat=` as above), from that seat's own view, each op in the pack's shape with a `why` about you (`GitGame.Bot.Why`); only read, never sent; `409` after the release |
| `GET /games/:id/feedback`, `PUT /games/:id/feedback` | Signed in: your note on a game once it's over (M13b), `{"body"}` of 1 to 1000 characters, one per player and game, rewritable; only from a seat you held, after the release (`409` before it) |
| `POST /rooms` | Signed in: opens a room (M9) with you as its host and first member → the room: its `code`, host, members, bots, day length |
| `GET /rooms/:code` | The room, and whether you're in it (`you.member`) or host it (`you.host`); `game_id` once its game has started |
| `POST /rooms/:code/join` | Signed in: joins the room; `409` once it is full (five seats, members and bots) or started |
| `PATCH /rooms/:code` | The host: `{"bots", "day_length"}` |
| `POST /rooms/:code/start` | The host: starts the game, members' seats in the order they joined, then the bots → the room with its `game_id` |
| `GET /rooms/:code/live` | Server-Sent Events: `refetch` on connecting and whenever the room changes; ends when its game starts |
| `GET /email`, `PUT /email`, `DELETE /email` | Signed in: the address given for reminders (`{"address", "digest"}`), set (a confirmation link is emailed; capped per hour), or removed |
| `GET /email/confirm`, `GET` or `POST /email/unsubscribe` | The links in emails: page navigations that come back to the client (`?email=confirmed`), and a mail client's one-click unsubscribe (RFC 8058) |
| `GET /push` | The VAPID public key a browser subscribes to reminders with (ADR-0006), or `404` if push is off |
| `POST /push/subscriptions` | Signed in: keeps a browser's push subscription (`{"endpoint", "keys"}`); only browsers' own push services are accepted |
| `DELETE /push/subscriptions` | Signed in: forgets it (`{"endpoint"}`) |
| `GET /games/:id/live` | Server-Sent Events: `refetch` on connecting and whenever the log grows, nothing else; ends after the release |
| `GET /health` | Whether the server and its database are up |
| `GET /stats` | The maintainer's pulse (M13e), behind `STATS_TOKEN` as HTTP Basic auth's password: by day for the last year, new players, games started, packs sent by people and visits; totals; when a person last sent a pack, when the last game started, how many games are in progress; counted from `STATS_SINCE` and without `STATS_TEAM`'s players (`since`, `left_out`). `404` while the token isn't set, `401` without it |

## Linking GitHub

Anonymous play needs nothing. To let players link GitHub in development, create a GitHub OAuth app whose callback URL is `http://localhost:5173/api/auth/github/callback` (the Vite server proxies `/api` here), and start the server with its credentials:

```bash
GITGAME_GITHUB_CLIENT_ID=... GITGAME_GITHUB_CLIENT_SECRET=... mix phx.server
```

A GitHub OAuth app has one callback URL, so production has an app of its own ("Turning on the optional features", below). The tests never reach GitHub: `test/support/github_stub.ex` stands in for it.

## The beta report

What the beta records for the playtest it stands in for ([ADR-0002](../docs/adr/0002-beta-before-human-playtest.md), M12): games started and finished, when packs were sent against how they went, failed pushes and what followed, absences, replays, and players who came back. It reads every game's log and the few marks the log can't hold (visits, replays opened); nothing is shown to players.

```bash
mix gitgame.beta_report                      # readable
mix gitgame.beta_report --json               # for a script
mix gitgame.beta_report --since 2026-10-05   # only games started that day or later, and visits, replays and notes since
mix gitgame.beta_report --feedback           # and the notes people left at the end of their games, to read
```

On the deployment, where the release has no Mix, `bin/beta_report` prints the same report from its database and takes the same options:

```bash
fly ssh console -a gitgame-online -C "/app/bin/beta_report --since 2026-10-05"
```

Count from the beta's launch date: games played before it, while the beta was built and tested, aren't strangers'.

### The pulse

Between reports, `/stats` on the deployment shows at a glance that the game is being played (M13e): when a person last sent a pack, totals, and bars by day, week or month. It is a pulse, not a measurement: test players and the team count like anyone else. It is there once its token is set, which restarts the app:

```bash
fly secrets set STATS_TOKEN=… -a gitgame-online
```

The browser asks for a user name and password: any name, and the token as the password. Without the token set, `/stats` and `/api/stats` answer `404`.

Two more secrets shape what it counts: `STATS_SINCE`, an ISO 8601 moment to count from, and `STATS_TEAM`, the handles of the team's test players, comma-separated, whose packs, visits and games it leaves out. Unset, it counts everything. Secrets, not config, so the handles stay out of this public repository:

```bash
fly secrets set STATS_SINCE=2026-10-03T03:00:00Z STATS_TEAM=one-handle-12,another-34 -a gitgame-online
```

## Production

The root `Dockerfile` builds the whole game into one image: the web client, the server's release, and the rules. It serves the landing page at `/` and the game at `/play` ([ADR-0009](../docs/adr/0009-a-landing-page-and-the-game-at-play.md)) from the same origin as `/api`, which the session cookie needs, and migrates its database before it starts. It needs:

| | |
|---|---|
| `DATABASE_URL` | `ecto://user:password@host/database` |
| `SECRET_KEY_BASE` | signs cookies: `mix phx.gen.secret` |
| `PHX_HOST` | the host people reach the game at, e.g. `gitgame.online` |
| `PORT` | where it listens (default 4000) |
| `GITGAME_GITHUB_CLIENT_ID`, `GITGAME_GITHUB_CLIENT_SECRET` | optional: linking GitHub |
| `GITGAME_SMTP_RELAY`, `GITGAME_SMTP_PORT`, `GITGAME_SMTP_USERNAME`, `GITGAME_SMTP_PASSWORD` | optional: reminders by email and the daily digest, through any SMTP provider that takes STARTTLS (port 587 unless `GITGAME_SMTP_PORT` says otherwise; port 465's implicit TLS doesn't work), sent from `Git Game <play@gitgame.online>`; in development emails are written to the log |
| `GITGAME_VAPID_PUBLIC_KEY`, `GITGAME_VAPID_PRIVATE_KEY`, `GITGAME_VAPID_SUBJECT` | optional: reminders by Web Push; `mix gitgame.vapid_keys` makes a pair, and changing it later unsubscribes every browser |

Behind a proxy, the proxy must terminate TLS and pass on `x-forwarded-proto`. Without Docker, the same release is `MIX_ENV=prod mix release`, once `web/dist/` has been copied into `priv/static/` and `rules/` into `priv/rules/` (see the `Dockerfile`), then `bin/migrate` and `bin/server`. It runs on Fly.io (below); CI builds the image and plays a game against it on every pull request.

## Deploying (Fly.io)

The beta runs on Fly.io ([ADR-0007](../docs/adr/0007-where-the-beta-runs.md)), configured by the root `fly.toml` and deployed by `.github/workflows/deploy.yml` when a `v*` tag is pushed ([workflow.md](../docs/workflow.md), releases). It was set up once, on 2026-09-30, from the maintainer's Fly account:

- **The app** is `gitgame-online` ("gitgame" was taken), in `lax`.
- **The database** is `gitgame`, with a user of its own that isn't a superuser, on the existing Postgres app `rps-db` ([ADR-0008](../docs/adr/0008-the-beta-shares-a-postgres.md)). Its `DATABASE_URL` is a secret of the app, over Fly's private network (`rps-db.flycast`, IPv6, hence `ECTO_IPV6` in `fly.toml`).
- **`SECRET_KEY_BASE`** is a secret of the app (`mix phx.gen.secret`).
- **The domain:** `fly certs add gitgame.online`, and the DNS records it asked for (`fly certs show gitgame.online -a gitgame-online`).
- **Deploys:** a deploy token (`fly tokens create deploy`) in the repository's secret `FLY_API_TOKEN`.

**A release.** Follow [workflow.md](../docs/workflow.md): move *Unreleased* in the changelog under a version, commit `chore(release): vX.Y.Z`, then tag and push the tag. The workflow deploys it, migrations run first, and it checks `https://gitgame.online/api/health`.

Behind Fly's proxy the server reads who asked from `fly-client-ip`, so the rate limits count people, not the proxy.

### Turning on the optional features

Each is off until its secrets are set, and each is set with `fly secrets set`, run from the repository root. Setting secrets restarts the app's machine with them, on the image it already runs: nothing from `main` is deployed. `fly secrets list -a gitgame-online` shows which are set, never their values.

#### GitHub sign-in

1. Create an OAuth app at https://github.com/settings/applications/new (or under an organization: Settings → Developer settings → OAuth Apps):
   - **Application name:** `Git Game`
   - **Homepage URL:** `https://gitgame.online`
   - **Authorization callback URL:** `https://gitgame.online/api/auth/github/callback`
   - **Enable Device Flow:** off.
2. On the app's page, copy the **Client ID**, then **Generate a new client secret** and copy it (GitHub shows it once).
3. Set both:

   ```bash
   fly secrets set -a gitgame-online GITGAME_GITHUB_CLIENT_ID=<client id> GITGAME_GITHUB_CLIENT_SECRET=<client secret>
   ```

4. Try it. Open https://gitgame.online: "link GitHub" is now beside your handle. Tap it; GitHub asks for no scopes, only your public profile, and you come back with your login and avatar. Open the site in a second browser, link the same account there, and the first browser's games are listed.

#### Email reminders (SMTP)

Emails come from `Git Game <play@gitgame.online>` (`GitGame.Mailer.from/0`), so the provider must be allowed to send for `gitgame.online`. Which provider is the maintainer's choice ([ADR-0006](../docs/adr/0006-notifications-web-push-and-email.md): the provider is configuration). It needs SMTP submission with **STARTTLS on port 587**, and a username and password: the server always upgrades to TLS and always logs in, and port 465's implicit TLS won't work.

1. In the provider, add `gitgame.online` as a sending domain. At gitgame.online's DNS host, add the records it gives, beside the A and AAAA records Fly's certificate uses (leave those as they are):
   - **SPF:** a TXT record on `gitgame.online`: `v=spf1 include:<the provider's SPF domain> ~all`. A name has one SPF record: if one exists, add the `include:` to it.
   - **DKIM:** the provider's records, usually CNAME or TXT records at `<selector>._domainkey.gitgame.online`.
   - **DMARC:** a TXT record on `_dmarc.gitgame.online`: `v=DMARC1; p=none`, to begin with. Tighten it to `p=quarantine` once the provider shows mail passing.
   - A bounce (Return-Path) CNAME, if the provider asks for one.

   Wait until the provider shows the domain as verified; `dig +short TXT gitgame.online` and `dig +short TXT _dmarc.gitgame.online` show what DNS says. Sending needs no MX record, and nothing receives mail sent to `play@gitgame.online`.
2. Make SMTP credentials in the provider, and set them:

   ```bash
   fly secrets set -a gitgame-online GITGAME_SMTP_RELAY=<smtp host> GITGAME_SMTP_PORT=587 GITGAME_SMTP_USERNAME=<username> GITGAME_SMTP_PASSWORD=<password>
   ```

3. Try it. "reminders by email" now appears on the start screen. Give an address you read, and the confirmation arrives from `play@gitgame.online`: check it isn't in spam, and that its headers say `spf=pass` and `dkim=pass`. Its link brings you back with the address confirmed. Then try a reminder (below). Every email after the confirmation has an unsubscribe link and a one-click `List-Unsubscribe` header. The digest, for players who choose it, goes at 08:00 UTC.

#### Push reminders (Web Push)

1. See whether push is on: `curl -s -o /dev/null -w '%{http_code}\n' https://gitgame.online/api/push` prints `200` if it is, `404` if not.
2. If not, make a key pair and set it, with an address you read as the subject (push services write to it if something is wrong):

   ```bash
   cd server && mix gitgame.vapid_keys
   fly secrets set -a gitgame-online GITGAME_VAPID_PUBLIC_KEY=<public key> GITGAME_VAPID_PRIVATE_KEY=<private key> GITGAME_VAPID_SUBJECT=mailto:<address>
   ```

   Changing the pair later unsubscribes every browser. Without `GITGAME_VAPID_SUBJECT`, the subject is `mailto:hello@gitgame.online`, and nothing receives mail there.
3. Use a browser that takes push:
   - Chrome, Edge or Firefox, on a computer or Android;
   - Safari on a Mac;
   - on an iPhone or iPad, only from the Home Screen (Share → Add to Home Screen, iOS 16.4 or later), not in a Safari tab.

#### Trying a reminder

Reminders go only in games with 24-hour days: one when a day opens, and one when a quarter of it is left, at most one per game a day on each channel.

1. On https://gitgame.online, open "more: set up a game by hand". Choose 1 bot and "correspondence · 24h days", then tap `git init`.
2. Write a pack and send it. The bot's pack is already in, so the day closes and the next one opens at once.
3. For push: tap "remind me when my pack is due", below "send pack", and allow notifications. It turns into "reminders are on".
4. Send the next day's pack. The day after it opens at once, and so does its reminder: a push notification ("your pack is due"), and an email if a confirmed address takes one per game. Tapping either opens the game, and the beta report counts the visit as one that came from a notification.

## Before you push

CI runs exactly these, and fails on any of them:

```bash
mix format --check-formatted
mix compile --warnings-as-errors
mix test
```
