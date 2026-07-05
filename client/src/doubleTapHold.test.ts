// Unit tests for double-tap-and-hold detection shared by engine/laser input.
import { describe, it, expect } from "vitest";
import { createDoubleTapTracker } from "./doubleTapHold";

describe("createDoubleTapTracker", () => {
  it("treats the first press as a single tap", () => {
    const registerDown = createDoubleTapTracker();
    expect(registerDown(1000)).toBe(false);
  });

  it("treats a second press within the window as a double tap", () => {
    const registerDown = createDoubleTapTracker();
    registerDown(1000);
    expect(registerDown(1200)).toBe(true); // 200ms later, within 300ms window
  });

  it("treats a second press outside the window as a fresh single tap", () => {
    const registerDown = createDoubleTapTracker();
    registerDown(1000);
    expect(registerDown(1500)).toBe(false); // 500ms later, outside window
  });

  it("resets after a double tap: a third press is judged against the second", () => {
    const registerDown = createDoubleTapTracker();
    registerDown(1000);
    registerDown(1200); // double tap
    expect(registerDown(1250)).toBe(true); // 50ms after the second press
    expect(registerDown(2000)).toBe(false); // 750ms after the third press
  });
});
