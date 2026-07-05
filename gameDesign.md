# Game Design

## Tech stack

Monorepo with three packages:

- `client/` - Vite + React + TypeScript, served from Firebase Hosting
- `server/` - Colyseus game server + TypeScript, deployed to Fly.io
- `shared/` - game state types and schemas shared by both

Auth is Firebase Auth (Google login). The client authenticates and passes a Firebase ID token when opening a WebSocket connection to Colyseus. The server validates the token using the Firebase Admin SDK. Local dev uses the real Firebase Auth project (not the emulator).

The game server runs the authoritative game loop via Colyseus's `onUpdate(deltaTime)`. Clients receive state diffs automatically. Physics run server-side only using Rapier (Rust/WASM via `@dimforge/rapier2d`). Clients interpolate remote entities and locally predict their own ship for responsive controls. See "Simulation and networking" below for the tick model, prediction, and reconciliation.

The visual layer uses an HTML Canvas 2D context. Each game part has a PNG sprite one unit wide; most are exactly one unit tall, but a sprite may be taller to show an effect extending past the part (e.g. an active/boosted engine's exhaust plume) without changing its collider. The renderer always scales sprite width to one unit and derives height from the image's own aspect ratio, anchoring the sprite's bottom edge (not its center) to the part's position, so extra height trails behind rather than being squeezed into a 1x1 box. Each animation frame, the canvas is cleared and all visible objects are redrawn with `drawImage()` and a rotation transform. HUD, menu, and other interface elements are also handled using the HTML canvas. When the affordances of the DOM are more appropriate for a task, the game uses React.

Tests focus on:

- unit tests of individual functions
- game state tests that set up scenes and evolve the game, asserting things are true on later ticks

## Simulation and networking

### Tick model (fixed timestep)

Colyseus calls `onUpdate(deltaTime)` at a variable rate, but Rapier needs a fixed step for stable, reproducible physics. The server accumulates `deltaTime` and steps Rapier at a fixed simulation rate (start with 60 Hz, i.e. `fixedDt = 1/60 s`), draining the accumulator with as many fixed steps as have elapsed. All per-tick game effects (laser damage, power production, thrust) are computed per fixed step, or scaled by `fixedDt`, so behavior never depends on frame rate.

The network patch rate is decoupled from the simulation rate. The simulation runs at 60 Hz; state is broadcast to clients at Colyseus's patch rate (start with 20 Hz). This keeps physics crisp while bounding bandwidth.

### Client-side prediction and reconciliation

The local player's ship uses client-side prediction so controls feel immediate rather than waiting a round trip:

- The client sends timestamped/sequence-numbered input to the server and immediately applies the same input to a local copy of its ship, simulating forward optimistically.
- Each server state carries the last input sequence number it has processed. On receiving authoritative state, the client snaps its ship to that state and re-applies (replays) any inputs newer than the acknowledged sequence — reconciliation.
- If the corrected position differs from the predicted one, the client eases (smooths) to the correction over a few frames rather than snapping visibly.

All other entities (remote ships, asteroids, free-floating parts) are rendered by interpolating between the two most recent received states. No prediction is applied to them.

### Entity scale and colliding-entity cap

Asteroids are made of many 1-unit rock parts, each a collider, so entity count is the main scaling risk for both Rapier CPU and Colyseus bandwidth. The match enforces a hard cap on the number of colliding entities (ship parts + rock parts + free-floating parts) present at once. When the cap is reached, no new asteroids spawn until destruction frees room. Choose an initial cap conservatively and tune it against measured server load. (Finer-grained interest management — only syncing entities near each player — can come later; the cap is the hard bound for v1.)

### Camera

The camera is stuck to the local player: their ship stays fixed at the center of the screen, and the world scrolls beneath it. Rendering applies a world-to-screen transform that centers on the player's ship position each frame.

### Persistence (deferred)

v1 has no persistence; every match starts fresh. To keep future persistence additive rather than a refactor, two constraints hold now:

- Authoritative state lives in plain, serializable data (the Colyseus schema), so a whole game state can be serialized as-is.
- Match-end resolves through a single "match over" handler — the one place to later push scores or ship definitions to a database keyed by the Firebase user ID.

## Dev workflow

From the repo root:

- `npm run dev` - does a one-shot rebuild of `shared` (plain `tsc`, not watch mode), then starts the Colyseus server (`tsx watch`) and the Vite client (`vite`) via `concurrently`. `shared` is rebuilt on every invocation because `client`/`server` import its compiled `dist` output, not its TypeScript source directly. There is deliberately no continuous `tsc --watch` process: the filesystem this sandbox shares with the host doesn't always deliver file-change events reliably, so a background watcher can silently miss an edit (leaving the server running stale compiled code with no error) or, worse, fire on a phantom change and restart the server mid-session, dropping active connections. Re-run `npm run dev` (or `npm run restart`) after any edit under `shared/src` rather than expecting it to pick up automatically.
- `npm run doctor` - reports whether the server (`:2567`) and client (`:3000`) are up, and whether duplicate dev processes are running (a sign of a stacked/leftover restart). If either check fails, it runs `npm run kill` for you.
- `npm run kill` - force-kills every process `npm run dev` can spawn and clears Vite's dependency cache. Use this any time the dev environment seems broken (e.g. `Uncaught ReferenceError: exports is not defined` in the browser, which is what a stale Vite cache looks like), then run `npm run dev` again for a clean start.
- `npm run restart` - `npm run kill` then `npm run dev`. The standard way to pick up any change under `shared/src` (or anywhere server-side) with certainty. After running it, do a hard refresh of the browser tab too — reconnecting through the app's own UI isn't enough, since a stale WebSocket/room from before the restart can also look like the old code is still running.
- `npm run build` - bundles the client
- `npm test` - runs vitest
- `npm run deploy:client` - deploys client to Firebase Hosting
- `npm run deploy:server` - deploys server to Fly.io

The Colyseus monitor UI is available at `http://localhost:2567/colyseus` during local dev for inspecting rooms and live game state.

## Map

A bounded rectangle, larger than the screen. We'll start with 200 x 200 units (where 1 unit is the size of a square sprite). The edges are solid walls with infinite mass and zero restitution — ships and debris stop dead against them rather than bouncing off.

## Matches and instances

The game is multiplayer via instanced matches, not one shared persistent world. Each match is a Colyseus room with its own map, asteroids, and players.

- By default, clicking "Start Game" places the player into a match by random matchmaking: join an open room with capacity, or create a new one if none is available.
- As a secondary option, a player may type an instance ID to join a specific match (so friends can play together). The room's instance ID is shown in the HUD so it can be shared. Random matchmaking is the v1 target; join-by-ID can come later.
- A per-room player cap bounds entity count and bandwidth (start with a small number, e.g. 8, and tune).

Because matches are instanced and short, nothing persists between matches in v1: every match starts players with one of each part. Cross-match progression (persistent supplies, leaderboards) is out of scope for now and would require a database, which the stack does not yet include.

## Starting the game

- Log in with your Google account using Firebase auth.
- Simple start game screen, which is just a placeholder for future lobby-management.
- The start screen offers "Quick play" (random matchmaking) and an optional field to join a specific instance ID.
- Player sees their new ship in the middle of the screen: 1 of each part (see part definitions below).
- The map is pre-populated by randomly-generated asteroids

## Ships

### Ship parts

A player's ship is made of square parts, where each part is one of these types:

- core
  - consumes constant power
  - increases power efficiency
- power
  - produces constant power
  - has a baseline efficiency rating (starts low, ~25%) so only a portion of produced power is delivered to the ship
- engine
  - consumes power when used by the player
  - has an edge (exhaust) which cannot connect to other parts
  - produces a fixed amount of thrust in the direction of its exhaust
  - has a boost mode that consumes additional power and produces additinoal thrust
  - has a baseline efficiency rating (starts low, ~25%) so only a portion of produced thrust is realized
- laser
  - consumes power when used by the player
  - has an edge (emitting lens) which cannot connect to other parts
  - the emitted laser beam extends a fixed length (in world units) in a straight line from the lens
  - objects whose hitbox the beam intersects take damage every tick
  - has a boost mode that consumes additional power and deals additional damage
  - has a baseline efficiency rating (starts low, ~25%) that limits its damage per tick. Range is fixed, matching the beam's fixed visual length, and does not scale with efficiency.

All ship parts:

- occupy 1 square unit
- have edges which can connect to other parts (3 or 4, see above)
- have mass
- have HP
- when they reach 0 HP, always either disappear (destroyed) or detach from the ship immediately; which of the two happens is governed by a configurable probability, not chance of it happening at all

### Ship composition

A ship is a rigid body: all attached parts share the same linear velocity, angular velocity, and rotation. Rapier computes center of mass and moment of inertia automatically from each part's collider and density.

If a group of attached ship parts becomes separated from another (i.e. a ship is cut in half by a laser), the game does not split the rigid body into two live ships. Instead it picks the group that remains the player's ship and treats every part in the other group(s) as destroyed, following the existing 0-HP rules (each part disappears or detaches into a free-floating, non-colliding part that retains the ship's velocity and can be scavenged). The surviving group is the one with more core parts; if there's a tie, the decision is random. This keeps exactly one rigid body per ship at all times: recomposition only ever adds or removes parts from a single body, never spawns a second live body. Part connectivity is determined by a flood-fill over the adjacency graph, not by Rapier.

