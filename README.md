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

## The audio graph, and why a panel died and a laptop did not

Every cue built an oscillator (or a noise source), a gain and usually a filter,
wired them to the master gain, and walked away. Chromium releases a *source*
node once it has finished — but the gain and the filter behind it are still
connected to the destination, so they stay reachable, stay in the graph, and
get pulled by the audio thread every 128-sample quantum for the rest of the
page's life.

A round creates about **2,900 nodes**, of which roughly 2,000 are gains and
filters that never leave. Measured over five rounds, counting nodes still wired
to the graph:

| | before | after |
|---|---|---|
| after round 1 | 1,725 | 217 |
| after round 2 | 3,355 | 214 |
| after round 3 | 4,848 | 214 |
| after round 4 | 6,606 | 220 |
| after round 5 | 8,275 | 214 |
| settled | **8,278** | **111** |

Ten thousand live nodes summed 375 times a second is something a laptop shrugs
off and a room panel does not — which is exactly why this only ever showed up
on the Desk Pro. Every chain is now torn down on its source's `onended`, with a
sweeper for the cue that was in flight when the context got suspended (somebody
taking a call) and never came back to say so, plus a hard ceiling of 400 live
chains so the graph cannot grow without bound even if `onended` never fires.

**Re-bakes are debounced.** `resize` fires in bursts — a panel raising its own
UI can send a dozen in a second — and `layout()` re-bakes all 96 sprites
whenever the scale moves far enough, which at 1:1 is **13.5 MB of canvas
allocated and discarded per burst**. The view still follows immediately; only
the re-bake waits 180ms for the resizing to stop.

**Sprite memory is up.** 96 baked canvases come to **13.46 MB at 1:1**, against
the ~6 MB this file used to claim — the nine bus liveries alone are 3.77 MB,
and the faces, trees, parcel van and pedicab account for most of the rest. It
is not what was crashing the panel, but it is worth knowing: the liveries could
be cut to one bus body plus nine small sign strips composited at draw time,
which would give back about 3.5 MB.

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

**He always surfaces in the middle column.** The exit used to reuse whatever
station entrance the destination row happened to have, or plant one wherever
there was space, so he came up at a random column and the first thing anyone
had to do after a ride was work out where he was. The stair is the landmark and
it belongs under the camera; anything already standing in that column is moved
aside. Verified over 60 rides: **60 out of 60 in column 8**, one stair each.

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

### Health

A walk uptown is tiring, and the only thing that fixes tired is lunch.

| | |
|---|---|
| Start | 100% |
| Every street crossed, on foot | **−3%** |
| … below 5%, or while flying on a TAM | **−1%** |
| … crossed by subway | **free** |
| Pizza | **+15%** · $5 · one a cart |
| Bagel | **+10%** · $7 · one a cart |
| Hot dog | **+7%** · $3 · **two** a cart |
| An objection that lands | **−75%** |
| Endpoint Agent shield | absorbs the hit completely, costs no health |

While it is held, a **blue shield badge sits against the right-hand end of the
health bar** rather than in the power-up chip row. What it does is take one hit
*instead of the bar taking it*, and sitting it with the other power-ups said
nothing about which number it was protecting.

All of them live together near `CHUCK_BONUS`, so the balance is one line to
change.

Three exemptions, each for a reason:

- **The subway is free.** A ride covers ten to twenty streets sitting down,
  which is the opposite of tiring, and charging for them turned the best
  power-up in the game into a trap. `progress()` is called from inside the ride
  while `G.ride` is still set, so that is the test.
- **Below 5% it costs a point a street.** The last few blocks are where a run
  is lost, and a hard floor of two crossings turned "nearly out" into "already
  out" with no chance of reaching the next cart.
- **Flying costs a point too.** Being carried over the traffic on a TAM is not
  walking.

Being hit no longer ends the run outright — it takes a bite out of him and he
carries on, once. Two hits from full is still death, so the shield keeps its
value by being the only thing that absorbs one for free. Running the tank to
zero is its own ending, `EXHAUSTION`, the one death in the game with no hazard
attached.

The drain is deliberately more than you start with: 47 blocks to the restaurant
costs 141%, and the round trip 282%. You cannot finish on the tank you begin
with. A flat rate for all three made the choice of cart meaningless. Now a pizza
counter is worth crossing for and a hot dog is what you take because it is
there.

