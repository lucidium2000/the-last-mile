# TE Last Mile

A single-file browser game. You walk uptown from Penn 1 to a customer meeting,
crossing Midtown traffic. Built to run as a web app on Cisco RoomOS devices
(Board / Desk / Room Navigator).

**Status: prototype.** Not an official Cisco or ThousandEyes product, and not
affiliated with or endorsed by either.

**No brand names appear in the game.** The title screen shows the eye mark and
reads `TE Last Mile`, with `TE` in orange. The wordmark, the
"a ThousandEyes game · Cisco" line, and the wordmark that used to sit in the
corner during play are all gone. The eye is a motif drawn from canvas paths,
not anyone's registered logo, and the palette is an approximation — see
*Rebranding* below.

## Play

Two input methods, both live at once:

| | |
|---|---|
| **Tap anywhere** | Cross. Any tap that is not a swipe moves you forward. |
| **Swipe** | Any direction, anywhere on the screen. |
| Keyboard | Arrows / `WASD` / `Space`, for desktop testing |
| Mute | Button in the **top**-right of the title and game-over screens, or `M` |
| Full screen | Button in the bottom-right corner, always available |

The full-screen button is the only control on screen during play, and it sits
in the one corner the HUD never draws into — below the TAM badge. It hides
itself where the Fullscreen API is missing, which includes RoomOS builds that
already run the page full-screen and expose no way to ask.

The canvas fits the viewport at 16:9 and is centred. On a screen *wider* than
16:9 it grows to fill the width instead of leaving bars down both sides, and
the spare vertical margin crops — capped at 6%, which keeps the top message row
and the bottom chip row inside the frame. It never crops horizontally: that
would eat playable columns.

## URL parameters

| Parameter | Effect |
|---|---|
| `?safe=1` | **Guest-safe mode.** Replaces sales objections with neutral network hazards (packet loss, BGP leak, route flap). Use this for rooms customers sit in. |
| `?mute=1` | Forces silence for a whole deployment, overriding the local toggle. |
| `?fps=1` | Perf overlay: FPS, backing-store size, device pixel ratio, bake scale. |
| `?offline=1` | Never contacts the leaderboard server, even if one is configured. |

Parameters combine, e.g. `?safe=1&mute=1`.

## RoomOS notes

- Must be served over HTTPS with a valid certificate. RoomOS will not load a
  self-signed cert.
- Canvas 2D only. No WebGL, no runtime `filter` / `blur` / `shadowBlur`, no
  external assets, no network calls — the whole game is one file.
- Device pixel ratio is capped at 1.5 and sprite baking at 1:1, holding sprite
  memory near 6 MB on a 4K Board.
- Audio is synthesised at runtime and unlocked on first tap (autoplay policy).
  If Web Audio is missing or throws, every cue becomes a silent no-op and the
  game behaves identically.
- Audio suspends on `visibilitychange` and `pagehide`, so an incoming call
  never leaves sound running.
- No login, no persistent state beyond one local best score and the mute
  preference. Nothing personal is stored — these are shared devices.
- **Check `?fps=1` on real hardware.** Everything else was validated in a
  desktop browser; the frame rate on a Board is the number that matters.

## The leaderboard

Three initials, arcade style, on every finished run — won or lost.

**GitHub Pages is static hosting: there is no server.** A board shared by
everyone who opens the link needs one somewhere, so the game is written against
a two-route HTTP contract and ships with a server that implements it.

```
GET  /top?n=25   -> { rows: [...], stats: {...} }
POST /score      -> { rows: [...], stats: {...} }
```

`BOARD_API` near the top of `index.html` is the switch. **Leave it empty and
the game never opens a socket** — the board is this device's own, in
localStorage, and the badge on it reads `LOCAL`. Set it to a URL and the same
board becomes everyone's, the badge reads `LIVE`, and the local copy stays on
as cache and offline fallback. If the request fails or takes more than six
seconds the badge reads `OFFLINE` and play is unaffected; nothing on the
network path can block the game.

The server that implements it lives in [`leaderboard/`](leaderboard/), along
with the one command that pushes it, pulls it, backs the data up and restores
it. There is **one copy of that code** and `leaderboard/lb.mjs check` is what
keeps it that way. Exercised against a stand-in store before shipping: sorting,
aggregation, rate limiting, and input sanitising all pass, including a score of
`999999999999` (clamped to the cap) and initials scrubbed to A–Z0–9. It is an
open endpoint on a public page, so the board is decorative, not a record.

