#!/usr/bin/env node
/* =========================================================================
   TE LAST MILE — leaderboard admin
   =========================================================================

   The code runs on Val Town and the authoritative copy lives in this repo.
   Two copies of anything drift, so this script is the thing that stops them:
   `check` says whether they have, `push` makes the live one match the repo,
   `pull` makes the repo match the live one.

   It also backs up the DATA, which git cannot do for you - the rows and the
   counters live in Val Town's blob store, not in any file here. `backup`
   pulls them into leaderboard/backups/ so a commit captures them.

   Everything here uses ONE credential, a Val Town API token, and it is only
   ever read from the environment - never a file, never a commit. The public
   endpoint the game talks to has no admin routes at all, which is the point:
   there is nothing on it to find.

     setx VAL_TOWN_API_KEY "vt_..."        (then open a new terminal)

   Make the token at val.town -> Settings -> API Tokens, with val read+write
   permission. Blob access rides along with the account.

   Usage, from the repo root:

     node leaderboard/lb.mjs status          what is live, and is it in sync
     node leaderboard/lb.mjs check           exit 1 if live code != repo code
     node leaderboard/lb.mjs push            repo code  -> Val Town
     node leaderboard/lb.mjs pull            Val Town   -> repo code
     node leaderboard/lb.mjs backup          live data  -> backups/<date>.json
     node leaderboard/lb.mjs restore <file>  a backup   -> live data
     node leaderboard/lb.mjs prune ZZZ       drop one name, leave the rest
     node leaderboard/lb.mjs blobs           what this token can actually see
     node leaderboard/lb.mjs reset           empty the board and the counters
   ========================================================================= */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import readline from "node:readline";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CFG = JSON.parse(fs.readFileSync(path.join(HERE, "val.json"), "utf8"));
const API = "https://api.val.town";
const TOKEN = process.env.VAL_TOWN_API_KEY || "";

const repoPath = path.join(HERE, CFG.repoFile);
const backupDir = path.join(HERE, "backups");

function die(msg) { console.error("\n  " + msg + "\n"); process.exit(1); }
function needToken() {
  if (!TOKEN) {
    die("No VAL_TOWN_API_KEY in the environment.\n" +
        "  Make one at val.town -> Settings -> API Tokens (val read+write),\n" +
        '  then run:  setx VAL_TOWN_API_KEY "vt_..."  and open a new terminal.');
  }
}

