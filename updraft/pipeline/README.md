# updraft pipeline

Everything the site shows is compiled offline into `../data/*.json`; the browser only
renders. This directory holds the public half of that contract:

- **`shared.js`** — the single declaration of the payoff estimator constants
  (`EST`: IT W/sqft, recoverable-heat share, ha per MWth, displaced-gas economics,
  CO₂ enrichment t/ha·yr) and the pure math (band verdict, haversine, cell snap).
  The browser loads it as a classic `<script>` before `atlas.js`; the verifier
  imports the same file — so the checks below exercise the exact code the site
  runs, and a drifted constant cannot pass silently. The estimator values are
  planning heuristics, not engineering; change one and re-run to test sensitivity.

- **`verify.mjs`** — recomputes every headline number (frontier counts, weighted
  shares, fermentation-CO₂ stoichiometry, golden pairs by great-circle distance,
  the threshold-sensitivity grid) from the shipped JSON, plus the analysis layers
  (light-cost recompute, design-day formula, water anchors, CO₂-claim indices),
  and diffs it all against `data/summary.json` / `data/layers.json`. Zero
  dependencies:

  ```bash
  node pipeline/verify.mjs
  ```

- **`build_layers.mjs`** + **`raw/`** — assembles `data/layers.json` (the LIGHT
  COST and WATER STRESS surfaces, CO₂ claims, and the design-day panel) from six
  source pulls in `raw/`, each carrying its own `_provenance` (NASA POWER monthly
  climatology 2001–2020; EIA-861 2024 state industrial prices; Census state
  boundaries; WRI Aqueduct 4.0 provincial baseline water stress; CCS
  contract/operating status per plant with per-plant sources; ASHRAE 2025
  99% design temperatures). Rebuild any time:

  ```bash
  node pipeline/build_layers.mjs && node pipeline/verify.mjs
  ```

What is *not* here: the upstream fetch/compile against IM3 (PNNL), NASA POWER,
EPA GHGRP and EIA — geolocation, cell snapping, and DLI/HDD derivation run
offline. Sources, vintages and licenses are on the site's DATA tab.

Two known rounding artifacts, disclosed rather than hidden: the shipped cells
carry 1-decimal DLI while banding was computed on unrounded values, so (a) 4 of
1,592 cells display a DLI that appears to satisfy the frontier rule while banding
just below it, and (b) the off-default rows of the sensitivity grid can differ by
a point or two when recomputed from the shipped values. No facility band and no
headline number is affected; `verify.mjs` checks both with stated tolerances.
