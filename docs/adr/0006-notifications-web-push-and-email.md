# ADR-0006: Notifications through standard Web Push and email, written fresh

*Status: Proposed · Date: 2026-09-30*

## Context

The [charter](0000-project-charter.md) calls notifications the product: "push (FCM), email, Slack/Discord webhooks, daily digest. 'It's your turn' is the retention loop" (decision 16). It planned to lift RPS's FCM notifier (decision 17). As with sign-in ([ADR-0005](0005-sign-in-written-fresh.md)), RPS isn't at hand, and the product has changed shape since the charter was written:

- The client is a PWA served from its own origin (M11a), with a service worker already.
- Players are anonymous by default, and we hold no email address for anyone: ADR-0005 decided never to ask GitHub for one.
- The beta's report counts visits "from a notification" apart from unprompted ones (M12). A notification has to say so when it's opened.
- Days last 24 hours, 5 minutes or 60 seconds. Only a 24-hour day is long enough for a reminder to mean anything; in shorter games the player is already looking at the screen.

## Decision

Notifications are sent by the server itself, through two open standards, with no vendor SDK and nothing lifted from RPS:

1. **Web Push (RFC 8030) with VAPID (RFC 8292)** for the browser.
   - The service worker subscribes and the server stores the subscription.
   - A notification is a push with no payload, which needs no message encryption. The service worker, woken by it, fetches the player's games and shows "your pack is due" from them. So a push carries nothing a push service could read.
   - The VAPID key pair is generated for the deployment and kept in its secrets. This reaches Chrome (whose push service is FCM), Firefox and Safari alike, without a Firebase project.
2. **Email** for players who give an address for it.
   - It's asked for in the client, with its own consent, never taken from GitHub, and confirmed by a link before anything is sent.
   - Every email carries a one-click unsubscribe.
   - It's sent through SMTP, via Swoosh, so the provider is configuration, chosen with the host (ADR-0007).
3. **What is sent,** only in games with 24-hour days:
   - "your pack is due" when a day opens with no pack of yours in it, and once more when a quarter of the day is left;
   - "v1.0 has shipped" when a game you're in is released.
   - Nothing for a day whose pack you've sent, and nothing to a player who has left the company.
   - At most one push and one email per game per day, whatever happens in it.
4. **The daily digest** is one email a day listing your games that wait on you, instead of one email per game, for players who choose it.
5. **Opening a notification** opens the game with `?via=notification` (or `email`, `digest`), which the beta's visit mark records (M12).
6. **Asking permission:** the browser's permission prompt is shown only after a player has sent a pack in a 24-hour game and taps "remind me". Never on a first visit, when a prompt is most likely to be refused for good.

Slack and Discord webhooks stay in the charter, for Teams (Phase 4); they are not part of the beta.

## Alternatives considered

- **The FCM SDK, as the charter planned.**
  - It needs a Firebase project and its client SDK in a bundle that is 13 KB gzipped today.
  - On the web, FCM's SDK is itself a wrapper over Web Push, and it ties delivery to a second vendor.
  - Standard Web Push reaches FCM for Chrome users without any of that. Rejected.
- **Web Push with encrypted payloads (RFC 8291).** The notification could carry its text. But the encryption is code we'd have to get exactly right, for text the service worker can fetch in one request. Payloadless first; payloads later if the fetch proves too slow.
- **A notification service (OneSignal and the like).** It would be a third party between us and every player's device, and would know who plays when. Rejected, for the same reasons as FCM.
- **Email from GitHub.** ADR-0005 asks GitHub for no scopes, on purpose. An address given for this purpose, and confirmed, is both more honest and more likely to be read.
- **Reminders in every game, whatever its day length.** In a 60-second game the reminder would arrive after the day had closed. Rejected.

## Consequences

- **M10 can be built without any account but the email provider's.** The VAPID keys are ours to generate, and the email provider is chosen with the host.
- **New tables:** push subscriptions, email addresses with their confirmation, and a record of what was sent, which is how "at most once a day" is kept and how the beta counts notifications.
- **A notification job:** Oban, when a day opens and when a quarter of it is left, as the day-closing jobs already are.
- **The service worker grows** a push handler and a notification click handler. It needs checking in real browsers, since this project's embedded test browser doesn't run service workers.
- **Players get less than the charter's "notifications are the product" might suggest** in the beta: no Slack, no Discord, and nothing in short games. The beta's report (M12) will say whether reminders bring people back, which is the question worth answering first.

## Supersedes / superseded by

Amends [ADR-0000](0000-project-charter.md):
- **Decision 16:** "push (FCM)" becomes standard Web Push; Slack/Discord webhooks move to Phase 4.
- **Decision 17's "RPS — FCM notifier":** it is no longer lifted.

The rest of both decisions, and of the charter, stands.
