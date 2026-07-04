# Development Plan

Ordered by priority. Each step should leave the project in a working, runnable state.

## Scaffolding

- [x] Monorepo initialized: `client/`, `server/`, `shared/` packages with `tsconfig`, `eslint`, `prettier`, and root `package.json` wiring up `npm run dev`, `npm test`, and `npm run build`
- [x] Server starts and responds 200 on a health check route
- [x] Client loads a blank page in the browser via Vite

## Server-client connection

- [x] Client opens a WebSocket connection to the Colyseus server
- [x] Server sends "hello world" to the client; client displays it on screen

## Auth

- [ ] Firebase project created and configured (client receives Firebase config)
- [ ] User can sign in with Google and see their email address on screen
- [ ] User can sign out

## Game shell

- [ ] Signed-in user sees a start game screen with a "Quick play" button
- [ ] Define the match room with a player cap (e.g. 8) so matches are instanced, not one shared world
- [ ] "Quick play" uses Colyseus `joinOrCreate` (random matchmaking): join an open room or create one
- [ ] Client joins the room and sees an empty canvas (map boundary visible, nothing else)
- [ ] Room's instance ID is shown in the HUD (so it can be shared)
- [ ] (Later) Start screen offers a field to join a specific instance ID via `joinById`

## Shared state schema

- [ ] Define the Colyseus schema in `shared/`: the client/server contract for entities and their fields (part type, local offset within the ship, facing, HP, powered flag) plus each body's transform and velocity, and per-player fields (score, input sequence number)
- [ ] Keep state as plain serializable data so a whole match can be serialized later without refactoring (persistence hook)

## Ship rendering

- [ ] Server spawns a starter ship when a player joins a room
- [ ] Client receives ship state and renders the ship sprite on the canvas
- [ ] Camera is stuck to the local player: their ship stays centered and the world scrolls beneath it (world-to-screen transform centered on the ship)

## Physics

- [ ] Rapier initialized server-side (await WASM init before the game loop starts); starter ship has a rigid body (sits still under gravity-free conditions)
- [ ] Fixed-timestep stepping: accumulate Colyseus `deltaTime` and step Rapier at a fixed rate (start 60 Hz); decouple the network patch rate (start 20 Hz) from the simulation rate
- [ ] Walls at map edges are static Rapier colliders; ship bounces off them
- [ ] (When asteroids arrive) enforce a hard cap on colliding entities per match; stop spawning when the cap is reached

## Controls

- [ ] Client captures keyboard input (arrow keys or WASD) and sends it to the server with a sequence number
- [ ] Server applies rotation to the ship rigid body in response to left/right input
- [ ] Server applies thrust in the ship's forward direction in response to up input
- [ ] Server echoes the last processed input sequence number in state
- [ ] Client predicts its own ship locally from input, then reconciles: snap to authoritative state and replay unacknowledged inputs, easing to any correction
- [ ] Client interpolates remote entities between received states so their motion looks smooth
- [ ] User can steer the ship around the empty map with responsive, low-latency controls

## First asteroid

- [ ] On load, the player has their starter ship and the map contains exactly one asteroid
- [ ] Asteroid uses the damage-grid / collision-shell split: a logical grid of rock cells (HP) plus a perimeter-cuboid collision shell on one rigid body
- [ ] Client renders the asteroid from its synced transform and per-cell state; ship collides with it (bounces off the shell)
