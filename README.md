# bpachter.github.io

Source for **[bpachter.github.io](https://bpachter.github.io)** — Benjamin Pachter's
portfolio, plus several of the interactive apps it links to.

## Layout

| Path | What it is |
|---|---|
| `index.html` | The portfolio. One file: inline CSS, markup, and inline JS — no build step, no framework, no dependencies. |
| `case-studies.html` | Longer write-ups of the consulting and utility work. |
| `astraea/` | Build output of [bpachter/astraea](https://github.com/bpachter/astraea) — governance layer for a knowledge graph. |
| `attractor/` | The Great Attractor — interactive tour of the observable universe. |
| `drawdown/` | US natural gas supply and demand model. |
| `gradient/` | Interactive course on neural networks. |
| `kernel/` | Python running in the browser, via Pyodide. |
| `updraft/` | Data-center waste-heat reuse atlas. |
| `media/` | Screenshots and recordings used by the portfolio. |

Two apps live in their own repositories and deploy themselves:
[entropy](https://github.com/bpachter/entropy) and headroom. Thessa is a
server-rendered application at **[thessa.space](https://thessa.space)** —
source at [bpachter/thessa](https://github.com/bpachter/thessa).

## Deploying

Pushing to `main` runs `.github/workflows/deploy-pages-site.yml`, which builds
`gradient/` and `attractor/` from source, assembles `_site`, and publishes it
with the official Pages action. Settings → Pages → Source must stay on
**GitHub Actions**.

The assemble step is an explicit allow-list and begins with `rm -rf _site`, so
**anything servable must appear in two places**: the `paths:` trigger filter and
the copy step. A directory missing from the copy step is not merely
un-deployed — the next deploy triggered by any other path removes it from the
live site. `astraea/`, `updraft/` and `media/` went 404 exactly that way.

A verification step at the end of the assemble now fails the build if a tracked
app directory is absent from `_site`, so the next drift stops the deploy instead
of quietly shipping a site with holes.

## Conventions

- Every app links back to the portfolio, so a visitor is never stranded.
- Numbers shown on the portfolio are read from the live service they describe,
  or they are not shown. Hardcoded metrics go stale silently.
- The single-file `index.html` is deliberate: it loads in one request and stays
  readable without tooling.

## Licence

MIT — see [LICENSE](LICENSE).
