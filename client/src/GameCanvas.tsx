// Canvas renderer: draws every ship's parts each frame, camera on the local player.
import { useEffect, useRef } from "react";
import type { Room } from "colyseus.js";
import type { MatchState, Part } from "@blasteroids/shared";
import type { BuildRejection } from "@blasteroids/shared";
import {
  partType,
  activation,
  facing,
  mapWidth,
  mapHeight,
  capacitorCapacityFor,
  suppliesCap,
  partBuildCost,
  partTypeNames,
  messageType,
} from "@blasteroids/shared";
import { keyBindings, bindingLabel } from "./keyBindings";
import type { ClientSim } from "./clientSim";

const pixelsPerUnit = 40; // screen pixels per world unit (one part is one unit)

// Engine/laser sprites while active/boosted are taller than one unit: they
// include an exhaust plume or beam extending past the part. Other sprites
// are plain 1x1 tiles.
const spriteUrls = {
  core: "/sprites/core.png",
  power: "/sprites/power.png",
  engine: "/sprites/engine.png",
  engineActive: "/sprites/engineActive.png",
  engineBoosted: "/sprites/engineBoosted.png",
  laser: "/sprites/laser.png",
  laserActive: "/sprites/laserActive.png",
  laserBoosted: "/sprites/laserBoosted.png",
  rock: "/sprites/rock.png",
} as const;
type SpriteKey = keyof typeof spriteUrls;
const spriteKeys: SpriteKey[] = [
  "core",
  "power",
  "engine",
  "engineActive",
  "engineBoosted",
  "laser",
  "laserActive",
  "laserBoosted",
  "rock",
];

// The plume/beam only makes sense to show if the part is both requesting
// that activation and actually receiving power this tick (see power
// budgeting). Instant on/off by design -- no fade in/out.
function spriteKeyFor(part: Part): SpriteKey {
  if (part.partType === partType.engine) {
    if (part.powered && part.activation === activation.boosted)
      return "engineBoosted";
    if (part.powered && part.activation === activation.active)
      return "engineActive";
    return "engine";
  }
  if (part.partType === partType.laser) {
    if (part.powered && part.activation === activation.boosted)
      return "laserBoosted";
    if (part.powered && part.activation === activation.active)
      return "laserActive";
    return "laser";
  }
  if (part.partType === partType.core) return "core";
  return "power";
}

// Canonical sprites face north; this rotates each part to its stored facing.
const facingRadians: Record<number, number> = {
  [facing.north]: 0,
  [facing.east]: -Math.PI / 2,
  [facing.south]: Math.PI,
  [facing.west]: Math.PI / 2,
};

// Free-floating parts always draw as the plain (inactive) sprite.
function floatingSpriteKey(type: number): SpriteKey {
  if (type === partType.power) return "power";
  if (type === partType.engine) return "engine";
  if (type === partType.laser) return "laser";
  return "core";
}

// Two depth layers of stars, fixed in world space so they scroll as the camera moves.
// A parallax factor below 1 makes the far layer appear to drift slower than the near one.
interface StarLayer {
  cellSize: number;
  parallax: number;
  density: number;
  sizeRange: readonly [number, number];
  alphaRange: readonly [number, number];
}

const starLayers: StarLayer[] = [
  {
    cellSize: 4,
    parallax: 0.4,
    density: 0.5,
    sizeRange: [0.5, 1],
    alphaRange: [0.2, 0.5],
  },
  {
    cellSize: 3,
    parallax: 1,
    density: 0.35,
    sizeRange: [1, 2],
    alphaRange: [0.5, 1],
  },
];

