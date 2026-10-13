# TE Last Mile

A single-file browser game. You are a seller crossing Midtown on foot to get
to a customer meeting, and the traffic is trying to stop you. Built to run as
a web app on Cisco RoomOS devices (Board / Desk / Room Navigator), and in any
browser.

**Play it:** [thelastmile.live](http://thelastmile.live)
**Created by:** Christopher G. Hunt

**Status: prototype.** Not an official Cisco or ThousandEyes product, and not
affiliated with or endorsed by either.

One HTML file. No build step, no libraries, no external assets — the only
network call it ever makes is to the leaderboard, and it runs without that.

---

## Play

Two input methods, both live at once.

| | |
|---|---|
| **Tap anywhere** | Cross. Any tap that is not a swipe moves you forward. |
| **Swipe** | Any direction, anywhere on the screen. |
| Keyboard | Arrows / `WASD` / `Space`, for desktop |
| Mute | Button on the title and game-over screens, or `M` |
| Full screen | Button in the bottom-right corner |

The canvas fits the viewport at 16:9 and is centred. It never crops
horizontally — that would eat playable columns.

## The run

You walk uptown. Every street you clear is a stage of a deal, and the
pipeline on the left is your score.

- **Health starts at 100** and drains slowly as you go — a little per block
  crossed, a little per second standing still. Food carts on the pavement put
  some back.
- **Getting hit costs 15–100**, scaled by what hits you. A yellow cab is the
  baseline; something larger is worse. Enough hits and the run is over.
- **Standing still is not safe.** The clock is a hazard of its own.

Runs end, and the board records how.

---

## The two headline SKUs

These are the ones the game is built around, and they work differently from
everything else.

### TE-ADDON — the terminal

A terminal on the pavement, not a power-up you pick up. **You use it from
where you stand** rather than walking into it. It opens, runs a live path
trace up the street in front of you, and attaches:

- **+$150,000** on the spot
- a route you can walk, live for **14 seconds**
- **ten clean nodes on that route pays +$100,000** — a Units Upsell, and it
  is repeatable inside a single trace

It is the most-used feature in the game: on the current contest board it is
firing about **three times a run**.

### ThousandEyes TAM — the premium tier

Drawn by its own gate, never from the power-up pool below:

- about **41.6%** chance per eligible row, with a **16-row cooldown**, so it
  is uncommon rather than rare
- **five seconds of flight** when collected
- and then it **stays engaged for the rest of the run**, paying out again
  periodically — a real TAM subscription keeps working after onboarding, so
  this one does too

---

## Power-ups

Everything below spawns as a pickup on the street.

| | What it does | Lasts | Pays |
|---|---|---|---|
| **MetroCard** | Swipe in at any subway entrance and ride uptown | — | — |
| **Chuck Bucks** | Straight onto the number | — | scales with the day's market move; **$250k** at 7.5% |
| **Internet Insights** | The whole grid drops into slow motion | 11s | **$180,000** |
| **Endpoint Agents** | A shield — absorbs the next objection. Stacks twice | — | **$100,000** once you are already double-shielded |
| **Traffic Insights** | Every lane risk-scored, and the traffic turns away from you | 12s | — |
| **Cloud Insights** | You run | 3.5s | **$20,000 per road lane** crossed while running |
| **Path Visualization** | The trace itself — see **TE-ADDON** above | 14s | via the terminal |

Note that **Path Visualization is not in the pickup pool**. It is what the
TE-ADDON terminal runs, which is the only way to get one.

## How often things appear

A pickup can spawn from the 7th row onward, never closer than 6 rows to the
last one, on a **48%** roll. When one does spawn, it is drawn from this pool:

| | |
|---|---|
| MetroCard | **42.34%** |
| Chuck Bucks | **19.14%** |
| Internet Insights | **15.00%** |
| Endpoint Agents | **12.65%** |
| Traffic Insights | **7.70%** |
| Cloud Insights | **3.18%** |

These are shares of one weighted draw, so they sum to 100% — raising any one
of them necessarily lowers the rest.

The **TAM** is not in that pool; it has its own roll (above) and takes the
slot before the draw happens. The **TE-ADDON terminal** is not in it either —
it is pavement furniture, and comes up about as often as a newsstand.

---

## URL parameters

| Parameter | Effect |
|---|---|
| `?team=nyc` | Use a separate leaderboard for that team |
| `?safe=1` | **Guest-safe mode.** Replaces sales objections with neutral network hazards. Use this for rooms customers sit in. |
| `?mute=1` | Forces silence for a whole deployment, overriding the local toggle |
| `?fps=1` | Perf overlay: FPS, backing-store size, device pixel ratio |
| `?offline=1` | Never contacts the leaderboard, even if one is configured |

Parameters combine, e.g. `?safe=1&mute=1`.

## The leaderboard

Optional. Three initials and a score, posted to a small service; without one,
or with `?offline=1`, the game keeps its own stats on the device and plays
exactly the same. The board screen shows the top runs; **FULL REPORT** shows
everything the game has been counting.

---

## Credits

**Created by Christopher G. Hunt.**

| | |
|---|---|
| **Play** | [thelastmile.live](http://thelastmile.live) |
| **Repository** | [github.com/lucidium2000/the-last-mile](https://github.com/lucidium2000/the-last-mile) |
| **Built with** | Nothing. One HTML file — canvas 2D, Web Audio, no libraries, no build step. |

## License

The **source** is released under the [MIT License](LICENSE) — free to use,
modify and redistribute, provided the copyright notice is retained.

**The embedded audio is not.** Six recordings are inlined as base64 so the
page fetches nothing. Two of them — `DIG_B64` and `WALK_B64` — are original
recordings and are covered by the licence above. The other four are short
excerpts of **third-party recordings**:

| Constant | What it is |
|---|---|
| `FREE_B64` | a film line, used as a flight cue |
| `WOAH_B64` | a film line, used on a dodge |
| `KEN_B64` | a video-game voice clip |
| `RING_B64` | a bell, used on the tenth node of a path trace |

These are **not the author's work and are not covered by the MIT grant**, so
the repository as a whole is not redistributable under it. Anyone reusing
this beyond private or internal play should strip those four constants.
Removing them is safe: the game is built to behave identically with no audio
at all.

## Disclaimer

Not an official Cisco or ThousandEyes product. Independent work, not
sponsored by, endorsed by, or affiliated with Cisco or ThousandEyes. Provided
**"as is"**, without warranty of any kind.