If at any time the player's ship does not satisfy basic requirements, they lose the game. The requirements are:

- 1 core part
- 1 power part

### Power budgeting

Core parts are in one of two states: on or off. Cores that are off have no effect on ship efficiency. Each active core beyond the first adds a diminishing-returns bonus to power efficiency (`efficiency = 1 - (1 - baselineEfficiency) ^ activeCoreCount`), so early cores matter more than later ones and efficiency asymptotically approaches 100% as more cores come online.

Laser and engine parts are in one of three states:

- Inactive: consumes no power
- Active: consumes power at a standard rate
- Boosted: consumes power at a higher rate

Cores are only ever checked against instantaneous power generation, never against stored capacitor energy: if generation cannot cover core consumption this tick, cores shut off immediately, with no grace period from the capacitor. Engines and lasers, by contrast, are backed by the capacitor: they draw first from any instantaneous surplus left over after cores, then from stored capacitor charge; sustained engine/laser use beyond that surplus drains the capacitor toward zero. When stored energy reaches zero, engines and lasers stop working even though cores may remain fully powered. The capacitor stores energy up to some limit; once full, additional surplus generation that tick is discarded rather than stored.

Power is allocated to cores before any other parts. Activating engines and lasers cannot deprive core parts of power. If core power consumption exceeds power generation, cores switch off, one at a time, in reverse attach order (the most-recently-attached active core goes first), looping within the same tick until core consumption no longer exceeds generation. This means a sudden generation drop (e.g. losing a power part) never leaves the ship over-drawn for more than the tick it happens in. When excess power generation is greater than the consumption of one core part, one additional core part (if it exists) can be switched back on, in attach order (the earliest-attached inactive core comes back first); only one core is restored per tick, since bringing a core online consumes part of the surplus that justified restoring it, and the situation is re-evaluated the following tick.