// Deterministic pseudo-random value in [0, 1) for a grid cell, so stars need no stored state.
function hash2(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function drawStarfield(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  camX: number,
  camY: number,
) {
  const halfWidthUnits = canvasWidth / 2 / pixelsPerUnit;
  const halfHeightUnits = canvasHeight / 2 / pixelsPerUnit;

  for (const layer of starLayers) {
    const layerCamX = camX * layer.parallax;
    const layerCamY = camY * layer.parallax;
    const toLayerScreenX = (wx: number) =>
      (wx - layerCamX) * pixelsPerUnit + canvasWidth / 2;
    const toLayerScreenY = (wy: number) =>
      -(wy - layerCamY) * pixelsPerUnit + canvasHeight / 2;

    const minCellX =
      Math.floor((layerCamX - halfWidthUnits) / layer.cellSize) - 1;
    const maxCellX =
      Math.ceil((layerCamX + halfWidthUnits) / layer.cellSize) + 1;
    const minCellY =
      Math.floor((layerCamY - halfHeightUnits) / layer.cellSize) - 1;
    const maxCellY =
      Math.ceil((layerCamY + halfHeightUnits) / layer.cellSize) + 1;

    for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
      for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
        if (hash2(cellX, cellY) > layer.density) continue;

        const worldX = (cellX + hash2(cellX + 0.5, cellY)) * layer.cellSize;
        const worldY = (cellY + hash2(cellX, cellY + 0.5)) * layer.cellSize;
        const [minSize, maxSize] = layer.sizeRange;
        const radius =
          minSize + hash2(cellX + 0.25, cellY + 0.75) * (maxSize - minSize);
        const [minAlpha, maxAlpha] = layer.alphaRange;
        const alpha =
          minAlpha + hash2(cellX + 0.75, cellY + 0.25) * (maxAlpha - minAlpha);

        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(
          toLayerScreenX(worldX),
          toLayerScreenY(worldY),
          radius,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
  }

  ctx.globalAlpha = 1;
}

// Fixed screen-space HUD bars: capacitor charge and, beside it, supplies.
const hudBarWidth = 20;
const hudBarHeight = 120;
const hudBarMargin = 20;

function drawVerticalBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  fraction: number,
  fillColor: string,
) {
  const fillHeight = hudBarHeight * fraction;

  ctx.globalAlpha = 1;
  ctx.fillStyle = fillColor;
  ctx.fillRect(x, y + hudBarHeight - fillHeight, hudBarWidth, fillHeight);

  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, hudBarWidth, hudBarHeight);
}

// Tick lines across a bar at every multiple of stepFraction, so the player
// can read the bar in units (the supplies bar: one gradation per part cost).
function drawBarGradations(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  stepFraction: number,
) {
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.5;
  for (let f = stepFraction; f < 1; f += stepFraction) {
    const lineY = y + hudBarHeight - hudBarHeight * f;
    ctx.beginPath();
    ctx.moveTo(x, lineY);
    ctx.lineTo(x + hudBarWidth, lineY);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// Build-key hints beside the supplies bar, dimmed while unaffordable. The
// key letters come from keyBindings so they always match the real controls.
const buildHints = [
  { binding: keyBindings.buildCore, type: partType.core },
  { binding: keyBindings.buildPower, type: partType.power },
  { binding: keyBindings.buildEngine, type: partType.engine },
  { binding: keyBindings.buildLaser, type: partType.laser },
];

function drawBuildHints(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  supplies: number,
) {
  const lineHeight = 18;
  ctx.font = "14px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  buildHints.forEach((hint, index) => {
    const name = partTypeNames[hint.type] ?? "part";
    ctx.globalAlpha = supplies >= partBuildCost ? 1 : 0.35;
    ctx.fillStyle = "#fff";
    ctx.fillText(
      `${bindingLabel(hint.binding)} ${name}`,
      x,
      y + hudBarHeight - (buildHints.length - 1 - index) * lineHeight,
    );
  });
  ctx.globalAlpha = 1;
  ctx.fillText(
    `${bindingLabel(keyBindings.defragment)} defrag`,
    x,
    y + hudBarHeight + lineHeight,
  );
}

// Defrag progress, drawn as a horizontal bar just above the (screen-centered)
// local ship while its downtime runs.
function drawDefragProgress(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  fraction: number,
) {
  const width = 120;
  const height = 10;
  const x = canvasWidth / 2 - width / 2;
  const y = canvasHeight / 2 - 80;

  ctx.globalAlpha = 1;
  ctx.fillStyle = "#0f8";
  ctx.fillRect(x, y, width * fraction, height);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, width, height);

  ctx.font = "12px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillStyle = "#fff";
  ctx.fillText("defragmenting...", canvasWidth / 2, y - 4);
}

// A transient center-screen warning (e.g. a rejected build).
interface HudWarning {
  text: string;
  expiresAt: number;
}

const warningDurationMs = 3000;

function buildRejectionText(rejection: BuildRejection): string {
  const name = partTypeNames[rejection.partType] ?? "part";
  if (rejection.reason === "unaffordable")
    return `Not enough supplies to build a ${name}`;
  return `No room to attach a ${name} - defragment or build a different part`;
}

// A world-space explosion burst, drawn as a growing-then-fading ring rather
// than a sprite -- purely local, no asset needed, and easing size/alpha over
// its lifetime reads as an impact flash on its own.
interface Explosion {
  x: number;
  y: number;
  spawnedAt: number;
}

const explosionLifetimeMs = 350;
const explosionMaxRadius = 18; // screen pixels

