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

### Part IV — thinking *(new: reasoning & test-time compute)*
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

### Part V — agents *(new: the loop and everything around it)*
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
