/* =========================================================================
   TE LAST MILE — leaderboard, the no-terminal version
   =========================================================================

   Same contract as leaderboard-worker.js, but for Val Town, where a URL
   appears the moment you press save. There is nothing to install and nothing
   to bind.

     1. val.town -> sign in with GitHub
     2. New -> HTTP val
     3. paste this whole file over the placeholder, save
     4. copy the URL it shows (https://<you>-<name>.web.val.run)

   Check it before using it. This should return {"rows":[],"stats":{...}}:

     curl https://<you>-<name>.web.val.run/top

   Then BOARD_API in index.html gets that URL, with no trailing slash.

   ---- One difference from the Cloudflare version -------------------------

   Blob storage has no transactions, so two runs ending in the same instant
   can race and one of them loses its row. For a game on office panels that
   is a rounding error; if this ever ran somewhere busy it would want a real
   database. The rate limit is held in the same record rather than in a
   separate key with a ttl, for the same reason - one less thing to write.

   ---- What it stores -----------------------------------------------------

   Three initials, the run's own numbers, and the random id the browser made
   up for itself so repeat plays can be counted without counting a person
   twice. No IP address is read or written anywhere in this file.
   ========================================================================= */

import { blob } from "https://esm.town/v/std/blob";

const BOARD_KEY = "lastmile_board";
const STATS_KEY = "lastmile_stats";
const KEEP = 100;              // rows retained server side
const POST_EVERY_MS = 10000;   // one post per browser id per ten seconds

/* Set this to your Pages origin to stop anyone else's page posting to it.
   "*" lets any origin read and post. */
const ALLOW_ORIGIN = "https://lucidium2000.github.io";

const POWERS = ["tam", "chuck", "metro", "path", "agent", "insight", "traffic", "sponsor"];

export default async function (request: Request): Promise<Response> {
  const cors = {
    "Access-Control-Allow-Origin": ALLOW_ORIGIN,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
  };
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  if (request.method === "OPTIONS") return new Response(null, { headers: cors });

  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/top") {
    const n = clampInt(url.searchParams.get("n"), 1, KEEP, 25);
    const rows = await readJSON(BOARD_KEY, []);
    const stats = await readJSON(STATS_KEY, blankStats());
    return json({ rows: rows.slice(0, n), stats: publicStats(stats) });
  }

  if (request.method === "POST" && url.pathname === "/score") {
    let body: any;
    try {
      body = JSON.parse(await request.text());
    } catch {
      return json({ error: "bad json" }, 400);
    }

    const id = String(body.id || "").slice(0, 64);
    if (!id) return json({ error: "no id" }, 400);

    const stats = await readJSON(STATS_KEY, blankStats());
    const now = Date.now();
    if (stats.seen && now - (stats.seen[id] || 0) < POST_EVERY_MS) {
      return json({ error: "slow down" }, 429);
    }

    const rec = {
      ini: String(body.ini || "---").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3) || "---",
      score: clampInt(body.score, 0, 50000000, 0),
      rows: clampInt(body.rows, 0, 5000, 0),
      steps: clampInt(body.steps, 0, 200000, 0),
      streets: clampInt(body.streets, 0, 5000, 0),
      rides: clampInt(body.rides, 0, 500, 0),
      tamWins: clampInt(body.tamWins, 0, 2000, 0),
      addons: clampInt(body.addons, 0, 2000, 0),
      secs: clampInt(body.secs, 0, 86400, 0),
      won: !!body.won,
      cause: String(body.cause || "").replace(/[^\x20-\x7E]/g, "").slice(0, 28),
      powers: cleanPowers(body.powers),
      at: now,
    };

    const rows = await readJSON(BOARD_KEY, []);
    rows.push(rec);
    rows.sort((a: any, b: any) => b.score - a.score || a.at - b.at);
    const kept = rows.slice(0, KEEP);
    await blob.setJSON(BOARD_KEY, kept);

    await blob.setJSON(STATS_KEY, bump(stats, rec, id));

    return json({ rows: kept.slice(0, 25), stats: publicStats(stats) });
  }

  return json({ error: "not found" }, 404);
}

async function readJSON(key: string, dflt: any) {
  try {
    const v = await blob.getJSON(key);
    return v === null || v === undefined ? dflt : v;
  } catch {
    return dflt;
  }
}
function clampInt(v: any, lo: number, hi: number, dflt: number) {
  const n = Math.round(Number(v));
  if (!isFinite(n)) return dflt;
  return Math.min(hi, Math.max(lo, n));
}
function cleanPowers(p: any) {
  const out: Record<string, number> = {};
  for (const k of POWERS) out[k] = clampInt(p && p[k], 0, 10000, 0);
  return out;
}
function blankStats() {
  return {
    plays: 0, wins: 0, deaths: 0, bestScore: 0,
    steps: 0, rows: 0, rides: 0, tamWins: 0, addons: 0, secs: 0,
    players: 0, seen: {} as Record<string, number>,
    powers: cleanPowers(null), first: Date.now(), last: 0,
  };
}
/* `seen` is the browser ids, and it never leaves the server - the game only
   needs the count. */
function publicStats(st: any) {
  const { seen, ...rest } = st;
  return rest;
}
function bump(st: any, rec: any, id: string) {
  st.plays++;
  if (rec.won) st.wins++; else st.deaths++;
  if (rec.score > st.bestScore) st.bestScore = rec.score;
  st.steps += rec.steps; st.rows += rec.rows; st.rides += rec.rides;
  st.tamWins += rec.tamWins;
  // the stats blob predates this field, so it starts from whatever is there
  st.addons = (st.addons || 0) + (rec.addons || 0);
  st.secs += rec.secs; st.last = rec.at;
  if (!st.seen) st.seen = {};
  if (!st.seen[id]) st.players = Object.keys(st.seen).length + 1;
  st.seen[id] = rec.at;                        // doubles as the rate limit clock
  for (const k of POWERS) st.powers[k] = (st.powers[k] || 0) + (rec.powers[k] || 0);
  return st;
}