### The readout

[`report.html`](report.html) sits beside the game at
`…/the-last-mile/report.html` and reads the same public route — no token, no
setup. Headline totals, per-run averages, what stops people, power-up usage,
and the full sortable board with CSV and JSON download.

It reads `BOARD_API` out of `index.html` instead of repeating the URL, so there
is still exactly one place that address is written down. It also asks the server
for nothing the server does not already send, so there is nothing to deploy and
nothing to keep in step — open it and it works.

### What is collected

Only numbers this game produced: score, rows walked, steps taken, streets
crossed, power-ups by kind, subway rides, TAM wins, whether the run was won and
what ended it, and how long it took. Plus a random id generated on the device,
so repeat plays can be counted without counting a person twice — and the set of
those ids never leaves the server, the game and the readout only ever receive
the count.

Deliberately **not** collected: no name beyond the three typed initials, no user
agent, no screen size, no language, no timezone, no location. All of those are
available without asking permission, which is exactly what makes them a
fingerprint, and a hallway game does not need one. The server reads no IP
address anywhere in the file.

Which is why there are **no device statistics in the readout** — not an
omission, there is simply nothing to report.

Storage degrades rather than breaks: private windows, blocked site data and
kiosk shells all throw on `localStorage`. Every access is wrapped, and when it
throws the board falls back to an in-memory copy — it still fills up while the
page is open, it just forgets on leaving. (This is not theoretical: the preview
pane used for testing serves `data:` URLs, where storage is disabled outright,
and the first version of the board silently held exactly one row because of it.)

### RoomOS

A live board means the device needs outbound HTTPS to the worker. If the rooms
are locked down, leave `BOARD_API` empty — everything still works, per device.
The "no network calls" property in the notes above holds exactly as long as
`BOARD_API` is empty.

## Rebranding

Every brand colour resolves from the `BRAND` object near the top of
`index.html`:

```js
var BRAND = {
  core:  "#ff6a13",   // primary orange
  deep:  "#c9480a",
  light: "#ffa552",
  pale:  "#ffd9b8",
  amber: "#ffc23d",
  p1: "#ff5a1f", p2: "#ff8c2b", p3: "#ffc23d", p4: "#ffe08a",  // power-ups
  cisco: "#00bceb"
};
```

Replacing those values reskins the HUD, street grid, power-ups, kiosks, shield
ring, stage banners, title and game-over screen in one edit. The values in the
repo are approximations, not official brand hexes.

The eye mark is drawn from canvas paths, not an image asset — the real logo
would need to be inlined as a data URI or redrawn as paths, since the game
loads nothing externally.

Real-world vehicle liveries (MTA blue, parcel brown, NYPD blue, cab yellow,
street-sign green) are deliberately left authentic and are not part of the
brand palette.

## Design notes

Hazards are real Midtown obstacles whose *behaviour* is the sales obstacle,
rather than generic cars with labels stuck on them:

| Hazard | Behaviour | Stands in for |
|---|---|---|
| City bus | Huge, stops every few seconds | Procurement |
| DSNY truck | Slowest mover, also stops | No budget |
| Yellow cab | Fast, aggressive | Competitor undercut |
| Delivery e-bike | Fastest, narrow, rides against the one-way | Unplanned urgency |
| Parcel vans | Arrive two abreast, nobody leading | The buying committee |
| Black SUV | Fast, tinted | The unreachable exec |
| Horse carriage | Ancient, plodding, still legal | The incumbent |
| Tourist crowd | Slow, wide, spreads | Nobody owns it |
| Double-parked truck | Never moves | The stalled deal |
| NYPD motorcade | Warning lights, then the street is gone | Re-org / spending freeze |

About a third of the cabs are rideshare cars instead — same footprint and speed
so the lane maths is untouched, but plain paint, no checker, no roof light and a
lit placard in the windscreen.

**Buses run nine routes, not one.** Every bus used to wear `M34 SELECT BUS
SERVICE`, which is right for the first ten blocks and wrong for the rest of the
island. Each row now draws one of nine liveries — M34, M42, M50, M57, M66, M79,
M104, M7, M20 — with its own side banner and front headsign. Only M34 and M79
are Select Bus Service in real life, so only those two get the amber band; the
locals get blue. The nine are baked once at startup and the row stores which it
wears, so the variety costs nothing per frame.

