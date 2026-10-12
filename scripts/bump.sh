#!/usr/bin/env bash
#
# Tag the next release and push it.
#
# Usage:
#   scripts/bump.sh          # vX.Y.Z      -> web + API deploy, and an iOS build
#   scripts/bump.sh web      # web-vX.Y.Z  -> web + API deploy only
#
# Both kinds share one number sequence, so a web-only release still takes the
# next number and the footer, Docker images and App Store versions never
# collide. The deploy workflow triggers on v* and web-v*; Xcode Cloud starts
# only on tags beginning with "v", so web-v* never reaches it. That start
# condition lives in Xcode Cloud, not this repo: if it is ever widened to
# "any tag", web-only releases will build iOS again.
#
set -euo pipefail

KIND="${1:-all}"
case "$KIND" in
  all) PREFIX="v" ;;
  web) PREFIX="web-v" ;;
  *)
    echo "Unknown release kind '$KIND' (expected: all or web)" >&2
    exit 1
    ;;
esac

# Highest number across both tag kinds.
LATEST=$(git tag -l 'v[0-9]*' 'web-v[0-9]*' | sed 's/^web-//' | sort -V | tail -1)
LATEST="${LATEST:-v0.0.0}"
IFS=. read -r MAJOR MINOR PATCH <<<"${LATEST#v}"
SUGGESTED="${PREFIX}${MAJOR}.${MINOR}.$((PATCH + 1))"

echo "Latest version: $LATEST"
if [ "$KIND" = "web" ]; then
  echo "Web and API only: no iOS build."
else
  echo "Web, API and an iOS build."
fi
read -r -p "Next tag [$SUGGESTED]: " TAG
TAG="${TAG:-$SUGGESTED}"

case "$TAG" in
  "$PREFIX"[0-9]*) ;;
  *)
    echo "Tag '$TAG' must start with '$PREFIX' for this release kind" >&2
    exit 1
    ;;
esac

echo "Tagging $TAG..."
git tag "$TAG"
git push
git push origin "$TAG"
echo "Tagged and pushed $TAG"
