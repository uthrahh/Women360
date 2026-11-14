/**
 * Which illustrated scene is behind the landing page, and how far through it the reader is.
 *
 * `tops` are the document positions where each scene's section begins (ascending). The reading line is the
 * middle of the screen: the scene is the last one whose section has reached it, and `progress` runs 0 to 1
 * from that section's start to the next one's (the last scene runs to the end of the page).
 * Progress is stepped in whole frames (`frames` per scene) so the drawing moves like hand-drawn animation,
 * and so the page repaints only when a frame actually changes.
 */
export function pickScene(tops: number[], readingLine: number, pageEnd: number, frames = 36): { index: number; progress: number } {
  if (tops.length === 0) return { index: 0, progress: 0 };
  let index = 0;
  for (let i = 0; i < tops.length; i++) if (tops[i] <= readingLine) index = i;
  const start = tops[index];
  const end = index + 1 < tops.length ? tops[index + 1] : Math.max(pageEnd, start + 1);
  const raw = readingLine <= start ? 0 : (readingLine - start) / Math.max(1, end - start);
  const clamped = Math.min(1, Math.max(0, raw));
  return { index, progress: Math.round(clamped * frames) / frames };
}

/** The part of the drawing kept in view: the whole stage when the screen is wide, the figure's column when it is tall. */
export function sceneViewBox(width: number, height: number): string {
  return width / Math.max(1, height) < 1 ? "1000 0 500 900" : "0 0 1600 900";
}
