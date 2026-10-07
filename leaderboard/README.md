# Leaderboard

The game works without any of this. Leave `BOARD_API` empty in `index.html`
and the board is per-device and the game opens no socket at all. This makes it
shared, so a score set on the panel in one office shows up in the next.

GitHub Pages only serves files, so the shared board has to live somewhere else.
There are two ways to put it there. Both end with a URL that goes into
`BOARD_API`.

---

## The short way — Val Town (no terminal, ~2 minutes)

1. **val.town** → sign in with GitHub
2. **New → HTTP val**
3. Paste [`valtown.ts`](valtown.ts) over the placeholder and save
4. Copy the URL it shows: `https://<you>-<name>.web.val.run`

That is the URL. Check it before using it — this should return
`{"rows":[],"stats":{...}}`:

```bash
curl https://YOU-NAME.web.val.run/top
```

Storage is built in, nothing to create or bind. The free tier allows 10 MB;
this board is a few kilobytes.

**The trade:** blob storage has no transactions, so two runs ending in the same
instant can race and one loses its row. On office panels that is a rounding
error. Val Town is also a much smaller company than Cloudflare — if it ever
went away the game would carry on, the board would just fall back to
per-device.

---

## The durable way — Cloudflare Worker

Three commands from inside this folder. Needs Node; `npx` fetches wrangler, so
there is nothing to install globally.

```bash
npx wrangler kv namespace create LASTMILE
```

Paste the `id` it prints into [`wrangler.toml`](wrangler.toml) over
`PASTE_THE_KV_ID_HERE`, then:

```bash
npx wrangler deploy
```

The first run opens a browser to log in (a free Cloudflare account is well
inside the free tier). It prints
`https://last-mile.<your-subdomain>.workers.dev`.

**Without a terminal:** dash.cloudflare.com → Workers & Pages → create a Worker
→ paste [`src/index.js`](src/index.js) over the placeholder → Deploy. Then
Storage & Databases → KV → create a namespace, and on the Worker,
Settings → Bindings → Add → KV Namespace, variable name **`BOARD`** → Deploy.
That binding name matters; the code reads `env.BOARD`. Optionally add a text
variable `ALLOW_ORIGIN` set to `https://lucidium2000.github.io`.

---

## Then

Set `BOARD_API` in `index.html` to the URL, no trailing slash, and push.

## What either one stores

Three initials, the run's own numbers, and a random id the browser made up for
itself so repeat plays can be counted without counting a person twice. The set
of ids never leaves the server — the game only receives the count. No IP
address is read or written anywhere in either file.

## Abuse

Both are open endpoints on a public page, so treat the board as decorative, not
as a record. Everything is clamped to sane ranges, initials are stripped to
A–Z0–9, and one id may post at most once every ten seconds. Someone determined
with the URL can still write nonsense. If that happens, clear the stored board
and it starts clean.
