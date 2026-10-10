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

## The ending, in three parts

Penn 1 used to end the game: paper on the desk, BOOKED, tally. That is the end
of the **work**, which is not the same thing as the end of the story — and the
story is the reason anybody in this job does the walk twice. So the booking
hands off to two more scenes, chained on a `then` field rather than keyed to a
street, because neither of them is in Midtown. 25.2 seconds of ending in all,
verified by running the whole chain through the real `updateScene`.

**The ending never shows the street again.** A landmark scene fades back to
Midtown because that is where it returns you; the ending does not, and for
five scenes in a row it was doing it anyway. `a` falls to 0 over the last
0.35s and the backdrop is only 93% opaque even at full strength, so the street
showed faintly through all of them and **fully through every join** — four
times, a third of a second of pavement in the middle of a man's victory lap.
Measured: alpha on the last frame of each ending scene was **0.029**, and is
now **1.0**.

Two flags fix it, and both describe what the scene *is* rather than what it
should look like. `solid` means this scene is a **place**, not an overlay on
the street, so opaque black goes down first and a fade-in comes from black.
`holdOut` means it hands straight to another scene, so it does not fade out at
all — it cuts. The last one carries `holdOut` too, because it hands to the
readout, which is up on the very next frame.

**And a tap during a cutscene does nothing.** `update()` returns early while
one is up, so a tap could never kill him — but it could still walk him,
collect a pickup and bank a crossing behind the picture, with every queued tap
landing at once the moment it lifted.

**And BOOKED has a sound.** The stamp, the paper under it and the money, in
that order and overlapping — because that is the order those three things
happen in and a chord of them is a noise rather than an event. It used to land
in silence, which is the one moment in the whole run the player has been
walking towards.

**PENN 1 is two shots now.** The building, then the desk — one title card,
because it is one arrival and cutting to a second card that also said PENN 1
would be an edit rather than a beat. One Penn Plaza is a black slab standing
directly on top of the Garden, and the photograph everybody has of it is taken
from the pavement looking up: the tower leaning away and the drum of MSG
curving in underneath. He walks in from the left and through the lit doors.

The low angle is faked the only way flat rectangles can: the tower **tapers**,
and its window courses get shorter and tighter as they rise. The first pass
narrowed it by a quarter over the frame and produced a ziggurat — a real slab
converges by a few per cent and the eye reads even that as "very tall". It
also runs off the top of the frame rather than stopping, because the one thing
such a photograph never shows you is the roof. **The Garden is a drum, not a dome.** The first pass drew a semicircle, which
from the pavement reads as something round lying on its side — and that is not
what you see. It is a very wide, very shallow cylinder: from down there its
roof edge is a long flat curve running most of the way across and dropping
away at the ends, with the ribs hanging straight **down** off it rather than
radiating out of a centre. Radial ribs were the other half of the
wheel-on-its-side problem. It is drawn **before** the tower so the tower
stands in front of it, which is how they sit.

**WHEELS UP** and **ONE MORE FLIGHT** — Penn 1 is on 33rd, GSX is in Las
Vegas and the beach is in Hawaii. Cutting straight from a lobby desk to an
arena asks the player to have crossed the country between two frames. Five
seconds of aeroplane is the oldest fix in cinema and it still works: the map
does the explaining and the scene after it is free.

One function, two destinations — the sky, the ground at each end and the words
on the card all come in as data, because two near-identical scene functions is
how a file ends up with two different aeroplanes. Manhattan behind him and the
Strip ahead on the first; nothing behind him and an island ahead on the
second, with the clock run forward from night to morning.

**One of them is a leg and one of them is only a destination.** The first card
reads NEW YORK → LAS VEGAS, which is a flight people take. The second read LAS
VEGAS → KONA, which is not — there is no non-stop, and anyone who has actually
made that trip has done it through somewhere. So the second card drops the
origin entirely and says **KONA OR BUST**: no arrow, no FROM, one line. The
card handles both by asking whether it was given a `fromName` rather than by
being two cards.

The silhouette behind him went with it. Drawing the Strip on the left of that
frame is claiming the same route in pictures, so by this leg there is nothing
back there — he is simply already out over water, which is also why the sub
is now *"Out over the Pacific, and then nothing at all"* instead of counting
off a mileage that only makes sense from the desert.

The plane flies an **arc**, not a line: a straight line across a frame is a
sprite being dragged, a curve is a journey, and the bank angle falls out of
the tangent for free. The dotted trail and the aeroplane are sampled off the
same quadratic, so they cannot disagree about where the route is. The cloud
deck scrolls the other way, which is the only thing telling you the aeroplane
is moving rather than the frame.

The cue has no tune — a transition with a melody on it stops being a
transition — but it has six things in it, which are the six that actually make
that sound: a **spool-up**, so the engines rise into the scene rather than
being at full tilt on frame one (two sweeps a fifth apart, which is what a
pair of turbofans not quite in sync does); the **engines in three bands**, a
low rumble you feel, a mid whoosh with the body in it and a high hiss for the
air going past outside, because one band of noise is a hairdryer and three is
a cabin; a **throb** built from eleven overlapping swells at drifting gains,
since a sine LFO is a wobble and this has to be a drift; the **vent** above
the seat, thin and the only thing that never changes; the **two-tone chime**
three times, which is the most recognisable sound on an aeroplane and costs
four notes; and a **muffled PA** underneath, two or three low-passed blips
that are obviously somebody talking and obviously not worth listening to.
Plus the gear coming up: one servo and a thud.

**CISCO CLUB** — up on the big stage at GSX. An arena: LED wall, truss with
six heads swinging on their own phase, a lit deck, and four ranks of audience
in the dark with phones going off in them. He comes up the steps stage left,
Chuck Robbins comes in from the right, and they meet in the middle and shake
on it. Flashbulbs on the shake, confetti after.

Three things took a second pass. The wall says its piece in the **top** of
itself, because two men are about to stand in the bottom and a stage screen
with its name halfway up is a screen with a head in front of its name — the
figure scale (`K` 1.08) is set by exactly that: 218K of man under a rule that
ends at 410, with feet on the deck at 664. Both of them get a **pool of
light**, without which they are two dark shapes on a dark deck in front of a
dark wall. And their two marks are **named** rather than derived — the first
pass worked one travel distance out from the wrong side and both of them
walked to x 788, where they shook hands with themselves.

The wall carries the **Cisco mark**, drawn rather than inlined: nine rounded
bars on a common baseline in the real pattern (short, mid, TALL, mid, short,
mid, TALL, mid, short) with the wordmark under them. A PNG of this would cost
more bytes than the code and would be the only logo in the file that could not
take a colour. The wordmark is measured and rescaled to 86% of the bars'
width, because the panel may resolve a different face and a logo whose two
halves disagree about their width is worse than no logo.

**HANALEI BAY** — a sunset, a cabana and two men who have finished working.
Sky in six bands with clouds lit from underneath, sea in lines with a swell
under them, a glitter path, a headland on the horizon, palms that sway, drapes
that blow, tiki torches, footprints stopping at the chair, a ThousandEyes
towel on the sand and a CLUB CISCO banner on the canopy. *"Soak it in and
ENJOY!"* — and then, typed out a character at a time, *"Your number goes back
to 0 tomorrow."*

**The hero took four goes.** Three of them were hand-drawn out of flat bars
and every one read as a surfboard with a head on it. The fourth was a baked
**voxel model** built from `playerModel`'s own head, hair and eye line — which
made him look exactly like the man in the game, and that turned out to be the
problem: the three ending scenes are *drawn*, and a blitted voxel sprite
sitting between two drawn scenes read as a different character who had
wandered in. Consistency across the three beats a resemblance to a fourth
thing nobody is looking at while they watch them.

So he is `sceneGuySeated`: sceneGuy's rules applied to a seated figure — same
92x150 body box, same 50x58 head, same 54x14 hair cap with a sideburn each
side, same front-on view, only the clothes and the pose changed. Seated
front-on, the thighs are a foreshortened band at the hips and the shins hang
straight down off it, which keeps every proportion sceneGuy already has.

**The chair is a folding beach chair, not a lounger.** A lounger is for a man
lying flat and the figure sits up, so the two never agreed and he read as
crouching on a plank. The striped canvas back goes *behind* him and the arms
and front legs *in front*, which is what makes him sit **in** it. It is half
again as wide as he is: at 1.12 it was nine pixels either side of him and
simply could not be seen, and a chair you cannot see is a man standing up.

**And Chuck is standing next to him**, in `sceneGuyResort` — the same rules
with the suit swapped for white linen: long sleeves, an open collar with a V
of chest in it, buttons down the front, a hem below the waist because the
shirt is not tucked in, and short silver hair set back off the brow, because a
full cap of hair down to the eyebrows is a young man. It takes its colours as
parameters rather than being hard-coded to one person, since the moment there
are two figures on a beach there will be three. He wears **stone** trousers,
not white: in linen-on-linen the shirt and the legs merged into one tall white
shape and he read as a chef.

**Winning and dying share a state, and they must not share a beat.**
`ST_DEAD` means "the run is over and the readout is coming" — it carries the
tally for both endings, which is right. What was not right is that it also
carried the **death hold**: `deadFor` started at 0, `drawDead()` waits for
`deathHold()` before it shows anything, and so a man who had just booked the
deal, taken the stage and spent ten seconds on a beach in Hawaii was cut back
to a Midtown pavement to lie face down on it for a second and a half before
being told he had won.

A win now starts its clock already expired, so the readout is up on the very
first frame after the beach and the street is never seen again — measured, the
word BOOKED is painting 5,205 pixels on that frame. The death pose is guarded
on `!G.won` too, because the win screen is 88% opaque rather than 100 and a
corpse showing faintly through BOOKED is worse than no figure at all. And
`hushed` is pre-set with it: the hush fires on the same test and would
otherwise land on the same frame as the win sting and eat it. An ordinary
death is untouched — verified: nothing painted during the hold, headline
after it.

**The punchline arrives late.** The beach card carries a `sub2`, which fades
in and rises two seconds after the first line. A punchline printed at the same
instant as the line it is a punchline *to* is not a punchline, it is a
sentence; the beat is the joke. *"Soak it in and ENJOY!"* — then, after two
seconds, *"Your number goes back to 0 tomorrow."*

**And it is a Club picture, not a holiday.** The resort knows what week it is
and so should the frame: a **CLUB CISCO banner** with the mark on it strung
between the cabana posts, two **tiki torches** whose flames are three stacked
shapes on their own flicker (a single triangle reads as a traffic cone), and a
**lei** round his neck, because everybody who has been to one of these has a
photograph of themselves wearing one. That is what turns it from "a man on a
beach" into "a man at the thing he won", which is the only reason it is at the
end of a sales game.

And it keeps going: **clouds** lit from underneath on three bands at
different speeds (a sunset sky with nothing in it is a colour chart), a
**headland** on the horizon — one dark shape is the difference between "the
sea" and "an island" — **footprints** coming in from the left and stopping at
the chair, because nobody arrives at a beach by teleport, and a **side table**
with his phone on it **face down**. He is not checking it. That is the entire
reward.

**His neck.** The head used to be drawn axis-aligned on the end of a neck that
was rotated along the torso, and the kink where the two met read as a broken
neck. Both are on the same rake now, the head tilted back a little less than
the torso is — which is what a man propped against a deckchair does with his
head — and the neck is short and wide enough that the joint is hidden inside
the head and the collar.

**He is the game character now, not a drawing of him.** The man on the beach
was hand-drawn out of flat bars for three passes and was wrong every time, for
a reason no amount of redrawing was going to fix: the game's hero is a **voxel
model in a cabinet projection**, and a figure made of 2D bars is a different
species. It did not look like him because it was not built like him.

`beachModel()` is built like him — same `P()` parts, same `bake()`, same
projection, and the head, neck, hair, sideburns and eye line lifted from
`playerModel` at exactly the z values they have there, which is what makes it
the same face rather than a similar one. Everything below the collar is
holiday: open shirt, swim shorts, bare shins, flip-flops, a lei and a drink.

**And the chair is a folding beach chair, not a lounger.** A lounger is for a
man lying flat and the model sits up, so the two never agreed — he read as
crouching on a plank. A low folding chair is what an upright seated figure
actually sits in, and it is built so the striped canvas back is **behind** him
and the arms and front legs are **in front**, which is what finally makes him
sit *in* it rather than near it. The arms are short and stay at the sides: at
half the back width they reached across his chest and read as a safety bar on
a fairground ride.

His face got the same treatment. The sunglasses are a **pair** now — two deep
lenses, a bridge and a brow bar, with a warm band low in each lens so they do
not read as empty sockets — and the smile is three steps rather than one bar,
the ends a step below the middle, which is the whole difference between a
mouth that is happy and a mouth that is a dash.

He is **seated**, which a voxel model does cleanly without rotating anything:
the thighs are blocks that run *forward* in y, from the hip at 0.47 to the
knee at 0.17, and in this projection forward is down and to the left — so they
read as legs coming out at you. The shins hang off the knee end and the feet
sit on the sand in front of him.

The cabana went from 296 to **400 high** and the banner moved onto the canopy
valance because of him: a seated man at a readable size is 340px of figure,
which put his head through the roof and the banner behind his head. Printed on
the valance it is also what a real one looks like.

**The pilot wings.** On the stage he wears the pin — black wings with the eye
where the emblem goes. Wings at this size are not feathers, they are a taper:
three bars each side, each shorter and thinner than the one above, drawn
separately because a solid triangle reads as a bow tie and the gaps are what
say "wing". It started at 62px, where the eye came out 17 across and the white
pupil — most of what makes the mark readable — was down to two pixels. At 84
the eye is 28 and the pupil 6, which is the smallest it can be and still be an
eye.

The blazer took four attempts to place. By his feet it read as a cool box; on
the chair back it turned out the back rail, his torso and his head all lie
along the same diagonal, so it came out as a blue slab on his chest — the
surfboard problem again in a different coat. Hanging off the **end of the
lounger rail** it overlaps nothing and is obviously a jacket because it is
obviously hanging.

Both scenes get their own theme. The stage is the only music in the file built
on stacked fifths and a timpani rather than on a progression you could sit
under — everything else here is a mood, and this one is an announcement.

**The beach is hapa haole**, and it took two passes. The first was a ukulele
with a plucked tune over it, which is *island* and is not Hawaiian. Three
things make it so and none of them were there:

- **The steel.** A lap steel glissando is the sound: a note that arrives by
  sliding into place from a third or a fifth below and then sits there
  wobbling. Plucked notes, however pretty, read as a music box. Every lead
  note glides in over a fifth of a bar and holds — and the hold is two tones a
  few cents apart so they beat against each other, which is vibrato for free,
  since there is no LFO in this synth and a detuned pair is indistinguishable
  at this length.
- **The vamp.** II7–V7–I, which in C is D7–G7–C: the turnaround every hula
  uses to get back to the top. The first pass ran C–F–G–Am, which is every
  other song ever written.
- **Slack key under it** — alternating thumb bass, root on one and fifth on
  three, chord brushed on the off beats. That gait is what makes it sway
  rather than march.

Tempo down from 1.3s a bar to 1.9, because chill is a tempo, and the shaker
becomes a gourd: a maraca is not an ipu.

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
- **Silence on the readout.** Every live audio chain is cut once, the frame
  the tally appears (`AUDIO.hush()`). The world stops simulating then so
  nothing new comes out of it, but a scene's music, the tail of a death or a
  brake can all still be ringing, and a score screen with a car horn under it
  is the game refusing to be over. The tally's own counting sounds start after
  the cut and are untouched.
- **A screensaver after two minutes parked.** The title, the readout, the name
  entry and the board run an idle clock; two minutes without a touch and the
  screen becomes the eye on black (`SAVER_AFTER`, `drawSaver`). This is the
  state the thing is most likely to be *found* in — a panel in a hallway that
  somebody walked away from — and it should be the mark rather than a dead man
  and somebody else's score.

  The clock deliberately does **not** run during play. A player standing on a
  corner reading the traffic is not idle, he is playing, and a screensaver over
  the top of that would be the worst thing this file does.

  It drifts, on two sines whose periods do not divide into each other, so the
  path never repeats and no pixel is lit for long: a solid orange shape on
  black, left up for months on a wall panel, is precisely the thing that burns
  in. The drift is invisible while you watch it and the whole point over a
  quarter. It breathes as well, because a still image reads as a frozen game
  rather than as a screen doing what it was told. One fill and one blit a
  frame — the world, the HUD and the readout are all skipped.

  Any input at all wakes it, and that input does **not** pass through to the
  game: waking a screen should never also start a run or skip a tally. The
  swallow sits in the `pointerup` handler rather than in `act()`, because the
  mute button, the leaderboard button and the name entry are all hit before
  `act()` is ever reached.
- **Check `?fps=1` on real hardware.** Everything else was validated in a
  desktop browser; the frame rate on a Board is the number that matters.

## The leaderboard

Three initials, arcade style, on every finished run — won or lost. Tap the
arrows, type them, or **scroll**: a column of letters with an arrow at each end
is a wheel drawn on the screen, so it answers to one. Three things have to be
reconciled there — a mouse notch is one big delta and a trackpad is a stream of
small ones, so the step is a threshold on an accumulator rather than one per
event; `deltaMode` can be lines or pages rather than pixels, so it is
normalised first; and the accumulator is dumped if nothing arrives for a fifth
of a second, or the tail of one flick adds itself to the head of the next.
Vertical moves the letter, horizontal moves between the three, and **Enter**
is "go on, then" on every screen that is not the game itself — the title, the
end screen, the board. The name screen takes Enter first, where it means
submit. Verified: one
notch up steps one letter, two down steps two back, a ten-event trackpad flick
steps two, sideways moves the slot, and it does nothing at all on any other
screen.

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

**There are no streetlight pools on the pavement any more.** Five amber ones
were baked across every pavement strip, and two things were wrong with them:
there are no streetlights on the pavement for the light to fall from, so it
was a glow with no source; and every pavement row is the *same* baked strip,
so the five pools landed at the same five columns on every row and stacked
into continuous vertical bands. Which is what they read as — not pools of
light on concrete, a yellowed stripe down the pavement. A pavement is a flat
grey thing and it is allowed to be one.

**A kerb belongs where the pavement meets the road, and nowhere else.** It
used to be baked into the pavement strip, which was fine when a pavement was
usually one row deep. It is two or three now, and every row was drawing its
own lip: a dark band and a lit orange seam laid across the middle of a single
pavement, where in the world there is nothing but more concrete. The contrast
complaint was not that the kerb was too strong — it was that there were three
of them. The strip is plain concrete now and `drawWalkEdges` draws each edge
only if the row on that side is a road. The street-side lip keeps its weight,
because that edge is the line between safe and not safe and the player reads
it every few seconds; its drop shadow comes off 0.45 to 0.30, which is as much
as it can lose and still read as a step down.

**A pavement is never one row deep.** The roll was 62% road as soon as a
single safe row had been laid, so better than half of all pavements came out
one row thick — a strip he lands on and is immediately back in traffic, with
nowhere to stand and read the next lane and no room for a cart, a stand or
anybody to walk on. `SAFE_MIN` is 2 and the existing cap of 3 still holds, so
every pavement is two rows or three. The floor only applies *while a pavement
is being laid*: the first version tested `safeRun` unconditionally, which
forced a sidewalk after every single road row and quietly deleted every
multi-lane street in the game — 42nd and 57th included. Measured after:
pavements 2 and 3 only, road runs still 1 to 4.

**The celebration wears what he is wearing.** The arms-up cheer was hardcoded
to the blue blazer — right exactly once, for the first set. Collect a second
and the coat turned purple while two *blue* arms went up over the top of it,
with rings and sparks in the colour of the coat he had just stopped wearing.
Coat, rings and sparks all read `G.shield` now. And **the arms are skipped in
flight**: the TAM sprite is baked mid-flight with his arms already out, so
painting a second pair over it gave him four, at the wrong angle. He keeps the
rings and the sparks — a man flying over 42nd Street does not need help looking
pleased.

**Every power-up on the pavement glows.** One used to be a small bobbing
sprite with a caption, which is a thing you *notice*; it needs to be a thing
you *want*, and the difference between those is light. Each one gets a pool of
its own colour on the ground, a halo behind it (eight nested ellipses at
falling alpha — a blurred ellipse for the price of eight fills), a ring
leaving the ground every 1.2 seconds, and four sparks rising off it.

The weight is per SKU. **Endpoint Agents hardest at 1.65**, because the blazer
is the one that changes what he looks like for the rest of the run; metrocards
least at 0.72, because you find nine of them and a card that screams is a card
you stop hearing. The pulse phase is offset by column, so two pickups on the
same screen do not breathe in lockstep — in lockstep they read as a screen
effect rather than as two objects.

Street furniture on the pavements includes bagel carts, pizza counters and hot
dog stands, newsstands, scaffolding sheds, subway entrances and TE-ADDON
terminals. At most one subway
entrance per pavement — subway is weighted twice in the prop pool and each prop
draws independently, so a three-prop sidewalk could otherwise come up with
three staircases to the same station.

### A TE-ADDON terminal is an attach, and an attach is revenue

Walking into one used to hand over a free Path Visualization and a two-line
banner, which made the one piece of actual Cisco motion in the game the
quietest thing in it. It is now worth **$150,000 straight onto the pipeline**,
with its own banner, the handshake chord rather than the pickup blip, and a
line of its own on the end screen and in the report.

The banner is deliberately the TAM payout banner's twin — same plate, same
rule, same `ADDED TO PIPELINE` on the right — because they are the same kind
of event and nobody should have to learn a second layout to read a number. A
TAM outranks it if both land on the same frame.

The count travels: `addons` on the run record, totalled in local stats and on
the server, a `TE-ADDONS` row in the tally, `ADD-ONS n` in the stats strip,
two cards in the report (the count, and the count times 150k) and an `Add-ons`
column in the board table and the CSV. The val clamps it like every other
number, and reads `st.addons || 0` because the stats blob predates the field.

