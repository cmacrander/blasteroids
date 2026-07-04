// Game view: canvas with a HUD overlay.
import { useEffect } from "react";
import type { Room } from "colyseus.js";
import type { MatchState } from "@blasteroids/shared";
import { GameCanvas } from "./GameCanvas";
import { attachEngineInput } from "./engineInput";
import { attachAimInput } from "./aimInput";

interface Props {
  room: Room<MatchState>;
  onExit: () => void;
}

export function GameView({ room, onExit }: Props) {
  useEffect(() => attachEngineInput(room), [room]);
  useEffect(() => attachAimInput(room), [room]);

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      <GameCanvas state={room.state} sessionId={room.sessionId} />
      <button
        onClick={onExit}
        style={{ position: "absolute", top: 16, right: 16 }}
      >
        Exit game
      </button>
    </div>
  );
}
