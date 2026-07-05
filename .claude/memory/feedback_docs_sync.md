---
name: feedback_docs_sync
description: "Keep gameDesign.md in sync with the actual implementation — audit for drift after building a feature, and remove aspirational/unimplemented language rather than leaving it"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 6784a6dc-2db3-42db-a2fb-e93632f37772
---

After implementing or changing a feature, check whether `gameDesign.md` still accurately describes it, and fix drift proactively. This session: after building the asteroid field (kinematic bodies, spawn/despawn replenishment), the user asked for a review of "Asteroid performance model" against the code and had me add a new subsection describing the actual kinematic-body/replenishment behavior (which the doc didn't cover at all). Separately, the doc's flood-fill/asteroid-splitting language was never implemented (explicitly deferred back when Harvesting was planned) — when asked to reconcile, the instruction was blunt: "Just remove all the non-implemented language," not soften it or mark it as a TODO.

**Why:** The user relies on gameDesign.md as the source of truth for both future sessions and their own planning (see [[project_development_plan]]); stale or aspirational language in it is worse than a gap, since it actively misleads about what exists. Confirmed via `grep` that no flood-fill/splitting code exists anywhere before removing the doc language — verify before editing, don't assume the deferred-plan note is still accurate months later.
**How to apply:** When a design-doc section describes behavior, verify it against the actual code (grep for the relevant function/mechanism) before trusting it. If something was planned but deferred/never built, remove that language entirely rather than hedging — don't leave "if X, do Y" framing for a Y that doesn't exist. When asked to align docs with code, treat it as a two-way check: doc might be behind code (needs additions) or ahead of it (needs deletions), not just one direction.