**The skipped total was 3.5x too big.** A tap runs the tally out at once,
which sets the total's progress to 1 while the clock is still near zero, and
the unclamped overshoot term went to about 25 — a giant number printed
straight across the rows underneath it. Clamped at both ends. It only ever
showed on a skip, which is the path nobody watches.

**A trace comes from a terminal and nowhere else.** `path` is out of
`POWER_WEIGHTS`, so it never drops as a cube in the street any more; its 15
slots went to Chuck Bucks, Endpoint Agents and Traffic Insights. `POWERS.path`
stays, because the terminal reads its colour, its copy and its fourteen
seconds out of it, and `POWER_ORDER` keeps the key so the runs already on the
board still read.

**The route always ends on a pavement.** Left to itself the walk stopped as
soon as it had crossed its quota of streets, which half the time is the middle
of a lane — and a line with a crosshair on the end of it that terminates in
traffic is the game telling you to go and stand there. `traceLand` walks on to
the next kerb, trying straight ahead first and then a step either side when
something is in the way, and if it cannot find one it trims back to the last
pavement the route did cross. One of those two always succeeds, because the
route began on one. Checked over 120 traces: 215 paths, every one of them
ending on a sidewalk.

**The route is drawn in the product's grammar.** Nodes joined by links, hop
ticks, per-hop latency, a destination with a crosshair, packets running the
line, and `BEST PATH!` pinned to the furthest node still on screen — because a
line on its own is a fact and the whole point is that it is a recommendation.

The glow is **stacked strokes of the same path, not a blur**: `shadowBlur` and
`ctx.filter` are the two things that put this canvas on the software
rasteriser, so a bloom is built out of one path, four widths and four alphas.
The route also **draws itself on** from his feet outwards over the first 0.6s,
with a bright head at the live end, which is what a traceroute actually looks
like resolving — and nodes only appear once the line has reached them. Hop
latencies come off the cell (`4 + ((r*7 + c*13 + 11) % 46)` ms) so they are
stable frame to frame; a number that flickers is a number nobody reads.

**The double-parked truck sits at the kerb, and goes down last.** It used to be
drawn first, on the lane centre, so every car in the row drove straight over
the top of it. It now drops `PARK_KERB` = 20px toward the camera and draws
after the traffic, so the lane passes on the far side of it the way it does on
a real street. 20px is inside the range the lane already moves things through:
a car swerving round the player travels up to `SWERVE_PX`, 26.

**The TE-ADDON pack is staged like the TAM, because it is that kind of drop.**
It used to be a terminal — a tall dark slab with a screen in it — which read as
a parking meter at any speed at all, and nobody crosses four lanes for a
parking meter. It is a **present** now: a gift box in the path amber with a trace-green
ribbon crossing the lid, a bow on top and the name on the front, floating the
way the TAM cube floats. **Sized against the TAM to the unit** — pedestal at
z 0.02, crown topping out at 0.85, core 0.54 across — because the first parcel
was two thirds of its height standing next to it and looked like the
consolation prize. (A pallet was tried under it. A pallet that bobs nine pixels
off the pavement is worse than no pallet.)

The ribbon's front-to-back run shares the lid's back edge, so it sorts against
it on `z` alone and sits *on* the lid rather than behind it; the left-to-right
run is nearer the camera than either and needs no help. Both stand 0.004
higher than the lid so they are proud of it.

Everything that makes the TAM feel like the premium drop it gets too: a beam
into the sky band so you can see it coming from blocks away, a glow pool and
two expanding rings on the ground, the bob, the **eye** over the top of it, and
then a card reading `TE-ADDON PACK` over `+$150,000 · BEST PATH` — what it is
worth matters more than what it is called. The sparks leaving it are the trace
green rather than the amber: they are a preview of the thing it hands you, and
the only green on the street until you take it. Spent, it drops to 0.4 alpha
and loses all of it.

**The stack is measured up from the ground, not down from the row.** The card
was pinned 182px above `sy`, which is exactly where the box is, so the two of
them sat on top of each other. `drawKioskLabel` takes the y its *bottom* goes
at now, and the ground, the pack, the eye and the card are stacked in that
order.

**And lunch comes off the number.** Three dollars against a seven-figure
pipeline is not a mechanic, it is a joke that lands because the last three
digits of the headline figure stop being zeroes — $300,000 becomes $299,985
after a bagel, a slice and a hot dog. It gets its own `LUNCH` row on the end
screen so the tally still adds up, `cash()` is signed now (−$15, not $-15), and
`pipeline()` is floored at zero because a man who buys a bagel on the first
block should not owe the company seven dollars.

### The newsstand prints a front page

Walk into one and he reads it, and what is on it moves the number — because the
thing that actually decides a quarter is almost never anything the seller did
that week. **Eight stories that help and six that hurt**, drawn flat within
each pool after a straight coin toss: *BGP LEAK SWALLOWS A REGION*
(+$150,000), *ZERO-DAY LOOSE IN THE WILD* (−$50,000), *CFO ORDERS A SPEND
REVIEW* (−$75,000), *RIVAL MISSES ITS NUMBER* (+$110,000).

**The coin is fair; the money is not.** Good and bad land 50/50 — the pools
are chosen *after* the flip, so their sizes change what a win is worth and
never how often it comes.

| | good | bad |
|---|---|---|
| headlines | 8 | 6 |
| chance | 50% | 50% |
| range | +$45k … +$180k | −$40k … −$75k |
| average | **+$102,500** | **−$57,500** |

That is a money ratio of **1.78 : 1** and an expected **+$22,500** a stand.
Newsstands are 7.69% of street props, about **0.218 a street**, so reading
every one you pass is worth roughly **+$4,900 a street** — real, but an order
of magnitude under a TE-ADDON terminal at $150,000 a pop. Each stand serves
once (`newsPr.read`), so a good one cannot be farmed.

The two cheapest headlines — *SAAS VENDOR EATS ITS OWN SLA* (+$55,000) and
*CONFERENCE WIFI DIES ON STAGE* (+$45,000) — were added at the bottom of the
range on purpose. The good pool ran 70k to 180k, a long way clear of the worst
bad news at −$75k, which made a newsstand close to free money with some drama
painted on it: ratio 2.09:1 and +$31,250 a stand. They are still the
industry's weather rather than anything the seller did, which is the conceit
of the whole good pool — just a slower news day.

**Any tap or swipe folds it.** 2.6s is right the first time and long by the
fortieth, and a player who has finished reading is a player waiting. The input
is swallowed rather than passed through — dismissing a card should not also
walk him into a road he cannot currently see. The money is already on the
pipeline by then; the card is only telling him.

The card is 2.6s and it **freezes the world** while it is up, because at the
size a front page has to be to be readable it covers the traffic he is standing
next to. The ticker card used to do the same and no longer does — the paper is
the only pickup left that stops the street. Masthead, rule, today's date off the
device clock, a photo box, three columns of unreadable grey and a coloured band
at the foot of it with what the story did to the pipeline. Each stand can only
be read once; a second visit gets the sad face.

**The masthead is invented.** A real paper's name on a fabricated front page is
a different kind of object entirely, and this is a joke about the industry, not
about anybody's newsroom.

**And the reaction is on his face now, not in a bubble.** `FACE_WOW` is an
eighth baked expression — eyes wide open and round rather than the usual bars,
brows up out of the way, mouth an O. The rays and the rings off the top of his
head stayed; the speech bubble went, because a comic panel floating over
somebody is a panel *about* him rather than a look on his face.

### The two best things in the game are ThousandEyes, so they arrive like it

A TAM and an Add-On Pack used to land the same way a metrocard does: a line of
text in a bar at the top of the screen. They are the two most valuable things a
player can pick up and the moment was worth about a fifth of a second of
attention.

**The two Insights hold half a second longer** than the rest — 1.6s against 1.1.
They are the ones that change how the street itself behaves rather than handing
him something, and that takes a beat more to land. Internet Insights also
carries an **hourglass** above the mark: two bowls meeting at a waist, the sand
draining from one into the other over the life of the burst with three grains in
the air between them. It is drawn slowly on purpose — an hourglass running fast
says the opposite of what that SKU means. It is 78px and centred at y 270,
because the pickup banner ends at 230 and the eye starts around 311, and
anything bigger sits on one or the other. **And a second glass stays on screen
for the whole eleven seconds** — see below.

**Everything that is ThousandEyes by name gets it** — the TAM, the Add-On Pack,
**Endpoint Agents**, **Traffic Insights** and **Internet Insights**, off one
`BRAND_SKUS` table. A metrocard is a prop and Chuck Bucks is a gag; these are
the product. Their copy says what they *do* rather than only what they do in
the game: Traffic Insights is "Insight and control of traffic", Endpoint Agents
is "the user's own experience, from their own chair", Internet Insights is
"outages across the whole internet, before the tickets".

### The mark is the real one

Every eye in the game used to be **drawn from paths** — a lens built from two
quadratic curves with a filled iris, described in the source as "a motif in
ThousandEyes' colour, not their official logo". It was a placeholder with a
note on it saying so, and it has been replaced with the actual artwork.

Two assets, both inlined as base64 like everything else in this file, because
the viewer blocks external images:

- **`TE_MARK_SRC`**, the eye on its own at 398×223, exactly as supplied. Its
  counters are already transparent; the one opaque thing inside it is the
  **white pupil**, which on a white page looks exactly like a hole. An earlier
  pass rebuilt the alpha from how far each pixel was from white, on the theory
  that the counters had been filled in — that is true of nothing in this file,
  and it deleted the pupil. Two colours, posterised alpha, nothing else done
  to it.
The **title** takes the mark on its own rather than the lockup, and the line
under it is **`ThE Last Mile`**, set as a lockup rather than as a word. The T
and the E are ThousandEyes' initials and they are the thing being said, so
they are full size and in the brand orange. The h is the word *The* happening
by accident on top of them, so it is white, **three quarters of the size, and
tucked back under the T** — the crossbar of a T overhangs its stem on both
sides and the space under the right arm is the only hole in the line. Dropping
a smaller letter into it, and pulling the E back behind the h in turn, keeps
`TE` reading as a pair at a glance and leaves *The* there for anyone who looks
twice. The tuck and the kern are fractions of the measured letter widths, not
pixels, because a 9px kern that is right in Segoe UI is wrong in Noto Sans.

**The whole line sits on one baseline**, which needs saying because the rest
of the file does not. The engine sets `textBaseline` to `"middle"` once at
startup and never touches it again — every other string in the game is one
size, so centring on `y` is the same as sitting on a baseline and it is easier
to place. Here it is not: with `"middle"`, a letter at three quarters of the
size is centred on the same `y` and its *feet* end up a quarter of the cap
height above everyone else's, which is exactly what the h was doing. The block
switches to an alphabetic baseline and puts it back, deriving the baseline
from the cap's own measured ascent rather than from a fraction of the point
size so the line does not shift when the panel resolves a different font.
Verified off the painted pixels rather than by eye: T, h, E and the L of Last
all have their feet at y 512. The orange letters are ThousandEyes' initials and the white one turns
them into a word, so the brand is read without being spelled out and the title
is still a sentence. The lockup has the name written out in it; next to that
line it would be the same two letters said three ways on one screen. The four
pieces are measured and laid out off **one** total, because centring each
separately drifts them apart on whatever font the panel falls back to.

**And it is set in a brand stack, not in Helvetica.** The ThousandEyes
wordmark is CiscoSans — a humanist sans with open apertures, a double-storey
`a` and a straight-tailed `y` — and Helvetica is a grotesque, which is the
wrong *family* of shape to stand under it. Nothing can be downloaded here, so
`BRAND_STACK` is a list of what a machine might already have, in descending
order of closeness: `CiscoSans`, `CiscoSansTT` (the real thing, on a
Cisco-managed machine), `Segoe UI`, `Noto Sans`, `Open Sans`,
`Source Sans Pro`, `Lucida Grande`, `Avenir Next`, `Avenir`, and then the old
stack so it can never end up with no font at all.

Measured by width rather than by `document.fonts.check`, which answers *true*
for anything it can satisfy by falling back: every name in the list measures
772px for this line except `Segoe UI` at 771, and the stack measures 771 — so
on Windows it lands on Segoe UI. On a panel it will most likely land on Noto
Sans or the system default, which is as close as this gets without embedding
a licensed corporate typeface.

- **`TE_LOGO_SRC`**, the whole Cisco ThousandEyes lockup at 900×181, snapped
  to exactly two colours so the PNG has almost no colour entropy left to
  store. The type on its own is the left 745px of it, so there is no third
  asset to keep in step. The lockup's *own* eye has no pupil in it, so it is
  thrown away and `TE_MARK_SRC` is composited into the same box — one mark,
  one shape, everywhere.

**Cutting the mark out of the lockup is the obvious move and the wrong one.**
The `s` of *Eyes* touches it — there is no empty column anywhere between them,
only a narrowest one at x 1657 with fifteen pixels of ink in it — and a column
scan that calls a column empty when its *maximum alpha is zero* finds the gap
between the `e` and the `s` instead. The first attempt shipped a hero logo
that read **S◉** and a wordmark that read *ThousandEye*. The mark now comes
from the file that only ever contained the mark.

**It is never tinted.** The two pickup labels used to draw their eye in the
SKU's own chip colour, and keeping that meant flattening the mark to a single
colour and filling it `source-in` — which is exactly what removed the pupil,
since the pupil is the one white thing in it. The real artwork wins: a logo
that changes colour per power-up was never the brand anyway, and the label
under it still carries the SKU's colour.
`drawEye` and `drawLogoEye` keep their path versions as the fallback for a
decode that never lands, the same contract as Chuck's photograph and the voice
lines.

Where it shows up: the **burst** (the mark big, with the real wordmark set
under it instead of Helvetica in caps — 430 wide, not 540, because at 540 it
was 160 tall, reached cy+292 and put the bottom of *ThousandEyes* inside the
name plate at cy+262; at 430 it spans cy+124 to cy+252, ten clear of the mark
above it and ten clear of the plate below), the **title**, the **persistent
lockup** bottom-left — which is now the whole lockup rather than a mark with
no name beside it, since it is the only branding on screen for most of a run —
the two **pickup labels**, and the **favicon** on both the game and the
readout. 33KB of PNG for all of it.

`brandHit` is the opposite. The mark comes up out of the middle of the screen at
the size of a dinner plate, rings leave it, and the product is spelled out
in full underneath — **THOUSANDEYES** over **TAM** or **TE-ADDON** — over a
**cash register**.

**It comes in two sizes, and that is deliberate.** Everything got bigger: the
lens is 12% wider, `THOUSANDEYES` went 62 → 72, the SKU 42 → 52, and every line
now has a hard dark offset under it, because there is no `shadowBlur` in this
renderer and there is a street full of yellow cabs behind the words — orange
type landing on a taxi roof was legible in the editor and invisible in a room.

**Where the burst is allowed to live.** Two hard edges. Above: the pickup
banner ends at y 294, so nothing may start higher. Below: he stands at
`BASE_Y` 858 and the lanes he has to read are *above* him on screen — the next
row up is at 786, the one after at 714 — so anything the burst paints below
about 650 is painted over the two decisions he is in the middle of making.
That is the whole of the playability problem, and it is why the answer is to
move the stack **up** rather than to make it shorter-lived: a celebration that
hides the traffic is a celebration that kills you, and one you can see past is
one you are glad to see again.

Everything hangs off `BURST_CY` 360, and **the eye is what pays for the room**.
It was 222px tall and it is the one element carrying nothing the line below it
does not already carry — the wordmark has the mark in it. Cutting it in half
buys the whole move and costs nothing you can name. The wash came down with it,
0.26 to 0.21, because the wash is the thing that says *stop looking at the
street* and the street is the game.

**The name plate glows.** There is no `shadowBlur` in this renderer and there
never will be — it is the single most expensive thing you can ask a software
canvas for and this runs on a room panel — so the glow is **ten rounded
rectangles stepped outward from the plate** at falling alpha and growing
corner radius, drawn outside in, which is what a blurred rounded rect looks
like for the price of ten fills. Over them a hot white ring just off the edge,
which is what sells a glow as *light* rather than as a coloured smudge, and on
the plate itself a white rim. The whole stack breathes at 9 rad/s — about
1.4Hz, a heartbeat slightly faster than yours. A sheen of six soft diagonal
bands sweeps across it once over the life of the burst, clipped to the plate:
that is the thing that makes a flat colour read as a *surface*, and a surface
is what you want to reach out and take.

**And the word fills it.** It was 58px type in a 68px box with 39px of air
either side — a label in a box. At 72px with 26 it is a *badge*, and a badge is
the thing you remember. And the plate is built round the **ink**, not
the other way round: it used to be a fixed 68-high box at `ny-48` with the
word drawn at `ny`, so the box centre was `ny-14` and the word sat fourteen
pixels below it — a slight list at 58px and a word falling out of its own badge
at 72. Worse, `"middle"` centres the *em* box, which carries room for
descenders a word in caps never uses, so even a correctly centred box leaves
the caps sitting low. Both go away if the ink is measured: switch to an
alphabetic baseline, ask for the actual bounding box of the actual string
(ascent 53, descent 1 at 72px), size the plate to that plus 9px either side,
and put the baseline where it lands the ink dead centre. Three more pieces of flair, all of them cheap: one
vertical **gradient** on the plate, built once a frame and only while a burst
is up, which turns a coloured rectangle into a lit object — brighter along the
top edge where the light is, deeper at the bottom; a **letterpress** pass, the
name drawn once in a light tint 2.5px below itself so the near-black letters
read as stamped into the orange, which is one extra `fillText`; and three
**twinkles** along the edges, staggered, each a four-point star drawn as two
rects. Nine fills for the set, and they are the only thing on the plate still
moving once the sheen has gone past.

Under the badge: **THE PATH TO SUCCESS!** The attach banner above already says
what it *is* and what it is *worth*; this says what it is *for*, which is the
only kind of subtitle worth the room. The name block moved up 12px to make
space for it — the badge grew to 72 tall when it was rebuilt round its own ink
— so the plate runs 534 to 606 and the line under it ends at 636, ten clear of
the plate above and five clear of the third row of traffic ahead of him at
641.

**Every SKU gets the badge.** It used to be the two big ones on a plate and
everything else in coloured type over the street, which said — without meaning
to — that Endpoint Agents and the two Insights were the cheap seats. They are
the product. They get the same object, built the same way, at `BADGE_K` 0.82
of the size: same gradient, same rim, same sheen, same twinkles, same
letterpress, a slightly tighter glow. The two that have to burn in keep their
lead through size and the third ring, which is the right way to say it.

Each of them says what it is *for* underneath, the way TE-ADDON does. Endpoint
Agents already had the best line in the game (*"Blue Blazer of Assurance"*,
then the double purple); Traffic Insights gets **INSIGHT AND CONTROL OF
TRAFFIC** and Internet Insights **OUTAGES BEFORE THE TICKETS**.

The two that have to survive the drive home, **TAM** and **TE-ADDON**, go
bigger again: everything ×1.22, the lens ×1.38, three rings instead of two, a
stronger wash, six tenths of a second longer, and the name on a **solid plate
in the brand orange** rather than coloured type over the street. A name you
have to pick out of the background is a name you read; a name on a plate is a
name you *saw*. The plate is measured with the same font string `txt` builds,
or it is the wrong width for the only two words on the screen that matter. The
test is simple and it is the whole point of the exercise: somebody who has
played forty runs should be able to name two things afterwards, and these are
the two.

**Three things used to say the same sentence at once.** A TE-ADDON raises its
own attach banner (which already reads `THOUSANDEYES ADD-ON PACK` and
`+$150,000 ADDED TO PIPELINE`), the burst, and the money rise — and the rise
floats off *his head*, which at the new type size is exactly where
`THOUSANDEYES` is. Two green numbers through the middle of the wordmark.

Fixed three ways. While any burst is up the rise parks centred at y 930 and
rises to 810, under the name plate and above the health bar, so it reads as
the bottom line *of* the burst instead of as a second thing fighting it —
decided at draw time, not when the rise starts, because the two fire in the
same frame and the order differs by pickup. The big burst drops 26px, since at
×1.38 the lens reaches y 292 and the attach banner ends at 294. And the
TE-ADDON burst lost its subtitle: a third copy of the same sentence in a third
size is not emphasis, it is noise.

Every burst also hangs **half a second longer** — `BRAND_HIT` 1.10 → 1.60, so
the whole family moves together and the ones already carrying their own extra
(both Insights, the blazers, TAM and TE-ADDON) keep their relative weight. Always in the brand orange, whatever the SKU's own chip
colour is: the first version took it from the product, pale for a TAM and amber
for the pack, which made the one moment that is supposed to be ThousandEyes
*itself* look like two different things. The mechanism first, two short noise bursts, one bright and
one dull, which is the *cha*; then the bell a twentieth of a second later, four
partials at inharmonic intervals because a real bell is not a chord and a sine
on its own is a doorbell; then the drawer coming out and stopping. Eight chains
scheduled, all of them torn down afterwards — measured 0 live nodes before and
0 after, which on this file is not a formality. The banner that follows says `THOUSANDEYES ADD-ON
PACK` rather than `TE-ADDON ATTACHED`, and the pickup label on the pack itself
says `THOUSANDEYES ADD-ON`. The point is that seeing the brand should be the
good feeling, not the small print on it.

It is gone again in 1.1 seconds, the wash is capped at 0.18 alpha and lasts a
third of a second, and the mark itself draws at 0.86 rather than opaque. He is
standing on a pavement when either of these fires — the TAM is inside its
booth's invulnerability and the pack is street furniture on a safe row — but
the lanes he has to read next are behind all of it, and a celebration that
hides the traffic is a celebration that kills you.

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
| Subway entrance with no MetroCard | Shakes his head, throws both hands up, and says so: **NEED METRO CARD** |
| Stairs he just came up, holding a card | Same shrug, different reason: **NO ROUTE** |

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

