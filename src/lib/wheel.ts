/**
 * The maths behind the wheel picker (components/ui/WheelPicker.tsx), kept pure so it can be tested.
 * Positions are in pixels along the strip of items: offset 0 puts item 0 in the middle, offset k*itemHeight item k.
 */

/** iOS-like deceleration: how far a flick carries, per millisecond of velocity. */
const DECELERATION = 0.998;
const PROJECTION = DECELERATION / (1 - DECELERATION); // ~499 ms

export function clampIndex(i: number, count: number) {
  return Math.min(count - 1, Math.max(0, i));
}

export function indexAt(offset: number, itemHeight: number, count: number) {
  return clampIndex(Math.round(offset / itemHeight), count);
}

/**
 * Where a flick comes to rest: the momentum projection of its release velocity (px per ms, positive = towards
 * later items), then snapped to the nearest whole item and kept inside the list.
 */
export function restingIndex(offset: number, velocity: number, itemHeight: number, count: number) {
  return indexAt(offset + velocity * PROJECTION, itemHeight, count);
}

/** Dragging past either end gives way less and less, like pulling on elastic. */
export function rubberBand(offset: number, min: number, max: number, dimension: number) {
  const pull = (over: number) => (1 - 1 / ((over * 0.55) / dimension + 1)) * dimension;
  if (offset < min) return min - pull(min - offset);
  if (offset > max) return max + pull(offset - max);
  return offset;
}

/** How long the glide to rest takes: longer for longer journeys, within sensible bounds. */
export function glideDuration(distance: number) {
  return Math.min(1100, Math.max(180, 160 + Math.sqrt(Math.abs(distance)) * 28));
}

/** Ease-out (quartic): fast at first, settling gently. */
export const easeOut = (t: number) => 1 - (1 - t) ** 4;

/** Degrees each item turns away from the middle of the wheel. */
export const DEGREES_PER_ITEM = 24;

/**
 * Where an item sits on the drum: its angle, its vertical position from the centre and how much it is foreshortened.
 * Items more than a quarter-turn away are behind the drum and not drawn.
 */
export function drumPosition(distanceInItems: number, itemHeight: number) {
  const angle = distanceInItems * DEGREES_PER_ITEM;
  const radians = (angle * Math.PI) / 180;
  const radius = itemHeight / ((DEGREES_PER_ITEM * Math.PI) / 180);
  return {
    angle,
    y: radius * Math.sin(radians),
    visible: Math.abs(angle) < 90,
    /** 1 in the middle, falling to 0 at the edge of the drum. */
    facing: Math.max(0, Math.cos(radians)),
  };
}

/** The visible height of the drum (from the item a quarter-turn up to the one a quarter-turn down), plus one item. */
export function drumHeight(itemHeight: number) {
  const radius = itemHeight / ((DEGREES_PER_ITEM * Math.PI) / 180);
  return Math.round(radius * 2 * Math.sin((80 * Math.PI) / 180) + itemHeight * 0.4);
}

/** Number of days in a month (month 1-12), leap years included. */
export function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
