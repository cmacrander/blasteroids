#!/usr/bin/env bash
# Reports whether the dev servers are up. Also flags duplicate dev processes
# even when both servers respond -- a leftover/stacked restart is the usual
# precursor to Vite's dependency cache going stale (see killDev.sh), so it's
# treated as unhealthy rather than waiting for the symptom to show up in the
# browser. Either condition triggers a full cleanup via killDev.sh.
set -u

cd "$(dirname "$0")/.."

serverUrl="http://localhost:2567/health"
clientUrl="http://localhost:3000/"

probe() { curl -fsS -o /dev/null -m 3 "$1"; }

serverOk=false
clientOk=false
probe "$serverUrl" && serverOk=true
probe "$clientUrl" && clientOk=true

# `npm run dev` spawns exactly one `concurrently` process per invocation, and
# it keeps running even if a child (vite/tsx) is crash-looping on a port
# conflict -- unlike counting vite/tsx workers directly, this doesn't miss a
# stacked second `npm run dev` just because its children haven't settled yet.
concurrentlyCount=$(pgrep -f "node_modules/.bin/concurrently" | wc -l | tr -d ' ')
duplicatesFound=false
if [ "$concurrentlyCount" -gt 1 ]; then
  duplicatesFound=true
fi

status() { if [ "$1" = true ]; then echo "up"; else echo "DOWN"; fi; }
echo "server (2567/health): $(status "$serverOk")"
echo "client (3000):        $(status "$clientOk")"
if [ "$duplicatesFound" = true ]; then
  echo "duplicate processes:  concurrently=$concurrentlyCount (stacked npm run dev instances, likely to corrupt the Vite cache next)"
fi

if [ "$serverOk" = true ] && [ "$clientOk" = true ] && [ "$duplicatesFound" = false ]; then
  echo "Dev environment healthy."
  exit 0
fi

echo "Something is down or duplicated. Cleaning up..."
bash scripts/killDev.sh
exit 0
