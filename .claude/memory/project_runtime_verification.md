---
name: project_runtime_verification
description: How to verify the running app — user views it in a host browser via a sandbox-published port; use npm run doctor to check dev servers
metadata:
  node_type: memory
  type: project
  originSessionId: 38a7f6f0-10fe-4efb-9157-f70728d3996f
---

The user runs the game inside the sandbox (`npm run dev`) and views it from a browser on their host via a published port: `sbx ports ... --publish 3000:3000`. The client is on `:3000`; the Colyseus server is on `:2567` and reached through Vite's `/colyseus` proxy.

No headless browser is installed in the sandbox, and Google sign-in gates the real game view, so I generally cannot screenshot the running app myself — the user is the one who eyeballs it. I CAN verify the server/state path headlessly: hit `POST :2567/matchmake/joinOrCreate/game`, or use a `colyseus.js` client from node to join and read `room.state`.

`npm run doctor` (scripts/devHealthcheck.sh) reports whether `:2567/health` and `:3000` are up and clears stale `npm run dev` processes if either is down.

**Why:** Establishes the division of labor for runtime checks and avoids me claiming "verified" when I've only run static checks.
**How to apply:** For runtime confidence, verify the server/state headlessly and ask the user to confirm the visual, or point them at `npm run doctor` when the dev loop looks broken. Static QA lives in [[feedback_qa_steps]]. Unrelated startup noise: [[project_dev_env_esbuild_noise]].