async function api(method, p, opts) {
  opts = opts || {};
  const res = await fetch(API + p, {
    method: method,
    headers: Object.assign(
      { Authorization: "Bearer " + TOKEN },
      opts.body === undefined ? {} : { "Content-Type": "application/json" }
    ),
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(function () { return ""; });
    die(method + " " + p + " -> " + res.status + "\n  " + txt.slice(0, 300));
  }
  if (res.status === 204) return null;
  return opts.raw ? await res.text() : await res.json();
}

let _valId = null;
async function valId() {
  if (_valId) return _valId;
  const v = await api("GET", "/v2/alias/vals/" + encodeURIComponent(CFG.username) +
                             "/" + encodeURIComponent(CFG.val));
  _valId = v.id;
  return _valId;
}

async function liveCode() {
  const id = await valId();
  return api("GET", "/v2/vals/" + id + "/files/content?path=" +
                    encodeURIComponent(CFG.valFile), { raw: true });
}
function repoCode() {
  if (!fs.existsSync(repoPath)) die("Missing " + repoPath);
  return fs.readFileSync(repoPath, "utf8");
}

/* Line endings are the one difference that is never a real difference: this
   repo checks out CRLF on Windows and Val Town stores LF. Comparing raw would
   report drift on every file every time, and a check that always cries wolf
   is a check nobody runs. */
function norm(s) { return s.replace(/\r\n/g, "\n").replace(/\s+$/, ""); }

async function blobList(prefix) {
  const r = await api("GET", "/v2/blob" +
    (prefix === undefined ? "" : "?prefix=" + encodeURIComponent(prefix)));
  return Array.isArray(r) ? r : (r && r.data) || [];
}

/* Reading the board through the API, with the one check that matters: if the
   public endpoint is serving rows and the API cannot find them, the key or the
   namespace is wrong and the honest answer is to say so. Reporting "nothing to
   do" in that situation is how a prune silently does nothing. */
async function readBoard() {
  const mine = await blobGet(CFG.blobKeys[0]);
  if (Array.isArray(mine) && mine.length) return mine;
  let live = null;
  try {
    const r = await fetch(CFG.url + "/top?n=100");
    if (r.ok) live = (await r.json()).rows || [];
  } catch (e) { /* offline: fall through to whatever the API said */ }
  if (live && live.length) {
    const keys = await blobList();
    die([
      "The board has " + live.length + " row" + (live.length === 1 ? "" : "s") +
        " on it, but this token cannot see them in blob storage.",
      "  Looked for:        " + CFG.blobKeys.join(", "),
      "  The token can see: " +
        (keys.length ? keys.map(function (k) { return k.key; }).join(", ")
                     : "(no blobs at all)"),
      "",
      "  Either the token belongs to a different Val Town account than the val,",
      "  or the val stores its data under different keys. Run",
      "      node leaderboard/lb.mjs blobs",
      "  and set blobKeys in leaderboard/val.json to what it lists.",
    ].join("\n"));
  }
  return mine || [];
}
async function blobGet(key) {
  const res = await fetch(API + "/v2/blob/" + encodeURIComponent(key),
                          { headers: { Authorization: "Bearer " + TOKEN } });
  if (res.status === 404) return null;
  if (!res.ok) die("GET blob " + key + " -> " + res.status);
  const txt = await res.text();
  try { return JSON.parse(txt); } catch (e) { return txt; }
}
async function blobPut(key, value) {
  const res = await fetch(API + "/v2/blob/" + encodeURIComponent(key), {
    method: "POST",
    headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
  if (!res.ok) die("POST blob " + key + " -> " + res.status + " " + (await res.text()).slice(0, 200));
}
async function blobDelete(key) {
  const res = await fetch(API + "/v2/blob/" + encodeURIComponent(key),
                          { method: "DELETE", headers: { Authorization: "Bearer " + TOKEN } });
  if (!res.ok && res.status !== 404) die("DELETE blob " + key + " -> " + res.status);
}

function ask(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(function (r) { rl.question(q, function (a) { rl.close(); r(a.trim()); }); });
}

function rowsIn(data) {
  const b = data && data[CFG.blobKeys[0]];
  return Array.isArray(b) ? b.length : 0;
}

/* ------------------------------------------------------------- commands -- */
const CMD = {
  async status() {
    // the public half needs no token, so this always reports something useful
    let board = null;
    try {
      const r = await fetch(CFG.url + "/top?n=100");
      board = r.ok ? await r.json() : null;
    } catch (e) { /* offline */ }
    console.log("\n  endpoint  " + CFG.url);
    if (board) {
      const s = board.stats || {};
      console.log("  live      " + board.rows.length + " rows, " + (s.plays || 0) +
                  " plays, " + (s.players || 0) + " players, best " + (s.bestScore || 0));
      if (board.rows[0]) console.log("  top       " + board.rows[0].ini + "   " + board.rows[0].score);
    } else {
      console.log("  live      UNREACHABLE");
    }
    if (!TOKEN) {
      console.log("  code      (set VAL_TOWN_API_KEY to compare)\n");
      return;
    }
    const same = norm(await liveCode()) === norm(repoCode());
    console.log("  code      " + (same
      ? "in sync with " + CFG.repoFile
      : "DRIFTED - `pull` takes the live one, `push` overwrites it"));
    const backups = fs.existsSync(backupDir)
      ? fs.readdirSync(backupDir).filter(function (f) { return f.endsWith(".json"); }).sort()
      : [];
    console.log("  backups   " + (backups.length
      ? backups.length + ", newest " + backups[backups.length - 1]
      : "none yet - run `backup`") + "\n");
  },

  async check() {
    needToken();
    const same = norm(await liveCode()) === norm(repoCode());
    console.log(same ? "in sync" : "DRIFTED: live code differs from " + CFG.repoFile);
    process.exit(same ? 0 : 1);
  },

  async push() {
    needToken();
    const code = repoCode();
    if (norm(await liveCode()) === norm(code)) {
      console.log("already in sync, nothing sent");
      return;
    }
    const id = await valId();
    await api("PUT", "/v2/vals/" + id + "/files?path=" + encodeURIComponent(CFG.valFile),
              { body: { content: code, type: "http" } });
    console.log("pushed " + CFG.repoFile + " -> " + CFG.val + "/" + CFG.valFile + ", live now");
  },

  async pull() {
    needToken();
    const code = await liveCode();
    if (norm(code) === norm(repoCode())) {
      console.log("already in sync, nothing written");
      return;
    }
    fs.writeFileSync(repoPath, code);
    console.log("pulled " + CFG.val + "/" + CFG.valFile + " -> " + CFG.repoFile + ", now commit it");
  },

  async backup() {
    needToken();
    await readBoard();                       // fails loudly if the keys are wrong
    const list = await blobList("lastmile_");
    const keys = list.map(function (b) { return b.key; }).filter(Boolean);
    const use = keys.length ? keys : CFG.blobKeys;
    const data = {};
    for (const k of use) data[k] = await blobGet(k);
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    fs.mkdirSync(backupDir, { recursive: true });
    const out = path.join(backupDir, "board-" + stamp + ".json");
    fs.writeFileSync(out, JSON.stringify({ at: Date.now(), keys: use, data: data }, null, 2));
    console.log("backed up " + rowsIn(data) + " rows and the counters ->\n  " +
                path.relative(process.cwd(), out) +
                "\n  commit it and the data is version controlled too");
  },

  /* What this token can actually see. The one command to run when something
     says it did nothing and you do not believe it. */
  async blobs() {
    needToken();
    const all = await blobList();
    if (!all.length) {
      console.log("\n  This token sees no blobs at all. It is most likely on a" +
                  "\n  different Val Town account than the val.\n");
      return;
    }
    console.log("\n  " + all.length + " blob" + (all.length === 1 ? "" : "s") +
                " visible to this token:");
    all.forEach(function (b) {
      console.log("    " + b.key + (b.size != null ? "   " + b.size + " bytes" : ""));
    });
    console.log("\n  val.json expects: " + CFG.blobKeys.join(", "));
    const missing = CFG.blobKeys.filter(function (k) {
      return !all.some(function (b) { return b.key === k; });
    });
    console.log(missing.length
      ? "  MISSING: " + missing.join(", ") + " - set blobKeys in val.json to match\n"
      : "  Both are there.\n");
  },

  async restore(file) {
    needToken();
    if (!file) {
      die("restore needs a file:\n" +
          "  node leaderboard/lb.mjs restore leaderboard/backups/board-....json");
    }
    const snap = JSON.parse(fs.readFileSync(file, "utf8"));
    const live = await blobGet(CFG.blobKeys[0]);
    console.log("\n  about to REPLACE the live board (" + ((live || []).length) +
                " rows) with this backup (" + rowsIn(snap.data) + " rows)");
    if ((await ask("  type yes to go ahead: ")) !== "yes") {
      console.log("  nothing changed");
      return;
    }
    for (const k of Object.keys(snap.data)) {
      if (snap.data[k] !== null) await blobPut(k, snap.data[k]);
    }
    console.log("  restored");
  },

  /* Taking one name off the board without nuking everyone else's. This exists
     because proving the write path worked meant posting a real score, and a
     junk row on a board people are going to stand in front of is not fine. */
  async prune(ini) {
    needToken();
    if (!ini) die("prune needs initials: node leaderboard/lb.mjs prune ZZZ");
    const want = String(ini).toUpperCase();
    const rows = await readBoard();
    const keep = rows.filter(function (r) { return (r.ini || "").toUpperCase() !== want; });
    const gone = rows.length - keep.length;
    if (!gone) {
      console.log("no rows with initials " + want + " - nothing to do");
      return;
    }
    console.log("\n  about to drop " + gone + " row" + (gone === 1 ? "" : "s") +
                " with initials " + want + ", leaving " + keep.length);
    if ((await ask("  type yes to go ahead: ")) !== "yes") {
      console.log("  nothing changed");
      return;
    }
    await blobPut(CFG.blobKeys[0], keep);
    console.log("  dropped - the counters are left alone, they are totals not rows");
  },

  async reset() {
    needToken();
    const live = await readBoard();
    console.log("\n  about to DELETE the board and the counters (" +
                ((live || []).length) + " rows live right now)");
    console.log("  run `backup` first if you want them back");
    if ((await ask("  type yes to go ahead: ")) !== "yes") {
      console.log("  nothing changed");
      return;
    }
    for (const k of CFG.blobKeys) await blobDelete(k);
    console.log("  cleared - the next score starts a fresh board");
  },
};

const argv = process.argv.slice(2);
const cmd = argv[0];
if (!cmd || !CMD[cmd]) {
  console.log("\n  node leaderboard/lb.mjs <status|check|push|pull|backup|restore <file>|prune <ini>|reset|blobs>\n");
  process.exit(cmd ? 1 : 0);
}
await CMD[cmd].apply(null, argv.slice(1));
