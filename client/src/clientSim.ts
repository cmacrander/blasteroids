// Client-side prediction/reconciliation for the local ship, plus snapshot
// interpolation for remote entities (see "Simulation and networking" in
// gameDesign.md). The render loop calls tick() every frame; the sim advances
// in the same fixed steps as the server, sends one sequence-numbered input
// per step, and replays unacked inputs whenever an authoritative patch lands.
import type { Room } from "colyseus.js";
import type {
  MatchState,
  PlayerInputMessage,
  ShipMotion,
} from "@blasteroids/shared";
import {
  messageType,
  simulationHz,
  patchHz,
  activation,
  stepShipMotion,
  motionFromBody,
  normalizeAngle,
} from "@blasteroids/shared";

const fixedDt = 1 / simulationHz;
const fixedDtMs = 1000 / simulationHz;

// Cap on how much wall time one tick() call may simulate (e.g. after the tab
// was hidden); anything longer is dropped rather than fast-forwarded.
const maxCatchUpMs = 250;

// Remote entities render this far in the past so two snapshots to
// interpolate between are (almost) always available.
const interpolationDelayMs = 1.5 * (1000 / patchHz);
const snapshotLifetimeMs = 1000;

// Reconciliation corrections ease in rather than snapping: the visible
// offset decays exponentially at this rate (per second) and snaps outright
// past this distance (world units) -- a teleport should look like one.
const offsetDecayRate = 8;
const offsetSnapDistance = 5;

export interface LocalControls {
  engineActivation: number;
  targetAngle: number;
}

interface Snapshot {
  t: number;
  x: number;
  y: number;
  angle: number;
}

export interface RenderPose {
  x: number;
  y: number;
  angle: number;
}

export interface ClientSim {
  controls: LocalControls;
  tick: (nowMs: number) => void;
  localPose: () => RenderPose | null;
  remotePose: (id: string, nowMs: number) => RenderPose | null;
}

export function createClientSim(room: Room<MatchState>): ClientSim {
  const controls: LocalControls = {
    engineActivation: activation.inactive,
    targetAngle: 0,
  };

  let motion: ShipMotion | null = null;
  let pendingInputs: PlayerInputMessage[] = [];
  let nextSeq = 1;
  let accumulatorMs = 0;
  let lastTickAt: number | null = null;
  const offset = { x: 0, y: 0, angle: 0 };

  const snapshots = new Map<string, Snapshot[]>();

  const myShip = () => room.state.players.get(room.sessionId)?.ship;

  // While defragging the server ignores controls entirely; predict the same.
  const effectiveControls = (): LocalControls => {
    const ship = myShip();
    if (ship && ship.defragRemaining > 0 && motion) {
      return {
        engineActivation: activation.inactive,
        targetAngle: motion.angle,
      };
    }
    return controls;
  };

  function tick(nowMs: number): void {
    const ship = myShip();
    if (!ship) {
      motion = null;
      pendingInputs = [];
      lastTickAt = nowMs;
      return;
    }
    motion ??= motionFromBody(ship.body);

    if (lastTickAt !== null) {
      accumulatorMs += Math.min(nowMs - lastTickAt, maxCatchUpMs);
    }
    lastTickAt = nowMs;

    const parts = [...ship.parts.values()];
    while (accumulatorMs >= fixedDtMs) {
      accumulatorMs -= fixedDtMs;
      const input: PlayerInputMessage = {
        seq: nextSeq++,
        engine: controls.engineActivation,
        aim: controls.targetAngle,
      };
      room.send(messageType.playerInput, input);
      pendingInputs.push(input);
      stepShipMotion(motion, parts, effectiveControls(), fixedDt);

      const decay = Math.exp(-offsetDecayRate * fixedDt);
      offset.x *= decay;
      offset.y *= decay;
      offset.angle *= decay;
    }
  }

  // Snap to the server's state and replay inputs it has not yet processed;
  // the difference between the old and new render pose becomes a decaying
  // visual offset so the correction eases in over a few frames.
  function reconcile(): void {
    const player = room.state.players.get(room.sessionId);
    const ship = player?.ship;
    if (!player || !ship) {
      motion = null;
      pendingInputs = [];
      return;
    }
    if (!motion) {
      motion = motionFromBody(ship.body);
      return;
    }

    const before = localPose();
    const corrected = motionFromBody(ship.body);
    pendingInputs = pendingInputs.filter(
      (input) => input.seq > player.lastProcessedInput,
    );
    const parts = [...ship.parts.values()];
    for (const input of pendingInputs) {
      stepShipMotion(
        corrected,
        parts,
        { engineActivation: input.engine, targetAngle: input.aim },
        fixedDt,
      );
    }
    motion = corrected;

    if (before) {
      offset.x = before.x - corrected.x;
      offset.y = before.y - corrected.y;
      offset.angle = normalizeAngle(before.angle - corrected.angle);
      if (Math.hypot(offset.x, offset.y) > offsetSnapDistance) {
        offset.x = 0;
        offset.y = 0;
        offset.angle = 0;
      }
    }
  }

  function recordSnapshots(): void {
    const t = performance.now();
    room.state.players.forEach((player, sessionId) => {
      if (sessionId === room.sessionId || !player.ship) return;
      record(`ship:${sessionId}`, player.ship.body, t);
    });
    room.state.asteroids.forEach((asteroid, id) => {
      record(`asteroid:${id}`, asteroid.body, t);
    });
  }

  function record(
    id: string,
    body: { x: number; y: number; angle: number },
    t: number,
  ): void {
    const list = snapshots.get(id) ?? [];
    list.push({ t, x: body.x, y: body.y, angle: body.angle });
    while (list.length > 0) {
      const oldest = list[0];
      if (!oldest || t - oldest.t <= snapshotLifetimeMs) break;
      list.shift();
    }
    snapshots.set(id, list);
  }

  function localPose(): RenderPose | null {
    if (!motion) return null;
    return {
      x: motion.x + offset.x,
      y: motion.y + offset.y,
      angle: motion.angle + offset.angle,
    };
  }

  function remotePose(id: string, nowMs: number): RenderPose | null {
    const list = snapshots.get(id);
    if (!list || list.length === 0) return null;
    const t = nowMs - interpolationDelayMs;

    const newest = list[list.length - 1];
    if (!newest) return null;
    if (t >= newest.t) return newest;

    for (let i = list.length - 2; i >= 0; i--) {
      const a = list[i];
      const b = list[i + 1];
      if (!a || !b || a.t > t) continue;
      const span = b.t - a.t;
      const f = span > 0 ? (t - a.t) / span : 1;
      return {
        x: a.x + (b.x - a.x) * f,
        y: a.y + (b.y - a.y) * f,
        angle: a.angle + normalizeAngle(b.angle - a.angle) * f,
      };
    }
    const oldest = list[0];
    return oldest ?? null;
  }

  room.onStateChange(() => {
    recordSnapshots();
    reconcile();
  });

  return { controls, tick, localPose, remotePose };
}
