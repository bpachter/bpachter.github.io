# bpachter.github.io

Source for **[bpachter.github.io](https://bpachter.github.io)** — Benjamin Pachter's
portfolio, plus several of the interactive apps it links to.

## Layout

| Path | What it is |
|---|---|
| `index.html` | The portfolio. One file: inline CSS, markup, and inline JS — no build step, no framework, no dependencies. |
| `case-studies.html` | Longer write-ups of the consulting and utility work. |
| `atlas/` | Current build output of [bpachter/astraea](https://github.com/bpachter/astraea) — governance layer for a knowledge graph. This is what the portfolio links. |
| `astraea/` | Redirect to `atlas/`. It used to serve a second build of the same app, but that build was made from a Git Bash shell, which rewrote Vite's base path to `/Program%20Files/Git/astraea/` — every data request 404'd and the page rendered "No graph instance found". The two bundles differed by 44 bytes, all of it the base path, so it is a redirect rather than a rebuild. |
| `attractor/` | The Great Attractor — interactive tour of the observable universe. |
| `drawdown/` | US natural gas supply and demand model. |
| `graph-ontology/` | Practical guide to knowledge-graph architecture, grounded in IEC CIM. |
| `gradient/` | Interactive course on neural networks. |
| `kernel/` | Python running in the browser, via Pyodide. |
| `resume/` | Source for `BPachterResume.pdf`. Build with `node resume/build.cjs`. Not a published page — deliberately absent from the deploy allow-list. |
| `updraft/` | Data-center waste-heat reuse atlas. |
| `media/` | Screenshots and recordings used by the portfolio. |

Three apps live in their own repositories and deploy themselves:
[entropy](https://github.com/bpachter/entropy),
[nullius](https://github.com/bpachter/nullius) and headroom. Thessa is a
server-rendered application at **[thessa.space](https://thessa.space)** —
source at [bpachter/thessa](https://github.com/bpachter/thessa).

## Deploying

Pushing to `main` runs `.github/workflows/deploy-pages-site.yml`, which builds
`gradient/` and `attractor/` from source, assembles `_site`, and publishes it
with the official Pages action. Settings → Pages → Source must stay on
**GitHub Actions**.

The assemble step is an explicit allow-list and begins with `rm -rf _site`, so
**anything servable must appear in three places**: the `paths:` trigger filter,
the copy step, and the guard loop at the end. A directory missing from the copy
step is not merely un-deployed — the next deploy triggered by any other path
removes it from the live site. `astraea/`, `updraft/` and `media/` went 404
exactly that way.

The guard loop fails the build if a tracked app directory is absent from
`_site`, so the next drift stops the deploy instead of quietly shipping a site
with holes.

## Conventions

- Every app links back to the portfolio, so a visitor is never stranded. For the
  Vite-built apps this anchor lives outside `#root` in the emitted `index.html`,
  which means **a rebuild drops it unless the source carries it too**. That has
  already happened twice.
- Third-party origins stay off the critical path. Fonts are self-hosted from
  `fonts/`; a render-blocking stylesheet from another origin puts a DNS lookup
  and a TLS handshake in front of first paint.
- Numbers shown on the portfolio are hardcoded literals, refreshed by hand from
  the live service they describe. They are not fetched at page load, so **they
  can go stale silently** — when a figure changes, it has to be updated in
  `index.html`, `case-studies.html`, `resume/index.html` and the chat worker's
  grounding block, which are four separate copies of the same truth.
- The single-file `index.html` is deliberate: it loads in one request and stays
  readable without tooling.

## Licence

MIT — see [LICENSE](LICENSE).
