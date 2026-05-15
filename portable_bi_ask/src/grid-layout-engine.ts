import type { WidgetType } from './shared/types/index';

export const GRID_COLS = 12;
export const ROW_PX = 40; // pixels per row unit
export const GAP_PX = 12; // gap between cards in pixels

export interface GridItemLayout {
  id: string;
  x: number; // column index 0 to GRID_COLS-1
  y: number; // row index 0 to N
  w: number; // column span 1 to GRID_COLS
  h: number; // row span 1 to N
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}

// Component-specific sizing rules
export const COMPONENT_RULES: Record<
  WidgetType,
  { defaultW: number; defaultH: number; minW: number; minH: number; maxW?: number; maxH?: number }
> = {
  kpi: { defaultW: 3, defaultH: 3, minW: 2, minH: 2, maxW: 6, maxH: 5 },
  chart: { defaultW: 6, defaultH: 6, minW: 4, minH: 4 },
  table: { defaultW: 12, defaultH: 7, minW: 6, minH: 4 },
  text: { defaultW: 6, defaultH: 3, minW: 3, minH: 2 },
  image: { defaultW: 4, defaultH: 4, minW: 2, minH: 2 },
  filter: { defaultW: 4, defaultH: 2, minW: 2, minH: 1 },
};

/**
 * Rounds all coords to integers, clamps x to [0, GRID_COLS-w],
 * ensures x+w<=GRID_COLS, applies min/max constraints.
 */
export function clampItem(item: GridItemLayout): GridItemLayout {
  let { x, y, w, h } = item;
  const { minW, minH, maxW, maxH } = item;

  // Round to integers
  x = Math.round(x);
  y = Math.round(y);
  w = Math.round(w);
  h = Math.round(h);

  // Apply min constraints
  if (minW !== undefined) w = Math.max(w, minW);
  if (minH !== undefined) h = Math.max(h, minH);

  // Apply max constraints
  if (maxW !== undefined) w = Math.min(w, maxW);
  if (maxH !== undefined) h = Math.min(h, maxH);

  // Ensure w doesn't exceed grid width
  w = Math.min(w, GRID_COLS);

  // Clamp negatives
  x = Math.max(0, x);
  y = Math.max(0, y);

  // Clamp x so x+w <= GRID_COLS
  x = Math.min(x, GRID_COLS - w);

  return { ...item, x, y, w, h };
}

function itemsOverlap(a: GridItemLayout, b: GridItemLayout): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/**
 * Keeps priorityId item in place, pushes colliding items down, cascades.
 */
export function resolveCollisions(layout: GridItemLayout[], priorityId: string): GridItemLayout[] {
  const result: GridItemLayout[] = layout.map((i) => ({ ...i }));
  const priorityItem = result.find((i) => i.id === priorityId);
  if (!priorityItem) return result;

  let changed = true;
  const maxIterations = result.length * result.length + 10;

  for (let iter = 0; changed && iter < maxIterations; iter++) {
    changed = false;
    for (const item of result) {
      if (item.id === priorityId) continue;
      changed = _pushItemDown(item, result, priorityId) || changed;
    }
  }

  return result;
}

function _pushItemDown(
  item: GridItemLayout,
  result: GridItemLayout[],
  priorityId: string,
): boolean {
  let changed = false;
  for (const other of result) {
    if (other.id === item.id) continue;
    if (!itemsOverlap(item, other)) continue;
    if (other.id !== priorityId && other.y > item.y) continue;
    const newY = other.y + other.h;
    if (newY !== item.y) {
      item.y = newY;
      changed = true;
    }
  }
  return changed;
}

/**
 * Packs items upward to remove gaps.
 * Sort by y then x, for each item find lowest y with no column overlap with already-placed items.
 */