**The parcel van replaced a Citi Bike pack.** Three bikes at road scale
collapsed into one blue smear with a tan dot on top, and a hazard you cannot
identify before it hits you is a bug wearing a costume. A brown step van reads
at any distance from its colour and silhouette alone. The first attempt at it
was as long and as low as the SUV and looked like a shipping container; a step
van is short and tall, and its roof is drawn as the *darkest* face because the
projection lights top faces hardest and a pale roof slab was all you could see.

Street furniture on the pavements includes bagel carts, pizza counters and hot
dog stands, newsstands, scaffolding sheds, subway entrances and TE-ADDON
terminals (which act as a free Path Visualization). At most one subway
entrance per pavement — subway is weighted twice in the prop pool and each prop
draws independently, so a three-prop sidewalk could otherwise come up with
three staircases to the same station.

### Nothing in a lane overlaps anything else in it

Every vehicle in a lane shares a speed, so left alone they hold their spacing
forever. Two things broke that, and both looked like cars driving through each
other:

- A bus or a DSNY truck halts on its own cycle while the one behind keeps
  rolling.
- A path trace used to reverse a single car *inside* a stream moving the other
  way, which guarantees a head-on.

The trace now turns the whole **lane** around rather than one car in it, which
preserves every gap exactly, and `separate()` runs after movement: each vehicle
is pushed back to at least a vehicle length behind whatever is directly in
front of it, so a stopped bus produces a queue instead of a collision. Spawn
order is position order and stays that way, so "in front" is the next index
around the loop — no sorting, and two passes settle a full chain.
`n * (eff + gap) <= SPAN` holds by construction at spawn, so the clamp can
never chase its own tail.

Measured over 4,800 simulated frames with the camera walked across 390 rows and
114 lanes forced into reverse: **0 overlaps in 160,974 sampled pairs**, minimum
slack exactly the 0.14-tile clearance buffer (a bus queue). The same run with
`separate()` disabled gives 252 overlaps and a worst case of −2.6 tiles.

### Reactions

The pavement reacts when you walk into it, which is the only time anything in
the world answers you back. Each is about a second, and each costs nothing —
the step was already refused.

| Walk into | He does |
|---|---|
| Bagel cart, pizza counter, hot dog stand | Pays and eats — see below |
| Newsstand | The headline takes the top of his head off — rays, rings and a face to match |
| Subway entrance with no MetroCard | Shakes his head, throws both hands up, and says so: **NO METRO CARD** |

At this scale his own face is twenty pixels of baked voxel, so the expression
lives in a bubble and the body supplies the gesture: two sleeves and two hands
drawn over the shoulders for the shrug.

### Suiting up

The Endpoint Agent turning the blazer blue is the biggest visual change in the
game and it used to happen in silence. Picking it up now springs him 30px off
the pavement, throws both arms into a V with fists at the top, pushes three
rings of blazer blue out across the road and sparks off the top of the frame —
over 1.75s, against a rising five-note figure that lands on a held chord.

### Buying lunch

Walk into a food cart and the whole transaction plays, over 1.95s on one clock:

| | |
|---|---|
| 0.00s | He leans out and a five-dollar bill travels across to the vendor |
| 0.55s | The vendor has it; **-$5** floats up and fades |
| 0.80s | The food comes back, growing as it arrives |
| 1.15s | Three bites, 0.2s apart, eaten from the side he is facing, with crumbs |
| 1.55s | A short satisfied beat, then it fades |

The bites are counted off the **clock**, not the renderer — the drawing code runs
every frame and would have chomped sixty times a second. Verified: 3 bites, 3
sounds, sequence 0→1→2→3.

The food is drawn by the *caller* of `drawPlayer`, not inside it. `drawPlayer`
blits the sprite part-way through and returns early in three places (hurt
flicker, flight blink, head shake), so anything drawn in there ends up behind
him or not at all. `drawPlayer` records an anchor, `drawEatOverlay()` paints it
afterwards. Verified: call order is `sprite` then `eat`, and the overlay still
draws through all three early-return paths.

A bagel has to be *stroked* rather than filled — a filled circle with a hole
punched in it would need to know what is behind it.

Objections and rebuttals appear on the game-over screen, with coaching lines
between milestones so the slow hazards that rarely kill you still get read.

### The player