**His complexion is one constant, `HERO_SKIN`,** used by both baked models and
by every hand drawn over them at runtime — the fists in the cheer, the shrug at
a closed turnstile, the figure in the Penn opening and the one at the bar — so
the sprite and the gestures cannot drift apart.

It went minifigure yellow for a while, on the argument that the man you are
*playing* should be nobody in particular: everybody else is drawn from a real
range of complexions on purpose, because the street is Midtown and Midtown
looks like Midtown, and a seller in Hartford and a seller in Johannesburg are
both meant to look down at that figure and see themselves holding the
briefcase. The argument is fine. What it looked like was a toy standing next to
a street full of people, and that is the verdict that counts.

He is back, and then **two steps darker and warmer** again: `#c2956b`. The old
`#e9b98c` was pale enough against a navy blazer and a night sky that he read as
lit from inside, and each step down also takes a little of the pink out, so
what is left is a tan rather than a wash. It sits in the middle of the range
the rest of the pavement is drawn from rather than at the top of it. Verified
across all six baked variants: the new tone is in every one, the yellow and the
old pale tone in none. The hand signing the purchase order is left alone; that
line says AUTHORISED SIGNATURE, and it is not his to sign.

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
landed on, since a ride covers seven to fifteen crossings at once and a sponsor
carries three rows. After: **0 rides land past 81**, and a three-rows-at-a-time
walk fires all eleven milestones and the dinner in order.

**Seven to fifteen streets, and the run takes 0.6s a street.** Both of those
moved. It was ten to twenty, and twenty streets is a third of the walk gone on
one swipe — the far end of that range made the metrocard *the game* rather than
a thing in it, where the best run was the one that drew the most of them. Seven
to fifteen still skips a real stretch of Midtown and still beats walking,
without deciding the run on its own.

**And fifteen is a ceiling on what gets *ridden*, not just on what gets
rolled.** The search takes the first station at or beyond the street it wants,
and where the stations are sparse that overshoots — the park is ten solid
streets with no subway in it, so a ride aiming at W 62 surfaced at W 70 and
the eighteen-street ride the player saw was never one of the nine the roll
could produce. The scan now also keeps the furthest station still *inside*
`SPAN_MAX` as it goes, and anything over the cap falls back to it. Measured by
attempting a ride from every row of a full walk: 157 rides, spread 1–15, none
over, none refused. The cost is that 16% now come out shorter than seven —
they are the ones that used to overshoot, and a short ride is a better answer
than a broken promise.

And the run was a flat 5.4s whatever it carried, so a seven-stop hop and a
fifteen-stop haul cost the same. It is now `RIDE_PER_ST` × streets — 4.2s for
seven, 9s for fifteen — so the ride costs exactly what it covers. The
fiscal clock ticks through the whole thing (it runs above the ride's own
return in `update`), which is what makes that time real. The floor of 1.0s is
for the truncated ones: a ride stopped short by the turn at 81 or by Penn can
be a single street, and the camera racing fifty rows in a blink is a smear with
no doors-close in front of it and no stop behind it. The other four beats —
down, platform, arrive, up — are fixed, because the stairs and the doors take
as long as they take. Measured: 7 streets, 4.20s asked, 4.22s on the clock.

**`n TO GO` counted rows, not streets.** It read `R.toRow - camRow`, which is
the distance in *generated rows* — three or more to a crossing once the avenues
and the multi-lane streets are in — so an eleven-street ride opened by
promising thirty-odd to go, and the two numbers on the same line disagreed by a
factor of three. It is taken off the run clock now instead of off the camera,
which makes it exact rather than merely right: the run is 0.6s a street, so it
drops by one every 600ms and lands on zero as the doors open. Measured on a
seven-street ride: 7 at the first frame, then 6, 5, 4, 3, 2, 1 at 600, 1217,
1833, 2417, 3017, 3633ms.

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

### Damage

Every hazard used to take the same 75%. It is worked out from what the thing
*is* now: damage scales with its **width** and the **square root of its
speed**, so size leads and speed is deliberately sub-linear — a bus crushing
you slowly is worse than a cab clipping you quickly. The yellow cab comes out
at exactly 75 by construction, and everything else is measured against it.

| | w | spd | damage | hits from full |
|---|---|---|---|---|
| NYPD motorcade | 1.70 | 6.40 | **−100%** | 1 |
| city bus | 2.60 | 0.72 | **−99%** | 2 |
| black SUV | 1.60 | 1.46 | **−86%** | 2 |
| **yellow cab** | 1.45 | 1.34 | **−75%** | 2 |
| DSNY truck | 2.40 | 0.48 | **−74%** | 2 |
| parcel van | 1.35 | 0.86 | **−56%** | 2 |
| delivery e-bike | 0.80 | 1.72 | **−47%** | 3 |
| pedicab | 1.55 | 0.62 | **−41%** | 3 |
| horse carriage | 2.10 | 0.30 | **−39%** | 3 |
| tourist crowd | 2.90 | 0.36 | **−31%** | 4 |
| parked box truck | 2.00 | 0 | **−25%** | 4 |

The one thing the formula cannot know is whether the thing is a ton of metal,
so `HAZ_HARD` tempers the four that are not: a crowd of tourists is the widest
hazard in the game and would otherwise hit like a taxi, and a parked truck is
something you walked into rather than something that hit you. The screen shake
scales with the hit too, so a bus and a pedicab do not land the same way even
before you read the number.

This cuts both ways: a bus is now nearly a one-shot, and a crowd takes four.

### Speed

Two lanes of the same thing should not run at the same pace. The per-lane
spread was ±15%, which is not enough to see; it is **±28%** now — measured
across 40 worlds, cab lanes ran anywhere from **1.52 to 6.20 tiles a second**.
The crossing guarantee adapts on its own, because the gap is expressed in time
rather than distance, so a faster lane is handed a proportionally bigger one.

Each driver also has his own foot, ±14% within a lane, **with car-following**:
he drives at his own pace until he catches the one in front, and then he drives
at that one's. Without the catch-up test a quick driver closes on a slow one
and `separate()` snaps him back every frame, which reads as shunting. 547,200
sampled car pairs after all of it: **0 overlaps**.

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
| An objection that lands | **−15% to −100%**, see below |
| Endpoint Agents shield | absorbs the hit completely, costs no health |

**Traffic nearer the camera than he is now paints over him.** He is drawn on
top of every vehicle on purpose — tucked into strict depth, a car in the lane
he had just left covered him to the waist and he looked like he was wading —
but the blanket version of that rule put him over a parcel van a row and a
half *in front* of him, standing in mid-air with his legs across its roof.
That is the same note the pedestrians got: somebody lower down the screen than
he is should pass in front of him, because that is what depth looks like. His
own row and everything beyond it still draws under him; anything at least a
full row nearer draws over him, with that row of slack so the lane he is
halfway out of does not swallow him on the way.

**The shield stacks, and the blazer has a name.** Nobody remembers "Endpoint
Agents, a shield". Everybody remembers the **Double Purple Pimp Blazer of
Assurance**, and having remembered it they can tell you what it does, which is
the only reason a name is worth anything. The first set is the
**“Blue Blazer of Assurance”**; the second turns the coat purple, adds a
wide-brim hat and a cane, and is the double. **The cane goes in the hand the
briefcase is not in**: both hung off the same side, which at fifty pixels is
not a man with a cane and a case, it is a stick growing out of a box — one
object nobody can name. The case moves to the far hip at level two and stays
on the near one everywhere else. And the cane has a **crook**, not a knob:
there are no curves in a voxel model, so the round is four blocks walking up
out of the shaft, over the top and back down the far side with a tip hanging
below the turn, sized so the notch between the tip and the shaft survives at
sprite scale. Mirrored about the shaft rather than negated, so the hook curls
away from him whichever way he faces. It is worth **two** hits: purple
takes one and drops to blue, blue takes one and drops to nothing, and only the
third actually lands. The badge beside the health bar doubles up so the number
of free hits left is countable rather than inferred from the colour.

**A third set pays $100,000 instead of evaporating.** He is already wearing
both, there is nothing left to put on him, so they write it up — and a
power-up that silently does nothing is the one thing worse than not finding
one. It carries its own line on the end screen (`SPARE BLAZERS`) so the number
is accounted for rather than appearing in the total from nowhere. Verified in
sequence: blue, double purple, +$100,000, +$100,000.

Verified: 1 agent → blue, 2 → purple, 3 → still purple; hit one leaves 100%
health and the blue coat, hit two leaves 100% and no coat, hit three takes the
full −75%. And the sprite actually worn at each level is the bare, blue and
purple variant respectively.

While it is held, a **blue shield badge sits against the right-hand end of the
health bar** rather than in the power-up chip row. What it does is take one hit
*instead of the bar taking it*, and sitting it with the other power-ups said
nothing about which number it was protecting.

Each blazer carries an **outcome line** in the money green: *SHIELDS UP!* on
the blue one and *DOUBLE SHIELD!* on the purple. The blazer is the joke; the
kicker is what it bought him, and that is the half a seller repeats. The third
pickup already states what it is worth on its own line and does not need
telling twice.

**No arrows on these two.** The arrows belong on a line about a *number* going
up — "you're unstoppable" has a direction to point at. A shield going up is
not a trend, and two triangles either side of it read as decoration. Verified
by drawing the same kicker string both ways and sampling the band: 693 green
pixels across 126px bare against 830 across 163px with the arrows, both
centred on the same axis.

**And the blazer names get a size of their own**: 30 rather than 26, pushed 14
further down the stack, because they are the line people quote. The gap to the
kicker grows with the tagline (`+(subSize-26)/2`) or a bigger line above lands
on the top of its caps. The burst then bottoms out at **674**, still clear of
the second row ahead of him at 714.

`brandHit` takes an `opts` bag for these — `{bare, subSize, subDrop}` — rather
than three more positional arguments threaded through every call site to say
nothing. Everything that does not pass one behaves exactly as it did.

The two **blazer** pickups hold half a second longer than every other burst
(`BRAND_HIT + 0.8` against `+ 0.3`, so 2.4s against 1.9s). "DOUBLE PURPLE PIMP
BLAZER OF ASSURANCE" is thirty-eight characters on one line and it is the joke
of the whole SKU — at the common duration it was gone before it had been read,
which is the one failure a gag cannot survive. The third pickup's line is
short and keeps the ordinary beat.

All of them live together near `CHUCK_BONUS`, so the balance is one line to
change.

Three exemptions, each for a reason:

- **The subway is free.** A ride covers seven to fifteen streets sitting down,
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
attached — **and it goes down differently.**

Everything else kills him by hitting him, and the hit death is built for that:
a jolt against the blow, a fast hinge to flat, a 36px slide and 11px of air,
all of it over in half a second. Running out is not that. Nothing touches him.
He stops. So it is three beats, and all of them are slow:

| | | |
|---|---|---|
| **0.00–0.62** | the sag and the knees | he leans 17° and sinks 20px, eased *out* — legs fail fastest at the end |
| **0.62–1.24** | the kneel | he holds there, folded, for well over half a second |
| **1.24–1.86** | the rest of him | over to flat and down the remaining drop, eased *in* — a body not catching itself |

That middle beat is the whole thing. Without a pause between the knees and the
ground it is one movement, and one movement is a *fall*. It was 0.18s to begin
with and that was not a pause, it was a hitch; at 0.62s it is a man who has
stopped. He travels 9px rather than 36, and only on the last beat as the
weight goes over, because nothing carried him anywhere. It finishes at 1.86
against a **2.05** hold — `deathHold()` is longer for this death than for any
other — so the last thing on screen before the readout is him lying still.

**There was a face-down sprite here for a while** and it is worth writing down
why it is not. A body modelled lying along +y, head at the far end, cross-faded
in as he went over, with dust and a contact shadow; then the cross-fade was
replaced with a forward foreshortening because the standing sprite hinges
*across* the screen while the prone one lay *away* from the camera, ninety
degrees apart in plan; then the prone model was pushed up `PRONE_Y0` so the two
boxed to the same pixels. Each step was more correct than the last and the
whole thing still read as one picture becoming another rather than as a man
going down. The hinge on its own, slowly, says it better. Measured: tilt 0, 6,
11, 15, 17 by 0.48, dead still to 1.24, then 18, 25, 37, 54, 77, 90 by 1.92.

The money goes with him either way — it is what the player is actually losing —
but it is not kicked out of him here: a third of the speed, a narrower cone and
twice the hang, because money leaving slowly is a worse feeling than money
leaving fast, and the slow one is the point of this death. And there is no
impact to play, so `AUDIO.collapse()` is a long breath falling away with the
two thuds that are the whole of it, soft and low, at 0.62 and 1.66 — the knees,
then the rest of him. The screen does not shake at all.

**The drain is per box and per second now, not per street.** Half a point of
health for every square he covers on foot, and a quarter point for every
second the run is live. A street was a lumpy proxy for both: a four-lane canyon and a one-lane
side street took the same 3% off him, a sideways dodge to get out from under a
bus was free, and standing on a corner reading the traffic cost nothing at all
— which is the one behaviour the old model actively rewarded.

Everything goes through `spendHp()`, so no path can drain him and forget to
check the worn-band prompt or the death. It keeps both floors the per-street
charge had: a third rate below `HP_CRAWL`, because the last few blocks are
where a run is lost and a hard rate turns *nearly out* into *already out* with
no chance of reaching the next cart, and the same third while he is in the air
on a TAM, because being carried over the traffic is not walking. The subway
stays free of the per-box charge — he is sitting down, and charging forty boxes
for a ride would make the metrocard a trap — but the clock keeps running,
because time passes on a train like anywhere else.

**These two numbers have been moved four times, and the next person to move
them should know which way each one went.**

| | **now** | | | |
|---|---|---|---|---|
| | 1 / 0.5 | 0.5 / 0.25 | 0.75 / 0.375 | **0.5 / 0.25** |
| a forward step | 1.000 | 0.500 | 0.750 | **0.500** |
| a three-row Cloud Insights leap | 3.000 | 1.500 | 2.250 | **1.500** |
| standing still, per second | 0.500 | 0.250 | 0.375 | **0.250** |
| a step below `HP_CRAWL` | 0.340 | 0.170 | 0.255 | **0.170** |
| full tank, ground alone | 100 boxes | 200 boxes | 133 boxes | **200 boxes** |
| full tank, clock alone | 3.3 min | 6.7 min | 4.4 min | **6.7 min** |
| round trip, ground only | 422% | 211% | 317% | **211%** |
| a four-minute run, clock only | 120% | 60% | 90% | **60%** |

**1 / 0.5** shipped, at roughly 1.9x the per-street drain it replaced. It
turned the food cart from a thing you took when it was on your way into a
thing you had to go and find, and a man detouring for a hot dog is not a man
walking uptown.

**0.5 / 0.25** overshot the other way. The walk stopped costing enough for the
route to be worth tracing and a cart you passed was a cart you could ignore.

**0.75 / 0.375** was the midpoint — but it landed *after* the carts were
thinned by 15%, and the two compounded into a walk nobody could finish. This
is the trap in tuning two dials at once: each was a defensible move on its own
and the pair was not.

**0.5 / 0.25 again** is where it is, deliberately back on the rate that was too
soft — because it is not the same game at that rate any more. There are 15%
fewer carts to find and the health on offer per street went 17.0% → 14.4%.
Same drain, ~15% less supply, so it sits between the two rather than on either.

All measured through `spendHp()` rather than read off the constants, so the
`HP_CRAWL` third is in the step figures. At the current pair the ground costs
**2.25% a street** against **14.3% on offer**, so covering the walking takes
about **16% of the carts you pass** and the clock roughly doubles that.

If it needs moving again, move `HP_PER_BOX` and leave the clock alone. The
ground is the cost a player can watch himself spending — he sees the bar move
when he steps — so changing it reads as the game being harder or easier. The
clock he feels without being able to point at it, and moving that mostly makes
runs end at a time he cannot explain.

The drain is deliberately more than you start with. You cannot finish on the
tank you begin with. A flat rate for all three made the choice of cart meaningless. Now a pizza
counter is worth crossing for and a hot dog is what you take because it is
there.

Measured over 1,200 generated worlds — counting a *street* as one run of road
rows, which is one crossing — the walk puts **1.06 food carts on every
street**, worth **14.4% of health a street** once the second hot dog is
counted. Against a ground cost of about 4.5 boxes a street, or 2.25% at the
current `HP_PER_BOX`, eating roughly a sixth of the carts you pass covers the
walking; the per-second drain roughly doubles that.
Average spend across a cart: **$5.80**.

Both of those were 1.26 carts and 17.0% before the carts were thinned by 15%
— see the weights below.

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
| **Fine** | 75–100% | the flat mouth with about a pixel of lift at the ends, no cheeks — barely above level. The full smile is what he does when he has just eaten, and wearing it for the whole top half of the bar made a man walking to a meeting look delighted about nothing |
| **Smile** | he pays, and between bites | three rects, middle one *lower*, cheeks |
| **Flat** | 50–75% | one level mouth, nothing else going on |
| **Meh** | 25–50% | the frown with half the step in it |
| **Worn** | under 25% | eyes half shut, heavy brows, mouth open, flushed |
| **Grinning** | the orange suit | baked into `heroModel` rather than selected here — it belongs to the moment, and on the ordinary sprite he wore it for the whole sixty seconds of an engagement, long after the flying had stopped being impressive. It took two goes: a four-pixel one-sided lift with a raised brow came out as a leer, and the level "proud" mouth that replaced it was too pleased with itself to be pleased at all. It is the ordinary smile curve now, with cheeks — he is flying over Midtown in an orange suit and should look like he is enjoying it |
| **Chew** | while he is eating | jaw dropped, lower lip below it |
| **Sad** | he walks into a cart he already bought from | middle *raised*, brows angled in |

An **engaged TAM puts orange shoes on him** instead of changing his face. They
are drawn *on* the figure rather than over it: each shoe is the same box the
model bakes, re-projected through the player's actual draw rect, so it lands on
his feet at any scale and under any of the seven faces. The alternative was a
shod variant of every face in both directions with and without the shield —
twenty-eight more baked canvases on a device whose sprite memory is already the
thing to watch.

Verified: 100/80/75 → smile, 74/55/50 → flat, 49/30/25 → meh, 24/5 → worn; a
TAM at 60% leaves the health face alone, a TAM at 10% still shows worn, and a
spent cart or a mouthful beats all of it.

Chewing alternates with the smile at about 3Hz once the bites start — a jaw
working rather than a flicker; anything faster read as a glitch. The eyes are
shared across all three, which is what makes the chew read as the same man
rather than a different sprite.

The curve needs a step of about 3px across a 14.5px head or the three rects line
up and read as a straight bar. The first attempt used 1.3px and did exactly
that.

**The hair is a moulded piece, and the hairline is nowhere near the brow.**
It is cut short and swept back: a thin crown sitting *on* the skull rather
than over it, and a sideburn down each side running past the eye line — which
is what stops a high hairline reading as a receding one. One colour
throughout, so the cuboid shading is the only thing separating the faces, the
way a minifig's hair piece is one lump of plastic with light on it.

The crown is **flush with the front of the head** (0.424 against 0.430 is a
sixth of a pixel) on purpose. Standing it forward gave a lit ledge over the
brow and the whole thing read as a board balanced on him; flush leaves one
crisp horizontal hairline instead.

**The skull had to grow for any of that to be visible.** The eyes sit at
0.742–0.766 and the mouth is below them, so on a head that stopped at 0.800
there were 1.4px between the brow and the top of him and no amount of moving
the hairline was going to find a forehead that was not there. The head is
**0.200 tall** rather than 0.145 — by way of 0.170, because this is the third
pass at the same problem. All of the extra goes above the eyes, where a minifig
keeps its head anyway, and at 31px wide against 20 tall it is still wider than
it is high. The hairline sits at 0.848 against a skull that stops at 0.855,
which makes the forehead the whole 0.766–0.848 band — **8.2px, against 5.2 at
the previous size and 1.4 when the hair still came down to 0.78** — and there
is no fringe at all. The sideburns grew with it, from the hairline down past
the eye line. The pimp hat rides higher again to clear the lot.

**Hats and hair sort on the back edge.** Parts are drawn furthest-first by
`y + d`, with ties broken on `z`. The hair reached 0.59 against the head's
0.58, which made it one step further away and hung it off the back of his
skull rather than sitting on top; the first hat was worse, at 0.62, and read
as a purple frame standing behind him. Matching the head's back edge drops
both onto the `z` tiebreak, and a higher `z` is what "on top" means in this
projection. A brim may still overhang *forward* — a smaller `y` — because that
is the only direction it can reach without going behind the head.

**Walking into a spent cart** is its own answer now. A cart serves a fixed number
of times and the stand is still standing there afterwards, so without a reaction
the refusal looked like the controls ignoring him.

### He walks. He used to hop

A 30px arc and an ease-out cubic that darted him out of the square and set him
down made a man on his way to a meeting look like a frog. Three changes:

- the easing is a **smoothstep**, so the speed builds and settles instead of
  all of it being spent in the first third;
- the **arc is gone** unless he is actually airborne, where it is deeper than
  ever, because that one is a flight. What is left on the ground is the bob of
  a walk: two footfalls a square, 3.4px;
- and the **stride is clipped, not baked**. The sprite is one bake and there
  are already forty-two of them, so the band below the knee is drawn twice —
  once clipped to the left half, once to the right — each raised by its own
  half of the cycle, 5px at the top. The sliver of road that opens under the
  raised shoe is the point: that is the foot off the ground. One cycle per
  square, and the phase flips on odd steps or he leads with the same leg every
  time.

**The gait runs on its own clock, not on the step.** Tying the cycle to
`G.hop` made every square its own little animation — the legs came up, went
down, snapped to attention, and the next tap started it again from zero, which
is what read as stiff. `G.walkPh` only advances while he is moving and
`G.walkAmt` eases in and out around it, so a second step picks up where the
first left off and the legs settle over about a tenth of a second instead of
snapping. **Half a cycle — one footfall — per square**: a full cycle was two
footfalls in 135ms, which is a sprint, and worse, the phase came back to where
it started every step so he led with the same leg every time. Half means they
alternate for free. Verified: π a step, legL, legR, legL, legR.

