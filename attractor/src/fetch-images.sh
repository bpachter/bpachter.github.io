#!/usr/bin/env bash
# fetch-images.sh — bash twin of fetch-images.ps1 (WSL / git-bash / macOS / Linux).
# Drops real, license-cleared telescope photos into attractor/img/ using the exact
# filenames the site's HTML already references. See fetch-images.ps1 for the full
# rationale and the per-image license/credit list. Run once, then commit img/.
#
#   ./attractor/src/fetch-images.sh            # the 5 wired images
#   ./attractor/src/fetch-images.sh --extras   # + Cosmic Cliffs nebula + M87 black hole
set -euo pipefail

UA='AttractorSiteBot/1.0 (+https://bpachter.github.io/attractor/; portfolio image fetch)'
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
img="$(cd "$here/.." && pwd)/img"
mkdir -p "$img"
echo "Target: $img"

# NOTE: fetches full-res ORIGINALS. Committed attractor/img files are web-optimized
# derivatives (downscaled; WMAP re-encoded to plate-cmb.jpg). Images are already in
# git — re-run only to refresh sources, then re-optimize before committing.
# "Commons filename|output name|longest-edge px"
targets=(
  "Webb's First Deep Field.jpg|hero-real.jpg|2200"
  "The Hubble eXtreme Deep Field (eso1633c).jpg|plate-deepfield.jpg|1800"
  "WMAP 2012.png|plate-cmb.png|1800"
  "ESO - Milky Way.jpg|plate-milkyway.jpg|2000"
  "Andromeda Galaxy (with h-alpha).jpg|plate-andromeda.jpg|1800"
)
if [[ "${1:-}" == "--extras" ]]; then
  targets+=(
    "Cosmic Cliffs in the Carina Nebula (NIRCam Image).jpg|plate-nebula.jpg|1800"
    "Black hole - Messier 87 crop.jpg|hero-singularity.jpg|1600"
  )
fi

# URL-encode helper (spaces->underscores, then percent-encode the rest).
enc() { local s="${1// /_}" o="" c; for ((i=0;i<${#s};i++)); do c="${s:i:1}"
  case "$c" in [a-zA-Z0-9._-]) o+="$c";; *) printf -v h '%%%02X' "'$c"; o+="$h";; esac; done; printf '%s' "$o"; }

ok=0; fail=()
for t in "${targets[@]}"; do
  IFS='|' read -r file out width <<< "$t"
  url="https://commons.wikimedia.org/wiki/Special:FilePath/$(enc "$file")?width=$width"
  dest="$img/$out"
  printf '%-22s <- %s\n' "$out" "$file"
  if curl -fsSL -A "$UA" --max-time 120 -o "$dest" "$url" && [[ $(stat -c%s "$dest" 2>/dev/null || stat -f%z "$dest") -ge 4096 ]]; then
    echo "   ok  $(( $(stat -c%s "$dest" 2>/dev/null || stat -f%z "$dest") / 1024 )) KB"; ok=$((ok+1))
  else
    echo "   FAILED"; rm -f "$dest"; fail+=("$out")
  fi
done

echo "$ok of ${#targets[@]} downloaded."
(( ${#fail[@]} )) && echo "Missing: ${fail[*]} — check the exact Commons title and re-run."
echo "Next: git add attractor/img && git commit -m 'Attractor: real telescope imagery' && git push"