A seller in a dark suit, white shirt and orange tie. Collect a TAM and the suit
comes off: caped hero, orange rather than red, **T** rather than S, with a
second baked cape state that streams back while airborne.

Cape geometry is dictated by the projection — depth renders as up-and-right, so
a cape hanging straight down behind the torso sits in the same screen space as
the legs and is invisible. It has to be wider than the body to read at all.

### Landmarks

Fourteen Midtown landmarks fade in and out by cross street, so the city changes
as you walk: Penn 1, Macy's, the Empire State, Peloton, Bryant Park, Grand
Central, Times Square, Rockefeller, Radio City, St Patrick's, Carnegie Hall,
Columbus Circle, The Plaza and Central Park.

They are flat rects, not voxels - fill rate is the scarce resource on a Board,
not geometry - and each is assigned one of four lanes across the screen. Two
landmarks sharing a lane are never scheduled together, fades included;
without that the Empire State drew out from behind the Times Square
billboards. Roughly four are up at once and no street is ever bare.

### The subway

A MetroCard rides you 10-20 streets uptown from any subway entrance. **Cards
stack** — pick up three and you have three fares, shown on the HUD chip as
`M3`. Standing on an entrance with an empty wallet says so on screen, plays a
turnstile refusing to turn, and the player shakes his head.

The head shake is drawn as two clipped passes over the one baked sprite: the
band below the neck draws where it always did and the band above it draws a few
pixels to the side. Shaking the whole sprite reads as a stumble; only the head
moving reads as "no".

The ride itself is a staged animation of about nine seconds — down the stairs,
the platform, the run, the arrival, back up — with a cue on every beat: the
swipe and the turnstile bar, a two-note PA chime over an announcement that is
deliberately unintelligible, the doors closing, five and a half seconds of
rolling rumble with rail joints beaten out underneath it, a curve squeal, a
horn, the brakes and the doors opening. Every cue is scheduled up front off the
audio clock, so a dropped frame cannot knock the sound out of time with the
picture.

### Inside the car

The car is **five standing positions** wide and you can walk it. Any tap or
swipe moves him one position: right/forward toward the front, left/back toward
the rear, and he bumps at either end. Two slots are rolled per ride:

| | |
|---|---|
| **A shady character**, ~45% of rides | Hood up, collar up, hands in, sunglasses, and a slow sway that is not the train's. Walk into him once and he tells you he is watching your bag. He does not block and he does not cost you anything. |
| **Chuck Bucks**, ~55% of rides | Left on a seat. Walk into it and you get the identical payout to the pavement pickup — the money, the CSCO card, the voice line. |

Neither ever lands on his starting position or on top of the other, so there is
always somewhere to walk to. Verified over 4,000 rolled rides: 0 collisions, 0
on the start slot, 45.9% / 56.0% appearance rates.

The ride also now **owns the input** while it is running. It did not before:
taps fell through to world movement and quietly walked the player across
streets he could not see. Verified that a full walk up and down the car leaves
`G.row`/`G.col` untouched.

Collecting on the train raises the ticker card, which freezes the world — and
the ride with it. Measured: the ride clock advances **1 frame out of the 205**
the card is up, on the tick where the card expires and falls through. That is
correct, not a leak.

The exit is found or planted on a pavement row at the destination, and the exit
cell is unblocked — which can never create a pin, since removing a blocker only
ever widens a gap.

### The shape of a run

The game is two legs and an ending, not an endless climb.

1. **Uptown, 34th to 81st.** Penn 1 to the meeting. Street numbers count up.
2. **Steak dinner at 81st.** The signing (below). The city turns round.
3. **Downtown, 81st back to 34th.** Carrying the signed order home. Street
   numbers count down, and every landmark comes back in the opposite order.
4. **Penn 1.** The paper goes on the desk and the game is won.

The player always walks *up* the screen; what reverses is the city around him.
Street numbers and landmarks are both keyed on the street number rather than on
distance travelled, so counting down gets the landmarks in reverse for free, and
`laneDir()` negates the one-way rule so a street that ran left-to-right on the
way up runs right-to-left on the way back. Verified: streets run
34→81→34, landmarks reverse exactly, and 41 of 43 sampled lanes mirror — the
two that do not are 34th/42nd/57th, which alternate lane by lane because they
are two-way.

`turnBack()` throws away every row the player has not reached and regenerates
it counting down. Only unreached rows are dropped, and the scene has the world
frozen while it runs.