**And the leg bends.** A thigh and a shin that travel the same distance is a
wooden leg swinging from the hip, which is what still read as stiff once the
gait itself was right. Each leg is two bands rather than one, split at the knee
(model z 0.21), and the shin comes up half again as far as the thigh — so the
leg gets visibly shorter at the top of the swing, which in this projection is
exactly what a bent knee looks like. The foot also kicks along the direction of
travel, but only on a step that *has* a direction the projection can show: a
sideways one, capped at 2.5px, because the gap between the inside edge of a
trouser leg and the middle of him is 3.6. Six bands now, so six blits.

**Eating does not move the bar immediately.** It holds at what he had for
`HP_HOLD` = 0.5s so the player reads the number he was *on* before the food
lands, then fills to the new one over `HP_FILL` = 0.35s. A bar that jumps while
the man is still handing over the money never shows you what the meal was worth
— it shows you the answer and nothing else. The percentage counts with it, or
the two disagree for a beat. **Damage reads the same way.** Getting hit holds
the bar at what he had and then empties it to the new number, so the player
watches the bite come out rather than finding it already gone. Measured on a
bus: shown 100 through 498ms, then 54, 19, 6, 1 by 833ms.

That one needed a fix in `update` before it worked at all. The hold and the
fill counted down *below* the hit-stop return — the `G.hurtT > 0.46` guard that
freezes the world for a beat on impact — so for the first third of a second
after a hit, which is precisely the window the delay exists for, neither timer
moved. The bar sat at the old number and then sat there some more. The two
ticks now run **above** the guard. Before the move: shown 100 at every sample
out to 960ms.

**A health bar over his head under 25%,** and for three seconds after either
of the two things that move the number — eating, or getting hit — at any health
at all, because those are the moments the figure is what you are looking at and
the HUD bar at the bottom of the screen is not. Same three colour bands as the
HUD so the two never disagree, ticked at the quarters so a quarter of a bar
reads as a quarter rather than a sliver, and measured against `HP_MAX` rather
than against the threshold, because a bar that is full at 24% health is a lie.
It fades in over the three points below the line and out over the last half
second of the three.

And he breathes when he is not walking — 1.3px at about 0.25Hz, folded into the
same `lift`. A figure perfectly still between taps is a statue, and a statue is
the other half of what read as stiff. `walkStride` returns null while he is
idle, so standing there still costs one blit rather than five.

The squash and the shadow shrink were a jump's, so on foot they are cut to a
fifth and a fifth respectively. Measured over four steps: lift peaks at 3.4px
mid-footfall, the legs alternate 5px and 0, and consecutive steps lead with
opposite feet.

**The traced route has its own footsteps.** Same climbing pentatonic ladder
as an ordinary step, but the note is a stack — root, fifth, octave and a
twelfth over the top — on sines rather than a triangle, with a longer tail
and a ping on it. Staying on the path should sound like being rewarded for
staying on the path, which is the entire pitch of the product. Checked
against the square he is arriving at, not the one he is leaving, so the note
lands with him.

**And the TAM hero flies rather than hovering.** While he is crossing a gap he
pitches over into the dive and comes back up as he lands — 0.62rad on a step
with a sideways component, which is the one the projection can show, and
0.24rad on a step straight up the screen so he is never bolt upright
mid-flight. Both scale with the sine of the hop and with `flyA`, and the pivot
is his middle, not his heels: rotating about the origin is a man falling over.
Sampled: 32° at the top of a sideways step.

**Flying is both fists over his head.** Standing with his hands at his sides
and a cape on is a man in a costume. A fully horizontal pose was tried — the
whole figure authored lying along x, head leading, legs trailing — and
abandoned: at 148px long and 24px thick it read as a log, and the head got
lost against the cape. Arms up is the one silhouette that works at this size
and this camera angle. The raised arms sit at back edge 0.57 against the
shoulders' 0.58, so they pass in front of him rather than behind, and they
clear the head, which spans 0.37 to 0.63.

**He is sluggish in the red.** The worn drag used to ramp from nothing, which
meant crossing into the band changed the handling by an amount nobody could
feel. There is now a step of 0.15 the moment he goes under `HP_WORN` and then
it climbs to 0.85: 135ms a step becomes 155ms at the threshold and 250ms on
his last point of health, which is slow enough that a gap he would have taken
at full strength is not there any more.

**The ticker card lost its logo.** A wordmark drawn from paths next to a real
symbol is the one place on that card where a mock starts to look like a claim.
The name is the symbol now too — `CSCO`, not `Cisco Systems Inc`.

### The man in the hood, and everybody else in the car

**He was a head and a half taller than the hero.** 153px against 113, which
made him a monster rather than a stranger — and a monster is not frightening
in the way a stranger is. He is fitted to the hero and stood on the same
floor now, both derived from the sprite rather than eyeballed: 223 is his
sole in his own coordinates and 70 is the top of the hood, so 153 is his
height and the scale and the drop both follow from where his feet have to
land. The knife, the blade glint and the KO all scale with him. The reaction
clock does not — everything else shrank to human scale, but that bar is the
reaction test and a reaction test you have to squint at is a trap.

**Three things make the question live, and none of them turn into anything.**
The nine-in-ten man still does nothing at all; the point is that you cannot
know that.

- a **lurch**: a quarter of the times he sets off he does it at three times
  the creep for half a second, and then stops dead. That half second is the
  whole of him.
- a **tell**: standing still, 30% of the time a hand comes out of the pocket
  with something in it, for nine tenths of a second, and then goes back. The
  same metal as the blade. Two points of light come up slowly inside the hood
  while it lasts — half the brightness and half the rate of the ones that
  mean it.
- the **hood turns**. The opening slides a few pixels toward whatever he is
  looking at, eased over about half a second. It is the only thing on him
  that can point, and a hood that tracks you is worth more than any amount of
  menace standing still. A head that snapped round would be a jump scare, and
  this is supposed to be worse than that.

- and **he talks to you**. Not one of his fourteen lines is a threat, and that
  is the entire point — the frightening version of a stranger on a train is the
  one asking an ordinary question slightly wrong. *"Hey. Can I use your phone?"*,
  *"Who do you work for?"*, *"What is in the case?"*, *"You look like
  somebody."*, *"Where you gettin' off?"* He says one on the beats where
  something nearly happens — a lurch, a tell — and never twice inside four
  seconds, because a stranger who keeps talking is a character and he is
  supposed to be a question. Three harder ones come out with the blade
  (*"Give me the bag."*), where there is nothing left to wonder about.
- and, now and then, **red eyes**. Two points come up inside the hood over
  0.7s, hold, and go out again over 1.3s, with a soft disc behind each one
  because a flat rect in a black opening reads as a sticker. They start at
  0.09 a second against a run phase of 4.2-9s, so between a third and
  two thirds of rides get one. They never mean anything, and that is
  deliberate: the whole man is
  a question the game refuses to answer, and this is the part of him that
  cannot be read as a tell at all.

**You cannot go straight back down the stairs you came up.** The exit is
flagged on the prop it plants, and walking into it gets `YOU JUST CAME UP
THOSE` rather than another train. Stepping back in put the player on a second
ride without a single step on the street in between, which is not a decision,
it is a loop — and the ride is meant to cost you the walk, not replace it. Any
other staircase still works; verified both ways.

**The bubble over his head says which of the two things is wrong.** It used to
say `NO METRO CARD` either way, so a player standing at the stairs he had just
walked out of, holding four of them, was told he had none — which reads as a
bug in the counter rather than as a closed route. A card in hand at a dead
entrance now gets **NO ROUTE**; an empty wallet anywhere gets **NEED METRO
CARD**. Verified all three branches: no card at a live stair, card at the exit,
no card at the exit.

**The other people in the car were two rectangles and a head**, which at this
size read as furniture — and a hooded man standing among furniture has nobody
to be a stranger among. One rider per slot now rather than two, at the hero's
own scale: coats of two lengths in six colours, five skin tones, hair or a
beanie, and one thing each of them is doing — a phone with its light on the
face, a backpack, headphones, a scarf, or asleep with their eyes shut.
Everything derives from an integer seed, so nobody changes clothes between
frames, and they stand to one side of the grab pole rather than having it
come up through their heads.

**There are enough people here that nobody has to stand for a category.**
Seven skin tones across the whole range; seven hair colours including grey and
white; **nine ways of wearing it** — cropped, short, shoulder-length, a top knot,
a beanie, a headscarf, a natural, locs, a turban — and a coat that may or may
not be a skirt, with tights or without. Penn 1 to 81st is the most mixed
stretch of pavement in the country and it should look like it. Anything that
falls *behind* the head (long hair, the afro, locs) is drawn before the face so
it frames it rather than being painted across it.

Two tables pair them up: `HAIR_FOR` says which hair colours go with which tone,
and `STYLE_FOR` which styles. Neither is a rule about people — they are rules
about what reads at twenty-eight pixels across. Everybody can go grey or white;
the common styles are in every row; the textured ones and the turban sit where
they read.

**And every one of them had the same complexion until this landed.** The tone
came off `(seed * 3) % 7`, which looks like a spread right up until the seeds
themselves are a multiple of seven apart — which is exactly what both callers
were handing it, `i * 7 + 5` for the street and `i * 7 + 3` for the car. The
tone is `seed % 7` now and the seeds step by 13.

**And they are out on the street too.** Nought to two on every pavement,
walking, wrapping round the ends. They carry no state at all: the position is
`x0 + v * G.t` wrapped, so nothing has to be stepped, and a row that scrolls
off and comes back is where it would have been. They block nothing and collide
with nothing, because they walk at the *back* of the pavement — model y 0.86
against the 0.46 the player walks on, which is 29px further up the screen — so
he passes in front of them, and they go down before the props so a hot dog
stand stands in front of them.

### One in fifty of them already knows you

A champion. Somebody in a suit with a briefcase, walking the same pavement, who
you have sold to before — and walking into them is not an argument, it is the
renewal: **$300,000 of Cloud Insights**, from somebody who had been meaning to
call. *"Hey! Good to see you — I've been meaning to reach out."*

The odds are the whole design. Two percent means a player can walk forty blocks
and never meet one, which is what makes meeting one an event — and it is the
only thing in the game that rewards walking **into** somebody, which is the
opposite of everything else it has taught you. They keep the square, because he
has stopped to talk, and afterwards they are just somebody in a suit.

Until then they are the loudest thing on the pavement: a blue beam, a body
glow, two rings leaving their feet, and a `CHAMPION` chip over their head with
a caret pointing down at *which* head. A halo on its own was tried and was not
enough — two percent of people is two percent, and a player who walks past the
only one in the run has been robbed of the best thing in it. Six baked
variants, the same skin tones and hairstyles as everybody else, a charcoal or
navy suit, a shirt, an orange tie and a bag. The banner is the third of the
three money banners — same plate, same rule — in the Endpoint blue, because this
one is a *person* rather than a product, and it outranks the add-on for the same
reason. `CHAMPIONS` gets a tally row, a figure in the stats strip, two cards in
the report, a board column, a field on the run record and a clamped field on the
val.

**And he never goes back to the pavement's lines.** Somebody who has just handed
you three hundred thousand dollars does not then tell you to watch where you are
going. Afterwards he does what everybody does once the business is done —
*"I'll call you next week."*, *"I'll shoot you an email."*, *"Send me the deck,
I'll look."* — and on the **second** walk into him he stops being polite about
it: *"I said I'd call you."*, *"Alright — enough."*, *"We are done here."*

**On the third he takes it back.** `CHAMP_LIMIT` was five, which is four more
chances than a real champion gives you. At three there is room for exactly one
brush-off and one warning, and the warning has to land on the second or the
withdrawal arrives with no notice at all. *"Actually — let's hold off on that."* The
deal was never signed — he said he *wanted* to add it, which is the most fragile
thing in any pipeline and the first thing to go when the person who championed
it stops wanting to see you. Same banner, same plate, in the red, with the rise
running the other way (`−$300,000 / OFF THE PIPELINE`), and `bonusChamp` and the
champion count both reversed. It is the only line in the game that takes money
off the number for something the **player** did rather than something that
happened to him. Verified over four bumps: one pleasantry, one warning, then
−300,000, and he stays angry after.

**The money says so three ways at once.** A figure climbs out of him and fades
(`+$300,000` over `ON THE PIPELINE`, rising 120px over 1.9s); the HUD readout
swells 12px and turns green for 1.4s; and the banner's right-hand third is a
filled green block with the number at 62px rather than a rule and two lines of
grey. Any one of those on its own is a line of text in a bar — the three
together are the only reason anybody notices a number in the corner changing.
The Add-On Pack gets the rise and the swell too, because it is the same kind of
event.

**They have their own lives.** Two of them meeting on the same pavement stop
and have four words about it — *"Ayy! Long time."*, *"Cold enough for ya?"* — one
speaking and the other replying three quarters of a second later, then both
walking on. Only when they are actually closing on each other, and with a seven
second cooldown each, so the same two do not talk every time they drift past.

And they **buy lunch**. Anybody passing within 0.4 tiles of a cart may stop and
order (*"Two slices."*, *"Coffee, light and sweet."*), and if somebody is
already there they stand 0.62 of a tile behind them — a real line, up to four
deep, which shuffles up when the head is served. The head waits **five seconds
flat**: long enough that a queue is a real obstacle rather than a decoration,
short enough that walking round it is a choice rather than the only option.

**A queue does not move for you.** It is the one obstacle in the game that
cannot be pushed past on the second tap — *"I'm in line here."*, *"Wait your
turn."*, *"Go around, go around."* — which is safe because it is on a pavement,
it clears itself in five seconds, and forward and back are both still open.

**And the cart sells what the cart sells.** A bagel counter does not do slices
and a slice counter does not do bagels — but both of them will sell you a
drink, which is why the **soda** and the **coffee** (the blue-and-white cup;
nothing else on a New York pavement looks like it) are the only two things that
cross over. The order they say matches the counter too: *"Pepperoni, hot."* at
the pizza place, *"Sesame, cream cheese."* at the bagel place, *"Mustard, no
kraut."* at the dog cart, with *"Make it two."* and *"Keep the change."* as the
three anybody says anywhere. The first item on each menu is listed twice, so
most people buy the thing the place is named after.

And they **eat it walking**, like everybody else in this city: four seconds of
it, the glyph up at the mouth on the side away from the figure, a bite about
every 0.85s and a small dip of the whole body on each one. Same trick the
hero's chew uses, one extra draw call per person.

**They used to teleport a tile and a half to the left the moment they were
served.** Leaving the queue folds the standing position back into `x0`, and
`folkRaw` returns `((u % span) + span) % span - 1.5` — so solving for the
unwrapped `u` that lands on `qx` means aiming at **`qx + 1.5`**, not at `qx`.
Measured after the fix: 0.000 tiles of jump.

Standing still **stops their walk clock** rather than overwriting their
position: `frozen` accumulates while they are held and `x0 + v * (G.t - frozen)`
carries them on from exactly where they were, instead of snapping to wherever
the world clock has got to. Leaving a queue folds the queue position back into
`x0` for the same reason. And each of them walks their own **lane**, 0.80 to
0.92 rather than all on 0.86, which is what lets two people pass each other
instead of occupying the same pixels — the projection already shifts both x and
y by it, so depth comes free.

**Times Square does not stop at the kerb.** The five blocks north of 42nd —
`CROWD_FROM` to `CROWD_TO` — carry **three times the people**, with the roll
floored at one so none of them can come up deserted. A cutscene about being
stuck in the crush followed by an empty street was the game contradicting
itself one row later. Measured over 240 rows: 4.13 people a pavement inside the
band against 1.13 outside it, minimum 3. It keys on the street number rather
than the leg, so the walk home is just as bad — and speech bubbles take one of
three heights off the seed, because four people talking at once all at the same
altitude is one illegible stack.

**Nobody argues with the cape.** While he is flying they do not block him at
all — he already passes over scaffolding and parked trucks, and a man standing
on a pavement is not going to be the thing that stops him. They scatter on the
spot, out of a queue if they were in one, and talk about it afterwards
(*"Did you SEE that?"*, *"Only in New York."*, *"I am callin' somebody."*).
Verified: on foot the first tap is refused and he stays put; flying, he takes
the square in one tap and they are 1.15 tiles further along.

**There is only ever one of him.** Two hooded men on the same screen is a gang,
and a gang is a different game — the whole weight of him comes from being the
only one. `HOOD_GAP` = 34 rows between them: the visible band is
`ROWS_BEHIND + ROWS_AHEAD` = 21 and he can wander `HOOD_REACH` = 5 from where he
started, so 34 apart cannot close to within 21. The flag belongs to the *row*,
so it goes to the first person on it and nobody else — handing it to the whole
loop put three of him on one pavement. And the draw keeps only the one nearest
the player regardless, because a leg change regenerates the rows ahead and the
spacing counter does not survive that. Checked over 900 rows: nine of him,
minimum gap 36, never more than one in any visible band.

**And he is out there too.** About one pavement in twenty-two has the hooded
man on it — never in the park — and on the street he is only ever a presence: no
knife, no robbery, nothing to react to. He closes on you slowly, holds at `HOOD_KEEP` = 0.95 tiles, says the same
fourteen things, and gets the red eyes at the same rate.

**And he follows you off the kerb.** Up to `HOOD_REACH` = 5 rows from the
pavement he started on, across the lanes, at 1.15 rows a second — and the
traffic does not care who he is. He is measured against the body of a car, not
its nose, the same way the player is, and when one gets him he takes it exactly
the way the player does: a jolt, a topple and a 34px slide the way the thing was
going, then he lies there for 3.2s and fades. A man who stops at the kerb is
scenery; a man who steps into 42nd after you is the reason you keep walking. He
is far slower than anything on the road, so it is not a chase he can win — it is
a thing happening behind you. Verified: hr 13.44 on the pavement, 13.88 and
14.32 in the road, flattened at 14.48.

**He looks before he steps off.** `HOOD_LOOK` = 1.15 seconds of the lane's own
traffic, swept forward from where each car is now: if any of that lands on him
he waits on the kerb, and he never enters a motorcade row at all. Once he is
committed he hurries (`HOOD_RUSH`, 1.9×), because stopping halfway across four
lanes of 42nd is how you get hit, not how you avoid it. It is a lookahead, not a
guarantee — he gets it wrong often enough to be worth watching, which is the
point of him being out there.

Because he can leave his row, he cannot be drawn by it: `HOOD_DRAW` gathers
everybody in a hood once a frame and each is drawn in the row he is standing in,
before that row's own contents, so the traffic in the lane passes in front of
him.

He **steers** rather than drifting, so he cannot be derived from the clock the
way everybody else is: `hx` is his own integrated position and `folkRaw` hands
it back untouched. He is drawn rather than blitted, scaled 102:153 off the rest of the pavement
and then **`HOOD_TALL`, a tenth taller**, the same as in the carriage — he is
the same man and he should be the one you keep an eye on wherever he turns up.
Measured: 96.5px against everybody else's 87.7 on the street, 99.4 against 90.4
in the car.

On the train he is on **70% of rides** rather than 45, and he means it on
**5.5%** of those rather than 10 — the whole value of him is the question, and a
question you only get asked every other ride is not one you carry around with
you. His pacing is weighted toward walking now too: 2.4–5.4s of closing against
0.6–1.7s of standing still, which is the difference between a man who is around
and a man who is coming.

**They hold their ground, and they tell you about it.** The first version had
them slide out of the way as he closed. It stopped the sprites overlapping and
looked like nothing that happens on a New York pavement: people do not glide
aside for you.

