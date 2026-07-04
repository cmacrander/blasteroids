// Canvas renderer for the game world.
import { useEffect, useRef } from "react";

export const MAP_SIZE = 1000; // world units (1 unit = 1 sprite width)

export function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Scale so the full map fits with padding; camera centred on map centre.
    const scale =
      Math.min(canvas.width / MAP_SIZE, canvas.height / MAP_SIZE) * 0.9;
    const camX = MAP_SIZE / 2;
    const camY = MAP_SIZE / 2;

    const toScreen = (wx: number, wy: number): [number, number] => [
      (wx - camX) * scale + canvas.width / 2,
      (wy - camY) * scale + canvas.height / 2,
    ];

    let animId: number;

    const draw = () => {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const [bx, by] = toScreen(0, 0);
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.strokeRect(bx, by, MAP_SIZE * scale, MAP_SIZE * scale);

      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animId);
    };
  }, []);

  return <canvas ref={canvasRef} style={{ display: "block" }} />;
}