**The TAM's engagement ends with the signature.** No more payouts, and no TAM
spawns on the return leg — the walk home is yours.

**The countdown is said out loud.** The HUD reads `BACK TO PENN 1 / W 68 ST` on
the left and `BLOCKS TO PENN 1 / 34` on the right, because a street number
ticking down is only obvious if you watched it tick up. It lives on the right
of the top band: put next to the street it ran straight through the departure
board, which owns the middle.

**Nothing can skip the dinner.** A ride from anywhere in the seventies used to
jump clean over 81: the dinner never fired and the walk never turned round, it
just kept going uptown. Eleven of eleven rides from streets 70-80 reproduced
it. Two fixes, because two things were wrong. The ride is capped — going up it
may not carry you past the restaurant, coming back it may not carry you past
Penn, and a ride that wanted to go further gets out as close as it can. And
`progress()` sweeps every street *passed* rather than testing only the one
landed on, since a ride covers ten to twenty crossings at once and a sponsor
carries three rows. After: **0 rides land past 81**, and a three-rows-at-a-time
walk fires all eleven milestones and the dinner in order.

**The subway used to die at the turn.** `startRide` looked for a street
`>= from + 10`, but numbers descend after the signature, so the test could
never pass and every ride on the way home was refused with a bump — the subway
was dead for the entire second half and said nothing. It now searches in the
direction of travel and clamps at 34. Measured at the real turn street:
**0 of 25 rides worked before, 25 of 25 after**, spanning 10-20 streets.

Dying on the return leg has its own death screen — **SO CLOSE**, with the
signed order still in your hand.

### The signing

Eighty-first is what the whole walk is for, so it is staged over eleven
seconds rather than shown:

| Beat | |
|---|---|
| 0.0s | Wide. Talking, nodding, glasses up |
| 2.0s | The order slides across the bar |
| 3.8s | **Cut in.** The purchase order, full frame |
| 4.4s | The pen starts writing, a point of the stroke at a time |
| 7.6s | Back wide. The handshake |
| 9.4s | He holds it up, and SIGNED comes down on it |

The cut is the point. A signature at the scale of two 110-pixel figures at a
bar is a smudge, and the one thing the player has to actually see is the pen
moving. The signature is built once as a path — a leaning capital loop, a run
of cursive humps, a flourish that sweeps back under the name — and revealed a
point at a time with the nib sitting on the head of the stroke, so the hand and
the ink stay married.

Long scenes are scored rather than stung: `beats` on a scene names a cue and a
time, and `updateScene` fires each one once as the clock passes it.

### Through the park

Streets **60 to 69** are inside Central Park, and the whole board changes for
ten blocks:

- **Grass instead of pavement.** A mown patchwork with tufts and a soft kerb,
  not a flat green bar.
- **Gravel drives instead of asphalt.** Pale edging, no painted lane markings.
- **Nothing with an engine.** Only horse carriages, pedicabs and tourist
  crowds spawn here; no motorcade sweeps through.
- **No subway.** You are inside the park — the stations are around the edge, so
  no entrance is placed on a park pavement and no ride surfaces on one.
- **Trees at the edges, not buildings.** The frontage slots that hold a façade
  everywhere else hold a tree here, and more often, because the edge of the
  park is denser than a block front. The first pass put twelve towers inside
  Central Park, which is how that was caught.

Everything resumes at 70th.

### Arrival scenes

Reaching a landmark crossing stops the walk for a beat and shows you where you
are, in the same register as the subway ride. Each plays once per run.

| Street | Scene |
|---|---|
| 42nd | Times Square — eight billboards each running their own loop, the ticker, Broadway traffic behind the red steps, steam off a grate, a crowd three ranks deep |
| 50th | Rockefeller Center — the slab, the rink, the flags, the fountains |
| 59th | Central Park South — the canopy, the pond, a carriage |
| 81st | Steak dinner — the customer, two glasses, and a handshake on a verbal |

The message afterwards is a **centre-screen notice**, not a corner toast: the
world dims, a bordered panel takes the middle of the screen for seven and a
half seconds, and it says in 56px that a signature is not a booking. A corner
toast was there before and was missable, which is the one thing it must not be.

81st is the end of the walk: the handshake lands, and the message that follows
says what a verbal is actually worth — *now get back to the office and lock it
in.*

### Music

