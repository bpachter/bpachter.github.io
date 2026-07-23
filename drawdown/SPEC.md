# DRAWDOWN — the market is asleep on natural gas

**Route:** `bpachter.github.io/drawdown/` (working name; rename = rename the folder + card link)
**Status:** in build, staged 2026-07-23
**One-liner:** An independent, playable model of the US natural gas balance 2026–2035 — showing
how AI data centers plus contracted LNG exports drain working storage below anything in the
historical record starting ~2028, why the forward curve hasn't noticed, and why hyperscalers
will come to price compute in performance-per-watt.

---

## Positioning & intellectual honesty

- This is **Ben's own mini-model**, built from public data: EIA history (storage, production,
  consumption, trade), the announced LNG project pipeline, and published data-center power
  forecasts (EPRI/LBNL/Goldman/BNEF/EIA et al.).
- The Chronometer Partners thesis (Invest Like the Best, 2026) is **one scenario among several**,
  credited as the piece's provocation — not its authority. Its headline numbers (35 Bcf/d LNG by
  2030, +20 Bcf/d max production growth, 5→15 Bcf/d AI gas pull, storage exhaustion ~2030) are
  preset scenario inputs the visitor can reproduce or reject with the levers.
- Every number in the narrative traces to a cited public source. The forward model is clearly
  labeled A MODEL. History is fact; the future is sliders.
- No tickers as recommendations. Winners/losers is sector dynamics, framed editorially
  ("who is structurally long/short this outcome"), never advice.

## v2 — TERMINAL APPLICATION (2026-07-23, second pass)

Ben's review of v1: the single-page scroll read "like a fancy blog"; he wants Thessa-depth —
an actual terminal product — and the game isolated on its own page. v2 restructures:

- **Shell** (`index.html` + `app.js`): boot overlay (sessionStorage-aware), topbar with
  brand + F1–F5 module tabs + UTC clock, live tape, hash router, bottom `dd>` command bar
  (help / go / brief N / preset / set lever value / operator seed N / fern), status footer
  with calibration anchors. Body never scrolls — modules scroll inside the viewport.
- **F1 TERMINAL** — dashboard: KPI strip w/ severity bars, storage chart (history+model),
  SOURCES & USES ledger (today vs 2030 announced), THE WIRE (10 real dated events incl.
  Fern $30.72, FID wave, EQT shut-ins), nav cards.
- **F2 BRIEF** — the six chapters as numbered briefing documents (DD-BRIEF-01…06 + ANNEX-A
  method/provenance) with index rail, doc metadata, prev/next — no scroll narrative.
- **F3 MODEL** — the desk (13 levers, 4 presets, readouts, alarm, 2 live charts) + METHOD
  sub-tab (equations, calibration-vs-reality ledger).
- **F4 DATA** — provenance ledgers rendered from the four JSONs: EIA headlines, the 28-project
  LNG commitment book, 10 DC forecasts + conversion anchor, 10 price episodes + fit.
- **F5 OPERATOR ↗** — `operator.html`, fully isolated page (own shell, `?seed=` URLs).

Thessa patterns borrowed (translated to the phosphor brand, not the violet one): boot
sequence, module tabs, hairline ledger tables w/ severity edge bars + chips, KPI strips,
command palette→command bar, tape, status bar. v1's scroll-explainer spec below is retained
for the copy inventory; layout portions are superseded.

## v2.1 — ATLAS + motion + typography (2026-07-23, third pass)

Ben asked for: interactive maps (Avalon/Thessa-23f class), beUI look-and-feel, enterprise fonts.

- **F5 ATLAS** (`atlas.js`): MapLibre GL (vendored, `vendor/`) on Carto dark-matter — the exact
  Avalon stack. Layers from `data/geo.json` (research agent, 21 sources): 7 basin polygons w/
  production labels, 8 stylized flow corridors, 17 LNG terminals (status-colored, capacity-sized),
  10 BTM DC campuses (GW-sized), 8 demand hubs. Animated layer switches, legend, click cards.
  **SITING sub-tab** = Thessa-23f pattern: click → pin → animated scorecard (GAS ACCESS /
  CORRIDOR ACCESS / LNG INSULATION / MARKET ACCESS, distance-based vs real geography) + campus
  GW slider priced by the engine (150 MMcf/d/GW × model 2030 price). OPERATOR moved to F6.
