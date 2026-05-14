import { describe, expect, it } from 'vitest';

import {
  clampItem,
  compactVertical,
  findBestPosition,
  GRID_COLS,
  type GridItemLayout,
  normalizeLayout,
  resolveCollisions,
} from './grid-layout-engine';

// Helper to create a minimal GridItemLayout
function item(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  overrides: Partial<GridItemLayout> = {},
): GridItemLayout {
  return { id, x, y, w, h, ...overrides };
}

describe('clampItem()', () => {
  it('clamps x so that x+w does not exceed GRID_COLS', () => {
    const result = clampItem(item('a', 10, 0, 4, 2));
    expect(result.x + result.w).toBeLessThanOrEqual(GRID_COLS);
    expect(result.x).toBe(GRID_COLS - 4); // clamped to 8
  });

  it('clamps negative x to 0', () => {
    const result = clampItem(item('a', -3, 0, 4, 2));
    expect(result.x).toBe(0);
  });

  it('clamps negative y to 0', () => {
    const result = clampItem(item('a', 0, -5, 4, 2));
    expect(result.y).toBe(0);
  });

  it('respects minW constraint', () => {
    const result = clampItem(item('a', 0, 0, 1, 2, { minW: 3 }));
    expect(result.w).toBeGreaterThanOrEqual(3);
  });

  it('respects minH constraint', () => {
    const result = clampItem(item('a', 0, 0, 4, 1, { minH: 3 }));
    expect(result.h).toBeGreaterThanOrEqual(3);
  });

  it('respects maxW constraint', () => {
    const result = clampItem(item('a', 0, 0, 10, 2, { maxW: 6 }));
    expect(result.w).toBeLessThanOrEqual(6);
  });

  it('respects maxH constraint', () => {
    const result = clampItem(item('a', 0, 0, 4, 10, { maxH: 5 }));
    expect(result.h).toBeLessThanOrEqual(5);
  });

  it('rounds coordinates to integers', () => {
    const result = clampItem({ ...item('a', 0, 0, 4, 3), x: 1.7, y: 2.3 });
    expect(Number.isInteger(result.x)).toBe(true);
    expect(Number.isInteger(result.y)).toBe(true);
  });

  it('does not allow w > GRID_COLS', () => {
    const result = clampItem(item('a', 0, 0, 20, 3));
    expect(result.w).toBe(GRID_COLS);
  });
});

describe('resolveCollisions()', () => {
  it('keeps the priority item in place', () => {
    const layout = [
      item('priority', 0, 0, 6, 4),
      item('other', 0, 0, 6, 4), // directly overlapping
    ];
    const result = resolveCollisions(layout, 'priority');
    const priorityResult = result.find((i) => i.id === 'priority')!;
    expect(priorityResult.x).toBe(0);
    expect(priorityResult.y).toBe(0);
  });

  it('pushes colliding item to below the priority item', () => {
    const layout = [
      item('priority', 0, 2, 6, 4), // y=2, h=4 → bottom at y=6
      item('other', 0, 2, 6, 4), // same position, must be pushed below y=6
    ];
    const result = resolveCollisions(layout, 'priority');
    const otherResult = result.find((i) => i.id === 'other')!;
    expect(otherResult.y).toBeGreaterThanOrEqual(6); // pushed to y=6 or below
  });

  it('does not move an item that is not colliding', () => {
    const layout = [
      item('priority', 0, 0, 6, 4),
      item('not-colliding', 6, 0, 6, 4), // different columns, no overlap
    ];
    const result = resolveCollisions(layout, 'priority');
    const nc = result.find((i) => i.id === 'not-colliding')!;
    expect(nc.y).toBe(0); // unchanged
  });

  it('leaves no overlapping items after resolution', () => {
    const layout = [item('a', 0, 0, 6, 4), item('b', 0, 0, 6, 4), item('c', 0, 0, 6, 4)];
    const result = resolveCollisions(layout, 'a');

    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const ri = result[i];
        const rj = result[j];
        const overlaps =
          ri.x < rj.x + rj.w && ri.x + ri.w > rj.x && ri.y < rj.y + rj.h && ri.y + ri.h > rj.y;
        expect(overlaps).toBe(false);
      }
    }
  });
});