Times Square, Central Park South and the steak dinner play a short theme: a walking
bass under piano-ish arpeggios, four bars, synthesised at runtime like every
other cue. **It is an original piece written for this game.** It is not a
transcription or an arrangement of any existing song, and nothing in the repo
reproduces copyrighted melody.

### The ticker card

Collecting Chuck Bucks freezes the walk and shows a mock of the Google Finance
quote card: the Cisco mark, the name, the NASDAQ line, the Following pill, the
range tabs, the chart with its cursor and tooltip — reporting **CSCO +10.00%**.

**It carries no share price, and it is marked "Simulated" on its face.** The
game makes no network calls — the RoomOS constraint the whole file is built
around — and there is no public quote API behind that card anyway, so a price
baked in here would be stale the next day and would be read as live. A round
percentage is plainly the game talking. Everything on the card is in percent
for the same reason: the axis, the series and the tooltip.

Chuck Bucks draws 4 of the 30 slots in `POWER_POOL` — double what it was. The
two extra slots came out of metro rather than being bolted on, so the pool stays
30 and the share is a true 2x rather than the 1.9x a bigger denominator would
have given; metro at 16/30 is still by far the most common pickup. Measured over
16,000 sampled pickups per arm: 4.47% → 9.26%, a ratio of **2.07** (95% CI
1.90–2.26).

Each pickup **rolls its own move, between 0 and 10 percent**, and the whole
series is scaled to it, so the chart, the axis, the headline and the tooltip
always agree. `CSCO.session` is the shape of the trading day normalised to a
close of 10; `CSCO.tail` is the after-hours in grey.

### Chuck

He pops up out of the bottom-right corner, holds, and drops back out — the
Mortal Kombat *Toasty* beat, which only works if it is fast, in the corner, and
gone before you can look straight at it. It runs over the ticker card, with the
voice line.

That voice line is the **one recorded sound in the game**, inlined as base64 so
the file still loads nothing over the network. Everything else is synthesised.
It is decoded the moment the AudioContext exists rather than on first use, so
the first Chuck Bucks of a session is not silent; every failure path leaves the
buffer null and the call becomes a no-op, like the rest of the engine.

The portrait is a halftone photograph inlined as a `data:` URI in `CHUCK_SRC`.
It arrived as a 268 KB 8-bit RGBA PNG with 32,504 unique colours and a fully
opaque alpha channel — on an image that is, visually, two tones carried by a
dither pattern. Re-encoded to an 8-colour palette with no re-dithering it is
**23.7 KB**, which is 31.7 KB of base64 instead of 358 KB, and the difference is
not visible at the size it is drawn. `index.html` grew 349 KB → 381 KB rather
than 707 KB.

Replacing it: encode any PNG, set `CHUCK_SRC` to the whole `data:` URI. Left
empty, the pop-in draws its own placard instead, so the effect still works. The
brand wash over the panel is applied *only* to the placard — over a photograph
it just turns a face orange.

**A photograph of a real person on a publicly reachable page is worth a
deliberate decision**; the site is `noindex, nofollow` and the disclaimer at the
top of this file applies.

### Power-ups

Four common ThousandEyes capabilities — Endpoint Agent (absorbs one hit),
Internet Insights (drops the world into slow motion), Path Visualization (lights
up safe crossings), Executive Sponsor (carries you three rows) — plus one rare
tier:

**Internet Insights** runs 11 seconds and throttles everything that moves to
**0.28×** — measured on one car in one lane: 2.598 tiles a second normally,
0.728 with it up. One constant, `SLOW_K`, drives both the mover and the
crossing-safety predictor, because a predictor running at a different rate from
the thing it predicts will tell you a lane is clear when it is not.

The look is the obvious reference: green glyph rain falling down the screen,
a cold green wash, scanlines, a slow bright band sweeping down and a frame
around the whole playfield. It is **baked, not drawn** — glyph by glyph it would
be ~700 `fillText` calls a frame, which is how you turn a conference panel into
a slideshow. Two sheets are rendered once at startup and scrolled at different
speeds, four `drawImage` calls a frame, every glyph wrapped modulo the sheet
height so the seam never shows. ASCII and symbols only: a missing glyph renders
as a tofu box on an unfamiliar font stack, and a screen of tofu boxes is worse
than no effect at all.

