# Gradient → a lightweight interactive textbook

Staged 2026-07-20. Current state: **3 parts, 10 chapters, ~20 live widgets.**
Target: **5 parts, ~21 chapters** — roughly double — covering what the frontier
actually shipped in the last year: reasoning models, agents, harnesses, MCP,
context engineering, interpretability, multimodality, and injection defense.
House rules stay absolute: warm cream, hand-sketched, zero runtime libraries,
**every chapter has something you can touch**, every widget auto-demos on
scroll and yields to the reader's hands.

---

## The gap analysis

What Gradient teaches today ends, intellectually, around early 2025: how a
model is built, how it generates, how inference got cheap. What it's missing
is everything the cool kids do now:

| Missing pillar | Concepts |
|---|---|
| **Reasoning / test-time compute** | chain of thought, thinking tokens, RLVR (verifiable rewards), GRPO, self-consistency, best-of-N + verifiers, thinking budgets, reasoning distillation |
| **Agents** | the agentic while-loop, tool use / function calling, MCP, computer use, agent evals (SWE-bench flavor) |
| **Harnesses & safety rails** | sandboxes, permissioning, dry-runs, blast-radius gates, verification-before-merge, graded autonomy |
| **Context engineering** | system prompts vs memory files, compaction, subagent fan-out, context rot, agentic RAG |
| **Multi-agent orchestration** | orchestrator/workers, adversarial verifiers, judge panels, when parallelism actually helps |
| **Alignment, applied** | Constitutional AI / RLAIF, deliberative alignment, prompt injection + the lethal trifecta, model specs |
| **Interpretability** | neurons vs features, superposition, sparse autoencoders, feature steering, circuits |
| **Multimodality** | ViT patches-as-tokens, audio in, image gen (diffusion vs autoregressive) |
| **Serving, 2026 edition** | long-context tricks (sliding window + attention sinks), constrained/structured decoding, MLA, SSM hybrids (Mamba), multi-token prediction, small-model renaissance |

## The new map — five hikes

Tab bar becomes: `foundations · language · engine room · thinking · agents`
(part III's tab renamed from "frontier" — with two parts beyond it, the old
name stops being true). Hover dropdowns (shipped 2026-07-20) scale to all
five tabs; landing route map grows to five cards.

### Part III — the engine room *(rename + small additions)*
- 09-10 unchanged (sculpting, MoE→RAG).
- **10i · The long-context problem** — context rot; sliding-window attention +
  attention sinks. *Widget: needle-in-a-haystack — drag the needle deeper into
  a growing haystack, watch retrieval accuracy sag; toggle attention sinks.*
- **10j · Drawing inside the lines** — constrained/structured decoding:
  grammar masks the probability bars so only valid JSON can be sampled.
  *Widget: the ch-08 probability bars, but a JSON schema greys out illegal
  tokens live as a config object assembles itself.*
- **Field-note deck refresh**: MLA (latent KV compression), Mamba/SSM hybrids,
  multi-token prediction, world models, the small-model renaissance.

> **Numbering update (build session ①):** agents ships first as **Part IV
> (ch 11-16)** so the book stays contiguous; thinking follows as **Part V
> (ch 17-20)**, closing the book with "Inside the mind." Sections below keep
> their content; read "Part IV — thinking" as Part V and vice versa.

### Part V — thinking *(new: reasoning & test-time compute)*
- **11 · Thinking out loud** — chain of thought → reasoning tokens → extended
  thinking; why models that "show work" are right more often. *Widget: the
  same arithmetic-word puzzle answered instantly vs with a visible scratchpad,
  20 trials each, live accuracy tally.*
- **12 · Training a reasoner** — RLVR: rewards only for *verifiably correct*
  answers; GRPO in one picture (group of rollouts, group-relative advantage,
  no value network); distilling traces into small models. *Widget: 8 rollouts
  per round, a verifier stamps ✓/✗, strategy bars shift toward what worked.*
- **13 · The thinking budget** — test-time scaling: longer chains vs parallel
  samples + majority vote vs best-of-N with a verifier; when to spend at
  inference what you didn't spend at training. *Widget: a compute slider you
  split between "think longer" and "sample wider," accuracy curve responds.*
