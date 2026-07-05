// Central action-to-key bindings (KeyboardEvent.code values); the HUD derives
// its displayed key letters from here so hints never drift from behavior.

export const keyBindings = {
  engines: "KeyW",
  buildCore: "KeyA",
  buildPower: "KeyS",
  buildEngine: "KeyD",
  buildLaser: "KeyF",
  defragment: "Tab",
} as const;

// "KeyA" -> "A"; other codes ("Tab") already read as labels.
export function bindingLabel(code: string): string {
  return code.startsWith("Key") ? code.slice(3) : code;
}