Measured over 40 generated worlds, the walk puts **0.797 food carts on every
street**, worth **10.8% of health a street** against a 3% cost once the second
hot dog is counted — so eating about **28% of the carts you pass** breaks even.
It was 16% when everything was worth a flat 25, and 35% before hot dog carts
started serving twice. Eating none still dies around **W 70th**, two thirds of
the way up. Average spend across a cart: **$5.80**.

**A cart serves a fixed number of times**, then it is done. Walking into a stand
is a free move — the step was already refused — so without counting the servings
you could stand next to a hot dog cart tapping into it and never run out of
health again. A hot dog cart hands over two, because they are small, the vendor
is right there and nobody buys one hot dog; everything else is one and done.

The bar sits across the **bottom middle** — the power-up chips run along the
bottom left and the TAM badge and full-screen button sit bottom right, so the
centre of that row is the one piece of furniture-free space on the board. It is
ticked every 25%, one meal a tick, so you can read how many lunches you are down
without doing arithmetic mid-crossing. Amber below half, red below 25%, and it
flashes.

### Running on empty

Below **25% health** it starts to show on him, and it gets worse the lower he
goes, so the state is readable without looking away from the road to check the
bar:

- **The face** — a fourth baked expression. Eyes half shut, flat heavy brows,
  mouth open to breathe, and colour in the cheeks that has nothing to do with
  being pleased about anything.
- **Sweat** — beads down the temples that swell, flick off and fall, each on
  its own cycle so they never drip in step. Two at 20%, four near zero.
- **Breath**, on the side he is facing.
- **Heat** coming off him, above his head, below about 11%.
- **Laboured breathing** — one breath clock drives the chest, the puff of
  breath and the red pulse, so they are all on the same lungs. Quick in, long
  out, **37 a minute**: a man who has walked too far too fast, not a man
  asleep. Measured 136 frames rising against 263 falling. His chest lifts him
  **7.4px** at 2% health and 2.8px at 19% — the first pass used a flat sine
  worth a couple of pixels and read as gentle bobbing rather than fighting for
  air. The puff leaves on the *exhale*, because watching a man heave and
  breathe out on different beats is worse than no breath at all.
- **He pulses red himself**, on the same breath. Tinting a baked sprite needs
  a composite op, and `source-atop` applies to the whole canvas — run on the
  main context it would wash everything already drawn behind him. So the
  silhouette is built on **one scratch canvas, reused for the life of the
  page** (verified: one canvas created across 2.5 seconds of pulsing) and
  blitted over him at the pulse alpha. A tinted variant per face would have
  been four more baked sprites for every expression, and sprite memory on a
  panel is already up. Every blit of the player goes through one helper, so
  the pulse cannot be missed on a path that returns early.
- **Red edges**, pulsing in time with that breathing and harder the lower he
  gets.
- **"NEED FOOD!"**, once, in a bubble over his head the first time he drops
  into the band. The pulse and the face say he is in trouble; neither says what
  to do about it, and the one thing a new player will not work out alone is
  that walking into a cart is the fix. Checked: fires exactly once a run. An edge pulse and not a full wash: a wash over the playfield is the one
  thing that would make the crossing harder to read at exactly the moment he
  can least afford it. It stands down for a real hit, which owns the screen,
  and never appears off `ST_PLAY`.
- **Tired legs** — up to **40% longer on a step**. A real cost, since the
  crossing windows do not widen to match, but that is the point: he is
  supposed to be struggling, and the fix is lunch. Flight overrides it.

Measured step times against a healthy 0.150s: 20% → ×1.00, 18% → ×1.00,
10% → ×1.11, 5% → ×1.22, 2% → ×1.33, and flying at 2% → ×1.00. The drag
itself is applied exactly; what is observable quantises to whole frames,
because a hop can only finish on a 1/60s boundary.

**The overlay anchor is not the middle of his face.** Every overlay is handed
the centre of his *tile* — the model at x=0.5 on the `y=0` plane — but his head
sits on the face plane at `y=0.43`, and the projection shifts x by `y * SKEW`.
The head is therefore **11.6px to the right** of the anchor, and the first pass
ran the sweat down the air beside his ear.

It is the lowest-priority face: a reaction to something in front of him beats
the state he is in, and eating is what fixes it anyway.

