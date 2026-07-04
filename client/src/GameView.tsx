// Game view: canvas with a HUD overlay.
import type { Room } from "colyseus.js";
import type { MatchState } from "@blasteroids/shared";
import { GameCanvas } from "./GameCanvas";

interface Props {
  room: Room<MatchState>;
  onExit: () => void;
}

export function GameView({ room, onExit }: Props) {
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