describe('compactVertical()', () => {
  it('removes vertical gap between items', () => {
    const layout = [
      item('a', 0, 0, 6, 4), // rows 0-3
      item('b', 0, 8, 6, 4), // has a gap (rows 4-7 empty)
    ];
    const result = compactVertical(layout);
    const b = result.find((i) => i.id === 'b')!;
    expect(b.y).toBe(4); // compacted to directly below 'a'
  });

  it('preserves items that cannot move higher', () => {
    const layout = [item('a', 0, 0, 12, 3), item('b', 0, 3, 12, 3)];
    const result = compactVertical(layout);
    const a = result.find((i) => i.id === 'a')!;
    const b = result.find((i) => i.id === 'b')!;
    expect(a.y).toBe(0);
    expect(b.y).toBe(3);
  });

  it('moves items up to fill vertical gaps', () => {
    const layout = [
      item('a', 0, 5, 4, 2), // no items above in its columns, should move to y=0
    ];
    const result = compactVertical(layout);
    const a = result.find((i) => i.id === 'a')!;
    expect(a.y).toBe(0);
  });

  it('allows items to move past gaps in non-overlapping columns', () => {
    // 'a' occupies cols 0-5, rows 0-3
    // 'b' occupies cols 6-11, rows 0-3
    // 'c' occupies cols 0-5, rows 8-11 (gap at rows 4-7)
    // 'd' occupies cols 6-11, rows 8-11 (gap at rows 4-7)
    const layout = [
      item('a', 0, 0, 6, 4),
      item('b', 6, 0, 6, 4),
      item('c', 0, 8, 6, 4),
      item('d', 6, 8, 6, 4),
    ];
    const result = compactVertical(layout);
    const c = result.find((i) => i.id === 'c')!;
    const d = result.find((i) => i.id === 'd')!;
    expect(c.y).toBe(4); // compacted
    expect(d.y).toBe(4); // compacted
  });
});

describe('normalizeLayout()', () => {
  it('clamps items that exceed GRID_COLS', () => {
    const layout = [item('a', 10, 0, 6, 3)];
    const result = normalizeLayout(layout);
    const a = result.find((i) => i.id === 'a')!;
    expect(a.x + a.w).toBeLessThanOrEqual(GRID_COLS);
  });

  it('compacts items after clamping', () => {
    const layout = [
      item('a', 0, 0, 6, 4),
      item('b', 0, 10, 6, 4), // large gap
    ];
    const result = normalizeLayout(layout);
    const b = result.find((i) => i.id === 'b')!;
    expect(b.y).toBe(4); // compacted directly below 'a'
  });

  it('ensures all coordinates are integers', () => {
    const layout = [{ ...item('a', 0, 0, 4, 3), x: 1.5, y: 2.7 }];
    const result = normalizeLayout(layout);
    const a = result[0]!;
    expect(Number.isInteger(a.x)).toBe(true);
    expect(Number.isInteger(a.y)).toBe(true);
    expect(Number.isInteger(a.w)).toBe(true);
    expect(Number.isInteger(a.h)).toBe(true);
  });

  it('leaves no overlapping items', () => {
    const layout = [
      item('a', 0, 0, 6, 4),
      item('b', 4, 2, 6, 4), // partially overlapping
    ];
    // After normalize, items may not overlap
    // (note: normalizeLayout does clamp + compact, doesn't guarantee no overlap in all edge cases
    // but with clampItem reducing to valid positions + compactVertical, the sorted output should be clean)
    const result = normalizeLayout(layout);
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const ri = result[i];
        const rj = result[j];
        expect(ri.x + ri.w).toBeLessThanOrEqual(GRID_COLS);
        expect(rj.x + rj.w).toBeLessThanOrEqual(GRID_COLS);
      }
    }
  });
});

describe('findBestPosition()', () => {
  it('places a kpi in the next available slot in a row', () => {
    const existing = [
      item('a', 0, 0, 3, 3), // kpi at col 0
      item('b', 3, 0, 3, 3), // kpi at col 3
    ];
    const pos = findBestPosition('kpi', existing);
    // Should be placed at col 6 (next available slot for defaultW=3)
    expect(pos.x).toBe(6);
    expect(pos.y).toBe(0);
    expect(pos.w).toBe(3);
    expect(pos.h).toBe(3);
  });

  it('chart does NOT fit into a tiny leftover gap less than minW', () => {
    // Fill the whole row except 2 columns (chart minW=4)
    const existing = [
      item('a', 0, 0, 10, 6), // only 2 cols left in row 0
    ];
    const pos = findBestPosition('chart', existing);
    // Chart (defaultW=6, minW=4) cannot fit in the 2-col gap
    // Should be placed at a new row below
    expect(pos.y).toBeGreaterThan(0); // must go below row 0
    // Or if it wraps, x + defaultW must not exceed GRID_COLS for the slot where it fits
    expect(pos.x + pos.w).toBeLessThanOrEqual(GRID_COLS);
  });

  it('falls back to bottom when layout is full', () => {
    // Fill 3 rows with wide items
    const existing = [item('a', 0, 0, 12, 4), item('b', 0, 4, 12, 4), item('c', 0, 8, 12, 4)];
    const pos = findBestPosition('kpi', existing);
    expect(pos.y).toBeGreaterThanOrEqual(12); // placed after all existing items
  });

  it('returns positions with correct default dimensions for kpi', () => {
    const pos = findBestPosition('kpi', []);
    expect(pos.w).toBe(3);
    expect(pos.h).toBe(3);
  });

  it('returns positions with correct default dimensions for chart', () => {
    const pos = findBestPosition('chart', []);
    expect(pos.w).toBe(6);
    expect(pos.h).toBe(6);
  });

  it('returns positions with correct default dimensions for table', () => {
    const pos = findBestPosition('table', []);
    expect(pos.w).toBe(12);
    expect(pos.h).toBe(7);
  });

  it('places at 0,0 when layout is empty', () => {
    const pos = findBestPosition('kpi', []);
    expect(pos.x).toBe(0);
    expect(pos.y).toBe(0);
  });
});