### His face

Finishing a meal used to pop an emoji bubble over his head. He has an actual
face now, with three expressions, all **baked as sprite variants** rather than
painted on in screen space — the projection places the mouth on his face for
free, and a guessed screen offset would have drifted the moment anything about
the camera changed.

He wears his health on his face. The reactions win; under them the resting
face is a read-out.

| | When | How |
|---|---|---|
| **Smile** | 75–100%, and he pays / between bites | three rects, middle one *lower*, cheeks |
| **Flat** | 50–75% | one level mouth, nothing else going on |
| **Meh** | 25–50% | the frown with half the step in it |
| **Worn** | under 25% | eyes half shut, heavy brows, mouth open, flushed |
| **Smirk** | an engaged TAM | asymmetric — one corner up, one brow raised. A smirk is asymmetric or it is just a smile |
| **Chew** | while he is eating | jaw dropped, lower lip below it |
| **Sad** | he walks into a cart he already bought from | middle *raised*, brows angled in |

The smirk outranks the health bands but **not** running on empty: a man
smirking at 8% health is reassuring at exactly the wrong moment. Verified
across all seven: 100/80/75 → smile, 74/55/50 → flat, 49/30/25 → meh, 24/5 →
worn, TAM at 60% → smirk, TAM at 10% → worn, and a spent cart or a mouthful
still beats all of it.

Chewing alternates with the smile at about 3Hz once the bites start — a jaw
working rather than a flicker; anything faster read as a glitch. The eyes are
shared across all three, which is what makes the chew read as the same man
rather than a different sprite.

The curve needs a step of about 3px across a 14.5px head or the three rects line
up and read as a straight bar. The first attempt used 1.3px and did exactly
that.

**Walking into a spent cart** is its own answer now. A cart serves a fixed number
of times and the stand is still standing there afterwards, so without a reaction
the refusal looked like the controls ignoring him.

### Moving about the car

A step is a **tween, not a jump**: a fifth of a second of easing out plus a
small lift, so it reads as a stride across a moving floor rather than a sprite
being dragged from one window to the next. `R.slot` is where he is going and is
what the logic uses; `R.slotX` is where he *is*, and is what gets drawn.

Both the slot he is heading for and the one he is leaving stay empty while he
is mid-stride, or he walks straight through a stranger on the way.

**The man with the knife measures against the drawn position, not the logical
one**, so the gap he is judging is the gap the player can see.

Collecting Chuck Bucks on the train **does not raise the ticker card**. It takes
the whole screen and freezes the world behind it, and the ride is already a
scene — stacking a second one on top threw the player out of the carriage
mid-stride, which is exactly when the man at the other end is walking towards
him. The money, the sound and the flash all still land.

### The carriage

The car does more than hold two figures now.

**Sound.** Jointed rail under the wheels: two axles over the same gap a beat
apart, every 0.56–0.68s with a heavier one every fourth, plus a long low roar
and the occasional flange squeal on a curve. It is scheduled off the ride clock
rather than looped, so nothing has to be stopped later and nothing can be left
running when the ride ends — and it goes silent the moment the car is not
moving. Measured: 10 clacks in six seconds of running, **0** at the platform.

**Graphics.** The band of card advertising above the windows (one of them is
ours), the strip map over the doors with a bullet creeping along it as the ride
progresses, straps that swing with the car each on its own slight delay, a
floor with dirt on it, and the lights dropping out for two frames in a hundred
while the car is working hardest.

The ad cards are *card stock under fluorescent light*, not light boxes. The
first pass used near-white and the four of them became the brightest thing in
the carriage, which is not where anybody should be looking.

### The man at the end of the car

**He has no face.** The first version had one, plus sunglasses, which made him
a man in sunglasses. What actually unsettles people is the absence: a hood with
nothing in it at all. So the opening is a void rather than a dark face, with
just enough bounce off the inside of the fabric to read as a hole rather than a
black sticker, and two points of light find you from inside it only once the
blade is out. Grey-blue zip hoodie, hands down, shoulders square.

He shows up on 45% of rides — but **nine times in ten he is just a man on a
train.** He gets on, he watches, he may drift up the car, and nothing happens.
He creeps at 0.13 slots a second in fits and starts (measured 20.4s moving
against 19.6s standing over 40 seconds), stops a yard and a half short and
never comes closer, holds his ground rather than retreating if you walk at him,
never draws, never takes anything, and cannot be hit — a man who has done
nothing does not get a briefcase in the face.

