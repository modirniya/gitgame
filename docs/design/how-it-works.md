# How it works: an event-sourced card game whose rules are Git

*Status: Draft · Last verified: 2026-10-04*

A draft of the engineering write-up for launch week ([website-content.md](website-content.md), wave 2), to be finished in the maintainer's voice and then published at `/notes/how-it-works`. It is posted as a normal submission beside the Show HN, and sent to the newsletters that take engineering posts. Every claim below is in an ADR or in the code it names; the numbers are as of 2026-10-04.

---

[Git Game](https://gitgame.online) is a free card game whose rules are Git. You ship commits to a shared `main`, pull before you push, bluff bugs past `git blame`, and survive `git push --force`. Every command prints what Git prints. It is open source, built in Elixir, and most of the interesting decisions are about time.

## There are no turns

A card game played online usually means a turn, a timer, and someone waiting. Git isn't like that: a team pushes when it pushes, and the remote sorts it out. So the game has **days** instead. Every player writes a **pack** for the day, up to four commands, and when the day closes the **remote** runs everyone's packs against `main`, one whole pack at a time, in a random order. A day lasts 60 seconds, 5 minutes or 24 hours, and ends early once every pack is in, so a lunch game and a week-long game by correspondence are the same game.

The order used to be arrival order, as a real remote's is. A simulation of 4,000 games per condition ([ADR-0003](../adr/0003-batch-packs-at-the-deadline.md)) showed why that can't survive contact with time zones: under arrival order, sending first won 61% of two-player games. Batching at the deadline made it 50.5 to 49.5. The price is that everyone writes blind to today's pushes, so conflicts about double; the drama moves from *when* you send to *what you guess* the others will do.

## The log stores what players did

Every game is an append-only log in Postgres with three kinds of event: the game was created with this seed and these players, this pack was sent, this day closed ([ADR-0004](../adr/0004-the-event-log-stores-inputs.md)). That's all. The state of a game is its inputs folded through the resolver; the day logs people read are derived the same way and are never stored as truth.

This is the opposite of storing results, and it is cheaper in every way that matters here. There is one implementation of every rule, not a second one that applies a result. A replay is a fold up to a day. A game keeps a snapshot of the rules it was created with, so a rules change (the rules are at v0.2 and the beta is the playtest) never alters a game in progress. And a bug fixed in the resolver changes the day logs of games already played, which is honest: the log shows what the rules make of the inputs, and a resolver fix has to say, in its PR, whether it changes finished games.

Packs carry the version of the game they were written against, and a pack for a version that has moved on is refused the way Git refuses it: `! [rejected] (fetch first)`.

## The resolver is pure, and the tests say so

`GitGame.Resolver` takes a game and a day's packs and returns the next game and the day log. No side effects, no clock, no database. Two property tests hold it to that, each under both resolution orders: *every day leaves a valid state* and *replaying the packs from the seed reproduces the game*, over random games with random packs. The second one is what makes replays free.

Everything random in a game comes from one seed: the deck's shuffle, each day's incident, each day's resolution order, a die roll. Each purpose draws from its own stream, derived from the seed and the purpose alone (`GitGame.Seeded`), so drawing one day's incident can never shift another day's order, and a seed means the same game on any server that ever runs it. The guided first game uses this the other way round: the server tries seeds until it finds one whose first day deals a clean card and lands the new player's first push.

## Git's words, captured

The game prints `! [rejected]        main -> main (non-fast-forward)`, `CONFLICT (content): Merge conflict in api.py`, `Already up to date.`, `Everything up-to-date`, and Git's two spellings of "nothing to do" are both correct. Credibility with people who know Git is the only moat a game like this has, so the rule is: if unsure what Git says, run Git. The site's pages about those lines go further and quote nothing typed: a script builds each scenario in a scratch repository with fixed dates and captures what Git printed, and the page names the Git that printed it.

## Bots that say why

One tap plays a bot, and the bot writes a public "why" for every op it plays, from what anyone at the table could see: *someone else's big commit is ahead of you: you overwrite main*. The same policy, run on your own view, is the game's hint. The bot force-pushes when the odds say to, because the simulation showed that in two-player games a force over one big commit is a real choice (it wins about half the time), and solo players would never see the moment otherwise.

## The stack

Elixir and Phoenix for the remote, Postgres for the log, Server-Sent Events for "something changed, refetch". The client is a Vite build of plain JavaScript modules, no framework: it fetches a view and renders it, keeps no game state of its own, and so opening a game a week later is the same as opening it a second later. It is a PWA, so it installs and opens offline to the last thing it saw. Sign-in is a session cookie for an anonymous player with a generated handle, and GitHub OAuth for anyone who wants to come back from another device. One small machine on Fly.io runs all of it.

It is also built with substantial AI assistance, which the repository says at its root and in every commit that qualifies. A human has read every line that lands on `main`.

## What we don't know yet

Whether paying for a rejected push feels fair; whether a player who goes quiet should have a bot write their pack; whether batching at the deadline feels like a game or like noise. Those are the beta's questions, every game ends with a box for answering them, and the rules will change with what people say.

Play it at [gitgame.online](https://gitgame.online). The code is [on GitHub](https://github.com/modirniya/gitgame), AGPL.
