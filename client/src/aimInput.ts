// Mouse binding: steer the ship to face the cursor. Writes into the client
// sim's controls; the sim sends the input packets (see clientSim.ts).
import type { LocalControls } from "./clientSim";

// The local player's ship is always rendered at screen center (the camera
// follows it), so the cursor's offset from center is its aim direction.
// Screen y grows downward while world +y is north, so y is flipped.
//
// Math.atan2 uses the standard convention where 0 = east. body.angle uses a
// different zero: the ship's nose (the starter ship's laser, at local
// offsetY +1) points north when body.angle is 0, which is already +90
// degrees from "east" -- so aiming the nose at the cursor means subtracting
// that offset from the raw cursor angle.
export function computeAimAngle(
  cursorX: number,
  cursorY: number,
  centerX: number,
  centerY: number,
): number {
  const cursorAngle = Math.atan2(centerY - cursorY, cursorX - centerX);
  return cursorAngle - Math.PI / 2;
}

export function attachAimInput(controls: LocalControls): () => void {
  const handleMouseMove = (event: MouseEvent) => {
    controls.targetAngle = computeAimAngle(
      event.clientX,
      event.clientY,
      window.innerWidth / 2,
      window.innerHeight / 2,
    );
  };

  window.addEventListener("mousemove", handleMouseMove);

  return () => {
    window.removeEventListener("mousemove", handleMouseMove);
  };
}