- **14 · Inside the mind** — interpretability: a neuron is not a concept;
  superposition; sparse autoencoders pulling features apart; steering a
  feature. *Widget: 6 toy concepts packed into 2 neurons (superposition,
  drawn); an SAE lens un-mixes them; a steering slider dials one feature up
  and the toy model's outputs change character.*

### Part IV — agents *(new: the loop and everything around it — ch 11-16)*
- **15 · The loop** — an agent is just a model + tools + a while-loop:
  observe → think → act → observe. Why feedback beats one-shot. *Widget: an
  animated agent fixes a failing "test": reads the error, edits, re-runs,
  loops until green — the reader can inject a surprise failure mid-run.*
- **16 · Hands: tools & MCP** — function calling with JSON schemas; MCP as
  the USB-C port for context; computer use in one panel. *Widget: three tool
  cards with schemas; ask one of several questions and watch the model pick a
  tool and assemble the call, argument by argument.*
- **17 · The context engineer** — the window as a workbench: system prompt,
  memory file, tool results piling up; compaction; subagents that return one
  paragraph instead of their whole transcript. *Widget: a shelf filling up in
  real time; press compact and a summary replaces the pile; spawn a subagent
  bubble and see one clean line come back.*
- **18 · Guardrails & harnesses** — sandboxes, permission prompts, dry-run
  first, blast-radius gates, verify-before-merge; autonomy as a ladder you
  climb rung by rung. *Widget: a gate simulator — a stream of proposed actions
  with blast sizes; small ones auto-apply in green, a sudden spike freezes as
  a dry-run and escalates for a human GO in gold.*
- **19 · Many hands** — orchestrator/workers, fan-out over a work list,
  adversarial verifiers, judge panels; parallelism's real limits. *Widget: a
  task queue processed by 1 vs 5 workers with a verifier rejecting sloppy
  output — wall-clock race with a quality bar.*
- **20 · Teaching it to behave** — Constitutional AI & RLAIF, deliberative
  alignment, prompt injection and the lethal trifecta (private data + untrusted
  content + exfiltration channel). *Widget: an inbox with a poisoned email;
  toggle a gullible vs hardened agent — one leaks, one refuses and flags the
  injection, highlighted in the text.*

### Part II addendum *(small)*
- **08b · Seeing is tokenizing** — multimodality: an image sliced into 16×16
  patches that enter the *same tower* as word tokens; audio as spectrogram
  frames. *Widget: a little sketch image chopped into patch chips that flow
  into the ch-04 pipeline beside word chips.*

## Navigability commitments

1. Five tabs, all with hover dropdowns (pattern shipped; add entries per part).
2. Landing route map → five cards + a "which hike?" hint line.
3. Pager chain I→II→III→IV→V; every chapter cross-links its prerequisites
   ("attention gets its own chapter", "the KV cache returns in ch 17").
4. Numbering stays global (01-20 + letters) so dropdowns read as one book.
5. One TS module per part (`thinking.ts`, `agents.ts`) compiled by build.sh;
   strict mode; reduced-motion parity for every new widget.

## Build order (each ≈ one session)

1. **Agents core (15-17)** — the loudest gap: the loop, tools/MCP, context
   engineering. Tab + landing card ship here.
2. **Agents hard part (18-20)** — harness/gates, multi-agent, alignment +
   injection playground.
3. **Thinking (11-14)** — reasoning, GRPO, budgets, interpretability.
4. **Trim pass** — 08b multimodal, 10i/10j, field-note refresh, portfolio
   card copy, cross-link sweep, full Playwright + mobile verification.

Est. new material: ~2,300 lines of TS + ~1,400 lines of HTML/prose — roughly
2× today's app, which is the brief.

> **Status:** Part IV (agents, ch 11-16) shipped 2026-07-20. Part V
> (thinking, ch 17-20) shipped 2026-07-20. Book I is complete.

---

# Book II — running a business on graphs + AI *(scoped 2026-07-20)*

The next doubling. Book I taught how the machine works; Book II teaches how
to run an enterprise on top of it — with **graph theory as the chosen data
architecture** (nodes, edges, typed relationships, ontology — the
thessa.space approach), other architectures shown honestly, anti-patterns
showcased by name, and then every Book-I concept (agents, harnesses, fleets,
RAG, verification) applied to the business itself.