The one time in ten he means it is worth something precisely because the other
nine were nothing. Measured over 4,000 rolls: **10.0%**.

When he does mean it, he **closes on you**,
smoothly, at 0.52 slots a second — off the grid the player moves on, because a
mugger who hops between the same five positions you do looks like another
commuter.

Inside **0.95 slots** the knife comes out, and a bar under him shows how long
you have. A reaction test with an invisible clock is just a trap.

| What you do | What happens |
|---|---|
| **Nothing**, for 1.7s | He takes the bag. **−30% health**, and the roll on the seat goes with him. Then he backs off to where he started. |
| **Step away** | The clock restarts. He closes again. |
| **Step into him** | Briefcase, full swing. He is out for the rest of the ride and drops a roll of Chuck Bucks. |

**The hit is four sounds, not one**: the case coming round, the flat crack of a
hard-shell corner on a jaw over a low thud on the same frame, the air going out
of him, and the body arriving on the floor. Plus a grunt of effort on the
backswing. Nothing musical — the cue that something good just happened is the
banner, not a fanfare.

It used to play the Chuck Bucks voice sample, which was the wrong voice
entirely for having just put a man on the floor. The payout now has a `quiet`
mode: it adds the money and keeps its mouth shut, and the swing keeps its own
sound and its own banner.

**Both of them react.** He goes down in three beats — head back, feet leave,
then he lands, with dust off the floor and the stars after — because a man who
simply becomes horizontal has not been hit by anything. The hero winds back,
comes through hard, and is still settling a third of a second after the case
has landed.

The swing is checked **before** the bounds test, because it is not a step: he
can have you cornered against the end of the car with nowhere to retreat, and
that is exactly when it needs to work.

Measured: closes at 0.52 slots/s with sub-slot positions throughout; knife at
5.87s from slot 4 against a player at 0, which is `(4 − 0.95) / 0.52`; robbed
exactly 1.70s later at −30 health; a step away resets the clock to zero without
a robbery; a step toward him knocks him out, pays $250,000 and leaves the player
where he was; the wrong direction just walks; cornered at slot 0 the retreat
bumps and the swing still lands; and once robbed he retreats to his spawn and
never draws again.

### The end screen

The end of a run used to print one number and stop. A run is twenty minutes of
decisions, so it is read back instead: **the tally**, line by line, counting up,
with the total landing last.

```
THE TALLY
GROUND COVERED   174 blocks        $2,610,000
CHUCK BUCKS      3 collected         $750,000
TAM PAYOUTS      5 wins              $640,000
────────────────────────────────────────────
PIPELINE BUILT                     $4,000,000

STEPS 431 · SUBWAY 4 · MEALS 9 · POWER-UPS 22 · FURTHEST W 81 ST
MIDTOWN LEGEND
```

Each line slides in from the left and counts up over two thirds of a second, the
counter easing out rather than stopping dead — a figure that climbs linearly and
halts feels like a progress bar, not a till. The total gets a wider rule, a
bigger size and the only piece of animation on the page that is purely for
effect. Below it, the things that are not money, the rank, and `NEW PERSONAL
BEST` when it has been beaten.

The two bonus streams are tracked separately as they accrue (`bonusChuck`,
`bonusTam`) so the tally can name where the money came from rather than
reporting one lump. The whole thing is built **once**, when the run ends, so the
figures cannot drift between frames and the audio and the rendering read the
same object.

**It can be skipped.** The first tap runs the tally out at once, the second
moves on to the initials. Making a player sit through four seconds of counting
after every death would turn the best part of the screen into the worst.

The counting noise is scheduled from `update`, not the renderer: a tick every
55ms while anything is still climbing, and a cue as each line lands — a run of
ticks with nothing at the end of it is a stuck machine.

### Arrival scenes

**A scene opens on the kerb, not in the road.** It used to fire the moment the
street number ticked over, which is the moment he steps *off* the pavement into
the first lane of that crossing — and the world is frozen behind a cutscene, so
he spent it standing in live traffic. It now looks one row ahead instead:
standing on a pavement, if the next crossing belongs to a street with a scene
he has not seen, it opens there.

