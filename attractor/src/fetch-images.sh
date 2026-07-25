#!/usr/bin/env bash
# fetch-images.sh — bash twin of fetch-images.ps1 (WSL / git-bash / macOS / Linux).
# Downloads the license-cleared telescope/archival photos this site references into
# attractor/img/, under the exact filenames the HTML expects. Several candidate Wikimedia
# Commons titles are tried per image (first that resolves wins); existing files are SKIPPED
# so re-runs never clobber the optimized originals (pass --force to re-fetch). See
# fetch-images.ps1 for the full per-image license/credit list. Run once, then commit img/.
#
#   ./attractor/src/fetch-images.sh            # fetch anything missing
#   ./attractor/src/fetch-images.sh --force    # re-fetch even if the file exists
#
# NOTE: img/hero-bullet.jpg and img/bg-bullet.jpg (the landing photo + its abstract
# fallback) are NOT generic fetch targets — hero-bullet.jpg is a hand-cropped derivative
# of the same source as plate-bullet.jpg (reframed, scale bar cropped out), bg-bullet.jpg
# is original artwork. To regenerate, re-fetch plate-bullet.jpg fresh and ask for a new
# crop rather than adding hero-bullet.jpg here — a plain re-fetch restores the scale bar.
set -uo pipefail

UA='AttractorSiteBot/1.0 (+https://bpachter.github.io/attractor/; portfolio image fetch)'
FORCE=0; [[ "${1:-}" == "--force" ]] && FORCE=1
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
img="$(cd "$here/.." && pwd)/img"; mkdir -p "$img"
echo "Target: $img"

# "out|width|candidate title 1|candidate title 2|..."
targets=(
  "plate-bullet.jpg|1800|1e0657 scale.jpg|Bullet cluster.jpg|1E0657-558.jpg"
  "plate-antennae.jpg|1800|Antennae galaxies xl.jpg|Antennae Galaxies reloaded.jpg|The Antennae Galaxies.jpg"
  "plate-pillars.jpg|1800|Pillars of Creation (NIRCam Image).jpg|Pillars of Creation (NIRCam and MIRI Image).jpg|Pillars 2014 HST denoise.jpg"
  "plate-cluster.jpg|1800|ESO Fornax Galaxy Cluster.jpg|Wide-field view of the Fornax Galaxy Cluster.jpg|The Fornax Galaxy Cluster.jpg|Fornax Cluster.jpg"
  "plate-pandora.jpg|1800|Pandora’s Cluster – Abell 2744.jpg|Abell 2744.jpg|Abell 2744 Hubble Frontier Fields.jpg"
  "plate-einstein.jpg|1100|Albert Einstein 1921 by F Schmutzer - restoration.jpg|Albert Einstein 1921 by F Schmutzer.jpg"
  "plate-leavitt.jpg|1000|Leavitt aavso.jpg|Leavitt henrietta b1.jpg"
  "plate-quasar.jpg|1600|Best image of bright quasar 3C 273.jpg|3C 273.jpg|Quasar 3C 273.jpg"
  "plate-cosmicweb.jpg|1800|Large scale structure of dark matter.jpg|Comparison of normal matter and dark matter's large scale structure.jpg|Dark matter map in the COSMOS field.jpg|3D map of the large-scale distribution of dark matter.jpg"
  "plate-webb.jpg|1800|Webb's First Deep Field.jpg|Webb's First Deep Field (high resolution).jpg|SMACS 0723.jpg"
)

enc() { local s="${1// /_}" o="" c; for ((i=0;i<${#s};i++)); do c="${s:i:1}"
  case "$c" in [a-zA-Z0-9._-]) o+="$c";; *) printf -v h '%%%02X' "'$c"; o+="$h";; esac; done; printf '%s' "$o"; }
sz() { stat -c%s "$1" 2>/dev/null || stat -f%z "$1" 2>/dev/null || echo 0; }

ok=0; skip=0; fail=()
for t in "${targets[@]}"; do
  IFS='|' read -r out width rest <<< "$t"; out="${out}"; IFS='|' read -ra cands <<< "$rest"
  dest="$img/$out"
  if [[ -f "$dest" && $FORCE -eq 0 ]]; then printf '%-22s skip (exists)\n' "$out"; skip=$((skip+1)); continue; fi
  got=0
  for f in "${cands[@]}"; do
    url="https://commons.wikimedia.org/wiki/Special:FilePath/$(enc "$f")?width=$width"
    if curl -fsSL -A "$UA" --max-time 120 -o "$dest" "$url" 2>/dev/null && [[ $(sz "$dest") -ge 4096 ]]; then
      printf '%-22s ok  %6s KB   <- %s\n' "$out" "$(( $(sz "$dest") / 1024 ))" "$f"; got=1; ok=$((ok+1)); break
    else rm -f "$dest"; fi
  done
  [[ $got -eq 0 ]] && { printf '%-22s NOT FOUND (tried %s titles)\n' "$out" "${#cands[@]}"; fail+=("$out"); }
done

echo "$ok fetched, $skip skipped, ${#fail[@]} missing."
(( ${#fail[@]} )) && echo "Missing: ${fail[*]} — copy each exact Commons title into the script and re-run; its plate stays hidden until then."
echo "Next: git add attractor/img && git commit -m 'Attractor: supplemental telescope imagery' && git push"
