// Pre-game lobby screen shown to signed-in users.
import type { AppUser } from "./devAuth";

interface Props {
  user: AppUser;
  onQuickPlay: () => void;
  onSignOut: () => void;
}

export function StartScreen({ user, onQuickPlay, onSignOut }: Props) {
  return (
    <div>
      <h1>Blasteroids</h1>
      <button onClick={onQuickPlay}>Quick Play</button>
      <p>Signed in as {user.email}</p>
      <button onClick={onSignOut}>Sign out</button>
    </div>
  );
}