function drawExplosion(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  age: number,
) {
  const progress = age / explosionLifetimeMs;
  const radius = explosionMaxRadius * Math.sin(progress * (Math.PI / 2));
  const alpha = 1 - progress;

  const gradient = ctx.createRadialGradient(
    screenX,
    screenY,
    0,
    screenX,
    screenY,
    radius,
  );
  gradient.addColorStop(0, `rgba(255, 255, 220, ${alpha.toString()})`);
  gradient.addColorStop(0.5, `rgba(255, 150, 40, ${(alpha * 0.8).toString()})`);
  gradient.addColorStop(1, "rgba(255, 60, 0, 0)");

  ctx.globalAlpha = 1;
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
  ctx.fill();
}

interface Props {
  // room and sim are absent in the dev render harness, which mocks the match
  // state locally: without them there are no server messages, no prediction,
  // and no interpolation -- everything draws from the raw state.
  room?: Room<MatchState> | undefined;
  state: MatchState;
  sessionId: string;
  sim?: ClientSim | undefined;
}

export function GameCanvas({ room, state, sessionId, sim }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const explosionsRef = useRef<Explosion[]>([]);
  const warningRef = useRef<HudWarning | null>(null);
  // Where the camera last sat: when the ship is lost, the camera freezes
  // here instead of jumping away (see "Game over and respawn").
  const lastCamRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!room) return;
    room.onMessage(
      messageType.spawnExplosion,
      (spawns: { x: number; y: number }[]) => {
        const now = performance.now();
        for (const spawn of spawns) {
          explosionsRef.current.push({ ...spawn, spawnedAt: now });
        }
      },
    );
    room.onMessage(messageType.buildRejected, (rejection: BuildRejection) => {
      warningRef.current = {
        text: buildRejectionText(rejection),
        expiresAt: performance.now() + warningDurationMs,
      };
    });
    // colyseus.js has no per-type listener removal; harmless to leave
    // attached for the room's lifetime, which matches this component's.
  }, [room]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const images: Record<SpriteKey, HTMLImageElement> = {
      core: new Image(),
      power: new Image(),
      engine: new Image(),
      engineActive: new Image(),
      engineBoosted: new Image(),
      laser: new Image(),
      laserActive: new Image(),
      laserBoosted: new Image(),
      rock: new Image(),
    };
    for (const key of spriteKeys) {
      images[key].src = spriteUrls[key];
    }

    let animId: number;

    const draw = () => {
      const now = performance.now();
      sim?.tick(now);

      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Camera follows the local player's predicted ship pose; fall back to
      // the raw state, then the map centre.
      const myPlayer = state.players.get(sessionId);
      const myShip = myPlayer?.ship;
      const myPose = sim?.localPose() ?? (myShip ? myShip.body : null);
      if (myPose) lastCamRef.current = { x: myPose.x, y: myPose.y };
      const cam = myPose ?? lastCamRef.current;
      const camX = cam ? cam.x : mapWidth / 2;
      const camY = cam ? cam.y : mapHeight / 2;

      // World +y is north; screen y grows downward, so the y axis is flipped.
      const toScreenX = (wx: number) =>
        (wx - camX) * pixelsPerUnit + canvas.width / 2;
      const toScreenY = (wy: number) =>
        -(wy - camY) * pixelsPerUnit + canvas.height / 2;

      drawStarfield(ctx, canvas.width, canvas.height, camX, camY);

      ctx.strokeStyle = "#333";
      ctx.lineWidth = 2;
      ctx.strokeRect(
        toScreenX(0),
        toScreenY(mapHeight),
        mapWidth * pixelsPerUnit,
        mapHeight * pixelsPerUnit,
      );

      state.players.forEach((player, playerSessionId) => {
        const ship = player.ship;
        if (!ship) return;
        // The local ship draws at its predicted pose, remote ships at their
        // interpolated (slightly past) pose; raw state is the fallback.
        const pose =
          (playerSessionId === sessionId
            ? sim?.localPose()
            : sim?.remotePose(`ship:${playerSessionId}`, now)) ?? ship.body;
        const angle = pose.angle;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        ship.parts.forEach((part) => {
          const image = images[spriteKeyFor(part)];
          if (!image.complete || image.naturalWidth === 0) return;

          // Rotate the part's local offset into world space, then to screen.
          const worldX = pose.x + part.offsetX * cos - part.offsetY * sin;
          const worldY = pose.y + part.offsetX * sin + part.offsetY * cos;
          const orientation = angle + (facingRadians[part.facing] ?? 0);

          // Sprites are always exactly one unit wide; taller ones (like an
          // engine's exhaust plume) extend past the part's south edge rather
          // than being centered, so the extra height reads as trailing behind
          // the nozzle instead of being squeezed to fit a 1x1 box.
          const destWidth = pixelsPerUnit;
          const destHeight =
            pixelsPerUnit * (image.naturalHeight / image.naturalWidth);

          ctx.save();
          ctx.translate(toScreenX(worldX), toScreenY(worldY));
          ctx.rotate(-orientation);
          ctx.globalAlpha = part.powered ? 1 : 0.6;
          ctx.drawImage(
            image,
            -destWidth / 2,
            pixelsPerUnit / 2 - destHeight,
            destWidth,
            destHeight,
          );
          ctx.restore();
        });
      });

      state.asteroids.forEach((asteroid, asteroidId) => {
        const image = images.rock;
        if (!image.complete || image.naturalWidth === 0) return;

        const pose =
          sim?.remotePose(`asteroid:${asteroidId}`, now) ?? asteroid.body;
        const angle = pose.angle;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        asteroid.cells.forEach((hp, index) => {
          if (hp <= 0) return;
          const col = index % asteroid.gridWidth;
          const row = Math.floor(index / asteroid.gridWidth);
          const localX = asteroid.originX + col;
          const localY = asteroid.originY + row;
          const worldX = pose.x + localX * cos - localY * sin;
          const worldY = pose.y + localX * sin + localY * cos;

          ctx.save();
          ctx.translate(toScreenX(worldX), toScreenY(worldY));
          ctx.rotate(-angle);
          ctx.drawImage(
            image,
            -pixelsPerUnit / 2,
            -pixelsPerUnit / 2,
            pixelsPerUnit,
            pixelsPerUnit,
          );
          ctx.restore();
        });
      });

      // Detached parts drift free until scavenged; drawn dimmer than a live
      // ship part so they read as debris.
      state.floatingParts.forEach((floating, floatingId) => {
        const image = images[floatingSpriteKey(floating.partType)];
        if (!image.complete || image.naturalWidth === 0) return;

        const pose =
          sim?.remotePose(`float:${floatingId}`, now) ?? floating.body;
        const orientation = pose.angle + (facingRadians[floating.facing] ?? 0);

        ctx.save();
        ctx.translate(toScreenX(pose.x), toScreenY(pose.y));
        ctx.rotate(-orientation);
        ctx.globalAlpha = 0.7;
        ctx.drawImage(
          image,
          -pixelsPerUnit / 2,
          -pixelsPerUnit / 2,
          pixelsPerUnit,
          pixelsPerUnit,
        );
        ctx.restore();
      });
      ctx.globalAlpha = 1;

      explosionsRef.current = explosionsRef.current.filter((explosion) => {
        const age = now - explosion.spawnedAt;
        if (age >= explosionLifetimeMs) return false;
        drawExplosion(ctx, toScreenX(explosion.x), toScreenY(explosion.y), age);
        return true;
      });

      if (myShip) {
        const barY = canvas.height - hudBarMargin - hudBarHeight;
        const energyFraction = Math.min(
          1,
          Math.max(0, myShip.storedEnergy / capacitorCapacityFor(myShip)),
        );
        drawVerticalBar(ctx, hudBarMargin, barY, energyFraction, "#0cf");

        const suppliesFraction = Math.min(
          1,
          Math.max(0, myPlayer.supplies / suppliesCap),
        );
        const suppliesBarX = hudBarMargin * 2 + hudBarWidth;
        drawVerticalBar(ctx, suppliesBarX, barY, suppliesFraction, "#fc0");
        drawBarGradations(ctx, suppliesBarX, barY, partBuildCost / suppliesCap);
        drawBuildHints(
          ctx,
          suppliesBarX + hudBarWidth + 10,
          barY,
          myPlayer.supplies,
        );

        if (myShip.defragRemaining > 0 && myShip.defragTotal > 0) {
          drawDefragProgress(
            ctx,
            canvas.width,
            canvas.height,
            1 - myShip.defragRemaining / myShip.defragTotal,
          );
        }
      }

      if (myPlayer) {
        ctx.font = "16px monospace";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillStyle = "#fff";
        ctx.fillText(
          `score ${String(myPlayer.score)}`,
          hudBarMargin,
          hudBarMargin,
        );
      }

      const warning = warningRef.current;
      if (warning) {
        if (performance.now() >= warning.expiresAt) {
          warningRef.current = null;
        } else {
          ctx.font = "16px monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillStyle = "#f80";
          ctx.fillText(warning.text, canvas.width / 2, canvas.height * 0.25);
        }
      }

      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animId);
    };
  }, [state, sessionId, sim]);

  return <canvas ref={canvasRef} style={{ display: "block" }} />;
}
