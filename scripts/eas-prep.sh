#!/usr/bin/env sh
# Copy the workspace lockfile into the target build directory so CI that runs
# `pnpm install --frozen-lockfile` there can find the lockfile.

set -e

# Target directory where lockfile should be copied. Defaults to current dir.
TARGET_DIR="${1:-.}"

if [ ! -f pnpm-lock.yaml ]; then
  echo "Error: pnpm-lock.yaml not found in repo root. Run this from the repository root." >&2
  exit 1
fi

echo "Copying pnpm-lock.yaml to ${TARGET_DIR}"
mkdir -p "${TARGET_DIR}"
cp pnpm-lock.yaml "${TARGET_DIR}/pnpm-lock.yaml"
echo "Done."
