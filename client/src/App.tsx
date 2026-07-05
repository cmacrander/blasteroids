// Root app component — routes between auth, start screen, and game.
import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import type { Room } from "colyseus.js";
import type { MatchState } from "@blasteroids/shared";
import { auth, signInWithGoogle, signOut } from "./firebaseAuth";
import { colyseusClient } from "./serverConnection";
import { createDevUser, type AppUser } from "./devAuth";
import { StartScreen } from "./StartScreen";
import { GameView } from "./GameView";

export function App() {
  const [user, setUser] = useState<AppUser | null | undefined>(undefined);
  const [room, setRoom] = useState<Room<MatchState> | null>(null);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  if (user === undefined) return <p>Loading...</p>;

  if (user === null) {
    return (
      <div>
        <button
          onClick={() => {
            void signInWithGoogle();
          }}
        >
          Sign in with Google
        </button>
        {import.meta.env.DEV && (
          <button
            onClick={() => {
              setUser(createDevUser());
            }}
          >
            Dev sign in (local only)
          </button>
        )}
      </div>
    );
  }

  if (room !== null) {
    const handleExit = () => {
      void room.leave();
      setRoom(null);
      history.pushState(null, "", "/");
    };
    return <GameView room={room} onExit={handleExit} />;
  }

  const handleQuickPlay = async () => {
    try {
      const r = await colyseusClient.joinOrCreate<MatchState>("game");
      setRoom(r);
      history.pushState(null, "", `/${r.roomId}`);
    } catch (err) {
      console.error("Failed to join game:", err);
    }
  };

  return (
    <StartScreen
      user={user}
      onQuickPlay={() => {
        void handleQuickPlay();
      }}
      onSignOut={() => {
        // A dev user has no real Firebase session to sign out of, so
        // onAuthStateChanged would never fire to clear it; clear it directly.
        setUser(null);
        void signOut();
      }}
    />
  );
}
