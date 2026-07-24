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

### Part II · The Evidence — `evidence/`  ✅ session 2
4. **The locals** — Local Group; MW–Andromeda(–Triangulum) merger clock
   (~4–5 Gyr, Gaia-era ~50% collision odds stated honestly).
   Widget: *merger clock* — scrub 0→10 Gyr; approach, tidal tails, Milkdromeda.
5. **First light** — the CMB; pannable sphere; the Cold Spot and its theories
   (supervoid leading; exotica labeled fringe). ΔT ~ 1 part in 100,000.
6. **The flow** — peculiar velocities; we move ~600 km/s against the CMB frame
   (measured from the CMB dipole — ties to ch 5). Named by the Seven Samurai
   (Lynden-Bell et al., 1988). HERO widget: *flow-field* — galaxies advected
   along streamlines into basins; Shapley + Dipole Repeller teased at edges.
7. **Zone of Avoidance** — the galactic plane hides ~20% of the extragalactic
   sky, and the Attractor sits behind it. Drag the Milky Way band aside, or
   switch to infrared eyes; the Norma cluster (ACO 3627, 1996) is the reveal.

### Part III · The Picture — `picture/`  ✅ session 3
8. **Laniakea** — watershed of gravity; the Attractor as drain-point; Shapley
   beyond it; the Dipole Repeller behind us — squeezed between push and pull.
9. **Emptier Holes** — Boötes ("60 galaxies where 2,000 belong") vs KBC;
   density-slider comparison. Underdense ≠ empty.
10. **The Suburb** — perspective ending; galactic habitability speculation,
    clearly labeled as speculation.

### Part IV · The Bubble — `bubble/`  (session 4) — the edge of seeing
11. **The black sky** — why space looks black; the observable universe is a
    93-Gly sphere centered on the observer (46.5 Gly radius — an edge of
    *perception*, not of the universe). Widget: *ripples on the pond* — a wave
    stretches as it travels; slide distance and watch it leave the visible band.
12. **Deeper than seeing** — the EM ladder: eye → night vision → JWST infrared
    → microwave instruments. Widget: *spectrum slide* — drag a galaxy away and
    its light slides down the spectrum; instruments light up as they catch it.
13. **The wall of first light** — the CMB as the *edge* of the bubble (surface
    of last scattering, ~380,000 yr). Complementary lens to ch 5: there it's a
    map/blueprint; here it's the wall. Widget: *the bubble in 3-D* — orbitable
    observer-centered sphere, galaxies inside, CMB shell at the horizon.
14. **The impossible distance** — 13.8-Gyr-old light arriving from what is now
    46.5 Gly away; space expands under the photon. Widget: *ant on a rubber
    band* — photon crawls at c while the band stretches; dual readout (distance
    the photon traveled vs where its source is NOW).

### Part V · The Bang — `bang/`  (session 5) — how we found out
15. **Einstein's blunder** — static universe + cosmological constant to balance
    gravity; the instability; the vindication as dark energy. Widget: *balance
    toy* — tune Λ to perfectly balance gravity, nudge it, watch it run away
    (the actual instability argument, playable).
16. **Measuring the sky** — Henrietta Leavitt's Cepheid period–luminosity law
    (credit her by name), Hubble + Andromeda: the "nebula" that was a galaxy.
    Widget: *Cepheid pulse-meter* — time a star's pulse → luminosity → distance.
17. **The redshift** — Doppler (ambulance) vs cosmological redshift (space
    stretches the wave in transit); Slipher's receding nebulae; the Hubble
    diagram. Widget: *build the Hubble diagram* — measure galaxies, plot v vs d,
    watch the slope (H₀) emerge. GUARDRAIL: Hubble's data showed *expansion*;
    ACCELERATION was the 1998 Type Ia supernova teams (Perlmutter, Riess,
    Schmidt — 2011 Nobel). Do not credit acceleration to Hubble.
18. **Everywhere at once** — the Big Bang was not an explosion at a point: run
    the expansion backward and it gets hot and dense EVERYWHERE; the CMB
    surrounds us because it happened *here* too. Inflation: ≥10²⁶× in a sliver
    of a second (grain of sand → ~galaxy scale, "at least"). Widget: *the
    infinite grid* — expanding lattice of dots; click ANY dot to re-center:
    every observer sees everyone else receding. The misconception-killer.

## Extra guardrails for Parts IV–V (fixes over the second source video)
- Radius of the observable universe: **46.5 billion ly** (video garbles "46 12").
- "Space is infinite" → **unknown**: the observable universe is finite; the
  whole universe may be infinite or finite-but-larger. Say "possibly infinite."
- CMB emitted at **~380,000 yr** (not 400,000).
- Cepheid distance method: **Leavitt's law** — name her, not just Hubble.
- Hubble/Slipher: expansion. **Acceleration: 1998 supernovae** (see ch 17).
- "Nothing moves through space faster than light, but space itself can stretch
  faster" — correct framing; keep it.
- The video's "first light at the very limits of our bubble" is the surface of
  last scattering — slightly inside the particle horizon; fine at our altitude.

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
