---
name: feedback_verification_scope
description: Stop spinning up more temp verification scripts once core behavior is proven via tests and one live check; clean up and summarize instead
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 6784a6dc-2db3-42db-a2fb-e93632f37772
---

Once deterministic unit tests pass and one live smoke check confirms a feature works end-to-end, stop there — don't keep writing additional throwaway debug/verification `.mjs`/`.ts` scripts to chase full certainty on every physics or networking edge case. This session, while trying to nail down an exact ship-vs-kinematic-asteroid collision detail live (after the core mechanic was already proven by tests and one working live check), the user cut in with: "Stop trying to verify behavior with temporary scenarios. Clean up what you've got and summarize."

**Why:** Live scripted-client verification against a real dev server has diminishing returns for edge cases (e.g. a pursuit-curve intercept test that never converges isn't a bug, just a bad test method) and burns time; a deterministic vitest case with controlled setup is the right tool for that level of certainty, not repeated ad-hoc node scripts.
**How to apply:** After the core mechanism is confirmed once (tests green + one live check), stop escalating. If a live verification attempt is inconclusive, don't write a more elaborate script to chase it down — fall back to a deterministic unit test, or just report the inconclusive result and move on. Always clean up temp files (`rm`) promptly rather than leaving several attempts lying around. Related: [[project_runtime_verification]].
