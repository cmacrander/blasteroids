// Dev-only harness: renders GameCanvas against a mocked match (no server, no auth).
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import {
  MatchState,
  Player,
  Ship,
  Part,
  partType,
  facing,
  mapWidth,
  mapHeight,
} from "@blasteroids/shared";
import { GameCanvas } from "./GameCanvas";
import "./global.css";

const starterLayout = [
  { type: partType.laser, offsetX: 0, offsetY: 1, facing: facing.north },
  { type: partType.core, offsetX: 0, offsetY: 0, facing: facing.north },
  { type: partType.power, offsetX: 0, offsetY: -1, facing: facing.north },
  { type: partType.engine, offsetX: 0, offsetY: -2, facing: facing.south },
];

function demoShip(x: number, y: number, angle: number, powered: boolean): Ship {
  const ship = new Ship();
  ship.body.x = x;
  ship.body.y = y;
  ship.body.angle = angle;
  starterLayout.forEach((spec, index) => {
    const part = new Part();
    part.partType = spec.type;
    part.offsetX = spec.offsetX;
    part.offsetY = spec.offsetY;
    part.facing = spec.facing;
    part.hp = 100;
    part.powered = powered;
    ship.parts.set(String(index), part);
  });
  return ship;
}

const state = new MatchState();

// Local ship: upright and powered, centred by the camera.
const me = new Player();
me.ship = demoShip(mapWidth / 2, mapHeight / 2, 0, true);
state.players.set("me", me);

// A neighbour ship: rotated and unpowered, to confirm rotation and the dim state.
const other = new Player();
other.ship = demoShip(mapWidth / 2 + 6, mapHeight / 2, Math.PI / 4, false);
state.players.set("other", other);

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("No #root element found");

createRoot(rootEl).render(
  <StrictMode>
    <GameCanvas state={state} sessionId="me" />
  </StrictMode>,
);
