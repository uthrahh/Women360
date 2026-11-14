/**
 * The maths behind a film that follows the scroll bar: where the visitor is in the section, which word to show, and how a video's
 * clock should chase that position. Pure functions, so they can be tested without a browser.
 */
import type { TimedScene } from "@/content/lifeFilm";

export const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

/**
 * How far through the pinned section the visitor is, 0 to 1. `top` is the section's top edge relative to the window (negative once
 * it has scrolled up past the top), `travel` is how far the pinned screen can move: the section's height minus the screen it pins.
 */
export function sectionProgress(top: number, travel: number): number {
  if (travel <= 0) return 0;
  return clamp01(-top / travel);
}

/** The scene playing at this point of the film, or null if the point lies beyond the last scene. */
export function sceneAt(scenes: TimedScene[], progress: number): TimedScene | null {
  const p = clamp01(progress);
  return scenes.find((s) => p >= s.from && p < s.to) ?? (p >= 1 ? scenes[scenes.length - 1] : null);
}

/**
 * The time the video should show. The very last instant is held back slightly: seeking to the exact end of a video can show nothing
 * in some browsers, and the final frame should always be there.
 */
export function targetTime(progress: number, duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return clamp01(progress) * Math.max(duration - 0.05, 0);
}

/**
 * One step of "ease towards the target". The video's clock does not jump to where the scroll bar is; it closes a fraction of the gap
 * on each frame, which turns the small steps of a mouse wheel into one smooth motion and makes the film feel weighted. Within
 * `epsilon` it lands exactly, so the loop can stop (no work, and no battery spent, while the visitor is still).
 */
export function approach(current: number, target: number, factor = 0.16, epsilon = 0.0015): number {
  const gap = target - current;
  return Math.abs(gap) <= epsilon ? target : current + gap * factor;
}

/** Whether the video is far enough from where it should be to be worth a seek (half a frame is not). */
export function needsSeek(currentTime: number, wanted: number, fps = 24): boolean {
  return Math.abs(currentTime - wanted) > 0.5 / fps;
}

/** Opacity for a word that fades in and out over `fade` of the film at either end of its scene. */
export function labelOpacity(progress: number, scene: TimedScene, fade = 0.025): number {
  const { from, to } = scene;
  const span = Math.max(to - from, 1e-6);
  const edge = Math.min(fade, span / 2);
  if (progress < from || progress > to) return 0;
  return clamp01(Math.min((progress - from) / edge, (to - progress) / edge));
}
