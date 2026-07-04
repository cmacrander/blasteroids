// Canvas renderer: draws every ship's parts each frame, camera on the local player.
import { useEffect, useRef } from "react";
import type { MatchState, PartType } from "@blasteroids/shared";
import { partType, facing, mapWidth, mapHeight } from "@blasteroids/shared";

const pixelsPerUnit = 40; // screen pixels per world unit (one part is one unit)

const spriteUrls: Record<PartType, string> = {
  [partType.core]: "/sprites/core.png",
  [partType.power]: "/sprites/power.png",
  [partType.engine]: "/sprites/engine.png",
  [partType.laser]: "/sprites/laser.png",
};

// Canonical sprites face north; this rotates each part to its stored facing.
const facingRadians: Record<number, number> = {
  [facing.north]: 0,
  [facing.east]: -Math.PI / 2,
  [facing.south]: Math.PI,
  [facing.west]: Math.PI / 2,
};

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

    const images: Record<number, HTMLImageElement> = {};
    for (const [type, url] of Object.entries(spriteUrls)) {
      const image = new Image();
      image.src = url;
      images[Number(type)] = image;
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
          const image = images[part.partType];
          if (!image?.complete || image.naturalWidth === 0) return;

          // Rotate the part's local offset into world space, then to screen.
          const worldX = ship.body.x + part.offsetX * cos - part.offsetY * sin;
          const worldY = ship.body.y + part.offsetX * sin + part.offsetY * cos;
          const orientation = angle + (facingRadians[part.facing] ?? 0);

          ctx.save();
          ctx.translate(toScreenX(worldX), toScreenY(worldY));
          ctx.rotate(-orientation);
          ctx.globalAlpha = part.powered ? 1 : 0.6;
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

      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animId);
    };
  }, [state, sessionId]);

  return <canvas ref={canvasRef} style={{ display: "block" }} />;
}
