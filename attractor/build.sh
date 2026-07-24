#!/usr/bin/env bash
# The Great Attractor — compile TypeScript sources to per-page bundles.
# Each page bundle = core.ts + its page file, concatenated by tsc --outFile
# (plain scripts, no module system → works from file:// and GitHub Pages alike).
# Mirrors gradient/build.sh. js/ is COMMITTED (see gradient/.gitignore note).
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p js
for page in landing setting; do
  tsc --target es2019 --lib es2019,dom --module none --strict \
      --noUnusedLocals --skipLibCheck \
      --outFile "js/$page.js" src/core.ts "src/$page.ts"
  echo "built js/$page.js"
done

# sidebar drawer toggle (no core; loaded on every page)
tsc --target es2019 --lib es2019,dom --module none --strict \
    --noUnusedLocals --skipLibCheck \
    --outFile js/nav.js src/nav.ts
echo "built js/nav.js"
