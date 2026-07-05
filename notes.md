Hi Claude. We have a partially done browser game here. I'd like you to finish phases 1, 2, and 3 in developmenetPlan.md. The descriptive files here (CLAUDE.md, gameDesign.md, developmentPlan.md) have some good
  detail, but of course they're not perfect. I'd like to spend one or two turns answering any questions you have about what to do, and then let you work for awhile. Once you're off and running, I'd like you to
  be as self-sufficient as possible, while also being efficient with your time (Fable tokens are expensive!). Examine the project now and queue up questions you have for me.

---

## Tuning notes

Show efficiency on the HUD
Cores are OP. They should either be more expensive, or provide less benefit.
Engines are OP. Increase mass of parts.
Ship shapes are too boring. Draw some cooler ones and use them as seeds. Extra parts can be attached.
Ship parts have too much HP. Reduce by a bit... 25% less?
AI enemies should switch to avoidance when they have no lasers.
build keys to: 1, 2, 3, 4

Core parts are still OP
Many engines on big ships OP?
Scavenging is fun, raise detachment prob

--
  We're mid-project on Blasteroids. Read CLAUDE.md, gameDesign.md, and developmentPlan.md first — they
  are current and accurate; the design doc has been kept in sync with the code throughout. Recent git
  history shows one commit per completed feature, each a runnable state.
  
  Where things stand: Phases 1 and 2 of developmentPlan.md are complete except Scavenging, and AI
  enemies are done (checkboxes in the plan are up to date). 118 tests pass, eslint is clean. The
  remaining work, in order:

  1. Scavenging — right-mouse-click attempts to attach floating parts that overlap the player's ship.
  Almost everything exists already: FloatingParts spawn from combat, drift, and render; the attach
  rule is chooseAttachSlot in shared/src/partPlacement.ts (same function building uses — call it per
  scavenged part, engines rearmost/lasers frontmost); attached parts get the floating part's hp,
  physics via addShipPartCollider in server/src/physicsWorld.ts. Overlap test: floating part position
  within ~1 unit of any ship-part world position (ships are small; brute force is fine). Add a
  scavenge message type, a client mousedown handler (right button = 2, preventDefault contextmenu),
  and remove claimed parts from state.floatingParts.
  2. Local auth backdoor (Phase 3) — a dev-only login button (shown when import.meta.env.DEV) that
  skips Google sign-in with a fabricated unique UID so multiple browsers can join one match locally.
  Note the server does not validate Firebase tokens at all yet (that's deferred to Phase 4
  deployment), so this is client-side only: client/src/App.tsx gates everything on Firebase
  onAuthStateChanged — the backdoor needs to bypass that gate, not the server.
  
  Working agreements from this project's owner:
  - QA trio before every commit: npm run eslint, npm run test, npm run format. All must pass. Run npm 
  run build --workspace=shared before tests whenever shared/src changed (tests import the compiled
  dist).
  - Commit per feature with a runnable state. Keep gameDesign.md synced with behavior changes in the
  same commit — remove aspirational language rather than hedging.
  - After any shared/ or server/ edit, the running dev stack needs npm run restart and the user needs
  a hard browser refresh (file watchers are unreliable on this mount — see memory).
  - Headless runtime verification: write a scripted colyseus.js client to a *.tmp.mjs file at the repo
  root (node module resolution fails from the scratchpad), run it, delete it. One live smoke check
  per feature is enough — don't chase edge cases with throwaway scripts; use vitest for those. The
  user eyeballs visuals via a published port.
  - The Vite "failed to load config / Could not resolve vite.config.ts" error at dev startup is benign
  sandbox noise; ignore it. npm run doctor checks server/client health.
  
  Architecture orientation (beyond the docs): shared/src/partPlacement.ts (attach rules), defrag.ts,
  shipSim.ts + rotationControl.ts (pure sim used by client prediction), connectivity.ts (flood fill).
  Client: clientSim.ts (prediction/reconciliation/interpolation), GameCanvas.tsx (renderer + HUD),
  keyBindings.ts (central bindings — HUD hints derive from it). Server: gameRoom.ts orchestrates;
  physicsWorld.ts owns all Rapier state including collider→part registries; shipDamage.ts
  (detach/destroy roll + group cut); botController.ts (bot decisions, population managed in
  gameRoom.tickBots).
  
  Work self-sufficiently; ask only if a genuine design decision is unspecified.