It's important that, as a ship becomes damaged, it is always in a functional state. If game constants are set such that the power generated by a single power part is greater than the consumption of a single core part, then any ship with all but one of its power parts destroyed will be able to power at least one core part and still have a positive net generation (if the last power part is destroyed the player loses).

### Game over and respawn

When a player loses their ship (no core or no power part remaining), their camera detaches from the ship and freezes on the map at its last position, and a "Respawn" button appears. Clicking it spawns a fresh starter ship (one of each part) at a valid location in the same match, and the camera re-attaches to it. The match itself continues for everyone else; losing is per-player, not the end of the match.

If a player disconnects mid-match, their ship is handled the same way as a loss (parts left in the world are treated per existing rules). Colyseus reconnection handling for brief drops can be added later.

### Scavenging

Parts which are not connected to any ship (they reached 0 HP and detached) retain their velocity but move without colliding with anything. The player can press a key at any time to capture parts that overlap with their ship. The game code then attempts to attach those parts to the player's ship, if possible, prioritizing engines at the rear and lasers at the front.

At any time the player may choose to "defragment" their ship (default key: tab). The game calculates three possible arrangements of their existing parts, preferring symmetry and engines at the back. The arrangements differ with their placement of lasers and a random factor. For now the most compact candidate (most shared part edges) is applied automatically; a UI to preview the three candidates and select or cancel is deferred.

