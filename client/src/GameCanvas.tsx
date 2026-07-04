// Canvas renderer: draws every ship's parts each frame, camera on the local player.
import { useEffect, useRef } from "react";
import type { MatchState, Part } from "@blasteroids/shared";
import {
  partType,
  activation,
  facing,
  mapWidth,
  mapHeight,
  capacitorCapacity,
} from "@blasteroids/shared";

const pixelsPerUnit = 40; // screen pixels per world unit (one part is one unit)

// Engine sprites while active/boosted are taller than one unit: they include an
// exhaust plume extending past the nozzle. Non-engine sprites are plain 1x1 tiles.
const spriteUrls = {
  core: "/sprites/core.png",
  power: "/sprites/power.png",
  engine: "/sprites/engine.png",
  engineActive: "/sprites/engineActive.png",
  engineBoosted: "/sprites/engineBoosted.png",
  laser: "/sprites/laser.png",
} as const;
type SpriteKey = keyof typeof spriteUrls;
const spriteKeys: SpriteKey[] = [
  "core",
  "power",
  "engine",
  "engineActive",
  "engineBoosted",
  "laser",
];

// The plume only makes sense to show if the engine is both requesting that
// activation and actually receiving power this tick (see power budgeting).
function spriteKeyFor(part: Part): SpriteKey {
  if (part.partType === partType.engine) {
    if (part.powered && part.activation === activation.boosted)
      return "engineBoosted";
    if (part.powered && part.activation === activation.active)
      return "engineActive";
    return "engine";
  }
  if (part.partType === partType.core) return "core";
  if (part.partType === partType.power) return "power";
  return "laser";
}

// Canonical sprites face north; this rotates each part to its stored facing.
const facingRadians: Record<number, number> = {
  [facing.north]: 0,
  [facing.east]: -Math.PI / 2,
  [facing.south]: Math.PI,
  [facing.west]: Math.PI / 2,
};

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

// Fixed screen-space HUD element showing the local ship's capacitor charge.
const energyBarWidth = 20;
const energyBarHeight = 120;
const energyBarMargin = 20;

function drawEnergyBar(
  ctx: CanvasRenderingContext2D,
  canvasHeight: number,
  fraction: number,
) {
  const x = energyBarMargin;
  const y = canvasHeight - energyBarMargin - energyBarHeight;
  const fillHeight = energyBarHeight * fraction;

  ctx.globalAlpha = 1;
  ctx.fillStyle = "#0cf";
  ctx.fillRect(x, y + energyBarHeight - fillHeight, energyBarWidth, fillHeight);

  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, energyBarWidth, energyBarHeight);
}

interface Props {
  state: MatchState;
  sessionId: string;
}

export function GameCanvas({ state, sessionId }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
    };
    for (const key of spriteKeys) {
      images[key].src = spriteUrls[key];
    }

    let animId: number;

    const draw = () => {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Camera follows the local player's ship; fall back to map centre.
      const myShip = state.players.get(sessionId)?.ship;
      const camX = myShip ? myShip.body.x : mapWidth / 2;
      const camY = myShip ? myShip.body.y : mapHeight / 2;

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

      state.players.forEach((player) => {
        const ship = player.ship;
        if (!ship) return;
        const angle = ship.body.angle;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        ship.parts.forEach((part) => {
          const image = images[spriteKeyFor(part)];
          if (!image.complete || image.naturalWidth === 0) return;

          // Rotate the part's local offset into world space, then to screen.
          const worldX = ship.body.x + part.offsetX * cos - part.offsetY * sin;
          const worldY = ship.body.y + part.offsetX * sin + part.offsetY * cos;
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

      if (myShip) {
        const fraction = Math.min(
          1,
          Math.max(0, myShip.storedEnergy / capacitorCapacity),
        );
        drawEnergyBar(ctx, canvas.height, fraction);
      }

      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animId);
    };
  }, [state, sessionId]);

  return <canvas ref={canvasRef} style={{ display: "block" }} />;
}