So the **first attempt at their square is refused** — they say one of fourteen
lines in a speech bubble (*"Hey! I'm walkin' here!"*, *"Step back, Jack."*,
*"Comedy show tonight?"*) and he does not get the step. **Under 25% health they
say something else entirely** — eleven other lines, concern or revulsion
(*"Whoa — you all right, buddy?"*, *"Get away from me."*, *"You look like you
need a slice."*). Walking into somebody is the same action either way, but a man
grey in the face and dripping does not get told to watch where he is going, and
both halves of that reaction say the same thing to the player: you are in
trouble, and the fix is food. It is the one piece of coaching in the game that
arrives in somebody else's voice. The **second attempt
goes through**, and they shuffle over 1.15 tiles with bad grace, eased out of
the displacement rather than animated into it so `x0` can move immediately and
the walk carries on from the new line.

**Anybody nearer the camera than he is draws after him.** The player is
deliberately painted over the whole world — he is the one thing that must never
be ambiguous, and a car in the lane he had just left used to be drawn over him
so he looked like he was wading through it — but that blanket rule put him in
front of people plainly a row closer to you than he is, and what should have
read as depth read as him standing inside somebody. Depth here is row plus the
model y the figure stands on: he walks the 0.46 line and they walk 0.86 at the
back of the pavement, so *within* a row he is always the nearer of the two and
nothing changes. Only the rows in front of him defer, and they carry their
speech bubbles with them.

That is also what keeps the generator's guarantee intact: a blocker that always
yields on the second tap cannot pin anybody. And it only applies **while he is
already on a pavement** — a man halfway across 42nd does not stop for a
conversation, and a refused tap out there would be a death. Both get `AUDIO.jostle()` — cloth, then the low thud of two people meeting —
and the refusal also gets a **voice**: a few short formant blips through a
low-pass, which is roughly what speech is across a pavement and is the oldest
trick in the book for a reason. The seed moves the pitch, so the man in the
beanie does not sound like the woman with the tote.

**There are three of them**, because there were three kinds of thing being
said and one noise for all of it. What separates them is the *contour*, which
is the only part of speech that survives being reduced to three blips — you
cannot hear the words, you can always hear whether somebody is pleased,
annoyed, or asking.

| | shape | measured | where |
|---|---|---|---|
| `SAY_WARM` | three blips stepping **up** and settling, triangle through a 1150Hz low-pass | 183→196, 206→220, 246→263 | the champion's offer and his *"I'll call you next week"*, two people on a pavement talking to each other |
| `SAY_CROSS` | two blips, lower, sawtooth through a tight 620Hz low-pass so it growls, each falling hard, plosive on the front | 148→104, 116→81 | anybody you have just walked into, the man at a cart, the champion's warning and his withdrawal |
| `SAY_ASK` | flat, flat, then the last one bending sharply **up** and held longer | 187→181, 164→159, **191→309** | *"Who do you work for?"*, *"Hey, can I use your phone?"* |

That rise on the third blip is the interrogative. It is the same in every
language anybody has looked at, and it is the whole reason the third voice
works without a single word in it. **A line ending in a question mark picks it
whatever the caller asked for** — `sayFor(line, dflt)` — so the hooded man's
two questions ask and his *"Give me the bag."* does not, off the same call.

Pedestrian-to-pedestrian chat had no sound at all before; it gets the warm one
now, and only within six rows of him, because the whole pavement muttering at
once is a crowd scene rather than a street. Verified: all three contours as
tabled, the question-mark override on every line in the pools, and 0 live
audio chains after all three have played. The bubbles
draw after the props, so a hot dog stand cannot sit on top of the words, and
they are smoothstepped in and out at both ends rather than ramped — a linear
fade has a corner at each end of it and the eye finds both. The rise is driven
off the same curve as the fade, so the bubble arrives rather than appearing and
then moving.

They are **baked**, not drawn live. A couple on every sidewalk on screen is
twenty-odd figures a frame and each one is twenty-odd `fillRect`s, where the
rest of the world puts a whole bus down with one `drawImage`. Twelve variants
at 0.86 of the carriage scale, blitted like everything else.

**They are the hero's size, off his own sprite.** `bake` pads every sprite by
14 a side, so the hero's *visible* figure is `(h - 28) * 0.92` tall and his
soles sit `14 * 0.92` above the bottom of the image `drawRider` places — 90.4px
and a floor line at `cy + 181.3`. A passenger is authored against a base figure
102 units tall and then scaled by `tall / 102`, with four percent either side
for variety: enough that a carriage is not a row of identical people, not
enough that anybody looks like they belong to a different game. Before this
they were 102–116px tall standing at `cy + 190`, which is both taller than the
man walking past them and standing in the floor.

**And everybody in the car stands on `CAR_FLOOR`.** It was 78, which put the
whole carriage up inside the window band with their feet somewhere on the
glass. The windows run `cy+66` to `cy+198` and the floor below them to the blue
stripe at `cy+268`, so **132** lands the soles at `cy+235` — the middle of the
floor, which is where people on a train actually stand. `carSole()` and
`carVis()` work it out in one place because the hero, the passengers and the
man in the hood have to agree about it to the pixel: the hooded man used to be
fitted to the *image bottom* rather than to the soles, 13px into the floor, and
scaled against the padded height, which left him 29% taller than the hero even
after he was supposedly matched to him.

**The CSCO card is 2.4s, not 3.4.** It is a celebration, not a document:
everything on it is legible inside a second and the last of it was dead air
over a frozen street.

### Moving about the car

A step is a **tween, not a jump**: a fifth of a second of easing out plus a
small lift, so it reads as a stride across a moving floor rather than a sprite
being dragged from one window to the next. `R.slot` is where he is going and is
what the logic uses; `R.slotX` is where he *is*, and is what gets drawn.

**Half a slot at a time, and nobody moves out of his way.** A full slot is a
fifth of the car — a stride no man takes, and he teleported from window to
window. `RIDE_SUB` is 0.5, and the stride duration scales with the distance
(`RIDE_STEP * |ns - from|`, floored at 0.06s) so the walking speed is the same
whatever the step size is set to: half a slot takes 0.10s. Measured over nine
taps: 2.5, 3, 3.5, 4, held at 4 against the end of the car, then 3.5, 3, 2.5.

The old rule emptied the slot he was heading for *and* the one he was leaving,
to stop him walking through a stranger. What it actually did was blink one
person out in front of him and another in behind, which read as the two of them
swapping places every time he moved. Everybody stays put now; he is drawn after
the loop, so he passes in front of them, which is what happens on a train.
Picking things up is a proximity test rather than an equality one — within half
a slot counts — because he no longer lands on the integers every time, and a
roll of notes you walk past without taking is worse than one that was never
there.

**The carriage has people in it with opinions.** The passengers get the same
lives as the people on the pavement: one per slot, seeded the way the drawing
seeds them so the man who speaks is the man you can see. Walking into one gets
a mouthful **and the step still goes through** — he passes straight past them
and they overlap for it. It used to be the pavement rule: first tap a refusal,
second tap through. On a five-slot car that is a wall rather than a crowd. The
pavement is a street he has a choice about; the carriage is five feet wide with
a man at the far end of it closing on him, and a passenger who eats a tap is a
passenger who got him robbed. Nobody on the train blocks him now, nothing in
there is a hit, and the only exception is the man with the blade — walking into
*him* while it is out is the briefcase swing, which is handled before the step
is even considered. Verified: every slot occupied, he walks 2.0 → 4.0 without a
refused tap and stops only at the end of the car, and the swing still fires for
+$250,000 with the knife cleared.

They still say it the first time he goes by, because that is the carriage
talking and it costs him nothing — only on a landing that puts him squarely in
somebody's slot, since a half step between two of them is the aisle. And two of
them next to each other exchange
four words every three to six seconds, the reply three quarters of a second
after the opener, the same beat the pavement uses.

**On the train they talk about the train.** The pavement's lines are about the
pavement — *"I'm walkin' here"* means nothing to somebody holding a pole — so
the carriage has its own set: *"Signal problems. Again."*, *"Express is runnin'
local today."*, *"Don't miss your stop."*, *"Hold the pole, not me."* Fourteen of
those, eight brush-offs for being walked past (*"There is a whole car, pal."*,
*"That is my foot."*), and three rare ones at **one in eight** — *"It smells like pee in
here."* A joke you hear every ride is not a joke, it is the smell. The
low-health pool still overrides both, because somebody grey in the face gets
concern wherever he is standing.

**The man with the knife measures against the drawn position, not the logical
one**, so the gap he is judging is the gap the player can see.

**He walks the car in quarter slots.** A slot is a fifth of a 1740-wide car —
330px — which is a stride no man takes, so he used to teleport window to
window. It went to half a slot and is now a **quarter: 83px**, about two
thirds of his own width. Because the stride time scales with the distance, he
crosses the car at exactly the same speed either way (5 slots/sec, measured
before and after) — 16 steps instead of 8. The one number that had to move
with it is the floor on `stepDur`: `RIDE_STEP * 0.25` is exactly 0.05, and the
old 0.06 clamp would have made every small step run 17% slow and quietly made
the whole car longer to cross.

`RIDE_SUB` is also the **reach** — what he is within one step of, he picks up
— so halving the step halves that too. That is the point: a roll of notes two
full windows away should not jump into his hand.

**The benches.** Cantilevered off the wall with no legs, the way they are in a
real car: a lip where the seat meets the panel, a lit edge along the front, a
dark apron under it and moulded dividers across it, because a flat slab three
hundred pixels long reads as a shelf. Drawn before the passengers so they
stand in front of it rather than on it, and it stops at the bay rather than
running through the doors, which is where the standing room is.

**The money is at one end of the car or the other, never in the middle.** He
starts in slot 2, so an end is always two full slots away — eight steps at the
quarter-slot stride — and that walk is the whole mechanic now that somebody
else wants it too. Dropped in slot 1 or 3 it was one stride and a shrug. It is
pulled before the hooded man, so he can never be standing on it when the doors
close: measured over 4,000 rides, slots 0 and 4 only (1114/1118) and never
once under him.

**He has to be standing on it.** The reach used to be one step, which at half
a slot was 165px — a man scooping up a roll of notes from most of a window
away. `RIDE_TAKE` is 0.13, which is "on the square" expressed as a tolerance:
both cash slots and his starting slot are whole numbers and he moves in
quarters, so the only distance that can satisfy it is zero. The 0.13 is slack
for floating point after eight additions of 0.25, not a reach — if the stride
ever stops dividing into 1, that is the line that has to change with it.

**And he is told what he got.** The ticker card is suppressed on a train for
good reasons, which left the one moment the player is actually paid down there
completely silent: the pipeline ticked up in the corner and nothing else
happened. The amount now rises over his head in the same green as every other
winning number, off the same `chuckRoll()` the card would have shown, with the
SKU under it — a figure with no name on it is a number, and the whole exercise
is that it should be a product.

### And he can see that you are struggling

The ordinary pool is a man asking you the time. `HOOD_HURT` is the same man
noticing that you are hurt, and every line is help offered in a way that is
worse than being ignored — *"Hey man, you need me to carry you?"*, *"I can
hold your stuff while you catch your breath."*, *"I wonder if your jacket
would fit me?"*

They escalate on their own: carry **you**, hold your **stuff**, wear your
**jacket**. Nothing in the game ever acts on any of it — he is still the
nine-in-ten man doing nothing — which is exactly why it lands.

He only says them while it is **true**: hurt, or under `HP_WORN`, and within
`HOOD_REACH`. A man offering to carry you at full health is a non sequitur,
and the whole weight of these is that he is right. Not while he is on his way
to a pickup either — he has stopped being interested in you by then, and that
is its own joke. Measured over 90 seconds: about one line every six seconds
while worn or hurt, and **never once** at full health. The carriage version
has them too, because the clock drains on a train as well.

### Everybody else wants it too

A roll of notes lying on a pavement in Midtown has about five seconds in it,
and the man in the hood is not the only person on the street who can see it.
After `FOLK_GREED_AFTER`, one ordinary pedestrian on that pavement walks over
and pockets it.

**One of them, not four.** The nearest on the row, chosen once — re-picking
every frame would hand it to whoever drifted nearest this tick, and four
pedestrians converging on a pickup is a scrum. What this is for is the small
sinking feeling of watching somebody else bend down.

**And only along their own pavement.** Crossing the road for it is the hood's
trick and it is the only thing that makes him different from the crowd. They
also only want **Chuck Bucks** — measured: a metrocard and a TAM on the same
square are never even noticed.

Pedestrians carry no state normally (`x0 + v*t`, wrapped), so a grabber gets a
real column in `f.gx` and `folkRaw` returns it while it is set. When he is
done — or when somebody beats him to it — the walked position is folded back
into `x0` so he carries on drifting from where he is standing rather than
snapping back.

**The clock is the money's, not theirs.** `seenT` is counted above the test
for whether anybody is standing on that pavement. It used to be counted below
it, which meant a roll landing on an empty stretch sat there for the rest of
the run, and the first person to wander onto that row started counting from
zero as if it had just been dropped — the money had been on screen the whole
time either way. Now somebody arriving at a square that has been sitting there
for ten seconds goes straight for it, which is what anybody would do. The loop
only covers rows in view, so "five seconds" still means five seconds the
player could see it.

Measured end to end: noticed at **5.02s**, taken at **6.83s** from two columns
away and **13.5s** from nine. On an empty pavement the clock now runs (8.00s
after eight seconds) and the money stays put because there is nobody to take
it; drop one pedestrian onto that row and he commits in **0.02s** and has it
**1.83s** later. A player walking straight at it still wins comfortably; one
who stops to count the lanes may not.

### And he does it on the street too

Four seconds of following you and he looks up. The man in the carriage goes
for the roll on the seat; this is the same man on the pavement, and he wants
the same things — a **metrocard** or a **roll of Chuck Bucks** lying on the
ground is worth more to him than another block of walking behind you. He says
the same thing about it, takes it, and gets the same green dollar signs.

**The four seconds are the whole design.** Straight away he would be a
pickup-stealing hazard, which is a different and much worse creature: the
point of him has always been that he follows and nothing happens. He has to
have *been* the question first and then break off — a man who turns away from
you and walks toward the thing you were going to collect is the only version
of this that is funny rather than cheap. The chase clock **decays** rather
than resetting when you get clear, so breaking line of sight for half a second
does not buy a fresh four.

He goes for it half again as fast as he creeps after you (`HOOD_LOOT_K`),
because he has decided something, and he closes all the way — `HOOD_KEEP` is
the distance he holds from a *person*, and a metrocard is not going to be
unnerved by him standing on it. Measured: noticed at **4.02s**, taken at
**7.97s**.

`hoodLoot()` only ever returns those two. A terminal is bolted down, a shield
is nothing to him, and a TAM is not a thing a man picks up off the floor —
verified across all eight pickup kinds: metrocard and Chuck Bucks noticed,
the other six never looked at.

### The man in the hood wants it too

Left alone long enough he notices the roll on the seat, says **"Hey, what's
that?"**, and goes and gets it. That turns an errand into a race and is the
only reason the walk to the end of the car costs anything.

He is slow on purpose. `SHADY_NOTICE` is 2.6s of not noticing and
`SHADY_GREED` 0.38 slots a second after that, against a run phase of 4.2 to
9 seconds. Measured over 3,000 rides with **the player never moving** — the
worst case — he notices on 94% of them and reaches it on **23%**. A player who
sets off immediately wins every time: two slots is 1.6–2.7s of tapping against
his 5.0s best.

Everything else he does is suspended while he goes for it. That is also what
makes it readable from across the car: a man who was drifting toward *you*
turns and walks the other way, which is the cue to run.

Only the nine-in-ten version does this. The one who means it is already coming
for something, and a mugger who breaks off to pick up litter is not a threat.

**And his eyes become green dollar signs.** Same ramp shape as the red eyes so
they arrive and leave the same way, and they suppress the red entirely — two
colours of light in one hood is a fault, not a mood. Drawn as type rather than
boxes: a `$` is four strokes and a bar at this size, and every attempt to
build one out of rects reads as a letter S with a problem. Verified by
sampling the hood: 428 green pixels with the dollar signs up and 0 red, 140
red pixels on an ordinary showing and 0 green.

**And the money is drawn last.** It used to be drawn inside the slot loop,
which put it behind everything that came after. Nobody *stands* in its slot
(`carPaxAt` returns null there), so the people in the windows were never the
problem — the **hooded man** is. He is drawn at his own floating position
after the loop and drifts up the car, and he could park himself squarely over
the one thing in the carriage worth walking to. Money you cannot see is money
that is not there. It now draws after the passengers, after him and after the
hero; the hero cannot cover it either way, since he collects it the moment he
is within one step. Verified by parking the hooded man on the cash slot — the
roll draws over him.

It sits **on the bench** now rather than floating in the middle of the window,
which is what *"someone left it on the seat"* always said it was doing, and
the bob is down from 5px to 3: a roll of notes on a seat should settle, not
hover.

Collecting Chuck Bucks on the train **does not raise the ticker card**. It is
laid out against the street — it sits high and clear of where the walking
figure stands, and the carriage puts him somewhere else entirely — and the ride
is already a scene. Stacking a second one on top threw the player out of the
carriage mid-stride, which is exactly when the man at the other end is walking
towards him. The money, the sound and the flash all still land.

### The carriage

The car does more than hold two figures now.

**Sound.** Jointed rail under the wheels: two axles over the same gap a beat
apart, every 0.56–0.68s with a heavier one every fourth, plus a long low roar
and the occasional flange squeal on a curve. It is scheduled off the ride clock
rather than looped, so nothing has to be stopped later and nothing can be left
running when the ride ends — and it goes silent the moment the car is not
moving. Measured: 10 clacks in six seconds of running, **0** at the platform.

**Graphics.** The band of card advertising above the windows (one of them is
ours), the **strip map** in the card slot beside it, straps that swing with the
car each on its own slight delay, a floor with dirt on it, and the lights
dropping out for two frames in a hundred while the car is working hardest.

**The strip map is the actual journey, and it lives where a strip map lives.**
It used to float over the doors at the bottom right, which is where nothing
is, and it was seven anonymous dots with a bullet sliding along them — which
tells you a proportion and nothing else. It is one dot per street now, from
the station he got on at to the one he gets off at, with both ends written on
it (`W 34` … `W 43`); the dots behind the train light up as he passes them and
the train itself is white so it is never mistaken for a stop. The thing the
counter over the window says in words — *9 STREETS · 6 TO GO* — is now also a
picture. Both ends are stored on the ride at boarding rather than looked up
later, because the rows under them are regenerated while he is on the train.
It took the card slot the TE advert was in and the advert moved one along: a
subway car with no advertising in it is not a subway car.

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

**He goes over when he dies.** A figure that simply vanishes under a panel has
not been hit by anything, so he takes it, hangs for a tenth of a second, and
then topples — accelerating, the way something that has stopped holding itself
up falls. The pivot is the model origin, which `blitScaled` already treats as
the point under his feet, so he swings round his heels rather than round his
middle. Sampled off the live canvas: 0.00s 0°, 0.08s −7° (the jolt), 0.20s 39°,
0.34s 75°, 0.50s flat.

**And it takes him with it.** The tilt on its own was a hinge — his feet
stayed exactly where they were and he swung down like a gate. Getting hit by
something moving does not leave you standing in the same spot, so he also
travels 36px in the push direction and leaves the ground for a moment on the
way: an ease-out slide, because all the speed is in the contact and the rest
is scrubbing off against the road, and half a sine of hop that is over before
he lands flat. Both run off the same push direction the tilt uses, so they
are always *away* from whatever caught him. Measured: 0.05s 8px across and
5.5px up, 0.15s 21px and 11px (the top of the hop), 0.30s 32px and back on
the deck, 0.52s the full 36px with the tilt at 90°. The same sample with the
push reversed comes out at −36px.

**He falls the way he was hit**, not the way he was facing. The collision
records the direction the thing that got him was travelling — which a path
trace can have reversed, so it reads `dir * rv` rather than `dir`. Two
exceptions: the parked box truck throws him *backwards*, because nothing hit
him, he walked into it; and the wrong-way bike throws him against its lane, by
definition. A death with no hazard behind it — exhaustion, or the quarter
closing — clears the push and falls back on the facing, and clears it explicitly so it
cannot inherit the last collision's. Checked both lane directions, both
facings, and that running out of road comes out with no push at all.

**What comes out of him is money.** The spray used to be orange and red
sparks. He has been carrying that number in the HUD the whole way up Midtown,
and now it comes out of him when something takes him off his feet — it reads
as blood for about a tenth of a second and then you see what it actually is.
Money sweat.

Notes are not sparks, so the pool of thirty forks on `p.bill`: a third of the
gravity, drag, a spin, and a sideways wander on the way down. Each one is
drawn as a green note with a pale panel and a dark centre, and the tumble is
faked with a horizontal squash — `cos` of the angle takes it edge-on and back
again, which is the whole reason it reads as paper rather than as a green
square. The panel and the centre are skipped below 7px wide, so edge-on it is
a bare sliver, which is correct.

**The death gets its own moment first.** The end screen used to drop over the
top of the frame he died on, so the one thing the player most wants to see —
what actually got him — was covered before he could see it. The world keeps
running underneath for `DEATH_HOLD`: the money, the shake and the figure all
stay up, and the tally clock does not start until the screen is actually there,
or the first rows would be half counted by the time anybody saw them.

`DEATH_HOLD` has been lengthened three times. 0.50s was enough to register the
hit; 0.85s got the fall onto the ground; 1.00s let the notes come back down;
**1.50s** lets them land and fade out where they fall. The fall finishes at
0.55s and the longest-lived note at about 1.50s, so it is the length of the
whole thing rather than a pause bolted on the end of it.

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

**The second line is the joke** — *why* he is standing in Times Square at six in
the evening — and it was set 26px in the same grey the HUD uses for things
nobody has to read. It is 32px in the brand orange now, on the same side of the
screen as the rule above the title. Times Square's reads *"Probably should have
gotten an Uber"*, which is the only correct thought anybody has ever had in
Times Square.

**The red steps** were a symmetric trapezoid that was *wider at the top than the
bottom*, which is perspective backwards — the top of a flight is further away,
so that is the end that should be narrower. They now run to one vanishing point
straight ahead and widen as they come towards you, and each step is drawn as two
faces, the tread you see the top of and the riser below it, instead of one flat
bar. Measured down the flight: 520, 544, 600, 624, 680, 704, 760, 784, 795 px
wide, every row wider than the one above it.

**No lettering on the booth.** The band across the top of the flight used to
read *TKTS*. The red steps already *are* the picture — the shape is the
landmark — and the word was the one thing up there claiming to be a named
business. The band stays and reads as the booth's glazing, which is what it
looks like from the street anyway.

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
contradiction in words. It hangs for **3.75 seconds** — it was 9.5, then 4.75,
and it is the one notice that is *followed* by something, so it can afford to
be shortest. Three lines and an arrow are read in about two seconds, and
everything past that was the player standing still on a pavement waiting to be
allowed to walk. The notice carries a U-turn beside the line: a
stroke down the right, round the bottom and back up the left, finishing in a
head that points **up**. An earlier version spelled the same thing out with a
captioned arrow and a strip reading `W 81 › W 80 › W 79 › W 78 …`, and it was
too much panel for one idea.

**The moment the notice goes, a green arrow blinks four times over the street
saying `PROCEED SOUTH`** — and it points **up**, because that is where his legs
actually go. It is handed straight on from the notice expiring, so there is no
gap between being told to turn round and being shown which way that is, and it
runs *while he walks* rather than while he stands there, which is where an
instruction like that belongs. It blinks rather than fades: a fade is
decoration and gets ignored, four hard blinks is an instruction, and four is
enough to be certain it was deliberate without becoming a thing to wait out.
Measured: notice gone at 3.76s, arrow from 3.76 to 6.94, 4 on-blinks at a 62%
duty.

After that, a small arrow and `STILL WALK UP / the numbers count down` sit
under the blocks counter on the right for the whole walk home.

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

### Four lines, and they are the four the game is about

The tally had eight rows. Spare blazers, champions, the news and lunch are all
real money and they all still go to the readout page and the leaderboard —
every one of them is in `runRecord`, and the stats strip under the total still
counts them — but the end screen is not a report. It is the last thing
somebody sees before deciding whether to play again, and eight rows of mostly
zeroes is a balance sheet.

**GROUND COVERED, CHUCK BUCKS, TE-ADDONS, TAM PAYOUTS.** What he did, and then
the product, ending on the TAM. The total under them is `PIPELINE BUILT`, not
a sum of the column, and it still counts everything — a champion's 300k is in
the number without being in the list. At four rows the fit scale comes back to
**1.0**, so the numbers anybody actually reads are full size again.

### The readout has to fit on the page

The tally is laid out at a fixed pitch downward from `top`, so its height is a
function of how many rows it has — and rows get added. `SPARE BLAZERS` made it
eight, which pushed the total to y 1060 and put the rank, the personal best
and *the line telling you how to start another run* clean off the bottom of a
1080-high canvas.

The strip of non-money stats sits **128 below the rule, not 96**. The total is
set at 76 and *pops* to 1.10 as it lands, so its ink reaches about `ly+97`,
and the strip at `ly+96` was being printed straight through the bottom of the
one number anybody repeats. At 128 there is a measured 36px gap and the tap
line still lands inside `TALLY_BOTTOM`; the fit scale accounts for the extra
32 in `natural`.

Rather than re-tune every number each time a row appears, the whole block is
measured and scaled to the space between `top` and `TALLY_BOTTOM` (1020),
about its own top edge, so every coordinate inside it still holds. Clamped at
1: it shrinks to fit and never grows to fill. The headers above it gave up
70px as well — a 96px headline over a 152px plate left the tally 510–1020 for
a block that needs 718, which scaled it to 0.71 and made the numbers everybody
reads smaller than the line telling them they missed a train. Tightened, the
tally starts at 440 and scales to **0.81**.

### The ticker card

### The payout is the move

Chuck Bucks used to pay a flat **$250,000** whether the card behind it said
0.4% or 9.8%, which made the chart decoration. It is the price of the stock
now, straight. The anchor is **7.5% pays 250,000**, so:

> **250,000 / 7.5 = $33,333 a percentage point**

| move | pays | move | pays | move | pays |
|---|---|---|---|---|---|
| 0.1% | $3,000 | 2.5% | $83,000 | 7.5% | **$250,000** |
| 1.0% | $33,000 | 5.0% | $167,000 | 9.0% | $300,000 |
| 2.0% | $67,000 | 6.0% | $200,000 | 10.0% | $333,000 |

Rounded to the nearest thousand, because a payout reading $166,667 is an
arithmetic result and one reading $167,000 is money.

**One roll feeds both.** The percentage and the money came from two different
places before, which only worked because one of them was a constant;
`chuckRoll()` returns the pair, so the number on the chart and the number in
the pipeline can never disagree. Verified over 20,000 rolls: zero mismatches,
range $3,000 to $333,000.

**It costs about a third of the average payout, and that is worth knowing.**
The roll is uniform on 0.1–10.0, so its middle is about 5.05%, not 7.5%.
Anchoring 250k at 7.5% therefore makes the mean Chuck Bucks **$168,712**
(measured) against the flat 250,000 it was — in exchange for a spread, and for
a card that means something. If the old average wants holding, move the roll
in `chuckRoll()` rather than bending the rate, or the table above stops being
the thing the card is showing.

**And the number is the loudest thing on the card.** The bottom line keeps its
brand-orange "CHUCK BUCKS" label at the old size, and sets the amount large in
the same green every winning number in this game is set in, with four offset
passes under it for a bloom (no `shadowBlur` here). It pops on arrival — 1.42x
on the frame it lands, settling to 1 by 0.55s, then a 4.5% breath so it is
never quite still. The label and the value are measured and centred as one
unit using the value's *scaled* width, or the line slides left as the pop
decays; both sit on the middle baseline, which is what lets two sizes share a
line and still look level.

Collecting Chuck Bucks freezes the walk and shows a mock of the Google Finance
quote card: the Cisco mark, the name, the NASDAQ line, the Following pill, the
range tabs, the chart with its cursor and tooltip.

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

**The card does not stop the game.** It used to: a 72%-opacity scrim over the
whole screen and an early return out of `update`, so the street froze, input
piled up and he came out of it mid-stride. Chuck Bucks is good news, not a
cutscene. The scrim is gone, the early return is gone, and the world keeps
moving under it — verified that `G.t` advances 0.4s over 0.4s of wall clock
with the card up, and the test run took a bus to the face while reading it.

Which means the card has to earn its space instead of taking the screen. It
sits at **y 110** instead of 176 and it is drawn at **0.70** of the size it was
laid out at. The scale is a transform about the card's own top edge rather than
a re-layout, so every measurement inside it — margins, tabs, chart box, tooltip
clamp — still holds exactly as written. 1120×730 from y 176 reached y 906 and
buried him; 0.70 from y 110 ends at **621**, above his head at ~680, so he and
the rows he is about to walk into are never behind it at all.

**It is not transparent.** Letting the street through it was tried at a quarter
and at a tenth, and both read as a rendering fault rather than as a light
touch — a Google Finance card is an opaque object or it is nothing. At 0.70 and
y 110 it is small enough that it does not need the help.

Each pickup **rolls its own move, between 0 and 10 percent**, and the whole
series is scaled to it, so the chart, the axis, the headline and the tooltip
always agree. `CSCO.session` is the shape of the trading day normalised to a
close of 10; `CSCO.tail` is the after-hours in grey.

### Chuck

He pops up out of the bottom-right corner, holds, and drops back out — the
Mortal Kombat *Toasty* beat, which only works if it is fast, in the corner, and
gone before you can look straight at it. It runs over the ticker card, with the
voice line.

**He comes in from the right, and the screen crops him.** He used to rise out
of the floor inside a tidy bordered box floating 84px above the bottom edge.
Checked against the reference frame: Dan Forden slides in from the right, he is
*big* — most of the bottom corner — and the screen edges cut him off. So does
this one, except for the crop: he arrives from off the right edge rather than
from under the floor, 420px wide, and he **sits on the bottom safe line rather
than through it**. Hanging 118px of him below the canvas looked right in a 4:3
pane and wrong on everything else — a screen wider than 16:9 is scaled to fill
the width and the spare height comes off *both* ends, so another thirty-odd
pixels went with it and what was left was the top of his head. The world only
ever uses y = 40–1040 for exactly this reason, and he lives inside it. The
hairline and the shadow stay on the picture's edge because the asset is a
rectangular halftone rather than a cut-out, and a hard rectangle with nothing on
it reads as a bug.

**And no word next to him.** The card behind him already says `CHUCK BUCKS ·
+$250,000 ON THE NUMBER`; a shout over the top of that was the same sentence
twice in two sizes. He is the gag, the card is the caption.

**The timing.** He was up for 1.78 seconds, which is long enough to
turn your head and look at him, and the whole effect is that you cannot. The
slide is 0.18s in and 0.18s out, overshooting by six percent on the way in and
settling back, and leaving faster than he arrived.

**He starts early.** He used to wait until 0.42s, by which point the chart had
drawn itself in and settled and the card looked finished — so he read as a
second thing that happened afterwards. He now starts at **0.16s**, while the
card is still fading up, and is fully in at 0.34. The joke is that he turns up
uninvited, and that only works if he is already there.

That voice line is one of **two recorded sounds in the game**, inlined as
base64 so the file still loads nothing over the network. Everything else is
synthesised. Both are decoded the moment the AudioContext exists rather than on
first use, so the first Chuck Bucks of a session is not silent; every failure
path leaves the buffer null and the call becomes a no-op, like the rest of the
engine.

**The other one is "I'm walkin' here", and it plays when traffic hits him.** He
has been saying it in a speech bubble since the pavement had people on it;
getting clipped by a cab is the one moment it is not a line, it is the
reaction. 40KB of mono-in-stereo at 44.1kHz, 1.33s. It fires on everything in
the road — which is everything that hits him except the crowd, because a man
who walks into a wall of people has nothing to shout about — and it fires
*before* the death check on purpose: going under a bus still shouting it is the
better version of the joke. Verified: cab yes, bus yes, crowd no.

**The first one in a run always lands; after that it is one in four.** A
recorded line you only hear some of the time reads as a bug the first time you
do not hear it, so the opening hit is guaranteed and `G.walkSaid` is what
remembers. Past that, a voice sample on every single hit stops being the
reaction and becomes the hit sound, and the whole value of it is that it is
*him*, not the game. Measured over 40 runs of 40 hits: the first fired every
time, and 10.13 fired per run against the 10.75 the odds predict. It plays at
0.465 against the Chuck Bucks line's 0.54 — it is a shout, and it does not need
to be the loudest thing in the mix to read as one.

Adding it turned up the last two chains in the engine still wiring a gain to
the master and walking away. The sample players were never reaped — the same
leak every oscillator cue was fixed for, just rarer, because a sound you hear a
handful of times a run does not look like a leak until the fifth round. Both go
through one `playSample` now, and it reaps. Measured: 1 live chain while it
plays, 0 after.

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

### The burst has a third line now

`brandHit` takes a **kicker**: a line under the tagline, in the money green
with a solid triangle pointing up. The badge says the name, the tagline says
the proposition, and the kicker says the **outcome** — which is the part a
seller repeats. Traffic Insights carries the first one: *▲ YOU’RE
UNSTOPPABLE*.

Green because every other number in this game that means *you are winning* is
green — the pipeline, the payouts, the money rise — and an arrow up because a
seller reads an arrow up before they read anything else.

**One arrow each side.** The arrows are filled triangles, not typed
characters: an arrow glyph resolves to whatever the panel happens to have and
lands on a different baseline on every device. The whole run — arrow, gap,
words, gap, arrow — is measured and centred **as one unit** rather than
centring the text and hanging the arrows off it, or a short line sits visibly
off-axis from the badge above it.

The tagline moves up 8px when a kicker is present, so the extra line does not
push the stack down onto the row he is reading. Measured, the burst now bottoms
out at **y 662** with a kicker against 639 for the big ones — still clear of
the second row ahead of him at 714, which is the one that matters.

#
## The Desk Pro crash

It started crashing a Desk Pro after a few goes. The obvious suspect was a
leak in the new code — the dash, the ending scenes, the flight audio — so
that is what got measured first, and all of it came back clean:

| what | measured | verdict |
|---|---|---|
| JS heap | 23 runs, 132s of real play | 5.9 → 6.2MB, flat |
| world rows | across those runs | 16–27, pruned |
| audio chains | the whole ending, real time | peak 107, drains to 0 |
| canvas state stack | gameplay + all 9 scenes | save/restore balanced, net 0/frame |
| frame cost | gameplay vs every scene | 1.01ms play, every scene cheaper |
| listeners, rAF, timers | — | registered once, one loop |
| localStorage | per run | fixed-size counters, board capped at 25 |

**There is no JS memory leak.** Which is exactly why it took a while: a Desk
Pro was dying while `performance.memory` sat flat, because the memory that
was killing it is not on the JS heap at all.

**The sprite atlas is 159 separate canvases** — 13.1MB of pixels here, about
18MB at the `BAKE` of 1 a Desk Pro runs at, and, since every sprite is its
own canvas, 159 separate GPU textures.

**And `bakeAll` runs more than once.** It fires whenever the scale moves more
than 2%, and a fullscreen toggle moves it from 0.845 to 1.0 — so every tap of
FULL SCREEN rebuilt all 159. Dropping the reference to a canvas does not free
it: the JS object has to be collected first, and only then does Chromium
release the backing store, with the GPU texture held in Skia's resource cache
until a budget forces it out. On a desktop that budget is large and the churn
is invisible. On a Desk Pro it is small, and the eviction can arrive *after*
the allocation that needed the room, which is a renderer crash rather than a
slow frame.

Measured, holding the references the way the GPU does: **twelve re-bakes
orphaned 1,908 canvases holding 187.9MB**, every one still carrying pixels.
Six fullscreen toggles. That is the crash, and a hallway demo where people
tap FULL SCREEN between runs is precisely its shape.

The fix is one lever, and it is the only one a page has over canvas memory:
setting `width = 0` frees the backing store **immediately and
synchronously**. So `releaseAtlas()` hands the old atlas back *before* the
new one is asked for — which also means peak usage is one atlas plus one
sprite, rather than two entire atlases at once. After: twenty rebuilds, 159
sprites, 13.1MB, pinned, with the heap flat beside it.

**And the sky gradient was being built sixty times a second.** `drawSky`
allocated a fresh `createLinearGradient` every frame — 3,600 a minute, a
quarter of a million an hour on a panel left running in a hallway — where
every other gradient in the file is built once in `layout()` and kept. A
gradient is a GPU object with a shader behind it. It is now cached like the
rest, and nulled in `layout()` with them, because a gradient belongs to the
transform it was built under. 300 frames went from 300 allocations to 0.



## The clock at the top

It used to be a departure off the board at Penn — `LIRR · 5:01 · HUNTINGTON`,
`DEPARTS 0:58` — and the mechanic was right while the fiction was not. Nobody
walks ninety-four blocks uptown to close a deal and then has to be back for the
5:01 to Ronkonkoma. The commute is the wrong deadline for the thing the player
is actually doing, and a joke that needs explaining is not doing any work.

Same clock. Sixty seconds, 1.25 banked back per block, the amber-to-red flash
under twelve, the whole of `FISC_PER_HOP`. What changed is what it counts down
*to*:

```
        Q4 FY27  ·  11:30 PM  ·  THE LAST MILE
              END OF FISCAL   0:30
```

**End of fiscal is the only deadline in this job that behaves exactly like a
train.** It is published a year in advance, it does not care that you are
nearly there, and it leaves at 11:59 whether or not you made it. That is the
same three properties the departure board had, which is why the mechanic
transferred without a line of logic changing.

The board keeps its three fields and its cadence, because a departure board is
still the right *shape* for a deadline you are running at: QUARTER — TIME —
who it is for.

**The fiscal year works itself out**, because a hard-coded one is wrong from
the next July onwards and nobody is coming back to change it — a panel left in
a hallway should still be telling the truth in eighteen months. Cisco's fiscal
year ends on the **last Saturday of July**, not the 31st, so the boundary is
computed rather than assumed: take 31 July and walk back to the nearest
Saturday, which `(getDay() + 1) % 7` gives in one step.

| | FY ends | | FY ends |
|---|---|---|---|
| 2025 | Sat 26 Jul | 2027 | Sat 31 Jul |
| 2026 | Sat 25 Jul | 2028 | Sat 29 Jul |

Past that line you are in next year's FY. Today, October 2026, that is **FY27**
— and it stays FY27 until the last Saturday of July 2027, when it becomes FY28
on its own. Using plain July would have been off by up to three and a half
weeks a year: 10 July 2027 is still FY27, and a month boundary would have
called it FY28. The whole clock is about a date that does not move for you, so
the date it names had better be the real one. Checked across a decade of
boundaries, the year-end day itself (still the old FY until 23:59) and the
two-digit roll at the century.

Q4 stays Q4: the clock counts down to the *end* of fiscal, and that is the
quarter the end of fiscal is in.

**The wall clock moves, because the countdown does.** It sat at a static
11:59 PM next to a number that was visibly draining — two clocks on one line
disagreeing about what time it is. The hour is now the *same* clock as the
number under it, read the other way round: the countdown says how much is
left, the wall clock says what time it is, and midnight is the deadline both
are about.

| left | clock | | left | clock |
|---|---|---|---|---|
| 60s | 11:00 PM | | 10s | 11:50 PM |
| 30s | 11:30 PM | | 0s | 12:00 AM |

A minute of real time is a minute on the wall, which is the one mapping a
player never has to be told. And it lets the top line answer what the
countdown cannot: `0:30` is a quantity, **11:30 PM is a place** — you can see
how near the edge of the year you are standing. Banking time by walking a
block turns the clock *back*, which is exactly what buying yourself minutes
should look like, and the cap at `FISC_MAX` stops it ever reading earlier than
11:00.

**And the face drifts, because a clock yanked backwards is a clock nobody
believes.** Each block banks 1.25s, which read literally is the hour hand
jumping back a minute or two, over and over, while the player is moving well
— the one time they least want the furniture twitching at them. Worse, a
strong run pins `fiscT` against the 60s cap, where it is banked up and drained
down repeatedly, so the clock jitters in place.

So the face chases the timer instead of equalling it. `G.fiscShow` is allowed
to be up to **`FISC_DRIFT` = 5 seconds** out of step while it catches up.
**The timer itself is untouched** — `fiscT` is still what drains, still what
fires `missClose`, still what the big countdown prints. The drift belongs to
the clock face and nothing else reads it.

**Rate-limited, not eased.** The first attempt eased toward the timer, which
is the wrong shape: an exponential ease moves *fastest* at the moment of the
jump, which is exactly the lurch it was meant to hide. Instead the face ticks
with real time on its own, and the gap is closed at a capped rate on top. The
cap is `FISC_REWIND` = 1.0 — precisely the rate the clock runs forwards — and
that one number is the whole rule:

> **The clock ticks forward, or it holds still.** It never runs backwards
> faster than it runs forwards; at 1.0 the correction can at most cancel the
> tick. Bank a block and the hour hand *stops for a moment*. It does not spin
> anti-clockwise.

Measured on a recorded trace of thirty seconds of flat-out walking, replayed
through each candidate:

| | backward steps | worst | face vs timer |
|---|---|---|---|
| before | 26 | 2 min | 0s |
| **shipped** | **15** | 2 min | **4.97s** |
| soft catch-up | 6–20 | 1 min | 21–28s |

**The lurch is not gone, and five seconds is why.** The soft catch-up row
removes the two-minute step — but only by letting the face wander up to half a
minute from the truth, which is no longer a drift allowance, it is a different
clock. Within a 5s budget the honest result is a 42% cut, not a cure: when a
player banks harder than five seconds of slack can absorb, something has to
give, and the backstop giving way is the correct thing to give. In steady play
with nothing banked the face is bit-identical to before — exactly 1.000s per
minute, zero backward steps, verified.

The allowance closes as the hour does: `min(FISC_DRIFT, fiscT)` leaves five
seconds of slack at the top of the run, one second with one second left, and
none at midnight — so the two always land on 12:00 AM together, which is the
one moment the player is really reading both.

**The third field went through three answers.** NYC COMMERCIAL was the first,
and it was not *cliché* — quarter, close time and segment is how a forecast
call is actually labelled, which reads as credible rather than cringe. The
problem was narrower than that: it was the only line in the game that assigned
the player an identity they might not have. Everything else is careful to be
universal — Midtown is a *place*, the objections coming out of those vehicles
are *every* seller's, the tally is *your* pipeline — and then one line told
most of a GSX hallway that this quarter belonged to somebody else. It is
THE LAST MILE now, which is nobody's territory and everybody's. The timer
line is capped at 460 like the line above it, which `DEPARTS 0:58` never needed
and `END OF FISCAL 0:58` does — it is half again as long and ran off both ends
of the 500px plate.

Running out of it used to be **MISSED YOUR TRAIN** over `LIRR · HUNTINGTON ·
THE 5:01`. It is now:

> **THE QUARTER CLOSED**
> Q4 FY27 · THE LAST MILE · 12:00 AM
> *You stood on the corner too long.*
> **REMEMBER** — The quarter closes whether or not you are ready.

It keeps its amber, which is what separates running out of time from being hit
by something. The leaderboard cause goes `MISSED TRAIN` → `MISSED CLOSE`.

The names went with it rather than being left as a layer of archaeology:
`TRAINS` → three constants, `trainT` → `fiscT`, `TRAIN_MAX`/`TRAIN_PER_HOP` →
`FISC_MAX`/`FISC_PER_HOP`, `missTrain` → `missClose`, `missedTrain` →
`missedClose`, including the one in the Cloud Insights comment that explains
where the banked time comes from. **The subway keeps every one of its train
names** — `TRAIN_ROB`, `TRAIN_CHAT`, `TRAIN APPROACHING` — because that one is
a real train you really ride.


## Central Park, and what a cutscene actually costs

The Desk Pro died going into the Central Park scene, then started freezing
after a few minutes generally — *"might be a common issue when it goes to
level cutscenes."* It was, and the park was the worst of them by a mile.

Counting draw calls rather than milliseconds, because on an embedded GPU the
call count is what hurts:

| scene | draw calls/frame |
|---|---|
| 81 Steak dinner | 13 |
| 50 Rockefeller | 387 |
| 42 Times Square | 478 |
| **59 Central Park** | **1,514** |

Almost none of it was moving.

**The skyline never changes.** Twenty towers and about a thousand windows,
and the lit/unlit test is `(wx*7 + wy*13 + k*5) % 17 < 6` — no `t` in it
anywhere. The same thousand rectangles, recomputed sixty times a second, to
produce the same picture. It is one `drawImage` now.

**The trees only sway.** Four ellipses and a trunk each, forty-five of them,
and the whole animation is `sin(t*0.7 + i + rk) * 3` — a three-pixel
horizontal nudge. One tree per rank is baked and blitted at a swaying x, which
is pixel-identical and turns 180 ellipse fills into 45 blits. The pond
reflection and the ducks stay live, because those genuinely move.

Central Park: **1,514 → 487 calls**, from twice Times Square to level with it.

**And a cutscene draws the world as well.** The frozen world — verified
frozen: zero of nineteen cars moved across sixty frames — is redrawn in full
underneath the card, every frame, for the eight to eleven seconds the scene is
up. That is why *every* scene costs about 3× a gameplay frame (528 calls →
785–1,033), and why the complaint was about cutscenes in general rather than
one of them. Caching the frozen world would remove it, and is deliberately
**not** done here: the cache is a full-screen canvas, ~18MB at the Desk Pro's
scale, on the machine whose crash was *caused* by canvas memory. Halving the
worst scene was the fix that does not trade one crash for another.

On the alpha: the bake draws windows at 0.55/0.07 over an opaque tower and is
blitted at the scene's `a`, where the original drew the tower at `a` and each
window at `a*0.55`. Identical at a=1, which is where the scene sits for all
but the 0.3s of fade at each end. Lazily built and cached in `S`, so
`releaseAtlas()` frees them with everything else on a re-bake.

## The shake does not come with him

Take a bus on the last row of a block and the landmark card that followed
arrived shuddering. `G.shake` is applied to the **root transform** at the top
of `render()`, before anything is drawn, so everything after it inherits the
wobble — the cutscene included. It read as the panel struggling rather than
as the hit it came from.

Cleared in `startScene`/`startEndScene` rather than only guarded in `render`,
because the world stops simulating behind a scene and `G.shake` decays in
`update()`: a guard on its own would have held the shake at full strength for
the whole scene and handed it back the moment the card lifted. The guard is
there too, as the backstop. Verified: 21.3px of shake in gameplay, exactly 0
during a cutscene.




## An evening, not an hour

The clock ran 11:00 PM to midnight: one timer-second to one minute, tidy
arithmetic and a bad story. Everything in a run happens inside it —
ninety-four blocks, a subway, a steak dinner and a signed order — and sixty
minutes to do all of that is not a tight deadline, it is an impossible one.
The player is not racing an hour. They are racing the end of a working day.

The same sixty seconds now cover **5:00 PM to midnight**: 420 minutes over 60
seconds, which is **exactly 7 minutes per timer-second** and divides without a
remainder, so the last second lands on midnight on the nose.

| left | clock | | left | clock |
|---|---|---|---|---|
| 60s | 5:00 PM | | 15s | 10:15 PM |
| 45s | 6:45 PM | | 5s | 11:25 PM |
| 30s | 8:30 PM | | 0s | 12:00 AM |

**But it counts; it does not jump.** Seven minutes a second taken literally is
5:00 to 5:07 to 5:14, which is a departure board flipping, not a clock
running. So the displayed time is its own value in minutes and chases the
timer **one minute at a time** — every minute between here and there actually
shown, just quickly, the way an odometer rolls. Verified: every step is
exactly 1 minute, no step is ever 7, and across six seconds of play there were
41 of them.

**And the lag is the buffer.** The chase only ever moves forward, so when a
block banks time and the target slides back toward the afternoon, the counter
simply stops and waits for the evening to catch up. Measured over 25 seconds
of hard walking: **zero backward steps**, and the clock held still at 6:45 PM
for 1,456 frames while the timer was banked to its cap and drained back, then
resumed 7:00, 7:21.

That pause replaced the whole `FISC_DRIFT` mechanism, which is a better
outcome than the alternative. Carried across literally, five minutes of slack
became **worse than no slack at all** — measured, 6 backward steps with a worst
case of 14 minutes, against 7 steps of 7 minutes with no drift at all. Every
budget that is not a whole multiple of the tick doubles the worst lurch,
because the backstop lets go halfway through a tick and the rounding turns one
step into two. A forward-only counter has no budget to run out of, never
snaps, and never lies by more than it is actually behind.

**One trap worth recording.** Three of these constants are derived from
`FISC_MAX`, which was declared 2,400 lines further down. `var` hoists the
declaration and never the value, so they computed off `undefined` and became
`NaN` — and the syntax check passed, because `NaN` is perfectly legal. They all
live together now, above everything that reads them.

## The card waits for him to land

Both cutscene triggers called `startScene` on the frame the street changed —
the same frame he steps onto the pavement — so the card came up over a man
still mid-stride, and on crossings where he arrived with traffic behind him it
looked like he had been caught by it. There is now half a second between the
two. Verified: 30 frames exactly, and he is standing on `safe` for all of them.

**And a scene has a sell-by.** Scenes fire for every street *passed*, not just
the one landed on, because a subway ride covers seven to fifteen crossings at
once. Correct, but it meant riding 38th to 55th surfaced you at Columbus
Circle and then played TIMES SQUARE at you, thirteen blocks after you went
past it. More than `SCENE_LATE` = 10 blocks and the moment has gone: marked
seen, skipped. The nice part is what happens next — that same ride now plays
**Rockefeller** instead, which is only five blocks back and still true.

Except the two that are not scenery. The steak dinner is where the order gets
signed and Penn 1 is the whole ending; both carry `must` and play however late
you are to them. Verified at 14, 18 and 24 blocks past.

The pending scene is **held, not cancelled**, if he is mid-ride or behind
another card when the half second runs out — a mandatory scene eaten by a train
he boarded on the same frame would cost him the order. Only death clears it.

## The terminal blinks out

A spent TE-ADDON used to stand there for the rest of the run at 40% alpha:
visibly finished, still solid, still taking one of the few columns on that
pavement. A faded box you cannot walk through is the worst of both — it reads
as scenery and behaves as a wall.

It now leaves **exactly the way the TAM flight does**. The game already has a
word for *this is about to be over*: the hard on/off blink on the hero when
the flight is lapsing, quickening as it runs down. Same two constants, 9
rising to 26, so anyone who has seen the flight or the suit expire already
knows what it means. Not a fade — a fade is a thing settling, a blink is a
thing switching off, and all three of these are powers running out.

Two seconds, then the prop goes **and so does its entry in `row.blocked`** —
which is the half that actually mattered, because that map is what stops a
step and nothing had ever taken anything back out of it since generation.
Verified: gone at 2.00s, blocked false, blocked while visible, walkable after.



## The board, and the report behind it

**The board answers one question** — who is top and what it cost them — so it
is down to six columns: `#`, `WHO`, `PIPELINE`, `POWER-UPS`, `TIME`, `WHEN`,
`RESULT`. Blocks and steps came off it. They are the detail of *how* a number
was got, which is a reading question rather than a glancing one, and both are
still on every row of the report.

`TIME` is how long the walk took and `WHEN` is when it was set. Two different
questions that both get called "time", so they get two words and sit next to
each other where the difference is obvious. `WHEN` renders in the reader's own
local clock, because a board shared between panels carries rows from other
machines and that is the only honest way to show somebody else's timestamp.

**The report is the list.** Built the way `report.html` is — the table first,
at full width and full detail, and the breakdowns underneath — because the
thing people actually want off a leaderboard is to find their own row and read
across it. Twelve columns, fifty rows: blocks, steps, rides, TAM wins,
add-ons, champions, time, when, outcome. Then **totals**, **per run on
average**, **what stops people** and **power-ups collected**, the last two as
bar charts in the colours the things themselves use.

`BOARD_MAX` went 25 → 50, so fifty is what is kept and what is asked for.

**It is one tall page that scrolls**, not a set of panels. Fifty rows and four
summaries do not fit on a screen, and paging through them means remembering
what was on the last page. A finger drags it one-to-one, a flick carries on
and slows down with the same rule as the initials wheel, and the wheel works
for anyone on a desk. The header and the CLOSE button do not scroll, so the
way out is never somewhere off the top.

Every gesture that starts on the report is **consumed** by it. A drag scrolls;
a flick spins; a tap either closes, if it landed on CLOSE, or does nothing at
all. Nothing falls through to `act()`, because on this screen `act()` starts a
new run — and losing your own numbers by touching the screen while reading
them is the one thing this page must not do.

**The page measures itself.** Hand-summing the section heights got it wrong by
five hundred pixels, which showed up as a screenful of nothing under the last
chart. `drawReport` now records where its own content ended and the scroll
limit uses that, so the two cannot drift apart when a section changes.

One number on it is deliberately **not** an average: the device never stored a
running total of score, only the best, and averaging the top fifty on the
board would be the average of the *winners* dressed up as the average of
everyone. It says "best pipeline" and means it.

## Five-minute steps

Seven hours in sixty seconds is seven minutes of wall clock a second however
it is sliced, and a digit turning over seven times a second is not a clock,
it is a counter having a fit. The face shows **every fifth minute**, which
drops it to one change every 0.70s — slow enough to read a time off, fast
enough that the evening is visibly going.

The quantising is in the *display* and nowhere else. `fiscMin` is still
continuous and still chases the timer one minute at a time, so the hold when a
block banks time is exactly as smooth as it was; the face just does not show
every step of it. 1020 and 1440 are both multiples of five, so the first time
shown is 5:00 PM on the nose and the last before midnight is 11:55 PM.

Measured: every step 5 minutes, one change every 0.70–0.72s, **zero** backward
changes, and 1,199 frames held still across twenty seconds of hard banking.



## The present opens

The pack is **two sprites: shut, and burst open.**

Shut is what stands on the pavement, and it is the original box — lid proud,
ribbon round it, bow on top — because an unopened present is the whole of the
idea. Nothing about it moves except the float and the light leaving the top
of the lid.

Open is what it becomes the moment somebody takes it, and it exists only for
the two seconds the pack is leaving. The lid has gone and the sides have burst
into **two flaps thrown up and out**, which is the shape that makes the route
pouring out of the middle make sense: the path was in the box, the box is
open, there is the path. Each flap is a short staircase of boxes — an
axis-aligned world has no diagonals, and three steps climbing away from the
hinge is how it gets one — with the ribbon carrying on over them so they are
plainly the lid that was tied shut a moment ago.

Two seconds in two halves. **The first is the present being opened**: full
strength, no blink, because the one moment the player is looking straight at
it is the moment they just earned. **The second is it leaving**, on a steady
blink that simply stops.

That blink started as the TAM flight's — 9 rising to 26, quickening as it runs
down — and was simplified to an even 2.4Hz. The quickening carries information
in the flight, where it is counting down to something you can still act on.
Nothing here can be acted on, so the extra was noise, and a steady rate is
calmer to sit next to on a panel that runs all day.

**And the route starts a square above it.** Anchored on the box's own square
the path's first node sits *under* the box, hiding the one end that needed to
be seen; one row further on it starts clear of the lid and runs away up the
street. `buildTrace` takes an origin now and defaults to the player, which is
right for Path Visualization — that one is a thing he switches on from where
he stands. The TE-ADDON is not.

**And the pack sits on its own route.** The trace is drawn at
`c*TILE + TILE*0.5` with no shear at all — it is a line on the floor, and the
floor is not sheared. Everything with HEIGHT is: cabinet projection pushes a
model right by `SKEW` per unit of depth, so a box half a tile deep ends up
about fourteen pixels right of the column its own route runs down. Close
enough to look like a mistake rather than a projection, which is exactly what
it looked like. `kioskDX` shifts it back onto the line — measured off the
sprite, because the open one and the shut one have different bounds and both
have to land on the same column. It works out at **−13.5px**, which is
`SKEW/2` exactly.

**The beam is centred properly too.** `cx` is the middle of the *square*, and
in cabinet projection that is not the middle of the thing standing on it:
everything is sheared right by `SKEW` per unit of depth, so a box half a tile
deep sits half a SKEW right of its own column. The beam and the eye were both
drawn at `cx` and both hung visibly off the left. They come off the baked
sprite now — where it is drawn and how wide it is — so it is right by
construction: 74px from the column start, not 60.

## A candy bar, from a stranger

One in four of the people who notice he is struggling **does something about
it** instead of commenting on it. The other three are the joke — a pavement
full of New Yorkers telling a man he looks terrible — and the fourth is what
makes the joke bearable, because a city that only ever says *"you don't look
good"* is a city nobody wants to walk ninety blocks through.

It is the only thing in the game that gives health away. Food costs money at a
cart; this costs nothing, from somebody who had no reason to, which is worth
more than the ten per cent. It is **not** taken off the pipeline — every other
mouthful is paid for, and charging him three dollars for a gift would be the
wrong joke.

**One each.** `gaveCandy` is set on the person, not the player: without it,
bumping the same pedestrian repeatedly is an unlimited health supply and the
hunger mechanic goes away. Verified — 24.8% offer rate against a 25% target,
0 further offers from anyone who has already given one, 0 at full health, and
the hooded man never offers at all.

**The hand-over is the point.** A number appearing over his head is a stat
changing; a chocolate bar crossing the pavement from somebody else's hand to
his is a person doing something for him, which is the only reason this exists.
So the bar is thrown — eased and lobbed, because a straight line between two
hands is a cursor moving and an arc is something thrown — tumbling once on the
way, with crumbs trailing it. **The health does not land until the bar does.**
The giver's row is kept rather than a screen position, because the camera is
still easing while it is in the air.

The carriage hands it over without the throw: the two of them are already
standing on top of each other in a five-foot car, and an arc across that gap
would be a lob from one shoulder to the other.

**One bug worth recording.** The first version ran the cart's eating animation
with `yumKind = "candy"`, and `foodGlyph` ends in a bare `else` that draws a
bagel — so a bagel appeared out of nowhere after every candy bar. The real
error was upstream of the glyph: that animation is a *transaction*, a five
going across and the vendor handing food back, and there is no vendor here and
nothing was paid. It is gone. The throw already showed the hand-over and the
bar over his head shows what it was worth.

## An hourglass, not a crate

Internet Insights fell through to the generic power-up model: a box with an
`I` printed on it. The one power-up that is **about time** looked like
packaging, next to a Cloud Insights that is a storm cloud with lightning
coming out of it.

It is an hourglass now, and **the silhouette is the whole job**. The first
attempt framed it properly — four corner posts, wide plates top and bottom —
and read as *a crate with something orange inside it*, because a box drawn
around a shape is a box and the eye takes the outline every time. The frame
came down to two thin uprights and two narrow caps, and the sand does the
work: five steps down to a waist and five back out, tapering in **depth as
well as width** so it is a pair of cones rather than a pair of wedges.

It is caught **mid-flow** on purpose. A full top bulb is an hourglass nobody
has started and an empty one is a deal already lost; sand in both halves with
a lit thread between them is the only state that says the clock is running,
which is what the power-up does. The thread is `E()` rather than `P()` —
emissive, so it glows like the trace and the beams — and it is the brightest
thing on the model, dead centre, where the eye goes first.

## One row of controls, and a volume that is a volume

**FULL SCREEN is smaller** (padding 11/16 to 8/13, font clamp 14–24 down to
12–20) and the sound control now sits **beside it**.

That meant moving it off the canvas. It was drawn in the top-right corner and
hit-tested against canvas coordinates; the full-screen button is a DOM element
in the bottom-right, and aligning one to the other across every viewport the
panel can be is a losing game. They are **siblings in one flex row** now, so
the row lays itself out — which matters because the volume label changes width
as it cycles, and anything hand-placed would have to be re-placed every time
it did.

It is also **always on screen**. The canvas control only existed on the title,
the readout and the board, which meant the one moment somebody actually wants
to turn a hallway panel down — while it is making noise — was the one moment
they could not.

**And it is three states, not two.** A hallway panel is sometimes next to a
meeting and sometimes next to nobody, and the honest answer to that is not a
switch:

| | gain | |
|---|---|---|
| **SOUND** | 0.32 | a demo you are standing at |
| **LOW** | 0.128 | one running behind a conversation |
| **MUTED** | 0 | a room that is working |

The icon is a **speaker with three bars** coming out of it, and the lit ones
**are** the level — so it says both what the control is and which state it is
in. All of it is drawn from elements and CSS borders rather than a glyph,
because a speaker character resolves to whatever the panel happens to have;
the cone is a border triangle with its tall edge at the right and its point at
the left, flaring away from the box.

**There is no word on it.** The label was the widest part of the button, and
dropping it lets the icon be big enough to read at arm's length, which is the
distance a hallway panel is used from. The accessible name is kept current in
`volSync` for anything that cannot see the bars.
Stored as an index rather than a boolean, so the steps can move later without
the saved value meaning something different afterwards, and it migrates the
old `lastmile.mute` key: anybody who had it muted stays muted.

Verified: SOUND and LOW both produce 49 nodes from the same cue, MUTED
produces **none at all** — muting does not just turn the gain down, it stops
the graph being built, which is a small win on the device as well.

`M` cycles rather than toggling, so the key and the button agree about what
the control is.

## The pavement teaches

Overheard fragments that sound like two New Yorkers talking and are, every one
of them, the thing a player most needs to be told. Nothing is phrased as
instruction — a tutorial on a hallway panel is a tutorial nobody reads — and a
man saying his jacket is tailored armour is just a man pleased with his
jacket. He is also telling you the Endpoint Agent eats a hit.

| the line | what it actually teaches |
|---|---|
| *"Can you literally walk through Traffic with Insights?"* | Traffic Insights makes stopped traffic harmless |
| *"I just found money on the subway!"* | Chuck Bucks are on the train too |
| *"It isn't just a jacket; it's my tailored armor."* | the Endpoint Agent absorbs one hit |
| *"Tap into your future; swipe to change your path."* | tap to step, swipe to change lane |
| *"Skipped lunch again. I can feel it in my legs."* | not eating is what actually kills you |
| *"Standing still is the only thing that's ever made me late."* | only forward progress buys the clock back |
| *"Three cards in my wallet. I never wait on a train."* | metrocards stack — three is three rides |

The last three are the three biggest mechanics the first four left uncovered:
the health drain, `FISC_PER_HOP`, and the fact that cards accumulate.

**They live in their own pool**, not folded in with `FOLK_CHAT`, so the ratio
is one number (`FOLK_TIP_ODDS`) instead of an accident of list lengths — seven
tips dropped into ten pleasantries would have made four lines in ten a lesson,
which is a tutorial wearing a coat.

**Either half of the exchange can be the useful one, but never both.** Tips
started as openers only, which halved how often they were heard for no reason
beyond the order the two lines happen to be written in — a thing said back to
you across a pavement is as overheard as a thing said to you. So the opener
rolls, and if it came up ordinary the reply gets the same roll. Exactly one
tip per exchange at most: two people swapping advice is a pamphlet, not a
conversation.

`folkTip()` never returns the same line twice running — with seven of them a
repeat is a one-in-seven coincidence that reads as the game being broken.
Measured over 4,000 draws: all seven appear, 13.5–14.9% each, **zero**
back-to-back repeats. In real play they are 6.7% of all pedestrian speech —
about two every couple of minutes, four to six across a run, so most of the
seven are heard once and none of them twice. The widest bubble is 535px
against a 1920 screen.

## "Wanna split it?"

He spends the whole block working out how to be near your things. The one
time the money lands in *your* hand instead of his, he asks for half of it —
cheerfully, as though that were a normal thing to ask a stranger on Eighth
Avenue.

It is the hurt lines running the other way round. There he offers help nobody
wants; here he wants a cut nobody offered. And it is the same man in both
places, so it fires on the pavement and in the carriage:

- **On the pavement**, `hoodNear(G.row, HOOD_REACH)` — five rows either side,
  and there is only ever one of him, so the first found is the one. The bubble
  waits out the ticker card on its own: the world is frozen behind it and
  `G.t` does not move while it is up, so the line is still fresh when the card
  lifts.
- **In the carriage**, within `HOOD_SPLIT_SLOTS` = 3 of the hero. That is most
  of a five-slot car but not the far end — a man the whole length of the
  carriage away shouting about splitting it is a different character.
  Verified: same slot and two slots away both speak; four slots away stays
  quiet.

He does not have to have noticed the money first. Beating him to something he
had not spotted yet is funnier than beating him to something he was already
walking at, and either way he is standing right there watching it go into
your pocket. Nothing in the game ever acts on it — he is still the
nine-in-ten man doing nothing — which is exactly why it lands.

Guarded against stomping a line he has just started: under 1.2s and he
finishes what he was saying, because a bubble that replaces itself after a
third of a second reads as a glitch rather than as a man talking.

## The stopped sanitation truck

Reported: *"I had Traffic Insights and I was walking in traffic, all was good
until I hit a non moving NYC sanitation truck, then it killed me."*

Exactly two vehicles in the game carry `stops:true` — the SELECT BUS and the
DSNY truck — and they run a cycle of 3.6 seconds rolling, 1.6 stationary. The
whole Traffic Insights block is guarded by `!car.stopped`, for a perfectly
good reason: a vehicle that is already stopped cannot brake and cannot steer,
so there is nothing for it to do.

But `sw` then stays at 0, and `sw` was the **only** thing the collision test
would accept as *that one has gone round him*. So a sanitation truck sitting
across the lane on its stop phase remained a full 2.4-tile lethal collider in
the middle of a power-up whose own tagline is "You're unstoppable".

The lane that had **braked** for him had the same hole from the other end:
those drivers saw him, `row.halt` is up, the cars are motionless — and every
one of them was still lethal.

The route tracer has always known better. It scores a lane with
`(c.stopped || row.halt > 0) ? 0 : speed`, so the path it draws treats both as
stationary obstacles rather than as traffic. The pathfinder and the collision
disagreed, and the collision had the last word.

So, while the SKU is up: **a vehicle that is not moving is not a threat.**
That is the fiction working as written, and it costs nothing, because a
vehicle that is moving still hits exactly as hard as it did. The wrong-way
bike is in too — it is held still by the same `row.halt`, and leaving it out
would have reproduced the bug in the vehicle most likely to be sitting on top
of him when the lane stopped.

Verified both ways: a stopped DSNY truck pinned on top of him kills without
the SKU (`"We spent it all on the refresh."`) and does not kill with it. The
double-parked box truck is unaffected — it is a blocker he is routed around
and cannot step onto in the first place.

## Power-ups

Four common ThousandEyes capabilities — Endpoint Agent (absorbs one hit),
Internet Insights (drops the world into slow motion), Path Visualization (lights
up safe crossings), Cloud Insights (orange high-tops, and he runs) — plus one
rare tier:

> **Chuck Bucks, third raise.** The pavement share of the weighted pool has
> gone 18.97% → 20.87% → **21.81%**, and a ride carrying cash 55% → 60.5% →
> **69.6%**. The pavement number is *solved*, never multiplied: raising a
> weight raises the denominator too, so +15% of the RATE needs the weight at
> 34.81, not 29.21 × 1.15. The train roll has no denominator to fight — a
> ride either has a roll on it or it does not — so that one is a straight
> multiply. Measured over 1,810 generated pickups: 21.85% against a 21.81%
> target.
>
> **And people leave it alone for longer.** `FOLK_GREED_AFTER` goes 5.0 → 6.5
> seconds, thirty per cent more hesitation before a pedestrian decides the
> roll is worth walking over for. With the money landing half again as often
> as it did two changes ago the window matters more than it used to: the same
> hesitation on more rolls is a race you lose more often, and the point of the
> clock is that you can win it if you move. The hooded man is untouched — he
> still needs `HOOD_GREED_AFTER` 4 seconds of chasing first, and on the train
> he still wants it immediately.

> **Testing a power-up:** `?pw=<kind>` plants that one on the first pavement
> of the run, two rows straight ahead of where he starts, every time —
> `?pw=sponsor` for Cloud Insights, and `tam`, `agent`, `insight`, `traffic`,
> `path`, `metro`, `chuck` for the rest.
>
> The drop is guarded by `POWERS[DROP_PW]`, so an unknown name is not an
> error — `?pw=off`, `?pw=none` and `?pw=anythingelse` all just plant
> nothing. That is deliberate: there is no list of valid kinds to keep in
> step with the pool.
>
> `DROP_PW_DEFAULT` is `null`, so nothing is planted unless somebody types
> it. It has been `"sponsor"` twice while Cloud Insights was being tuned,
> and `"pill"` once — a red-and-white capsule that jumped straight to Penn 1
> and played the whole ending, built so the three closing scenes could be
> looked at without walking ninety-four blocks for them each time. It is
> back to `null` every time, which is the state it ships in.
>
> **The pill is gone now**, all five pieces of it: the `POWERS` entry, the
> model, the bake line, the branch in `collect()` and the default. It was
> never in `POWER_WEIGHTS`, so it could never be rolled — but a scaffold
> left standing is a scaffold that ships, and a test build that walks into
> the credits is a bad one to hand somebody.

**The cloud is struck.** The pickup's bolt flashes: twice about every 1.7
seconds, 50ms each, and nothing in between — a 6% duty cycle, measured. A bolt
that strobes steadily is a warning light and a bolt lit half the time is just
a yellow bolt; lightning is mostly not happening.

The model is axis-aligned boxes baked to a canvas, so there is nothing to
animate in place. It bakes **twice** instead — `powerModel(kind, lit)` — once
with the bolt in its ordinary amber and once blown out to near-white, and the
draw swaps sprites. A second one-tile bake is cheaper than any amount of
per-frame geometry on a Board. Verified at the pixel level: 171 amber bolt
pixels become white, 104 more pixels cross the bright threshold, and the
width, height and both offsets are identical between the two, so the swap
cannot jitter the sprite.

Struck, the bolt also picks up the emissive top edge (the `p.emit` branch in
`part()`). All three segments are under 0.12 wide, so they get no rim at all
in the ordinary state — which is what makes the lit one read as a flash rather
than as a recolour.

The phase is offset by column, like the bob on the same sprite, so two clouds
in view never flash together. Weather is not synchronised, and two objects
blinking in lockstep read as one screen effect rather than as two things.

**Cloud Insights** was Executive Sponsor, which handed him a car service and
jumped him three rows. A power-up whose entire expression is the player being
somewhere else a frame later: nothing to look at, nothing to play, and the one
SKU in the pool with no product behind it. It is three seconds of **three blocks a
jump**: one forward tap clears two rows and lands on the third, at the
ordinary step rate. Three rows in a third of the time would be nine times the
ground, which is not a power-up, it is a cutscene — the leap is where the
speed comes from and the clock stays where it is, which is a true 3× and
three times the clock banked off `FISC_PER_HOP`.

**He goes through things.** Flying carries him *over* scaffolding, parked
trucks and the people on the pavement; the suit takes him *through* them — he
is moving too fast to stop and that is the joke. Solid props, double-parked
trucks and pedestrians all stop refusing the step, and the leap stops only at
the edge of the generated world. It used to stop at the first prop as well,
which was right while he still walked into things, but a leap that refuses a
row his own walk would have taken reads as a bug.

**And he can still be hit from the side.** Neither the suit nor the leap
touches the traffic. The lanes run across the street and he is hit from them
exactly like anybody else, which is the only thing that can still end the run
while the three seconds are up — a power-up that made him untouchable would
make them a loading screen. The leap does not test for traffic either:
sailing over two lanes is the point, and he is as vulnerable as anybody else
on the row he lands in. Verified both halves: a step into a blocked square is
refused on foot and goes three rows in the suit, and a cab on his column in
the suit still takes him from 100 to 25. A span of more than one
row gets real air under it on a half sine, because a three-row jump at walk
height is a man sliding, which is the one thing it must not look like.
Measured: every accepted forward tap in the suit moves him exactly 3. It multiplies with the worn-out drag rather than
overriding it: a man on his last point of health in running shoes is quick
*for a man who is about to fall over*. Tagline on the burst, in the same
treatment as every other SKU: *Accelerating your journey in the Cloud.*

**Three seconds on the clock, 3.5 in the hand.** Ten was double the TAM's
flight, which is the wrong way round for a common pickup against the headline
SKU — and at three rows a step it was long enough to cross most of a leg, so
the back half was spent running out of generated world rather than using it.
Three sits under the flight's five, which is the order these two belong in.
It refreshes rather than stacks (`Math.max`), so a second cloud resets the
clock and never goes above it.

The power actually runs **3.5 seconds** (`POWERS.sponsor.secs`) against a
**three second dial** (`DASH_SHOW`). The extra half second is spent at the top
with the ring full and the number reading 3.0: the strobe, the lightning and
the first stride all land inside it, and the counting does not start until he
is moving. Starting the clock on the pickup frame meant the first thing the
countdown did was run while the screen was still white and nobody was looking
at it. The player gets a free half second and the dial never lies, because it
is not counting yet. Measured: grace exactly **0.500s**, beats at 0.5s, 1.5s
and 2.5s, warn window exactly **1.00s**, zero at **3.5s**.

**All four directions leap.** The stride is the stride whichever way he is
pointing, and having the suit only work up the screen made a sideways tap feel
like the power had switched itself off. Left and right go three columns
exactly as forward goes three rows — and sideways is the move that gets him
out from under a bus, which is where three squares of reach is worth most. It
stops at the edge of the *street* rather than the edge of the generated world,
since there is no column 16 to land in: measured, a leap from column 14 clamps
to 15 and one from column 1 clamps to 0.

**Backwards was the one left out, and it made the suit look broken.** Forward
and sideways leap three and arm `LEAP_GRACE`, which is what keeps him from
being hit while still in the air over a lane — and it is also what arms the
vault, the rule that bumps him a row clear instead of killing him when he
comes down on a vehicle. Backwards did neither, so retreating in the suit was
the one move that put him on a single square at walk speed with no grace and
no vault, stepping back into lanes he had just leapt across. He was hit
getting out of exactly the traffic the power-up had carried him through. It
now leaps and arms the grace like the rest, clamped to the same floor the
ordinary step obeys (six rows below `maxRow`, never below row 0) — measured at
both limits.

**And the vault goes the way he was already going.** It always pushed forward,
which was right while only forward leapt. A man who leapt three rows backwards
out of traffic and was then shoved forward had been put straight back into the
lane he was retreating from — a second bug wearing the first one's coat.
`G.leapDir` carries the direction; sideways vaults forward, since a sideways
leap has no row of its own to continue into and forward is where progress is.
If the row that way is missing or past the retreat limit it falls back to the
other direction, because being carried the wrong way still beats being killed
by the power-up.

### A sideways leap arrives at things

Running three columns past a hot dog cart because you were moving quickly is
not a rule anybody would defend. The leap used to be applied *after* the
interaction checks in `act()`, and those checks only ever look at the one
square named in `nc` — so a leap sailed clean over a cart two columns away,
which was never the square being tested.

It is resolved up front now, walking the squares in travel order and doing two
different things with what it finds.

**Pickups are taken in passing.** `collect()` takes an optional column, so a
power-up two squares into the leap is swept up and he still completes the full
three. Running over a TAM and missing it because you were quick is the same
unarguable bug in a different coat.

**Anything he would have stopped for stops him.** The leap ends on that square
and the ordinary interaction runs exactly as a walk would — he eats, reads,
attaches, swipes in. `interactAt()` defines the list: food he has not
finished, a terminal he has not used, a paper he has not read, a staircase.
Scaffolding, parked trucks and bins are *not* on it, because being stopped
dead by a skip is the thing the suit exists not to do.

**Forward still goes through everything.** The asymmetry is deliberate:
sideways is the move you make to go and *get* something, forward is progress.
Measured — a forward leap through a pizza cart covers three rows and eats
nothing; a sideways leap at the same cart two columns away eats it for +15
health and leaves him where he stood, which is bit for bit what walking into
it does.

The air under him and the mid-air grace are owed to the longer axis now
(`leapSpan()`), not to the row span. A three column dive with no arc is a man
skidding sideways along the pavement, which looked precisely as odd as it
sounds.

`DASH_WARN` came down to **1.0s** with it. 1.4 was 14% of ten and would have
been 47% of three — half the power-up spent blinking, which turns the warning
into the experience. At 1.0 it is the last third, close to the 28% the flight
runs at.

### Three seconds has to be performed

A three second power-up is over before an onlooker has worked out that it
began. The HUD chip that carries every other SKU is 40px across in the bottom
corner and was never going to hold this one, so the duration is staged
(`drawDashHud`). Three pieces:

**A strobe on pickup.** 0.42s, two hits rather than one fade — a single ramp
down reads as a transition between screens, two read as something striking
him. A rising sweep with a crack and a low roll under it.

There were three forks of lightning struck across the screen here as well,
built once per pickup and flickered rather than faded. They came out: at three
strobes a run, over a street he is about to step into, they were more screen
than the moment needed, and the wash already carries it. The thunder under the
crack was put there for them and has been left — without the bolts it simply
reads as a deeper pickup. Worth knowing if anyone wonders why the sound has a
roll in it.

**A ring of thrust under his feet, draining as it burns.** Three goes at this.
First a 92px ring parked at y 268 up in the sky band: safely clear of the
lanes, and completely detached from the man it was counting for. Then a badge
on his shoulder — his, certainly, but it overlapped him at any offset small
enough to still read as his. Measured against the sprite's opaque pixels
rather than its bounding box, clearing him needed the badge 100px off centre,
by which point it was a thing floating near him rather than a thing he had.

So: the fuel gauge and the reason he is moving are now **the same object**. He
stands on it. Nothing has to be explained and nothing is laid over anything.

It is an **ellipse**, not a circle — everything else on the ground plane here
(the shadow, the shield ring, the flight ring) is drawn at roughly 0.42
vertical squash to sit in the cabinet projection, and a true circle under his
feet stands up like a hoop he is holding. It is glued to his feet with the
lift included, so it goes up with him through a three-square leap: a pad he
took off *from* would be a launch, a pad he carries is propulsion.

**Jets round the rim**, drawn before the ring so the ring caps them. They are
tall at the back of the ellipse and short at the front, which is what stops it
reading as a flat sticker on the road — the far side of a dish is further away
and what comes off it is seen more side-on. They flutter on their own index so
the rim does not breathe in unison, and they **shorten as the fuel goes**, so
the last second barely has a flame on it.

The readout sits **below** the pad, on the pavement he has already crossed.
Above it is where the lanes he has to read are; inside it is where his feet
are. A hard dark pass under the digits, because there is no `shadowBlur` here
and a number landing on a taxi roof is invisible in a room. It pops on each
whole second so the count is felt as well as read, and it carries a decimal
because three integers in a row is not a countdown, it is a list.

The pad stays drawn while the figure blinks out over the last second, the same
way the flight ring does — you can still see where you are standing while the
sprite cuts in and out.

**No name on it.** The HUD chip bottom-left carries CLOUD INSIGHTS for all
three seconds and the pickup banner gives it the big moment; a label on the
pad was wider than the pad.

**Edges that beat.** They thicken and quicken as the clock runs down and turn
red for the last second, so the pressure is readable without looking away from
his feet. The edges rather than the middle for the same reason as the ring:
it is the one place a full-screen effect can go without hiding a taxi.

A beat fires on each whole second (`Math.ceil`, so the first lands a second
*in* — the strobe already owns the pickup moment and two hits on one frame
read as one). The last one is a fifth higher, so the final second is audibly
the final second.

Verified through the real `collect()` and `update()` path: pickup at 3.000,
beats at 1.98 and 0.98, warn window exactly 1.00s, strobe 0.42s, clock reaching
zero at 3.0s.

**On flashing, because this runs on wall panels.** The edge bars beat at
1.75Hz at pickup rising to 4.0Hz at the end, and they are at most ~9% of the
screen — WCAG's general and red flash thresholds apply above 25% of the
viewing area, and 4Hz is well under the 15–20Hz worst band. The oscillation is
a sine, so there are no hard transitions. The pickup strobe is full-screen but
is two flashes, once, against a limit of three in any one second. **Do not
raise the rate or the area to make it angrier** — make the bars brighter or
thicker instead, and keep an eye on that 25%.

**And it tells him before it stops.** The last 1.4 seconds the figure blinks,
quickening as it goes, the HUD chip goes red and a beep counts down — the same
`FLY_WARN` treatment the TAM's flight gets, on `DASH_WARN`. Every power-up
that changes how he *moves* has to warn him: a man who is suddenly covering
one row a tap, having spent three seconds judging gaps three rows at a time, is
a man who has already stepped. The one that absorbs a hit or slows the world
does not need this; the two that change his stride both do.

**And he changes clothes for it.** Three seconds in a full orange suit with a
cowl, gold bolts at the ears, a gold belt and a lightning bolt on a pale disc
across his chest — the only power-up in the game that changes what he *is*
rather than what he is carrying, and at three squares a step it has earned it.

It is built on **playerModel's exact geometry**, not the caped hero's. The
walk slices this sprite into bands by pixel row — torso, arms, thighs, shins —
so a model with its own proportions would have its knees cut through the
shins. Same boxes, different colours, plus the cowl and the emblem. The TAM's
hero can afford its own proportions because it does not walk; this one does
nothing but. Three details that each took a pass: the legs are a shade down
from the chest, because one flat orange from collar to boot is a jumpsuit and
the figure loses its waist; the belt is wider than the chest and a step nearer
the camera, or the chest is drawn over it and there is no belt; and the bolt
is three blocks in a descending stagger rather than a cross, because at ten
pixels a cross reads as a letter. It loses to the TAM — a caped man in a cowl
is two costumes at once.

**And you can see it on his feet.** Orange high-tops with the eye on the toe
and a small wing at each heel, the wings beating off the walk clock — fastest
when he is, half open when he is standing, because at this size a wing that
does not move is a smudge. Drawn over the sprite rather than baked into it:
the alternative is a second shoe state on every player variant, three blazers
by nine faces by two facings, to put eight pixels of orange on his feet.
Everything is placed in model space and projected, so they sit on his feet
through the bob, the lean and the stride, and each shoe rides its own leg on
`walkStride()`.

**A shoe is a thing that is longer than it is tall.** The first pass was 0.16
wide by 0.145 high with the collar stacked on top, which at this distance is a
cube on each foot — two orange bricks, not footwear. Shallower and longer
forward fixed it for nothing: the sole band at the near edge thins to a line,
which is what a sole looks like, and the silhouette starts reading as a shoe
from the shape alone. The collar is a low lip at the *heel* rather than a block
over the whole foot, because a high-top is high at the back.

**Both wings go OUT.** They used to hang off `x0` on both feet — outward on the
left shoe and straight into the gap between his ankles on the right one, where
it was drawn behind the other shoe. Half the wings in the game were invisible
and the half that showed looked like a mistake. `side` is passed in now. They
are also bigger than the shoe they are attached to, deliberately: they are the
only part of this that moves and the only part that says these are not
ordinary shoes.

**And there is no mark on the shoe.** The eye does not survive at this size.
The outer cheek in this projection is about four pixels by seven and the top
face is not much better, so a lens with an iris in it came out as a white band
with an orange middle — read as a stripe. The white toe cap that the
projection gives the far face for free is already the only light thing down
there, and a second white patch beside it was two accents fighting over nine
pixels. The orange and the wings carry the brand, which they were always going
to have to. They supersede the TAM's plain
orange shoes while they are on — same colour, same feet, and the ones with
wings are the ones worth looking at.

**And lightning, behind him.** Two bolts off his heels, each a polyline
walked back down the trail with the lateral offset thrown a fixed distance
either side at every joint — a zigzag, not a wiggle, because real lightning
turns corners and a smooth curve reads as smoke. They are rebuilt from
scratch every frame off a stepping seed, so the shape never repeats and never
settles: a bolt that holds still for three frames is a crack in the screen.
No `shadowBlur` here, so the glow is the same path stroked three times — wide
and faint, narrower and warmer, then a hot white core. Three strokes of a
six-point path is nothing, and it is the difference between a yellow line and
something with light coming off it. The tail is cut shorter when he is barely
moving, so the bolts grow out of him as he picks up.

**And speed lines, behind him.** A streak in *front* of a runner is a thing he
is about to hit. Behind, in this projection, is down and slightly left: he
travels +y, which the projection sends up the screen and to the right by
`SKEW`, so the trail runs back along `(-SKEW, +ROW_H)` normalised. Seven of
them, each with its own lane across the trail, its own length and its own
place in a loop running from just behind him to well back — and they scroll
along their own length rather than sitting still, which is what separates a
speed line from a scratch on the lens. They are cut when he is not actually
moving, because a man standing still with motion lines coming off him is a
man vibrating.

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

**The hourglass stays up for the whole eleven seconds.** The one in the pickup
burst says *time is about to go slow* and then leaves, which is the wrong half
of the sentence: the thing worth showing is how much of it is left. The one in
the overlay drains against `G.slowT`, so it is a clock rather than a logo and
the player can read the end coming. Measured across a full run: drawn every
frame at (960, 898) at 76px, draining 0.17, 0.33, 0.49, 0.66, 0.82, 0.99 as the
clock runs out, and gone the frame it does.

It also moved the `SLOW MOTION` label, which was at `LOGICAL_H - 36` — y 1044,
dead centre inside the health bar, which spans 680–1240 at y 986–1048 and is
drawn *after* the tint. It was painted over every frame it was up. Label at 966
now, glass above it at 898, both clear of the bar.

**And it sounds low.** A wind-down first — a pitch falling from 392Hz to 82.41,
two and a half octaves over most of a second, which is the sound of something
losing speed — and then a drone underneath that holds for as long as the mode
does: 55Hz and 82.41Hz, A1 and the fifth above it, through a 420Hz low-pass.
Two oscillators rather than one, because a lone sine at 55Hz is *felt* rather
than heard on a panel speaker and the fifth is what makes it read as a pitch at
all; the upper one is detuned six cents so the pair beat against each other
about once a second, since a dead-steady drone reads as a hum in the room
rather than as something the game is doing.

It starts only on the way *in*. A second card while the first is still running
extends the clock, and a second drone on top of the one already playing is two
drones, not a louder one. It is one chain for the whole eleven seconds rather
than a cue retriggered per frame, and it is reaped like everything else —
measured: 3 live chains while it plays, 0 after it ends.

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
   as it was for nothing. **A lane that has braked stays braked for the rest of
   the power-up.** It used to re-arm half a second at a time, so the moment he
   stepped clear the lane rolled again and the street he had just crossed
   closed behind him — which is a driver who looked away, not one who has
   control of the traffic. The SKU is "insight *and control* of traffic"; this
   is the control half. `row.halt` is set to whatever is left on `G.riskT`, so
   it expires with the power-up rather than on a timer of its own, and a lane
   he never walks into never stops at all. A second card picked up mid-effect
   pushes `riskT` back up, so the per-row tick re-raises any live halt to
   match it — otherwise a lane it had already stopped would start rolling again
   underneath him. Measured on a 4s run: the car moves 0 at every sample while
   he stands clear of the lane, and starts again on the frame `riskT` reaches
   zero.

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

**And all three pools are maps of numbers now, drawn with `wpick()`.** Power-ups,
street props and park props were each a literal array with the common entries
written out twice, picked with a uniform index. That reads well right up until
a rate has to move by a percentage: 15% more Cloud Insights against a weight of
5 in 150 wants **5.78**, and you cannot write 5.78 copies of a string into an
array — rounding to 6 is +20%. The weights are fractional where the arithmetic
says so and `wpick` walks them. Verified unbiased over 2,000,000 draws from each
map: every realised share within 0.07pp of its weight.

| | before | after | measured |
|---|---|---|---|
| Cloud Insights, share of drops | 3.333% | 3.833% | **+15.00%** |
| food carts, share of street props | 38.46% | 32.69% | **−15.00%** |
| food carts, share of park props | 30.00% | 25.50% | **−15.00%** |
| TE-ADDON terminal, street props | 7.692% | 6.923% | **−10.00%** |
| TE-ADDON terminal, park props | 10.00% | 9.00% | **−10.00%** |

Two things about that arithmetic are worth writing down, because both are easy
to get wrong by eye.

**Raising a weight raises the denominator too.** Cloud Insights at 5 → 5.75 is
+15% of the *weight* but only +14.1% of the actual drop rate, because the pool
got bigger underneath it. 5.78 is the number that lands on +15.0%. The other
five power-ups each give up 0.5% of their own share to pay for it, which is
unavoidable — the shares have to sum to one.

**And lowering one needs somewhere for the weight to go.** Scaling the terminal
to 0.9 and leaving everything else alone drops its rate by 3.7%, not 10%: the
denominator shrank with the numerator. The weight that comes off the carts and
the terminal goes to the **bins and the planters**, split evenly, so both maps
still total what they did (13 and 10) and every other prop keeps exactly the
rate it had. That is also the right answer narratively — the two things on the
pavement that do nothing at all are what should be standing where a hot dog
cart is not.

In-world rather than in the weights, over six paired trials of 200 worlds each:
terminals **−10.08%**, carts **−14.71%**. The per-trial spread is wide (−7.5% to
−11.8% on the terminal) because both sides of the ratio are sampled — a single
trial is not enough to read one of these off, which is worth knowing before
anybody re-measures and thinks it has drifted.

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
