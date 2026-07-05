---
name: project_development_plan
description: "developmentPlan.md at repo root tracks prioritized next features; gameDesign.md is the spec, developmentPlan.md is the sequencing"
metadata:
  node_type: memory
  type: project
  originSessionId: 6784a6dc-2db3-42db-a2fb-e93632f37772
---

`developmentPlan.md` (repo root) is a priority-ordered checklist of upcoming features, separate from `gameDesign.md` (the spec of how things should behave once built). As of the session that added it, the order is: ship-to-ship combat & part destruction, client-side prediction/reconciliation, game over & respawn, scavenging, part-building, defragmentation, AI enemies, entity-scale/colliding-entity cap, deployment.

Several items were added after a code-vs-plan-vs-doc audit found real gaps: ships currently take no damage at all (lasers only ever hit asteroids), there's no game-over/respawn/scavenging, client-side prediction is schema-scaffolded (`Player.lastProcessedInput`) but entirely unimplemented, and `deploy:client`/`deploy:server` npm scripts exist but reference config files (`server/fly.toml`, `firebase.json`) that don't exist yet.

**Why:** AI enemies and other later items implicitly depend on ship-to-ship combat existing first ("fight other ships" has nothing to fight with yet) — worth checking dependency order before picking up a later item out of sequence.
**How to apply:** Before starting a feature, check `developmentPlan.md` for its position/dependencies rather than assuming gameDesign.md's section order is the build order. When a gameDesign.md section describes a mechanic with no corresponding code (like AI enemies, which isn't even in gameDesign.md at all), flag the design/code gap explicitly rather than implementing from assumptions — see [[feedback_docs_sync]].