export function compactVertical(layout: GridItemLayout[]): GridItemLayout[] {
  if (layout.length === 0) return [];

  // Sort by y then x
  const sorted = [...layout].sort((a, b) => a.y - b.y || a.x - b.x);
  const placed: GridItemLayout[] = [];

  for (const item of sorted) {
    let bestY = 0;

    // Find the lowest y where this item fits without overlapping already placed items
    for (const placedItem of placed) {
      // Check if columns overlap
      const colOverlap = item.x < placedItem.x + placedItem.w && item.x + item.w > placedItem.x;
      if (colOverlap) {
        // Must be below this placed item
        bestY = Math.max(bestY, placedItem.y + placedItem.h);
      }
    }

    placed.push({ ...item, y: bestY });
  }

  return placed;
}

/**
 * clampItem each item + compactVertical.
 */
export function normalizeLayout(layout: GridItemLayout[]): GridItemLayout[] {
  const clamped = layout.map(clampItem);
  return compactVertical(clamped);
}

/**
 * Use COMPONENT_RULES defaultW/defaultH.
 * Find first slot (scanning top-left to bottom-right) where item fits without overlapping anything.
 * Falls back to appending at bottom.
 */
export function findBestPosition(
  type: WidgetType,
  existingLayout: GridItemLayout[],
): { x: number; y: number; w: number; h: number } {
  const rules = COMPONENT_RULES[type];
  const { defaultW, defaultH } = rules;

  // Determine how many rows to scan (existing height + buffer)
  const maxRow = existingLayout.length > 0 ? Math.max(...existingLayout.map((i) => i.y + i.h)) : 0;

  // Scan rows and columns for the first fitting slot
  for (let y = 0; y <= maxRow; y++) {
    for (let x = 0; x <= GRID_COLS - defaultW; x++) {
      const candidate = { id: '__candidate__', x, y, w: defaultW, h: defaultH };
      const overlaps = existingLayout.some((item) => itemsOverlap(candidate, item));
      if (!overlaps) {
        return { x, y, w: defaultW, h: defaultH };
      }
    }
  }

  // Fall back: append at bottom
  return { x: 0, y: maxRow, w: defaultW, h: defaultH };
}

/**
 * Convert pixel coordinates to grid cell indices.
 */
export function pixelToGrid(
  pixelX: number,
  pixelY: number,
  containerWidth: number,
): { col: number; row: number } {
  const colW = containerWidth / GRID_COLS;
  const col = Math.max(0, Math.min(GRID_COLS - 1, Math.floor(pixelX / colW)));
  const row = Math.max(0, Math.floor(pixelY / ROW_PX));
  return { col, row };
}

/**
 * Convert grid item layout to pixel dimensions.
 */
export function gridToPixels(
  item: GridItemLayout,
  containerWidth: number,
): { left: number; top: number; width: number; height: number } {
  const colW = containerWidth / GRID_COLS;
  return {
    left: item.x * colW,
    top: item.y * ROW_PX,
    width: item.w * colW - GAP_PX,
    height: item.h * ROW_PX - GAP_PX,
  };
}

/**
 * Migrate pixel-based or grid-based positions to GridItemLayout[].
 * If any position has w > 12 or x > 12 → treat as pixels.
 * Otherwise → treat as already grid units.
 * containerWidth defaults to 1200 for migration.
 */
export function migrateToGridLayout(
  positions: Array<{ x: number; y: number; w: number; h: number }>,
  ids: string[],
  containerWidth: number = 1200,
): GridItemLayout[] {
  if (positions.length === 0) return [];

  const isPixelBased = positions.some((p) => p.w > 12 || p.x > 12);

  if (isPixelBased) {
    const colW = containerWidth / GRID_COLS;
    return positions.map((pos, i) => ({
      id: ids[i] ?? `widget-${i}`,
      x: Math.max(0, Math.round(pos.x / colW)),
      y: Math.max(0, Math.round(pos.y / ROW_PX)),
      w: Math.max(1, Math.round(pos.w / colW)),
      h: Math.max(1, Math.round(pos.h / ROW_PX)),
    }));
  }

  // Already grid units
  return positions.map((pos, i) => ({
    id: ids[i] ?? `widget-${i}`,
    x: pos.x,
    y: pos.y,
    w: pos.w,
    h: pos.h,
  }));
}
