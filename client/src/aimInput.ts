// Mouse binding: steer the ship to face the cursor.
import type { Room } from "colyseus.js";
import type { MatchState } from "@blasteroids/shared";
import { messageType, patchHz } from "@blasteroids/shared";

// No point sending faster than the state broadcast rate the result rides on.
const sendIntervalMs = 1000 / patchHz;

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

export function attachAimInput(room: Room<MatchState>): () => void {
  let lastSentAt = -Infinity;

  const handleMouseMove = (event: MouseEvent) => {
    const now = performance.now();
    if (now - lastSentAt < sendIntervalMs) return;
    lastSentAt = now;

    const angle = computeAimAngle(
      event.clientX,
      event.clientY,
      window.innerWidth / 2,
      window.innerHeight / 2,
    );
    room.send(messageType.setAimAngle, angle);
  };

  window.addEventListener("mousemove", handleMouseMove);

  return () => {
    window.removeEventListener("mousemove", handleMouseMove);
  };
}
