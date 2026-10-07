# Leaderboard worker

The game runs fine without this — leave `BOARD_API` empty in `index.html` and
scores stay on each device, and the game opens no socket at all. This makes the
board shared, so a score set on the panel in one office shows up in the next.

Everything is already wired up. Three commands, from inside this folder:

```bash
npx wrangler kv namespace create LASTMILE
```

It prints an `id`. Paste it into `wrangler.toml` over `PASTE_THE_KV_ID_HERE`.

```bash
npx wrangler deploy
```

The first run opens a browser to log in to Cloudflare (a free account is
enough — this is far inside the free tier). When it finishes it prints the URL:

```
https://last-mile.<your-subdomain>.workers.dev
```

**That is the Worker URL.** Check it before handing it over — this should
return `{"rows":[],"stats":{...}}`:

```bash
curl https://last-mile.<your-subdomain>.workers.dev/top
```

Then set `BOARD_API` in `index.html` to that URL (no trailing slash) and push.

## What it stores

Three initials, the run's own numbers, and a random id the browser made up for
itself so repeat plays can be counted without counting a person twice. No IP
address is read or written anywhere in `src/index.js`.
