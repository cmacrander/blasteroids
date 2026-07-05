// Dev-only auth backdoor: skips Google sign-in with a fabricated unique uid,
// so multiple browsers can join one match locally without real accounts. The
// server does not validate Firebase tokens yet (deferred to deployment), so
// this only needs to satisfy the client's own auth gate.
export interface AppUser {
  uid: string;
  email: string | null;
}

export function createDevUser(): AppUser {
  const uid = `dev-${Math.random().toString(36).slice(2)}`;
  return { uid, email: `${uid}@local.dev` };
}
