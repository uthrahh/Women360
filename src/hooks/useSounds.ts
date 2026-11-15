import { useEffect, useState } from "react";
import { onSoundsChange, setSoundsOn, soundsOn } from "@/lib/sound";

/** The interface-sounds switch, kept in step everywhere it appears. */
export function useSounds() {
  const [on, setOn] = useState(soundsOn);
  useEffect(() => onSoundsChange(setOn), []);
  return { on, toggle: () => setSoundsOn(!on) };
}
