// Shared double-tap-and-hold detection, used by both engine and laser input:
// a control is "boosted" if its second down-event arrives within
// doubleTapWindowMs of the first, while still held.
const doubleTapWindowMs = 300;

export function createDoubleTapTracker(): (now: number) => boolean {
  let lastDownTime = -Infinity;

  return (now: number) => {
    const isDoubleTap = now - lastDownTime <= doubleTapWindowMs;
    lastDownTime = now;
    return isDoubleTap;
  };
}
