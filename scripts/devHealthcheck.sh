#!/usr/bin/env bash
# Reports whether the dev servers are up; if either is down, clears stale dev
# processes so a fresh `npm run dev` starts clean.
set -u

serverUrl="http://localhost:2567/health"
clientUrl="http://localhost:3000/"

probe() { curl -fsS -o /dev/null -m 3 "$1"; }

serverOk=false
clientOk=false
probe "$serverUrl" && serverOk=true
probe "$clientUrl" && clientOk=true

status() { if [ "$1" = true ]; then echo "up"; else echo "DOWN"; fi; }
echo "server (2567/health): $(status "$serverOk")"
echo "client (3000):        $(status "$clientOk")"

if [ "$serverOk" = true ] && [ "$clientOk" = true ]; then
  echo "Dev environment healthy."
  exit 0
fi

echo "Something is down. Clearing stale dev processes..."
# Patterns cover the whole `npm run dev` tree: concurrently, the shared
# package's tsc watcher, the tsx server watcher, and the vite client.
# `npm run doctor` never matches these.
pkill -9 -f "concurrently" 2>/dev/null
pkill -9 -f "node_modules/.bin/tsc --watch" 2>/dev/null
pkill -9 -f "tsx watch src/index.ts" 2>/dev/null
pkill -9 -f "node_modules/.bin/vite" 2>/dev/null
pkill -9 -f "npm run dev" 2>/dev/null
sleep 1
echo "Stale processes cleared. Now run: npm run dev"
exit 0
