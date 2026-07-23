# Portfolio Project Ideas

Staged 2026-07-20. Quick, self-contained projects in the spirit of thessa.space and
Entropy — each with a genuine technical hook, buildable in a focused session, and
deployable as a subpath of this site or its own repo.

---

## 1. Interconnection Queue — *why AI datacenters are strangling the grid*

**Status: staged (top pick for next build — unique domain advantage)**

An interactive explainer applying Entropy's "physics you can play with" trick to
transmission capacity — the exact thing I do at Duke. A playable network (nodes =
substations, edges = lines with MW headroom) where you drag load growth and watch
congestion cascade. Nobody else building a portfolio has this domain to draw from.

- Hook: drag a datacenter onto the map → watch line loadings redistribute (DC power
  flow approximation is enough), queue positions stack up, curtailment appear.
- Concepts: headroom, N-1 contingency, interconnection queues, why studies take years.
- Stack: single-page, canvas/SVG, no backend. Real graph algorithms (my thessa moat).

## 2. Graph Algorithms Playground — *supply chains as living graphs*

**Status: staged**

A toy supply-chain graph you can click through: BFS/DFS traversal animating, shortest
path, sole-supplier / second-source detection lighting up nodes — the ontology and
graph-theory chops from thessa without exposing anything proprietary.

- Hook: "find the single point of failure" game mode — click the node whose removal
  disconnects the most downstream demand; then the algorithm shows its answer.
- Stack: D3 force layout or hand-rolled canvas graph; deterministic seeded data.

## 3. Gradient — *an interactive journey into how machines learn*

**Status: IN PROGRESS (this build) → `/gradient/`**

A warm, light-mode, sketch-styled scrolly explainer of how machines learn,
rebuilt from my own notes with live widgets — Entropy's sibling, but cream instead of dark.

- Chapters: perceptron playground → gradient-descent ball → live in-browser XOR
  training (real backprop, activation picker shows vanishing gradients) → tokens &
  embeddings → attention arcs + causal mask + positional encodings → the autocomplete
  machine (real n-gram LM over the essay's own text; temperature / top-k / top-p
  sampling with live probability bars) → LoRA/QLoRA + RLHF/DPO → 2025 field notes
  (RoPE, GQA, FlashAttention, MoE, speculative decoding, KV cache, RAG).
- Design: Anthropic-ish cream, warm ink, coral accent, hand-sketched underlines and
  annotations that draw themselves in on scroll, friendly serif display type.
- Stack: zero dependencies — one HTML + CSS + JS, all sims hand-written.

## 3.5 Drawdown — *the market is asleep on natural gas*

**Status: IN BUILD (2026-07-23) → `/drawdown/`**

Independent mini-model of the US gas balance 2026–2035: AI data centers + contracted LNG
exports drain working storage below the historical record starting ~2028; the forward curve
hasn't noticed; performance-per-watt becomes the hyperscaler metric. Financial-terminal
aesthetic. Three movements: scrolly explainer → scenario simulator → Capitalism-Lab-hard
"you run US energy policy" game ("nobody has beaten 2030 yet"). Own model built from EIA
history, LNG project pipeline, and multi-source DC forecasts; the Chronometer/ILTB podcast
thesis is one preset scenario, cited but not load-bearing. Full spec: `drawdown/SPEC.md`.
Absorbs part of idea #1's grid/interconnection angle (gas as marginal price-setter,
time-to-power, BYOG).

## 4. Orbital Mechanics Piece — *Kessler syndrome or constellation coverage*

**Status: staged**

Reuse the Solaris skills (satellite.js / globe.gl / TLE propagation): a playable
Kessler-cascade sim (debris begets debris) or a constellation-coverage designer
(how many satellites for continuous coverage at altitude X?).

- Hook: slider for launch cadence vs. debris mitigation → watch LEO fill or stay clean.
- Stack: three.js/globe.gl; or 2D orbital-plane canvas for the quick version.

## 5. Quant Scorecard — *paste a ticker, watch the diagnosis*

**Status: staged**

The QV engine made public-friendly: enter a ticker, fetch public fundamentals, and
watch Piotroski F-Score, Altman Z-Score, and Beneish M-Score assemble themselves
component by component with plain-English explanations of each signal.

- Hook: the score bars animate as each ratio computes; red flags annotated.
- Caveat: needs a free fundamentals API (SEC EDGAR facts endpoint works, no key).
- Stack: single page + fetch; falls back to bundled sample companies offline.

---

### Parking notes

- Each project gets a card on the portfolio when it ships.
- Prefer subpath deploys on this site (`/gradient/`, `/queue/`, …) — one repo, one
  Pages deploy, zero infra.
- Keep the rule from Entropy: **every chapter has something you can touch.**
