// Decision logic for computer-controlled ships (see "Computer-controlled
// enemy ships" in gameDesign.md): fight the nearest ship in range (or flee it
// if unarmed), else mine the nearest asteroid in range, else drift. Never
// boosts, never defrags.
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

// Nose (body angle 0) points north, so aiming subtracts a quarter turn from
// the standard atan2 (0 = east) angle -- same as computeAimAngle.
function angleToward(self: Point, target: Point): number {
  return Math.atan2(target.y - self.y, target.x - self.x) - Math.PI / 2;
}

export function decideBotAction(
  self: Point,
  otherShips: Point[],
  asteroids: Point[],
  hasLaser: boolean,
): BotDecision {
  const nearestShip = nearestInRange(self, otherShips);
  if (nearestShip) {
    // Unarmed bots can't fight, so a nearby ship is a threat to run from
    // instead: face directly away from it and burn engines.
    if (!hasLaser) {
      return {
        targetAngle: angleToward(self, nearestShip) + Math.PI,
        engine: activation.active,
        laser: activation.inactive,
      };
    }
    return {
      targetAngle: angleToward(self, nearestShip),
      engine: activation.active,
      laser: activation.active,
    };
  }

  const nearestAsteroid = nearestInRange(self, asteroids);
  if (!nearestAsteroid) {
    return {
      targetAngle: null,
      engine: activation.inactive,
      laser: activation.inactive,
    };
  }
  return {
    targetAngle: angleToward(self, nearestAsteroid),
    engine: activation.active,
    laser: activation.active,
  };
}