Defragmentation downtime: engines and lasers switch off and ignore input, the ship drifts on its current velocity with no steering, and it remains collidable and damageable the whole time -- defragging mid-fight is a real risk. The downtime scales with ship size (0.1 s per part, minimum 2 s) and a progress bar is shown on the HUD. The new arrangement is computed at the end of the downtime, not the start, so parts destroyed or built during it are accounted for. Building is still allowed while defragging; power generation and the capacitor keep running.

The defragmentation algorithm runs three times with different random seeds to produce three candidate arrangements:

```
defragment(inventory):
  halfCount[type] = floor(inventory[type] / 2)
  remainder[type] = inventory[type] mod 2

  grid = {}  // (x, y) -> partType, right half only (x > 0)

  // Phase 1: cores — compact cluster, seed just right of center
  place(grid, 1, 0, core)
  repeat halfCount.core - 1:
    place(grid, bestSlot(grid, x > 0), core)

  // Phase 2: power — same compactness rule, bias toward back (low y)
  repeat halfCount.power:
    place(grid, bestSlot(grid, x > 0, biasLowY), power)

  // Phase 3: engines — rearmost open slots (minimum y)
  repeat halfCount.engine:
    place(grid, extremeSlot(grid, x > 0, minY), engine)

  // Phase 4: lasers — frontmost open slots (maximum y)
  repeat halfCount.laser:
    place(grid, extremeSlot(grid, x > 0, maxY), laser)

  // Mirror right half to left half, across the boundary between columns
  // 0 and 1 (NOT across a center column: mirroring x to -x would leave the
  // two halves disconnected, since nothing occupies x = 0)
  for (x, y, type) in grid:
    grid.add(1 - x, y, type)

  // Second pass: odd remainders, anywhere
  for type in [core, power, engine, laser]:
    repeat remainder[type]:
      place(grid, bestSlot(grid, anywhere), type)

  return grid


bestSlot(grid, constraint, bias?):
  candidates = openSlots(grid).filter(constraint)
  sort by adjacencyCount descending, then by bias (e.g. low y first), then random
  return candidates.first()

openSlots(grid):
  all positions not in grid that share an edge with at least one grid position

adjacencyCount(pos, grid):
  count of [N, S, E, W] neighbors of pos that are in grid

extremeSlot(grid, constraint, dimension):
  candidates = openSlots(grid).filter(constraint)
  extreme = min or max of candidates[dimension]
  return randomPick(candidates where dimension == extreme)
```

Implementation notes:

- If halfCount.core == 0, skip the seed and defer to the second pass. Add a general "seed if grid is empty" guard at the start of each phase so the first placed part of any type can anchor the grid.
- Engine and laser orientation is implied by placement position: an engine at the rearmost slot faces south (exhaust = south); a laser at the frontmost slot faces north (lens = north). Store the facing direction explicitly on each placed part so the renderer knows which way to draw the sprite.
- Candidate slots respect the forbidden-edge rule everywhere (including the second pass): no part may be placed in the cell an engine exhaust or laser lens points into, and a placed engine/laser must have its own exhaust/lens cell open.

### Harvesting

The game includes natural asteroids. The map is pre-populated with a field of them at match start, roughly one per 50x50 units of map area. Each has a random roundish shape (4 to 24 rock cells) and drifts at a slow, random constant velocity.

Asteroids are conceptually ships made of "rock" cells (1 square unit, all attached, a defined HP per unit). They can be damaged by lasers. When a rock cell reaches 0 HP it is destroyed, and the player who destroyed it gains "supplies" as a type of currency.

#### Asteroid movement and field replenishment

Asteroids are **kinematic** rigid bodies, not dynamic ones: each is assigned a constant velocity once, at spawn, and drifts by it forever with no forces acting on it. This is also what gives ship-asteroid collisions their one-way behavior for free, straight from the physics engine's body-type semantics, with no custom code needed: a ship colliding with an asteroid is blocked/deflected as if it hit an immovable object, while the asteroid itself is entirely unaffected and keeps its original velocity -- there is no momentum transfer from ships to asteroids.

