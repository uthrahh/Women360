/**
 * "A Lifetime in Bloom": the scroll-driven film on the landing page.
 *
 * This file is the single description of the film: where its files live, how long each scene runs, and the words that appear. The
 * brief for producing the footage is docs/LIFE_FILM.md, and the scene lengths below must match the edit of the finished film.
 *
 * The section appears only when BOTH are true: the build has VITE_LIFE_FILM=on, and the film files exist. Without the files it
 * removes itself (nothing else on the page moves), so switching it on early is safe, and no placeholder animation ever stands in for the footage.
 */
export const LIFE_FILM_ON = import.meta.env.VITE_LIFE_FILM === "on";

/** The files, in /public/film. Two compositions: a wide one for landscape screens and a tall one for phones held upright. */
export const FILM_FILES = {
  landscape: { mp4: "/film/life-landscape.mp4", webm: "/film/life-landscape.webm", poster: "/film/poster-landscape.jpg" },
  portrait: { mp4: "/film/life-portrait.mp4", webm: "/film/life-portrait.webm", poster: "/film/poster-portrait.jpg" },
} as const;

/**
 * How much scrolling the film takes, as a multiple of the screen height the section occupies in total. 2.2 means the section is
 * pinned while the visitor scrolls 1.2 screens: enough to feel the passage of time, short enough not to feel like a trap.
 */
export const SCROLL_SCREENS = { landscape: 2.3, portrait: 2.1 } as const;

export interface Scene {
  id: string;
  /** The small word shown while this scene plays. */
  label: string;
  /** How long the scene runs in the finished film, in seconds (the bridge into the next scene is part of its own scene's time). */
  seconds: number;
}

export const SCENES: Scene[] = [
  // Whole frames at 24 fps (60, 54, 54, 60, 60, 60 = 348 frames, 14.5 s), so the edit can match these exactly.
  { id: "childhood", label: "Childhood", seconds: 2.5 },
  { id: "growing", label: "Growing", seconds: 2.25 },
  { id: "becoming", label: "Becoming", seconds: 2.25 },
  { id: "flourishing", label: "Flourishing", seconds: 2.5 },
  { id: "evolving", label: "Evolving", seconds: 2.5 },
  { id: "lifetime", label: "A lifetime", seconds: 2.5 },
];

/** Where the closing words take over, as a fraction of the whole film. Before this the labels play; after it the headline holds. */
export const HEADLINE_FROM = 0.9;

export const FILM_COPY = {
  /** For screen readers and the static version: the one heading of the section. */
  title: "A lifetime in bloom",
  headline: "Every stage of her life matters.",
  support: "Women's health and wellbeing, considered across a lifetime.",
  /** What the film shows, in words, for people who can't see it or who have chosen not to play it. */
  description:
    "A short film in one garden. A girl runs through it in the morning light. As she runs she grows: a young woman, a woman in midlife, an older woman who walks slowly and touches a flower, and finally an elderly woman who pauses beneath a flowering tree and smiles. The seasons turn around her, and a blossom drifts across the view to begin again.",
};

export interface TimedScene extends Scene {
  /** 0 to 1: when this scene starts and ends within the whole film. */
  from: number;
  to: number;
}

/** The scenes with their place in the film as fractions, from their lengths. */
export function timeline(scenes: Scene[] = SCENES): TimedScene[] {
  const total = scenes.reduce((sum, s) => sum + s.seconds, 0);
  let elapsed = 0;
  return scenes.map((s) => {
    const from = elapsed / total;
    elapsed += s.seconds;
    return { ...s, from, to: elapsed / total };
  });
}

export const FILM_SECONDS = SCENES.reduce((sum, s) => sum + s.seconds, 0);
