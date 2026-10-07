# Leaderboard

The shared board. A score set on the panel in one office shows up in the next.

```
the game  ──►  https://lucidium2000--be403ca8c25711f194891607ee4eb77e.web.val.run
                 │
                 ├─ code  ── valtown.ts  (this repo is the authoritative copy)
                 └─ data  ── Val Town blob storage  (backed up into backups/)
```

The game works without any of it. Emptying `BOARD_API` in `index.html` puts it
back to a per-device board and zero network calls, which is the RoomOS-safe
default.

## The files

| | |
|---|---|
| [`valtown.ts`](valtown.ts) | the whole server. **The only copy that counts.** |
| [`val.json`](val.json) | which val it is, which file inside it, and the URL |
| [`lb.mjs`](lb.mjs) | the one command for everything below |
| `backups/` | dated snapshots of the live data, committed |
| [`../report.html`](../report.html) | the full readout — every metric, as a page |

## Setup, once

One credential does everything. Make it at **val.town → Settings → API Tokens**
with **val read + write**, then:

```bash
setx VAL_TOWN_API_KEY "vt_your_token_here"
```

Open a new terminal afterwards — `setx` only affects new ones. The token is
read from the environment and never written to a file here, so it cannot end up
in a commit.

## Editing it

Edit [`valtown.ts`](valtown.ts), then:

```bash
node leaderboard/lb.mjs push
```

That is live immediately; the URL never changes, so nothing in the game needs
touching. Commit the file and the repo and the server agree again.

**If you edit in the Val Town web editor instead** — which is fine, it is often
quicker — pull it back down so the repo stops being a lie:

```bash
node leaderboard/lb.mjs pull
```

Either direction works. What breaks things is editing both and guessing, and
that is what `check` is for:

```bash
node leaderboard/lb.mjs check
```

Exit 0 if the live code matches `valtown.ts`, exit 1 if it has drifted. It
ignores line endings, because this repo checks out CRLF on Windows and Val Town
stores LF, and a check that always cries wolf is a check nobody runs.

## Backing it up

Git covers the code. It cannot cover the **data** — the rows and the counters
live in Val Town's blob store, not in any file here. So:

```bash
node leaderboard/lb.mjs backup
```

Writes `backups/board-<date>.json` with every row and every counter. Commit it
and the data is version controlled too. To put one back:

```bash
node leaderboard/lb.mjs restore leaderboard/backups/board-2026-10-07-14-30-00.json
```

It shows you how many rows you are replacing and how many you are replacing
them with, and does nothing unless you type `yes`.

## Everything the command does

```bash
node leaderboard/lb.mjs status          # what is live, and is the code in sync
node leaderboard/lb.mjs check           # exit 1 on drift, for a script
node leaderboard/lb.mjs push            # repo code  -> Val Town
node leaderboard/lb.mjs pull            # Val Town   -> repo code
node leaderboard/lb.mjs backup          # live data  -> backups/<date>.json
node leaderboard/lb.mjs restore <file>  # a backup   -> live data
node leaderboard/lb.mjs prune ZZZ       # drop one name, leave everyone else
node leaderboard/lb.mjs reset           # empty the board and the counters
```

`status` is the only one that works without a token — it reads the public
endpoint, so it always tells you something. `restore`, `prune` and `reset` all
ask before they touch anything.

## The readout

[`report.html`](../report.html) sits next to the game and reads the same public
`/top` route, so it needs no token and no setup:

```
https://lucidium2000.github.io/the-last-mile/report.html
```

Headline totals, per-run averages, what stops people, power-up usage and the
full sortable board, with CSV and JSON download and a print stylesheet. It reads
the endpoint out of `index.html` rather than repeating it, so there is still
only one place the URL is written.

It asks the server for nothing the server does not already send, so there is
nothing to deploy for it and nothing that can fall out of step.

## What it stores

Three initials, the run's own numbers, and a random id the browser made up for
itself so repeat plays can be counted without counting a person twice. **The set
of ids never leaves the server** — the game only ever receives the count. No IP
address is read or written anywhere in `valtown.ts`.

Deliberately *not* collected: user agent, screen size, language, timezone,
location. Those need no permission, which is exactly what makes them a
fingerprint. So there are no device or location statistics in the readout,
because there is nothing to report.

## Why there are no admin routes

`backup`, `restore`, `prune` and `reset` all go through Val Town's own API with
your token. None of them is a route on the public endpoint. That endpoint has
exactly two routes — `GET /top` and `POST /score` — so there is nothing on it to
find, and no second secret to manage.

## Abuse

It is an open endpoint on a public page, so treat the board as decorative, not
as a record. Everything is clamped to sane ranges, initials are stripped to
A–Z0–9, and one id may post at most once every ten seconds. Someone determined
with the URL can still write nonsense. If that happens: `backup`, then `prune`
or `reset`.

## The Cloudflare version

There used to be a second implementation of the same two routes for Cloudflare
Workers, plus a duplicate of it, plus a `wrangler.toml`. Three copies of one
contract, two of them unused and already going stale — which is the drift
problem this whole folder exists to stop. They were removed; the last commit
that has them is **2006600**:

```bash
git show 2006600:leaderboard-worker.js > worker.js
```