Measured over 25 generated walks: **100 scenes opened, 100 of them on a
pavement, 0 in the road.** On a single full uptown leg, 42nd, 50th, 59th and
81st each opened on a safe row.

The sweep in `progress()` stays as the backstop for arrivals that skip the
pavement entirely — a subway ride, or a sponsor carrying him three rows at
once — and `sceneStepBack` stays behind that, moving him out of traffic if one
ever does fire there. Checked over 200 trials starting in traffic: **200 on a
pavement afterwards, 0 on a blocked column, 200 with `maxRow` intact.** Over
120 trials starting on a pavement, **0 moved**.

Because the dinner scene now opens a row before 81st, the turn explicitly sets
the street to the scene's own — the restaurant is on that corner, and the walk
home should count down from 81 rather than from the kerb he happened to be
standing on.

Reaching a landmark crossing stops the walk for a beat and shows you where you
are, in the same register as the subway ride. Each plays once per run.

| Street | Scene |
|---|---|
| 42nd | Times Square — eight billboards each running their own loop, the ticker, Broadway traffic behind the red steps, steam off a grate, a crowd three ranks deep |
| 50th | Rockefeller Center — 30 Rock itself, the sunken plaza, Prometheus, the flags and the rink |
| 59th | Central Park South — the Midtown skyline over the treeline, the Pond with it reflected, Gapstow Bridge, the drive and a carriage |
| 59th | Central Park South — the canopy, the pond, a carriage |
| 81st | Steak dinner — the customer, two glasses, and a handshake on a verbal |

**The red steps** were a symmetric trapezoid that was *wider at the top than the
bottom*, which is perspective backwards — the top of a flight is further away,
so that is the end that should be narrower. They now run to one vanishing point
straight ahead and widen as they come towards you, and each step is drawn as two
faces, the tread you see the top of and the riser below it, instead of one flat
bar. Measured down the flight: 520, 544, 600, 624, 680, 704, 760, 784, 795 px
wide, every row wider than the one above it.

**30 Rock** was a flat wall of window rectangles that could have been any office
block in any city. It is recognised by its *shape*, so it is built as a
silhouette first: a slender limestone slab with slight setbacks stepping in as
it rises, unbroken vertical piers the full height of each tier, and the window
glass recessed in continuous ribbons rather than a grid — which is the detail
that reads Art Deco instead of curtain wall. The first attempt stepped
330→268→214→168 and came out a ziggurat; it is 232→216→202→188 now, 464px wide
at the base against 376 at the top, a 19% taper over the whole height.

**Central Park South** was a row of ellipses, a blue rectangle and a carriage.
The view anyone actually photographs there is not trees — it is the **Pond**,
with Midtown standing over the treeline behind it and the little stone arch at
the south end. It is built in planes back to front now: skyline, three ranks of
trees, water with the skyline upside down in it, Gapstow Bridge, then the drive.

The reflection is the skyline chopped into slats that wobble independently.
Flat colour reads as a floor; a broken reflection is the only thing that reads
as water without a blur filter to lean on. The bridge is a solid deck with the
arch **cut out** of it — an arch is the hole, not the stone, and drawing it the
other way round left a rainbow sitting on the water. And the first pass left the
middle of the skyline empty, meaning to show the park opening up; it read as a
hole punched in the city, so it is a continuous wall of towers now.

The message afterwards is a **centre-screen notice**, not a corner toast: the
world dims, a bordered panel takes the middle of the screen for seven and a
half seconds, and it says in 56px that a signature is not a booking. A corner
toast was there before and was missable, which is the one thing it must not be.

**The paper carries the real number.** The purchase order used to read a flat
`$1,000,000` whatever had happened, which made the whole walk decorative — it
said the same thing after twenty blocks as after two hundred. It is
`pipeline()` now, so the signature is on what he actually built. Checked at
three run sizes against what the scene draws: $330,000, $1,940,000, $5,580,000.

The date and the PO number come off the device clock for the same reason. A
paper frozen at *6 OCT* and numbered *0081* was going to look stale on a panel
the following week, and the walk is meant to be happening today.