Because asteroids never bounce off the map's boundary walls (kinematic bodies ignore collision response), the field would otherwise slowly leak out of bounds over the course of a match. To keep the in-map count constant, every time an asteroid either drifts far enough out of bounds to never return, or is fully mined out, it's removed and the field is topped back up to its initial size by new asteroids spawning just outside a random map edge with a velocity aimed back inward. Replenishment is gated by the colliding-entity cap (see "Entity scale and colliding-entity cap"): a replacement only spawns while the largest possible asteroid is guaranteed to fit under the cap, so a match crowded with ship parts and floating parts pauses replenishment and resumes it once destruction frees room. Under the cap this behaves as a direct one-for-one swap, so the total count stays fixed at the initial field size rather than merely trending toward it.

#### Asteroid performance model

Asteroids are many and passive, so unlike ships they are not built from one collider per cell. That would scale collider count with asteroid _area_ and dominate physics cost. Instead each asteroid separates two concerns that a ship's parts conflate:

- **Damage grid** — a logical grid of rock cells, each with HP. This is plain data, not physics. It drives destruction and supplies, exactly like a ship's part graph, but it owns no colliders of its own.
- **Collision shell** — the asteroid's physical shape, built as **perimeter cuboids**: one 1-unit box collider per _boundary_ cell only (a cell with at least one open edge, i.e. missing a N/S/E/W neighbor). Interior cells get no collider because they can never participate in a contact. All cuboids attach to the asteroid's single rigid body as a compound. For a solid k x k asteroid this is ~4k-4 colliders instead of k squared.

The shell is rebuilt event-driven, not per tick: when a cell is destroyed, remove its cuboid (if it had one) and promote any newly-exposed neighbor cells to colliders.

Lasers damage asteroids by a **grid march**, not by hitting per-cell colliders: raycast to the shell to find the entry point, then walk the ray across the asteroid's local grid (DDA / Bresenham) applying per-cell HP loss and awarding supplies cell by cell, up to the beam's remaining range. This keeps damage resolution independent of collider count and gives direct control over how far a beam penetrates.

This split is asteroid-specific. Ships keep one collider per part: they have few parts, are highly dynamic, and need accurate per-part collision for combat carving. Collision at asteroid scale and ship scale are different problems and are handled differently on purpose.

State sync follows the same split: an asteroid is synced as its rigid-body transform plus a compact per-cell representation (HP or an alive/dead bitmask), not as N separate entities.

### Building

With enough supplies, players can add new parts to their ship. There is a dedicated action for adding each type of ship part (see [Controls](#controls)). The new part is attached with the defragmentation rules, as if it was the last part to be attached in the defragmentation algorithm. When the player builds a part, its cost in supplies is deducted from the player's total.

### Ship to ship combat

This should be covered by all the rules above. Lasers can damage other player's ships just like they damage asteroids. Parts detached from their ship can be scavenged by other players. Groups of parts can be carved off ships. Players are always left with the group with the most core parts. When a player loses all their core parts or all their power parts, they lose the game.

## Controls

Keep bindings separate from actions.

| action            | default binding                    |
| ----------------- | ---------------------------------- |
| engines on        | key down: w                        |
| engines boost     | double-tap and hold: w             |
| lasers on         | mouse down: left button            |
| lasers boost      | double-click and hold: left button |
| scavenge          | mouse click: right button          |
| rotate            | mouse position                     |
| build core part   | key: a                             |
| build power part  | key: s                             |
| build engine part | key: d                             |
| build laser part  | key: f                             |
| defragment        | key: tab                           |

## Computer-controlled enemy ships

Matches should always have the name number of ships (configurable, approximately 6-8). When the number of human players is lower than this number, ships are spawned and controlled by the server. When human players join, a computer-controlled ship is despawned to maintain the ship count.

The algorithm for these enemies is intentionally very simple, and more robust AI to control them is deferred.

Computer-controlled ships prioritize behavior based on what is nearby:

1. fight other ships - when within 20 units of another ship, they will choose the closest ship, orient toward it, and fire their lasers and engines.
2. mine asteroids - when within 20 units of an asteroid, they will choose the closest asteroid, orient toward it, and fire their lasers and engines (unless rule 1 takes precedence)
3. inactive - they will drift at current velocity (unless rule 1 or 2 takes precedence)

Computer-controlled ships never use engine boost or laser boost, and they never defragment themselves. They will build parts whenever they have enough supplies to do so, with simple round-robin selections, unless attaching parts becomes impossible.

The code for computer-controlled ships will likely change in future versions of the design.
