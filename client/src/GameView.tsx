// Game view: canvas with a HUD overlay.
import { GameCanvas } from "./GameCanvas";

interface Props {
  onExit: () => void;
}

export function GameView({ onExit }: Props) {
  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      <GameCanvas />
      <button
        onClick={onExit}
        style={{ position: "absolute", top: 16, right: 16 }}
      >
        Exit game
      </button>
    </div>
  );
}
