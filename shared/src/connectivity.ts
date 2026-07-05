// Flood-fill over the 4-neighbor adjacency graph of part grid positions.
import { cellKey, type GridPart } from "./partPlacement.js";

export function connectedGroups<T extends GridPart>(parts: T[]): T[][] {
  const byCell = new Map<string, T>();
  for (const part of parts) {
    byCell.set(cellKey(part.offsetX, part.offsetY), part);
  }

  const visited = new Set<string>();
  const groups: T[][] = [];

  for (const [startKey, startPart] of byCell) {
    if (visited.has(startKey)) continue;
    visited.add(startKey);
    const group: T[] = [];
    const stack = [startPart];

    while (stack.length > 0) {
      const part = stack.pop();
      if (!part) break;
      group.push(part);
      for (const [dx, dy] of [
        [0, 1],
        [1, 0],
        [0, -1],
        [-1, 0],
      ] as const) {
        const key = cellKey(part.offsetX + dx, part.offsetY + dy);
        const neighbor = byCell.get(key);
        if (!neighbor || visited.has(key)) continue;
        visited.add(key);
        stack.push(neighbor);
      }
    }

    groups.push(group);
  }

  return groups;
}
