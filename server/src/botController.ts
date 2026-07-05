// Decision logic for computer-controlled ships (see "Computer-controlled
// enemy ships" in gameDesign.md): fight the nearest ship in range, else mine
// the nearest asteroid in range, else drift. Never boosts, never defrags.
import type { Activation } from "@blasteroids/shared";
import { activation, botEngageRange } from "@blasteroids/shared";

interface Point {
  x: number;
  y: number;
}

export interface BotDecision {
  targetAngle: number | null; // null = no steering, keep drifting
  engine: Activation;
  laser: Activation;
}

function nearestInRange(self: Point, targets: Point[]): Point | null {
  let best: Point | null = null;
  let bestDistance = botEngageRange;
  for (const target of targets) {
    const distance = Math.hypot(target.x - self.x, target.y - self.y);
    if (distance <= bestDistance) {
      bestDistance = distance;
      best = target;
    }
  }
  return best;
}

export function decideBotAction(
  self: Point,
  otherShips: Point[],
  asteroids: Point[],
): BotDecision {
  const target =
    nearestInRange(self, otherShips) ?? nearestInRange(self, asteroids);
  if (!target) {
    return {
      targetAngle: null,
      engine: activation.inactive,
      laser: activation.inactive,
    };
  }
  return {
    // Nose (body angle 0) points north, so aiming subtracts a quarter turn
    // from the standard atan2 (0 = east) angle -- same as computeAimAngle.
    targetAngle: Math.atan2(target.y - self.y, target.x - self.x) - Math.PI / 2,
    engine: activation.active,
    laser: activation.active,
  };
}
