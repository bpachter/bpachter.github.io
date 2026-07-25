# DRAWDOWN — the market is asleep on natural gas

An independent, playable model of the US natural gas balance, 2026–2035: how AI data
centers plus contracted LNG exports pull on a system that's already close to fully
committed, why working storage is on track to leave its historical range starting around
2028, why the forward curve hasn't priced it, and why hyperscalers will come to treat
performance-per-watt as a first-order cost metric rather than an engineering nicety.

Live at [`bpachter.github.io/drawdown`](https://bpachter.github.io/drawdown/).

## Positioning

- This is an independent model, built from public data: EIA history (storage, production,
  consumption, trade), the announced/FID'd LNG project pipeline, and published data-center
  power forecasts (EPRI, LBNL, Goldman Sachs, BloombergNEF, IEA, and others).
- The Chronometer Partners thesis that provoked this project (*Invest Like the Best*, 2026)
  is credited but not taken on authority — it's one labeled preset scenario among several,
  reproducible or rejectable with the model's own levers.
- Every number in the narrative traces to a cited public source. History is fact; the
  forward path is a model, and it's labeled as one everywhere it appears.
- No tickers as investment recommendations. Sector discussion (who is structurally
  long/short this outcome) is market-structure commentary, not advice.

## What's here

Six modules, all in one terminal-style app:

- **Terminal** — dashboard: KPI strip, storage chart (history + model), a sources-and-uses
  ledger (today vs. 2030 announced), and a wire of real dated events.
- **Brief** — the argument as six short documents (abundance → the commitments → the
  ceiling → the pull → the draw → the misprice), plus a method/provenance annex.
- **Model** — the desk: 13 levers (LNG build-out and slip, data-center path and gas share,
  perf-per-watt gains, production ceiling and build rate, Canada pipeline, nuclear, resi
  solar, weather), four presets, live readouts, and a calibration-vs-reality ledger.
- **Data** — provenance tables rendered straight from the underlying JSON: EIA history, the
  LNG commitment book, data-center forecasts, and price-spike episodes, each with sources.
- **Atlas** — an interactive MapLibre map of the physical system (producing basins, flow
  corridors, LNG terminals, behind-the-meter data-center campuses, demand hubs), plus a
  siting tool that scores and prices a hypothetical gas-powered campus anywhere you click.
- **Operator** — a standalone quarterly policy game (`operator.html`): run US energy policy
  2026–2036 against the same engine, with real build lags (pipelines ~3 years, reactors
  ~7) and four things that have to survive you — the grid, consumer bills, the AI race, and
  the alliance relationships LNG exports depend on. Seed-deterministic and shareable via
  `?seed=`. Nobody has beaten 2030 yet.

## Engine

Monthly timestep, July 2026 → 2036. State is US working gas storage (Bcf).

- **Supply**: dry production (a price-responsive ramp, capped at a max-deliverability
  lever) plus net Canadian imports, seasonal.
- **Demand**: residential/commercial and industrial (seasonal, slow growth), power burn
  (base generation plus new data-center load converted from GW via heat-rate math), LNG
  feedgas (the FID'd project ramp, with curtailment logic above certain price thresholds),
  and Mexico pipeline exports.
- Storage integrates supply minus demand each month against ~4,280 Bcf of demonstrated
  capacity and an ~800 Bcf operational floor.
- **Price**: Henry Hub is a convex function of storage's deviation from a self-consistent
  seasonal norm, fitted to real price-spike episodes (the 2014 polar vortex, Winter Storm
  Uri, the 2022 post-invasion run). Electricity price is the heat-rate pass-through at the
  margin; hyperscaler energy share of compute cost follows from that.
- The system is anchored so today's observed balance reproduces by construction — the
  model's own July-2026 spot price and its projected October-2026 storage peak both land
  within a few percent of the real, independently reported figures. The future is driven
  only by announced changes and whatever levers you move.
- Every constant lives in one calibration object in `engine.js`, with inline citations to
  its source.

## Data (`data/`)

- `eia_history.json` — storage (weekly + 5-yr band), production, consumption by sector,
  trade, Henry Hub prices.
- `lng_projects.json` — the LNG project/train list with capacities and in-service dates.
- `datacenters.json` — multi-source data-center load forecasts, heat-rate conversion
  factors, and the largest announced behind-the-meter projects.
- `price_episodes.json` — historical price-spike episodes with storage deviations, used to
  fit the price model's convexity.
- `geo.json` — coordinates and attributes for the Atlas map (basins, pipeline corridors,
  LNG terminals, data-center campuses, demand hubs).

All fetched at runtime, same-origin; each series carries its source URL and retrieval date.

## Known limitations

- Weather-normal by default; the model doesn't simulate intra-winter storm shocks the way
  real markets experience them (the Operator draws yearly severity multipliers, which is a
  coarser approximation).
- National single-node balance — no regional basis differentiation (Appalachia, Permian,
  New England, etc. are not priced separately).
- Production responds to spot price with a lag rather than to the forward curve, which is
  a simplification of how real capital-allocation decisions get made.

Each of these is conservative in the direction that makes the underlying problem look
*smaller*, not larger.

## Stack

Zero runtime framework. Vanilla JS, hand-rolled canvas charts, self-hosted fonts (Inter,
Space Grotesk, JetBrains Mono), and a vendored copy of MapLibre GL for the Atlas — no
build step, no bundler, no CDN dependency at runtime beyond the Carto basemap tiles.
