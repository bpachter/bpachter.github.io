#!/usr/bin/env bash
# Gradient — compile TypeScript sources to per-page bundles.
# Each page bundle = core.ts + its page file, concatenated by tsc --outFile
# (plain scripts, no module system → works from file:// and GitHub Pages alike).
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p js
for page in landing foundations language frontier agents thinking graph business epilogue; do
  tsc --target es2019 --lib es2019,dom --module none --strict \
      --noUnusedLocals --skipLibCheck \
      --outFile "js/$page.js" src/core.ts "src/$page.ts"
  echo "built js/$page.js"
done

# standalone "ask about Ben" chat widget (no core; self-injecting; dormant until WORKER_URL set)
tsc --target es2019 --lib es2019,dom --module none --strict \
    --noUnusedLocals --skipLibCheck \
    --outFile js/chat.js src/chat.ts
echo "built js/chat.js"

# sidebar drawer toggle (no core; loaded on every page)
tsc --target es2019 --lib es2019,dom --module none --strict \
    --noUnusedLocals --skipLibCheck \
    --outFile js/nav.js src/nav.ts
echo "built js/nav.js"
