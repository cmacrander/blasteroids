// Game view: canvas with a HUD overlay.
import { useEffect } from "react";
import type { Room } from "colyseus.js";
import type { MatchState } from "@blasteroids/shared";
import { GameCanvas } from "./GameCanvas";
import { attachEngineInput } from "./engineInput";
import { attachLaserInput } from "./laserInput";
import { attachAimInput } from "./aimInput";
import { logGameConstants } from "./logGameConstants";

interface Props {
  room: Room<MatchState>;
  onExit: () => void;
}

export function GameView({ room, onExit }: Props) {
  useEffect(() => attachEngineInput(room), [room]);
  useEffect(() => attachLaserInput(room), [room]);
  useEffect(() => attachAimInput(room), [room]);
  useEffect(logGameConstants, []);

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      <GameCanvas room={room} state={room.state} sessionId={room.sessionId} />
      <button
        onClick={onExit}
        style={{ position: "absolute", top: 16, right: 16 }}
      >
        Exit game
      </button>
    </div>
  );
}