81st is the end of the walk: the handshake lands, and the message that follows
says what a verbal is actually worth — *now get back to the office and lock it
in.* **The direction confuses people, so it is drawn rather than written.** He still
walks *up* the screen but the numbers now count *down*, which reads as a
contradiction in words. The notice carries a diagram — an arrow pointing the
way he still moves, labelled `KEEP WALKING`, and beside it `W 81 › W 80 › W 79
› W 78 … down to 34, and Penn 1`. After the notice has gone, a small arrow and
`STILL WALK UP / the numbers count down` sit under the blocks counter on the
right for the whole walk home.

**It also puts health back to 100%.** He has just sat down to a steak, and
forty-seven blocks back to Penn 1 is a second run in all but name; starting it
on whatever was left of the first one was a tax on having got there at all.

### Music

**A theme a place.** They were all playing the same four bars, which made four
different arrivals feel like one arrival. Each is original, written for this
game, and each is scheduled against the audio clock in a single pass — so it
costs nothing per frame and cannot drift if the renderer stutters.

| Scene | Theme |
|---|---|
| Times Square, and Penn 1 on the way home | the anthemic one: walking bass, piano-ish arpeggios |
| Rockefeller Center | a slow **waltz** for the rink — three beats to the bar, a bell on the one, wide stately voicings |
| Central Park South | **pastoral** — slower, open fifths instead of stacked thirds, a soft low pad, two birds, nothing percussive |
| The steak dinner | a lounge **ii–V–I** — walking bass on every beat, brushed hat, close voicings, the only one with a swing to it |

All four are synthesised at runtime like every other cue. **They are original
pieces written for this game** — not transcriptions or arrangements of any
existing song, and nothing in the repo reproduces copyrighted melody.

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

**Internet Insights** runs 11 seconds and throttles **everything that moves to
25% of normal.** One constant, `SLOW_K`, drives the mover, the motorcade sweep,
the wrong-way bike, the bus and sanitation halt cycle, and the crossing-safety
predictor — a predictor running at a different rate from the thing it predicts
will tell you a lane is clear when it is not.

Measured over 20.8 seconds of wall clock, which is four whole bus/DSNY stop
cycles at full speed and exactly one at a quarter, so neither pass can be caught
mid-halt. Per-frame deltas, wrap-corrected:

| | full | slowed | ratio |
|---|---|---|---|
| cab | 49.01 | 12.25 | 0.2500 |
| bus | 21.98 | 5.50 | 0.2500 |
| DSNY | 30.69 | 7.67 | 0.2500 |
| delivery e-bike | 87.91 | 21.98 | 0.2500 |
| parcel van | 34.32 | 8.58 | 0.2500 |
| black SUV | 69.44 | 17.36 | 0.2500 |
| horse carriage | 16.63 | 4.16 | 0.2500 |
| tourist crowd | 21.49 | 5.37 | 0.2500 |
| pedicab | 49.68 | 12.42 | 0.2500 |
| wrong-way bike | 96.72 | 24.18 | 0.2500 |

The two stopping vehicles were the only things in the game *not* running at
`SLOW_K`: their halt cycle ran on real time, so a bus would crawl at a quarter
speed and still slam to a halt on the normal beat. That is not slow motion, it
is broken, and the cycle is scaled now too.

The look is a cool wash, scanlines, a frame and one bright band sweeping down
at normal speed. The band is what sells it: it is the only thing on screen still
moving at the old rate.

An earlier version put Matrix-style green glyph rain over all of this. It looked
the part and it was distracting, and for an overlay you have to play *underneath*
that is the only verdict that matters. The rain is gone; the slow motion stays.

**Traffic Insights** runs 15 seconds, colours every lane by live risk — *and
now answers it,* in two stages:

1. **Drivers steer round him.** A car approaching the lane he is standing in
   eases off the lane centre, holds the swerve while it passes, and drifts back
   after. A car far enough out has gone round him, not through him, and the
   collision check skips it.
2. **If there is no room, the lane stops.** It used to turn around, which
   worked — gaps were preserved exactly — but a street full of traffic
   reversing on the spot is a strange thing to watch, and it threw cars he had
   already judged safe back across his path. Brakes are the obvious reading of
   *that driver has seen me*, and halting the whole row keeps every gap exactly
   as it was for nothing. It re-arms every frame while he is still in front of
   them, so the lane holds for as long as he stands there and rolls again half
   a second after he is clear.

