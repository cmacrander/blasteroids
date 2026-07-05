# Development Plan

Ordered by priority. Each step should leave the project in a working, runnable state.

## Phase 1: minimal single-player

- [ ] Part-building feature
  - The user can see how many parts they can afford to build: gradations overlaid on supply meter in units of part cost
  - HUD that informs the user of what key strokes will build new parts. Link which keyboard letter is displayed to the configured key bindings (do not build user-changeable settings)
  - On part build, attach new part to the ship. Lasers always face forward, engines always face back. Implement this algorithm as a reusable function that can later be incorporated into defragmentation.
  - Support the case where there is no legal position to attach the new part, and display a warning to the user: user must defragment or build a different part type (do not implement defragmentation yet).
- [ ] Defragmentation
  - Write the pseudocode algorithm as a function and test
  - Decide on ship behavior while defrag is in process (ship drifts, loses power, for some time period? scales with part number?) Should display progress meter on HUD.
- [ ] Client-side prediction and reconciliation
  - Currently unimplemented: `Player.lastProcessedInput` sits in the schema unused, and there's no client-side prediction/replay code at all, despite gameDesign.md calling it out as required for responsive controls (see "Client-side prediction and reconciliation").
  - This is invisible in local dev, where server round-trip is near zero — it'll only show up as a real problem once played over actual network latency. Land it before real playtesting or deployment, not after, or the first real latency test will feel broken with no obvious cause.
  - Sequence-numbered input, replay-on-reconciliation, and easing a corrected position in over a few frames — as specced in gameDesign.md.

## Phase 2: single player with ship combat

- [ ] Entity scale and colliding-entity cap
  - gameDesign.md already specs this (see "Entity scale and colliding-entity cap"): a hard cap on ship parts + rock parts + floating parts, past which new asteroids stop spawning. Not implemented at all yet.
  - Currently nothing bounds entity count. It's not yet a real risk (asteroids replenish 1:1 and nothing produces floating parts), but ship combat above starts creating floating parts, and AI enemies above multiplies ship count — this needs to land before those make entity count actually run away, not after a real match hits the wall.
- [ ] AI enemies
  - gameDesign.md doesn't describe AI enemies anywhere yet — write that section (spawn count/rate, starter ship stats, difficulty curve, target-selection specifics) before or alongside implementing, so design and code don't drift the way they briefly did for Harvesting.
  - Depends on "Ship-to-ship combat" above: "fight other ships" has nothing to fight with until lasers can damage ships.
  - spawn in enemy starter ships
  - prioritize behavior based on what is nearby: (1) fight other ships (2) mine asteroids (3) drift
  - build parts whenever possible, with simple round-robin selections
- [ ] Ship-to-ship combat and part destruction
  - Let lasers damage ship parts, not just asteroid cells. Ships already have one collider per part, so this is a plain raycast against ship colliders, not the asteroid grid-march path (see "Asteroid performance model" in gameDesign.md for why those two are different problems).
  - Implement the 0-HP rule for parts (see "Ship parts" in gameDesign.md): a part always either disappears or detaches into a free-floating part, governed by a configurable probability. `FloatingPart` already exists in the schema but nothing produces one yet.
  - Implement the flood-fill group-cut rule: when destruction disconnects a ship's parts into multiple groups, the group with more core parts survives as the live ship (random tiebreak); every other group's parts are destroyed/detached per the rule above. Reuses/extends the same flood-fill concept called for in "Ship composition."
- [ ] Game over and respawn
  - Detect the loss condition every tick: no core part or no power part remaining (see "Ship composition")
  - On loss: detach the camera, freeze it at the ship's last position, show a "Respawn" button. On click, spawn a fresh starter ship and reattach the camera; the match continues for everyone else.
  - Treat a mid-match disconnect the same as a loss
  - `player.score` already exists in the schema but nothing increments it and nothing displays it. Decide what counts as score (kills? supplies collected? survival time?) before wiring it up — that's a design decision, not just implementation.
- [ ] Scavenging
  - Floating parts retain their velocity and collide with nothing (see "Scavenging" in gameDesign.md)
  - The scavenge key (already bound in Controls) attempts to attach any overlapping floating parts to the player's ship, prioritizing engines at the rear and lasers at the front — same attach logic as part-building below, so build that as one reusable function both features call.

## Phase 3: local multiplayer

- [ ] Local-only auth backdoor
  - To test multiplayer without having to set up many accounts, the developer should be able to log in by just clicking a button. The code should assign a unique arbitrary firebase ID as if the player was authenticated.
  - It should be possible to use different browsers to log in to the game on the same computer to validate multiplayer functionality

## Phase 4: Version 1.0 real multiplayer

- [ ] Deployment
  - `deploy:client`/`deploy:server` npm scripts already exist in package.json, but reference config that doesn't exist yet: there's no `server/fly.toml` and no `firebase.json`/`.firebaserc` at the repo root, so running either script today fails immediately.
  - Provision the actual Fly.io app and Firebase Hosting site, and add the missing config files
  - Handle server-side secrets (Firebase Admin SDK credentials) for the deployed environment — local dev's setup doesn't cover this
  - write script to check health of a remote deployment (same idea as `npm run doctor`, but against the real deployed URLs instead of localhost)
