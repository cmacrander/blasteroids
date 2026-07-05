#!/usr/bin/env bash
# Force-kills every process `npm run dev` can spawn (concurrently, the shared
# package's tsc watcher, the tsx server watcher, vite) and clears Vite's
# dependency pre-bundling cache. That cache can go stale after a crash/restart
# cycle (e.g. two dev servers racing over the same port) and serve a broken
# bundle to the browser -- symptom: "Uncaught ReferenceError: exports is not
# defined". Safe to run any time; follow with `npm run dev` for a clean start.
set -u

cd "$(dirname "$0")/.."

pkill -9 -f "concurrently" 2>/dev/null
pkill -9 -f "node_modules/.bin/tsc --watch" 2>/dev/null
pkill -9 -f "tsx watch src/index.ts" 2>/dev/null
# tsx's actual worker is a grandchild with a totally different command line
# (node --require .../tsx/dist/preflight.cjs ...) that the pattern above
# doesn't match -- kill it directly or it survives as an orphan.
pkill -9 -f "tsx/dist/preflight.cjs" 2>/dev/null
pkill -9 -f "node_modules/.bin/vite" 2>/dev/null
# Deliberately no "npm run dev" pattern: it's redundant with "concurrently"
# above (which is the actual, precise process for a running dev session) and
# dangerous -- it matches ANY command line containing that substring,
# including "npm run restart" (which chains ...&& npm run dev at the end),
# self-killing the very script that's trying to start a fresh session.

rm -rf node_modules/.vite client/node_modules/.vite

sleep 1
echo "All dev processes killed and Vite's dependency cache cleared."
echo "Now run: npm run dev"
