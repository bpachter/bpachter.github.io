# The Great Attractor — build roadmap

An interactive, chaptered explainer of where we live in the universe and why
every galaxy in our neighborhood is streaming toward a point we cannot see.
Sibling to `gradient/` (same shell: sidebar chapters, per-page TS bundles via
`build.sh`, committed `js/`), but its own atmosphere: deep-space dark, editorial
serif, and the portfolio's palette family — **teal = gravity's pull,
violet = dark energy's push, gold = the Attractor itself**.

Dark-only by design: space has no light mode.

## Chapter plan (3 parts, 10 chapters)

### Part I · The Setting — `setting/`  ✅ session 1
1. **The Hole** — the KBC underdensity, ~2 Gly across, and you in the middle.
   Widget: *powers-of-ten pull-back* — log-zoom slider from 1 AU to 2 Gly.
2. **The Web** — voids, filaments, nodes; the honest version of the neuron echo.
   Widget: *orbitable 3-D cosmic web* (drag to spin, toggle void ghosts).
3. **Two Forces** — gravity vs dark energy, and the crossover distance.
   Widget: *tug-of-war sim* — mass + separation sliders, release & watch
   merge or runaway recession; crossover marker.

### Part II · The Evidence — `evidence/`  (session 2)
4. **The Locals** — Local Group; MW–Andromeda(–Triangulum) merger clock
   (~4–5 Gyr, with the modern uncertainty stated honestly).
5. **First Light** — the CMB; pannable sphere; the Cold Spot and its theories.
6. **The Flow** — peculiar velocities; we move ~600 km/s against the CMB frame.
   HERO widget: *flow-field* — galaxies advected along streamlines into basins.
7. **Zone of Avoidance** — drag the Milky Way's dust aside; X-ray/IR reveal
   of the Norma cluster region.

### Part III · The Picture — `picture/`  (session 3)
8. **Laniakea** — watershed of gravity; the Attractor as drain-point; Shapley
   beyond it; the Dipole Repeller behind us — squeezed between push and pull.
9. **Emptier Holes** — Boötes ("60 galaxies where 2,000 belong") vs KBC;
   density-slider comparison. Underdense ≠ empty.
10. **The Suburb** — perspective ending; galactic habitability speculation,
    clearly labeled as speculation.

## Science guardrails (fixes over the source video)
- Great Attractor region mass ≈ **10¹⁶ M☉** (the video self-contradicts:
  "10 quintillion" vs "10 million billion").
- MW–Andromeda merger ≈ **4–5 Gyr** out (not 2–3), and recent work
  (Gaia-era proper motions) puts the collision itself at ~50% odds — say so.
- Frame the GA as **Laniakea's basin of attraction / velocity-flow focus**,
  not a single mystery object; much of the pull traces to Norma cluster +
  the larger Shapley concentration beyond.
- KBC void: **underdense (~20–80% locally), not empty** — that's ch 9–10's
  whole payoff; don't oversell "hole" early.
- CMB Cold Spot: supervoid is the leading mundane explanation; parallel-universe
  bruise is fringe — present with that weighting.
- The neuron/web comparison is structural resemblance, not function.

## Build conventions
- `build.sh` mirrors gradient's: `tsc --outFile js/<page>.js src/core.ts src/<page>.ts`
  per page + standalone `nav.ts`. **Commit `js/`** (branch-deploy safe).
- Pages: `index.html` (landing, bundle `landing`), `setting/`, `evidence/`,
  `picture/` (bundles `setting`, `evidence`, `picture`).
- Shell classes mirror gradient's (`m-topbar`, `sidebar`, `nav-sec`, `part-hero`,
  `chapter`, `ch-head`, `margin-note`, …) so maintenance stays symmetric.
- Widgets: `.fig` frame, `.fig-head`, canvas, `.fig-controls`, `.fig-cap`;
  auto-demo on scroll-into-view until first touch (core `autoOnView`/`userTouch`),
  `prefers-reduced-motion` respected everywhere.
- Landing hero: starfield with a slow coherent drift toward one off-screen
  point — the whole thesis in one background.

## Session log
- **S1**: scaffold, design system, core.ts, landing + hero, Part I complete
  (ch 1–3, three widgets), deploy workflow taught about `attractor/` (and the
  artifact gap for `drawdown/` + `case-studies.html` fixed), portfolio card added.
- S2 (planned): Part II — merger clock, CMB sphere, flow-field hero, ZoA reveal.
- S3 (planned): Part III — Laniakea basins, density compare, ending; polish pass;
  cross-links from gradient sidebar ("More" section) if desired.