- **beUI note**: beui.dev is React + Framer Motion (shadcn-registry). Incompatible with this
  zero-framework static app, so its patterns were PORTED by hand into `motion.js`: number
  tickers (Number Animation), toast stack (Notification Stack), ⌘K fuzzy palette (Command
  Palette block), gliding tab indicator (Expandable Tabs/Dock), staggered module entrances,
  spring easings (`--spring`), hover elevations. All reduced-motion safe. If literal beUI is
  wanted, that's a React/Vite rebuild — flagged as an option, not taken.
- **Typography** (self-hosted woff2, `fonts/`): Inter (UI, ≥500; labels 600 tracked),
  Space Grotesk (display/wordmark), JetBrains Mono (all data, tabular-nums) — Thessa's exact
  hierarchy. Zero-dep purity now "zero-framework": vendored MapLibre + fonts, no CDNs at
  runtime except Carto basemap tiles.

## v1 format (superseded) — three movements, one page

**Act I — THE TAPE (scrolly explainer, ~6 chapters).** Financial-terminal aesthetic. Each
chapter is a terminal "panel" that animates in as you scroll, driven by the real data bundle:

1. **ABUNDANCE** — the shale era: production 55→110+ Bcf/d since 2010; the psychology of
   15 years of cheap gas. Chart: production history.
2. **THE COMMITMENTS** — LNG nameplate 0→15 Bcf/d, contracts + project finance already take it
   to ~30-35 by 2030-31. Chart: project-by-project capacity ramp (stacked). The die was cast
   before AI showed up.
3. **THE CEILING** — what supply can actually do: basin-by-basin growth to ~128-132 Bcf/d max
   deliverability; processing/gathering/pipeline constraints; one interstate pipeline built in
   a decade. (Duke/grid credibility lives here + interconnection tie-in.)
4. **THE PULL** — data centers: forecast fan chart (multiple sources, low/base/high), GW→Bcf/d
   conversion made explicit (heat-rate math on screen), BYOG/behind-the-meter means MORE gas.
5. **THE DRAW** — the centerpiece: working storage with 5-yr min/max band, historical weekly
   data, then the model's projection punching below the band in '28 and toward exhaustion
   ~2030. This is the alarm chart.
6. **THE MISPRICE** — flat forward curve vs modeled balance; the DRAM analogy ("slowly at
   first, then all at once"); convex price function calibrated on real episodes (2014 vortex,
   Uri, 2022); what $10+ gas does to power prices and to hyperscaler cost-of-compute
   (energy 10% → 20-40%), hence **performance-per-watt becomes the metric**.

