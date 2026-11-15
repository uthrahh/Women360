import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { onSoundsChange, setSoundsOn, soundsOn } from "@/lib/sound";
import { cn } from "@/lib/utils";

/** The speaker switch shown beside controls that make sounds. The same setting lives in Settings > Accessibility. */
export function SoundToggle({ className }: { className?: string }) {
  const [on, setOn] = useState(soundsOn);
  useEffect(() => onSoundsChange(setOn), []);
  return (
    <button
      type="button"
      onClick={() => setSoundsOn(!on)}
      aria-pressed={on}
      aria-label={on ? "Sounds on. Turn off" : "Sounds off. Turn on"}
      title={on ? "Sounds on" : "Sounds off"}
      className={cn("p-1.5 rounded-full text-[var(--w360-text-muted)] hover:text-[var(--w360-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--w360-focus)]", className)}
    >
      {on ? <Volume2 size={16} aria-hidden /> : <VolumeX size={16} aria-hidden />}
    </button>
  );
}
