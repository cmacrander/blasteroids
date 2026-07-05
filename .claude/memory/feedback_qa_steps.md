---
name: feedback-qa-steps
description: QA steps required after every code change in blasteroids
metadata:
  node_type: memory
  type: feedback
  originSessionId: f88828d1-2a9d-4a73-b292-dee41f56f720
---

After every code change, always run all three QA steps before reporting done:

1. `npm run eslint` — must pass clean
2. `npm run test` — must pass
3. Apply prettier formatting (`npm run format`)

**Why:** User added these to CLAUDE.md as a hard requirement. Skipping them led to a session where lint errors shipped and had to be fixed in a follow-up turn.

**How to apply:** Run all three after any edit, not just when prompted. Do not declare a task complete until all three pass.
