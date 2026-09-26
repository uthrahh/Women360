export interface ActivityTemplate {
  label: string;
  type: string;
  duration: number;
  intensity: "low" | "moderate" | "high";
}

// A small static library of guided-routine presets — text-based on purpose
// (video-guided workouts are a content-production project of their own,
// out of scope here). Tapping one prefills the existing Add activity form
// instead of a blank one, still editable before saving.
export const ACTIVITY_TEMPLATES: ActivityTemplate[] = [
  { label: "15-min walk", type: "Walk", duration: 15, intensity: "low" },
  { label: "30-min brisk walk", type: "Brisk walk", duration: 30, intensity: "moderate" },
  { label: "20-min strength (bodyweight)", type: "Strength (bodyweight)", duration: 20, intensity: "moderate" },
  { label: "10-min stretch / mobility", type: "Stretch / mobility", duration: 10, intensity: "low" },
  { label: "30-min cycling", type: "Cycling", duration: 30, intensity: "moderate" },
  { label: "20-min yoga", type: "Yoga", duration: 20, intensity: "low" },
];

export const LOW_INTENSITY_TEMPLATES = ACTIVITY_TEMPLATES.filter((t) => t.intensity === "low");