Two things had to be got right. The swerve is measured against the **whole
body**, not the leading edge: measuring the nose of a bus collapsed the swerve
the moment the front was past him while nine feet of bus was still over his
head, and he was run down on the way out. And the turn-around is suppressed for
a car that has already pulled clear — without that it fired at 3.2 tiles before
any swerve had developed, and the avoidance was decoration.

Standing in a lane for thirty seconds: **0 direction changes, 0 frames run
over.** The halt only ran for 0.5s of that, because the swerve got there first
nearly every time — so to prove the brakes work at all, the same test with
swerving disabled: **30s halted out of 30, cars rolling for 0s, 0 reverses, 0
frames run over.**

Measured, four lanes, thirty seconds each, standing still at the same column:

| Lane | Without it | With it |
|---|---|---|
| cab | run over on 510 of 1800 frames | **0** — 464 frames passing round him, 1 turn-around |
| cab | run over on 480 frames | **0** — 290 frames round him, 6 turn-arounds |
| parcel van | run over on 537 frames | **0** — 484 frames round him, 1 turn-around |
| cab | run over on 488 frames | **0** — 490 frames round him, 1 turn-around |

Turn-arounds dropped from 11–22 a run to 0–6, which is the avoidance doing the
work instead of the flip. Every swerving car was confirmed **drawn at its
offset** rather than the lane centre. A full-world sweep with both power-ups
held open — 452,000 sampled car pairs — found **0 overlaps**, so neither the
swerves, the flips nor the slow motion break the separation invariant.

The trace is **green end to end** — line, hop ticks, nodes, destination and the
packet halo, all from the `TRACE` block, which is a single swap point the way
`BRAND` is.

**The route and the player are drawn over the traffic**, not into it. Both used
to be painted in strict depth order, and both were wrong for it: the trace went
down before any vehicle, so the line telling you where it is safe to walk was
buried under the cars crossing it, and the player was tucked into his own row,
so a car in the lane he had just left was drawn over him and he looked like he
was wading through it. Strict depth is the more correct answer and the worse
one — these two are the things the player is actually reading.

**Path Visualization** traces a route of six to eight crossings, drawn as nodes
joined by links with a packet running it. Roughly 45% of routes carry one or two
alternate branches that diverge and rejoin, the way a real path trace shows
traffic taking more than one way to the same place; about 9% are perfectly
straight, which is only ever claimed when the player's own column is clear the
whole way. You cannot be hit anywhere on the route and traffic turns around on
contact with it.

**TAMs are a fifth rarer** — the drop chance is 0.416, down from 0.52
(×0.800 exactly). A run that opens with a TAM is a different game from one
that does not, and it was opening with one too often.

**Shields are a fifth more common** — 12% of drops, up from 10% (×1.200
exactly), with the three slots taken off metrocards, still by far the most
common pickup at 51%. The pool is built from a **weight table** now rather than
a hand-written list of thirty strings: thirty slots could only be tuned in
whole thirtieths, 3.3% a step, too coarse to move one drop by a fifth without
shoving every other share around. At 150 the step is 0.67%.

**TAM payouts run every 16–28 seconds** once engaged — about 2.7 a minute. They
used to run every 8–14, which was so often that the banner was more or less
permanent and stopped reading as an event at all. Measured over 30 minutes of
game time: 81 payouts, mean gap 22.38s, ratio to the old rate **0.492**.

**Nothing shouts over the train.** `drawHud` draws on top of `drawRide`, so a
banner raised just before the turnstile — or on the single frame a ride ends —
sat across the carriage. All four message bands (TAM payout, flash, milestone
toast and the centre-screen notice) are suppressed for the length of a ride.
The pipeline, health and departure board stay up.

**The TAM arrives in a phone booth.** He does not simply take off — he gets
changed first. A booth drops over him with a bang, the glass lights up while
two bands of blue sweep round the inside, and at **1.06s** the panels blow off
and he comes out flying. It is the one power-up that visibly changes who he is,
so it is the one that gets a transformation rather than a pickup noise.

The booth is drawn **over** him, not instead of him: seeing the silhouette
turning behind the glass is the whole gag, and a solid box with somebody's word
that he is in there is just a box. Two sweeping bands rather than one, because
one reads as a stripe and two read as rotation. Input is refused for the length
of it — nobody takes a call mid-change — and the flight, the engagement clock
and the first payout are all handed over when the doors come off, not when the
pickup is touched.

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