Sourcing rule: thessa.space is the worked example — only its *public* face
(knowledge graph of ~11k orgs, typed supply/program edges, provenance-first
verification, hybrid local/cloud model fleet). No internal codenames or
private architecture ever appear in this repo.

### Part VI — the graph *(ch 21-26: data architecture fundamentals)*
- **21 · Everything is a record** — how businesses store truth: relational
  tables, documents, key-value, columns, graphs — same tiny supply-chain
  business rendered five ways. *Widget: one dataset, five shapes; toggle
  through them and watch the same fact change costume.*
- **22 · The join tax** — the relationship question that breaks SQL: "who
  supplies the supplier of my supplier?" *Widget: query race — a hop-count
  slider; join cost explodes combinatorially while the graph walk stays
  linear. First anti-pattern showcased: relationship data forced into rows.*
- **23 · Nodes & edges, done right** — entities vs relationships, typed +
  directed edges, properties on both. *Widget: build-a-graph sandbox with a
  live linter that flags the classics: stringly-typed edges, orphan nodes,
  the god-node, edges-as-nodes.*
- **24 · The ontology** — the vocabulary contract: classes, hierarchies,
  constraints; identity resolution — why "Northrop Grumman Systems Corp"
  must not become a second Northrop node. *Widget: entity-resolution game —
  merge or veto? ticker/LEI conflicts and single-token names are traps.*
- **25 · Provenance, or receipts** — every edge cites a source; confidence
  tiers; contradictions quarantined, never silently deleted; time-travel.
  *Widget: an edge's evidence stack — add a contradicting source and watch
  status shift; drag a bitemporal slider to see the graph as-of a date.*
- **26 · The hall of shame** — the spreadsheet empire, the copy-paste
  warehouse, the data swamp, the god table, the untyped JSON blob store.
  *Widget: spot-the-failure — click the rot in a mini architecture diagram;
  each click reveals the failure mode and its graph-shaped fix.*

### Part VII — the business *(ch 27-31: Book I applied at company scale)*
- **27 · The flywheel** — ch 11 + ch 14, industrialized: extractor agents
  propose edges from documents, verifier agents adjudicate against sources,
  the blast-radius gate applies or escalates, the graph compounds nightly.
  *Widget: a live mini-flywheel growing a graph with confidence-colored
  edges; a bad batch trips the gate.*
- **28 · GraphRAG** — retrieval over structure, not chunks: multi-hop
  questions ("which customers depend on the fab that just flooded?") need
  traversal + synthesis; vanilla RAG visibly fails them. *Widget: same
  question, two retrievers — chunk-RAG grabs near-text and misses; GraphRAG
  walks the edges and lights up the blast-radius subgraph.*
- **29 · The model fleet** — right-size the model to the job: $0 local
  extractors, cheap verifiers, frontier judgment — routing, batching, and
  the cost meter that justifies it. *Widget: a task stream hitting a router;
  cost + quality meters vs the all-frontier baseline.*
- **30 · Humans in the org chart** — graded autonomy at company scale:
  approval lanes, audit ledgers, escalation paths, incident replay — ch 14's
  gate as an operating model, not a demo. *Widget: an org chart where agent
  lanes flow and one gold escalation climbs to the human row.*
- **31 · The modern data department** — the whole stack, end to end:
  sources → pipelines → graph → agents → decisions; build-vs-buy; what to
  do first on Monday. *Widget: the landing pipeline's enterprise sibling —
  an animated end-to-end flow you can poke.*

### Navigation at 7 parts
- Landing becomes two route maps: **Book I — how machines learn** (I-V) and
  **Book II — running a business on it** (VI-VII), each with its own cards.
- Tab bar: keep five Book-I tabs on Book-I pages; Book-II pages carry
  `graph · business` plus a compact `book I ▾` rollup tab (one dropdown
  listing parts I-V). Symmetric rollup (`book II ▾`) appears on Book-I pages
  once VI ships. Dropdown pattern already scales; global chapter numbering
  (01-31) keeps it reading as one library.
- Pager chain continues V → VI → VII.

### Build order
1. **Session ③ (done):** Part V — thinking.
2. **Session ④:** Part VI ch 21-24 (records → join tax → nodes & edges →
   ontology) + Book-II landing section + nav rollup.
