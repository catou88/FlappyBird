#!/usr/bin/env bash

set -euo pipefail

readonly SCRIPT_NAME="$(basename "$0")"
readonly SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
readonly REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
readonly SCRIPT_PATH="$SCRIPT_DIR/$SCRIPT_NAME"
readonly EXPECTED_SCRIPT_PATH="$REPO_ROOT/$SCRIPT_NAME"

if [[ "$SCRIPT_PATH" != "$EXPECTED_SCRIPT_PATH" ]]; then
  echo "Error: $SCRIPT_NAME must remain at the repository root." >&2
  exit 1
fi

if [[ ! -d "$REPO_ROOT/.git" ]]; then
  echo "Error: refusing to run because $REPO_ROOT is not a standard Git working tree." >&2
  exit 1
fi

if [[ "$(git -C "$REPO_ROOT" branch --show-current)" != "main" ]]; then
  echo "Error: switch to the main branch before running $SCRIPT_NAME." >&2
  exit 1
fi

if ! git -C "$REPO_ROOT" remote get-url origin >/dev/null 2>&1; then
  echo "Error: the repository does not have an origin remote." >&2
  exit 1
fi

echo "Synchronizing with origin/main..."
git -C "$REPO_ROOT" fetch origin main
git -C "$REPO_ROOT" reset --mixed origin/main

echo "Removing local files except $SCRIPT_NAME and root-level SpacetimeDB paths..."
while IFS= read -r -d '' entry; do
  entry_name="$(basename "$entry")"
  case "$entry_name" in
    spacetime*|.spacetime*)
      echo "Preserving SpacetimeDB path: $entry_name"
      continue
      ;;
  esac
  rm -rf -- "$entry"
done < <(
  find "$REPO_ROOT" -mindepth 1 -maxdepth 1 \
    ! -name '.git' \
    ! -name "$SCRIPT_NAME" \
    -print0
)

git -C "$REPO_ROOT" add -A
if ! git -C "$REPO_ROOT" diff --cached --quiet; then
  git -C "$REPO_ROOT" commit -m "Clear repository contents"
fi

echo "Pushing the cleared main branch..."
git -C "$REPO_ROOT" push -u origin main

echo "Deleting remote branches other than main..."
while IFS=$'\t' read -r _ ref; do
  branch="${ref#refs/heads/}"
  if [[ -n "$branch" && "$branch" != "main" ]]; then
    git -C "$REPO_ROOT" push origin --delete "$branch"
  fi
done < <(git -C "$REPO_ROOT" ls-remote --heads origin)

echo "Repository cleared. $SCRIPT_NAME and root-level SpacetimeDB paths remain on main."