**Act II — THE DESK (scenario simulator).** The model with its hood open. Levers:
- LNG export ramp (announced schedule ↔ delayed ↔ curtail spot ↔ breach contracts)
- Data-center buildout (P50 / P30 / P0 paths; % gas-served; perf-per-watt improvement rate)
- Production response (price elasticity, max deliverability, midstream build rate)
- Canada pipe (+0-2 Bcf/d, 3-yr lag), nuclear (AP1000s online '33+), resi solar adoption
- Weather (normal / cold / hot draws)
Readouts: storage trajectory vs bands, Henry Hub path (convex), power-price pass-through,
hyperscaler energy share of compute cost, consumer bill index. Preset buttons:
`[CONSENSUS]` `[CHRONOMETER]` `[SOFT LANDING]` `[CRISIS]`.

**Act III — THE OPERATOR (the game).** Capitalism-Lab-hard. You run US energy policy +
markets 2026–2035, quarterly turns. Same engine, but decisions have lags, budgets, and
political costs:
- Approve pipelines/processing (3-yr lag), fast-track nukes (7-yr lag, $$$), LNG diplomacy
  (curtail = ally trust penalty), DC interconnection throttling (AI growth penalty),
  demand response, resi-solar incentives, strategic storage builds.
- Score dimensions: consumer bills, AI compute delivered, ally trust, blackout-hours, storage
  never below operational minimum. Fail states are easy; the "win" is narrow and uncomfortable.
- Framing: **"Nobody has beaten 2030 yet."** Share-your-run seed codes; if enough people find
  a path through, the winning policy mixes ARE the point. (Seed-deterministic runs, shareable
  as URL params — no backend.)

## Aesthetic — FINANCIAL TERMINAL

- Near-black (#0a0e12-ish), monospace everything (IBM Plex Mono / JetBrains Mono, system
  fallback), phosphor green for data, amber for warnings, red for breaches. Thin 1px panel
  borders, ALL-CAPS panel headers with tick labels (`STOR.L48 ▓`, `HH.FWD`, `DC.LOAD`).
- Top ticker tape (real bundled quotes: HH spot, storage vs 5yr, LNG util, DC GW).
- Blinking block cursor, occasional scanline/CRT restraint (subtle — no gimmick overload).
- Charts hand-rolled canvas/SVG, zero dependencies, same discipline as `/gradient/`.
- Light-mode: not offered. The terminal is dark. (Portfolio card can note it.)

## Engine design (v1)

Monthly timestep, 2026-01 → 2035-12. State: storage S (Bcf).
- Supply: dry production (base + price-elastic ramp, capped at max deliverability lever),
  + Canada net imports (seasonal), − Mexico exports.
- Demand: res/comm (seasonal normal), industrial (slow growth), power burn = base power gas
  + DC load × gas-share × heat-rate conversion, + LNG feedgas (project ramp, curtailment
  logic at price thresholds).
- S(t+1) = S(t) + supply − demand (monthly Bcf). Capacity ~4,000+ Bcf; operational floor
  ~700-900 Bcf (base-gas proxy); breach = crisis event.
- Price: HH = f(storage deviation vs 5-yr norm), exponential/convex, calibrated to episode
  data (price_episodes.json). Power price = heat rate × HH pass-through at the margin.
  Hyperscaler energy share = elec price × usage ÷ compute cost stack.
- All parameters in one visible `PARAMS` object; "show your work" panel renders the actual
  equations + sources. The model IS the content.

## Data bundle (`data/`)

- `eia_history.json` — storage weekly + 5yr bands, production, consumption by sector, trade,
  HH prices (EIA).
- `lng_projects.json` — project/train list w/ capacities + in-service dates; aggregate ramp.
- `datacenters.json` — multi-source DC load forecasts (fan), heat-rate conversions, BTM list.
- `price_episodes.json` — spike episodes w/ storage deviations; regime summary; fit pairs.
All fetched at runtime same-origin; each carries `source` URLs + `retrieved` dates.

## Build phases

1. ✅ Spec + data research (4 parallel agents, 2026-07-23)
2. ✅ Engine + calibration — anchors: model spot $2.86 vs actual $2.80; Oct-26 peak 3,970 vs
   EIA STEO 3,966; seasonal amplitude 1,943 vs real band 1,944; price k fitted to episode data
   (empirical P≈4.15·e^(−1.95·dev), deficit side steeper)
3. ✅ Act II desk (13 levers, 4 presets, live readouts + alarm)
4. ✅ Act I scrolly (6 chapters, real EIA/LNG/DC data in copy + charts)
5. ✅ Act III — THE OPERATOR (quarterly turns, 10 actions w/ real lags, PC budget, seeded
   winters, 4 meters, 5 endings, share string, ?seed= URLs). Do-nothing baseline dies 2029 Q3.
6. ✅ Portfolio card on index.html (row 04)

### v1 known simplifications (candidates for v1.1)
- Weather-normal model; game draws yearly multipliers but no intra-winter storm shocks (Fern-style)
- Operator actions re-simulate the whole trajectory, so matured effects subtly rewrite pre-effect history
- No regional basis (Appalachia/Permian/New England) — national single-node balance
- Difficulty untested by humans; "nobody has beaten 2030 yet" needs playtesting to stay honest

## Open questions for Ben

- Name: `drawdown` vs alternatives (`convexity`, `the-gas-cliff`, `shortgas`).
- Winners/losers depth: sector-level only (recommended) vs naming public companies.
- Whether Act III ships in v1 or fast-follows.