3. **Session ⑤:** Part VI ch 25-26 + Part VII ch 27-28 (provenance, hall of
   shame, flywheel, GraphRAG).
4. **Session ⑥:** Part VII ch 29-31 + trim pass (multimodal 08b, engine-room
   10i/10j, field-note refresh, portfolio card, cross-link sweep, full
   re-verification).

Est. Book II: ~2,600 lines TS + ~1,700 lines HTML/prose — the equivalent
depth requested.

> **Status:** Part VI (the graph, ch 21-26) shipped 2026-07-20 with the
> two-book landing and `book II ▾` nav rollup. Part VII (the business,
> ch 27-31) shipped 2026-07-20. **Epilogue (ch 32 — one question traced
> through the whole machine, plus the complete atlas) shipped 2026-07-20:
> the library is closed at 32 chapters.** Remaining: the trim pass
> (multimodal 08b, engine-room 10i/10j, field-note refresh, portfolio
> card update, cross-link sweep).

## Interactivity audit — Tier 1 (shipped 2026-07-20)

A pass over every widget found eleven that were animated-but-not-*driven* —
they played a canned story with no dial the reader could turn. Tier 1 turned
each into a real model:

- **DPO (09b):** β slider now computes the live preference-loss `−log σ(β·Δ)`
  and gradient push once you cast a vote.
- **MoE (10a):** top-k slider (1–4) picks *k* distinct experts per token and
  recomputes active-parameter count.
- **FlashAttention (10e):** tile-size control (2/3/4/6) re-tiles the matrix and
  reports SRAM passes = (N/tile)².
- **Speculative decoding (10f):** γ slider drives the real throughput curve
  `E=(1−α^{γ+1})/(1−α)`, `tok/s = 12·E/(1+cγ)` — it peaks then declines, showing
  the wasted-draft tax.
- **RAG (10h):** top-k slider does genuine k-NN retrieval in fixed design-space
  (chunk coordinates laid out so the true nearest neighbours are the cited ones);
  turning k up visibly drags weaker chunks into the prompt.
- **The loop (11):** "look first / guess blindly" toggle — blind mode skips the
  observation step, hardcodes the answer, and diverges into whack-a-mole.
- **Many hands (15):** crew-size slider (1–6) shows the verifier becoming the
  bottleneck — speedup never matches headcount.
- **Chain of thought (17):** reasoning-steps slider (0–6); accuracy follows
  `1 − 0.7·0.5^steps` (30% guessing → ~99%), and the scratchpad grows to match.
- **Hall of shame (26):** false-alarm penalty — accusing the innocent system of
  record shakes red and scores a strike.
- **The flywheel (27):** verifier-strictness slider — too loose compounds
  misinformation, too strict starves the graph (`accept when rng() > strictness`).
- **The model fleet (29):** smart-routing / all-frontier toggle — helicopter mode
  dumps every errand on the $$$ tier for ~11× the cost.

Verified end-to-end with Playwright (each new control exercised, no JS
exceptions, no 390px overflow).

## Interactivity audit — Tier 2 (shipped 2026-07-21)

The five deeper reworks — each turning a passive animation into a probe:

- **Embeddings (05):** click any word and its genuine k-nearest neighbours light
  up, ranked by Euclidean distance — "who sits nearby" made literal.
- **The autocomplete hero (landing):** a temperature dial that *actually samples*
  the next token (reshaping alone is order-preserving, so we sample and draw the
  reshaped odds); low τ is the confident answer, high τ wanders.
- **Tools & MCP (12):** a free-text keyword **router** — ask about rain → it calls
  `get_weather`, ask for a count → it writes SQL, ask a riddle → it declines and
  answers from memory. Args are extracted from your words.
- **The modern data department (31):** hover/tap any box to inspect its job and
  the chapter it comes from — nine regions, hit-tested in the fixed 880-space.
- **The whole machine (epilogue 32):** three **scenario chips** run different
  questions (supply shock / sole-supplier / tariff) through the same eight
  stations — one machine, different stories in and out.

Verified with Playwright (router routes + declines, NN readout, hover regions,
scenario switch, temperature control, no exceptions, no 390px overflow) and an
adversarial multi-agent review of the diff.
