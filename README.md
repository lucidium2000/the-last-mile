# The Last Mile

A single-file browser game. You walk uptown from Penn 1 to a customer meeting,
crossing Midtown traffic. Built to run as a web app on Cisco RoomOS devices
(Board / Desk / Room Navigator).

**Status: prototype.** Not an official Cisco or ThousandEyes product, and not
affiliated with or endorsed by either. The ThousandEyes name and the colour
palette here are placeholders pending brand review — see *Rebranding* below.

## Play

Two input methods, both live at once:

| | |
|---|---|
| **Tap anywhere** | Cross. Any tap that is not a swipe moves you forward. |
| **Swipe** | Any direction, anywhere on the screen. |
| Keyboard | Arrows / `WASD` / `Space`, for desktop testing |
| Mute | Button in the bottom-right of the title and game-over screens, or `M` |

There are no on-screen buttons during play, so nothing covers the road.

## URL parameters

| Parameter | Effect |
|---|---|
| `?safe=1` | **Guest-safe mode.** Replaces sales objections with neutral network hazards (packet loss, BGP leak, route flap). Use this for rooms customers sit in. |
| `?mute=1` | Forces silence for a whole deployment, overriding the local toggle. |
| `?fps=1` | Perf overlay: FPS, backing-store size, device pixel ratio, bake scale. |

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

Real-world vehicle liveries (MTA blue, Citi Bike blue, NYPD blue, cab yellow,
street-sign green) are deliberately left authentic and are not part of the
brand palette.

## Design notes

Hazards are real Midtown obstacles whose *behaviour* is the sales obstacle,
rather than generic cars with labels stuck on them:

| Hazard | Behaviour | Stands in for |
|---|---|---|
| M34 Select Bus | Huge, stops every few seconds | Procurement |
| DSNY truck | Slowest mover, also stops | No budget |
| Yellow cab | Fast, aggressive | Competitor undercut |
| Delivery e-bike | Fastest, narrow, rides against the one-way | Unplanned urgency |
| Citi Bikes | Arrive as a staggered pack | The buying committee |
| Black SUV | Fast, tinted | The unreachable exec |
| Horse carriage | Ancient, plodding, still legal | The incumbent |
| Tourist crowd | Slow, wide, spreads | Nobody owns it |
| Double-parked truck | Never moves | The stalled deal |
| NYPD motorcade | Warning lights, then the street is gone | Re-org / spending freeze |

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

### Power-ups

Four common ThousandEyes capabilities — Endpoint Agent (absorbs one hit),
Internet Insights (slows traffic), Path Visualization (lights up safe
crossings), Executive Sponsor (carries you three rows) — plus one rare tier:

**Path Visualization** traces a route of six to eight crossings, drawn as nodes
joined by links with a packet running it. Roughly 45% of routes carry one or two
alternate branches that diverge and rejoin, the way a real path trace shows
traffic taking more than one way to the same place; about 9% are perfectly
straight, which is only ever claimed when the player's own column is clear the
whole way. You cannot be hit anywhere on the route and traffic turns around on
contact with it.

**TAM.** The headline SKU. Five seconds of flight, which ignores both traffic
and solid props, hops 32% faster, and renders above the whole world. Unlike
every other power-up it does not expire: once engaged it stays for the rest of
the run and delivers another two seconds every 8-14s, announcing something a
ThousandEyes TAM actually does (22 lines). The first payout lands 3-6s after
pickup, as the opening flight runs out, so the SKU is seen working immediately.
Total flight is capped at 9s so it cannot be hoarded.

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

Tuning dials: `FLY_SECS`, `TAM_BONUS_SECS`, `FLY_MAX`, `TAM_COOLDOWN_ROWS`,
the `0.52` spawn roll in `makeWalk`, and the payout intervals in `collect`
(first win) and `update` (subsequent).

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
