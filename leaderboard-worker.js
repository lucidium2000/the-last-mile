/* =========================================================================
   THE LAST MILE — leaderboard server
   =========================================================================

   A Cloudflare Worker. Free tier is far more than this needs. It implements
   the whole contract the game expects, which is two routes:

     GET  /top?n=25   -> { rows: [...], stats: {...} }
     POST /score      -> { rows: [...], stats: {...} }     (body: JSON as text)

   The game talks to it only if BOARD_API in index.html is set. Leave that
   empty and the game never opens a socket.

   ---- Deploying it -------------------------------------------------------

   1. https://dash.cloudflare.com -> Workers & Pages -> Create -> Worker.
      Name it something like `last-mile`. Deploy the placeholder.
   2. Edit code, paste this whole file over what is there, Deploy.
   3. Storage & Databases -> KV -> Create namespace, call it `LASTMILE`.
   4. Back in the Worker -> Settings -> Bindings -> Add -> KV namespace.
      Variable name: BOARD      Namespace: LASTMILE
   5. Settings -> Variables -> add a plain text variable (optional but
      recommended):
         ALLOW_ORIGIN = https://lucidium2000.github.io
      Leave it out and any origin may read and post.
   6. Copy the worker URL (https://last-mile.<your-subdomain>.workers.dev)
      into BOARD_API in index.html, commit, push.

   ---- What it stores -----------------------------------------------------

   Only what the game sends: three initials, the run's numbers, and the random
   id the browser made up for itself so repeat plays can be counted without
   counting a person twice. No IP address is read or written anywhere in this
   file. Cloudflare's own edge logs are a separate matter and are not under
   the game's control; if that matters to you, turn logging off for the
   worker in the dashboard.

   ---- Abuse ---------------------------------------------------------------

   This is an open endpoint on a public page, so treat the board as
   decorative, not as a record. Everything is clamped to sane ranges, initials
   are stripped to A-Z0-9, and one id may post at most once every 10 seconds.
   A determined person with the URL can still write nonsense to it. If that
   happens, delete the `board` key in KV and it starts clean.
   ========================================================================= */

const BOARD_KEY = "board";
const STATS_KEY = "stats";
const KEEP = 100;          // rows retained server side
const POST_EVERY_MS = 10000;

const POWERS = ["tam", "chuck", "metro", "path", "agent", "insight", "traffic", "sponsor"];

export default {
  async fetch(request, env) {
    const origin = env.ALLOW_ORIGIN || "*";
    const cors = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Cache-Control": "no-store",
    };
    const json = (body, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { ...cors, "Content-Type": "application/json" },
      });

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (!env.BOARD) return json({ error: "no KV binding named BOARD" }, 500);

    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/top") {
      const n = clampInt(url.searchParams.get("n"), 1, KEEP, 25);
      const rows = await readJSON(env, BOARD_KEY, []);
      const stats = await readJSON(env, STATS_KEY, blankStats());
      return json({ rows: rows.slice(0, n), stats });
    }

    if (request.method === "POST" && url.pathname === "/score") {
      let body;
      try {
        body = JSON.parse(await request.text());
      } catch {
        return json({ error: "bad json" }, 400);
      }

      const id = String(body.id || "").slice(0, 64);
      if (!id) return json({ error: "no id" }, 400);

      // one post per id per POST_EVERY_MS, held in KV with a short ttl
      const seenKey = "seen:" + id;
      if (await env.BOARD.get(seenKey)) return json({ error: "slow down" }, 429);
      await env.BOARD.put(seenKey, "1", {
        expirationTtl: Math.ceil(POST_EVERY_MS / 1000),
      });

      const rec = {
        ini: String(body.ini || "---").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3) || "---",
        score: clampInt(body.score, 0, 50000000, 0),
        rows: clampInt(body.rows, 0, 5000, 0),
        steps: clampInt(body.steps, 0, 200000, 0),
        streets: clampInt(body.streets, 0, 5000, 0),
        rides: clampInt(body.rides, 0, 500, 0),
        tamWins: clampInt(body.tamWins, 0, 2000, 0),
        secs: clampInt(body.secs, 0, 86400, 0),
        won: !!body.won,
        cause: String(body.cause || "").replace(/[^\x20-\x7E]/g, "").slice(0, 28),
        powers: cleanPowers(body.powers),
        at: Date.now(),
      };

      const rows = await readJSON(env, BOARD_KEY, []);
      rows.push(rec);
      rows.sort((a, b) => b.score - a.score || a.at - b.at);
      const kept = rows.slice(0, KEEP);
      await env.BOARD.put(BOARD_KEY, JSON.stringify(kept));

      const stats = bump(await readJSON(env, STATS_KEY, blankStats()), rec, id);
      await env.BOARD.put(STATS_KEY, JSON.stringify(stats));

      return json({ rows: kept.slice(0, 25), stats });
    }

    return json({ error: "not found" }, 404);
  },
};

async function readJSON(env, key, dflt) {
  try {
    const raw = await env.BOARD.get(key);
    if (!raw) return dflt;
    const v = JSON.parse(raw);
    return v === null || v === undefined ? dflt : v;
  } catch {
    return dflt;
  }
}
function clampInt(v, lo, hi, dflt) {
  const n = Math.round(Number(v));
  if (!isFinite(n)) return dflt;
  return Math.min(hi, Math.max(lo, n));
}
function cleanPowers(p) {
  const out = {};
  for (const k of POWERS) out[k] = clampInt(p && p[k], 0, 10000, 0);
  return out;
}
function blankStats() {
  return {
    plays: 0, wins: 0, deaths: 0, bestScore: 0,
    steps: 0, rows: 0, rides: 0, tamWins: 0, secs: 0,
    players: 0, seen: {}, powers: cleanPowers(null), first: Date.now(), last: 0,
  };
}
function bump(st, rec, id) {
  st.plays++;
  if (rec.won) st.wins++; else st.deaths++;
  if (rec.score > st.bestScore) st.bestScore = rec.score;
  st.steps += rec.steps; st.rows += rec.rows; st.rides += rec.rides;
  st.tamWins += rec.tamWins; st.secs += rec.secs; st.last = rec.at;
  if (!st.seen) st.seen = {};
  if (!st.seen[id]) { st.seen[id] = 1; st.players = Object.keys(st.seen).length; }
  for (const k of POWERS) st.powers[k] = (st.powers[k] || 0) + (rec.powers[k] || 0);
  /* `seen` is a set of random browser ids and nothing else. It only exists so
     "players" is not just "plays". If it ever gets big enough to matter,
     swap it for a HyperLogLog or just drop it. */
  return st;
}
