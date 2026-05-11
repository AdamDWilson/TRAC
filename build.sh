#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

# Build environment label — overridden by CI (test or production).
ENV="${BUILD_ENV:-local}"

rm -rf dist
mkdir -p dist

# Each top-level tool dir gets mirrored into dist/, allowlisted by extension.
# Add a new tool? Add its directory to this list.
TOOLS=(template-letters)

# Allowlist of file patterns to publish. Add a new extension here when needed.
# */ lets rsync descend into subdirectories; */ alone copies no files.
INCLUDES=(
  '*/'
  '*.html'
  '*.css'
  '*.js'
  '*.json'
  '*.letter.md'
)

for tool in "${TOOLS[@]}"; do
  mkdir -p "dist/$tool"
  rsync -a --prune-empty-dirs \
    "${INCLUDES[@]/#/--include=}" \
    --exclude='*' \
    "$tool/" "dist/$tool/"
done

# Build-info: served at /tools/build-info.txt so the integrator (and you) can
# always tell what is deployed.
timestamp="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
sha="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
ref="$(git describe --tags --exact-match 2>/dev/null \
       || git symbolic-ref --short HEAD 2>/dev/null \
       || git rev-parse --short HEAD 2>/dev/null \
       || echo unknown)"

cat > dist/build-info.txt <<EOF
Build: $timestamp
Ref:   $ref
SHA:   $sha
Env:   $ENV
EOF

echo "Built dist/ from: ${TOOLS[*]} (env=$ENV, ref=$ref, sha=$sha)"
