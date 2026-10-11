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
const RECENT_KEY = "lastmile_recent";

/* ------------------------------------------------------- WHICH BOARD ----
   ?team=nyc, or `team` in the posted body, puts the run on its own set of
   three blobs. No team is the original set, untouched and still holding
   every run played before any of this existed.

   The suffix is rebuilt from a whitelist rather than trusted. This string
   becomes part of a storage key, and a key built out of whatever a client
   sends is how one board ends up overwriting another - or reading one it was
   never meant to see. Anything that is not 1-24 characters of lower-case
   letters, digits and hyphens is treated as no team at all. */
function teamSuffix(raw: unknown) {
  const t = String(raw || "").toLowerCase();
  return /^[a-z0-9-]{1,24}$/.test(t) ? "_" + t : "";
}
/* TWO COLLECTIONS, because they answer two different questions.

   The BOARD is the top scores: who is best, ordered by score, and it is meant
   to be hard to get on. RECENT is the last hundred runs whatever they scored,
   in the order they happened, and it is what the distribution charts read -
   because "how do runs end" asked of the leaderboard is asked of the winners,
   and the winners are not a sample of anybody.

   KEEP stays at 100 rather than dropping to the 20 the board shows. Retention
   is not display: the extra 80 cost nothing, they are the only history this
   thing has, and throwing them away to change a heading would be a strange
   trade. The game asks for the 20 it wants. */
const KEEP = 100;              // board rows retained server side
const RECENT_KEEP = 100;       // runs kept for the distribution, newest last
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
    const sfx = teamSuffix(url.searchParams.get("team"));
    const rows = await readJSON(BOARD_KEY + sfx, []);
    const stats = await readJSON(STATS_KEY + sfx, blankStats());
    const recent = await readJSON(RECENT_KEY + sfx, []);
    return json({
      rows: rows.slice(0, n),
      stats: publicStats(stats),
      recent: recentSummary(recent),
    });
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

    const sfx = teamSuffix(body.team);
    const stats = await readJSON(STATS_KEY + sfx, blankStats());
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
      champs: clampInt(body.champs, 0, 2000, 0),
      secs: clampInt(body.secs, 0, 86400, 0),
      won: !!body.won,
      cause: String(body.cause || "").replace(/[^\x20-\x7E]/g, "").slice(0, 28),
      powers: cleanPowers(body.powers),
      at: now,
    };

    const rows = await readJSON(BOARD_KEY + sfx, []);
    rows.push(rec);
    rows.sort((a: any, b: any) => b.score - a.score || a.at - b.at);
    const kept = rows.slice(0, KEEP);
    await blob.setJSON(BOARD_KEY + sfx, kept);

    /* And the same run again, in time order this time. Every run lands here,
       including the ones that drop straight off the bottom of the board -
       which is the point: a run that did not place is still a run that
       happened, and this is the only place that remembers it. */
    const recent = await readJSON(RECENT_KEY + sfx, []);
    recent.push(rec);
    const keptRecent = recent.slice(-RECENT_KEEP);
    await blob.setJSON(RECENT_KEY + sfx, keptRecent);

    await blob.setJSON(STATS_KEY + sfx, bump(stats, rec, id));

    return json({
      rows: kept.slice(0, 25),
      stats: publicStats(stats),
      recent: recentSummary(keptRecent),
    });
  }

  return json({ error: "not found" }, 404);
}

/* What the last hundred runs looked like. DERIVED ON READ rather than
   accumulated, which is the whole reason this is a window and not a counter:
   a running total can only ever grow and can never forget, so it would still
   be describing a game that has since been rebalanced. Recomputing over a
   hundred records costs nothing and is always exactly the hundred most recent
   runs, with nothing to migrate and no stale keys to cap. */
function recentSummary(list: any[]) {
  const causes: Record<string, number> = {};
  let wins = 0, steps = 0, rides = 0, rows = 0, secs = 0, best = 0;
  for (const r of list) {
    const why = r.won ? "Booked" : (String(r.cause || "").trim() || "Unknown");
    causes[why] = (causes[why] || 0) + 1;
    if (r.won) wins++;
    steps += r.steps || 0;
    rides += r.rides || 0;
    rows += r.rows || 0;
    secs += r.secs || 0;
    if ((r.score || 0) > best) best = r.score;
  }
  return { n: list.length, wins, steps, rides, rows, secs, best, causes };
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
    steps: 0, rows: 0, rides: 0, tamWins: 0, addons: 0, champs: 0, secs: 0,
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
  st.champs = (st.champs || 0) + (rec.champs || 0);
  st.secs += rec.secs; st.last = rec.at;
  if (!st.seen) st.seen = {};
  if (!st.seen[id]) st.players = Object.keys(st.seen).length + 1;
  st.seen[id] = rec.at;                        // doubles as the rate limit clock
  for (const k of POWERS) st.powers[k] = (st.powers[k] || 0) + (rec.powers[k] || 0);
  return st;
}