**Traffic Insights** runs 15 seconds, colours every lane by live risk — *and
now answers it.* While it is up, whatever is bearing down on the lane he is
**standing in** turns around rather than run him over, within 3.2 tiles, with a
band across the lane and a trio of arrows showing which way it went. It flips
the **whole lane**, the same way the path trace does, because reversing one
vehicle inside a moving stream is most of what "cars pass through each other"
used to be.

Measured, four lanes, thirty seconds each, standing still at the same column:

| Lane | Without Traffic Insights | With it |
|---|---|---|
| cab | run over on 492 of 1800 frames | **0**, 22 turn-arounds |
| parcel van | run over on 522 frames | **0**, 22 turn-arounds |
| cab | run over on 504 frames | **0**, 22 turn-arounds |
| SUV | run over on 511 frames | **0**, 18 turn-arounds |

A full-world sweep with both power-ups held open — 452,000 sampled car pairs —
found **0 overlaps**, so neither the flips nor the slow motion break the
separation invariant.

The trace is **green end to end** — line, hop ticks, nodes, destination and the
packet halo, all from the `TRACE` block, which is a single swap point the way
`BRAND` is.

**Path Visualization** traces a route of six to eight crossings, drawn as nodes
joined by links with a packet running it. Roughly 45% of routes carry one or two
alternate branches that diverge and rejoin, the way a real path trace shows
traffic taking more than one way to the same place; about 9% are perfectly
straight, which is only ever claimed when the player's own column is clear the
whole way. You cannot be hit anywhere on the route and traffic turns around on
contact with it.

**TAM.** The headline SKU, and the only power-up that pays twice in different
currencies.

*On pickup:* five seconds of flight, which ignores both traffic and solid
props, hops 32% faster, and renders above the whole world.

*After that, no more flight.* Every 8-14s for the next minute the engaged TAM
delivers an **outcome** instead: a full-width banner naming what the TAM did,
what it led to, and what it is worth — "TAM INCREASED ADOPTION / Customer wants
to buy 80k more / +$80,000" — and that amount goes straight onto the pipeline.
There are 22 of them, each a thing a real ThousandEyes TAM actually does, each
with a number attached (35k-250k).

The banner is deliberately not the ordinary flash: 1280 wide, 174 tall, 40px
headline, the amount set large on its own side of a rule, and it holds for
4.4s. At 26px in an 880-wide plate nobody was reading these.

The first payout lands 3-6s after pickup, as the opening flight runs out, so
the SKU is seen delivering immediately. Measured over 60 simulated seconds with
a TAM engaged: 5 wins, $295,000 added to pipeline, and flight never rose above
its opening 5s.

Uncommon rather than rare: ~38% of pickups, one every ~37 rows, 16-row
cooldown, and it can appear as early as row 10. Measured over 90 bot runs:
median run goes from row 47 to row 124 when a TAM is collected, and every TAM
run saw at least one win delivered.

On screen it is staged rather than just placed - a beam of light up into the
sky band, a glow pool on the pavement, two pulsing rings, rising sparks and the
brand mark floating overhead with a TAM label (`drawTamPickup`). The pickup
sprite itself is 2.2x the area of the common four. The beam is what makes it
findable from several blocks away.

Flight is the only thing that bypasses both hazard types, so landing is
handled explicitly in `landFromFlight()` — on expiry the player slides out of
any solid cell to the nearest free column and gets a moment of grace, since
flight can otherwise end inside a scaffold or on top of a bus.

Tuning dials: `FLY_SECS`, `FLY_MAX`, `TAM_DURATION`, `TAM_COOLDOWN_ROWS`, the
`0.52` spawn roll in `makeWalk`, the amounts in `TAM_WINS`, and the payout
intervals in `collect` (first win) and `update` (subsequent).

Cross streets are generated from the real grid: direction follows the
even-eastbound one-way rule, and 34th / 42nd / 57th generate as paired two-way
crossings.

Generation guarantees, each covering a bug found in testing:

- No position can be pinned. A pin needs a single free column with blocked
  neighbours on both sides, so gaps between blockers are always ≥ 2 wide and
  columns 1 and 14 are never blocked.
- The crossing window at any column never falls below 0.60 s. The minimum gap
  is expressed in *time*, not tiles — ramping speed up while ramping the tile
  gap down compounded, and at depth left some rows genuinely impassable.
- A motorcade street always has a sidewalk immediately behind it, so retreat
  is always available.
- Parked trucks block exactly the columns they occupy, so you can never step
  into a cell that kills you on arrival.
