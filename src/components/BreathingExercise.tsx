import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

/**
 * A simple guided box-breathing pacer (4s inhale / 4s hold / 4s exhale /
 * 4s hold) — no audio, no external content dependency. The on-screen
 * countdown text is the actual pacing mechanism; the circle's scale
 * transition is a purely decorative layer on top of it, so a
 * prefers-reduced-motion user (index.css forces near-zero transition
 * durations globally) still gets a fully working, just visually static,
 * pacer rather than a broken one.
 */
const PHASE_SEQUENCE = [
  { phase: "inhale" as const, label: "Breathe in", seconds: 4 },
  { phase: "hold1" as const, label: "Hold", seconds: 4 },
  { phase: "exhale" as const, label: "Breathe out", seconds: 4 },
  { phase: "hold2" as const, label: "Hold", seconds: 4 },
];
const CYCLES = 8; // roughly 2 minutes

export function BreathingExercise() {
  const [running, setRunning] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(PHASE_SEQUENCE[0].seconds);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!running) return;
    const timer = setTimeout(() => {
      if (secondsLeft > 1) {
        setSecondsLeft((s) => s - 1);
        return;
      }
      const nextStep = (stepIndex + 1) % PHASE_SEQUENCE.length;
      const completedCycle = nextStep === 0;
      if (completedCycle && cycle + 1 >= CYCLES) {
        setRunning(false);
        setDone(true);
        return;
      }
      setStepIndex(nextStep);
      setSecondsLeft(PHASE_SEQUENCE[nextStep].seconds);
      if (completedCycle) setCycle((c) => c + 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [running, secondsLeft, stepIndex, cycle]);

  const current = PHASE_SEQUENCE[stepIndex];
  const expanded = current.phase === "inhale" || current.phase === "hold1";

  function start() {
    setStepIndex(0);
    setSecondsLeft(PHASE_SEQUENCE[0].seconds);
    setCycle(0);
    setDone(false);
    setRunning(true);
  }

  return (
    <div className="flex flex-col items-center gap-4 py-2">
      <div className="relative w-40 h-40 flex items-center justify-center">
        <div
          className="absolute inset-0 rounded-full bg-maroon-100 dark:bg-maroon-900/40"
          style={{
            transform: `scale(${expanded ? 1 : 0.65})`,
            transitionProperty: "transform",
            transitionDuration: running ? `${current.seconds}s` : "0.3s",
            transitionTimingFunction: "ease-in-out",
          }}
        />
        <div className="relative flex flex-col items-center">
          <span className="text-sm font-medium senior:text-base">{running ? current.label : done ? "Nice work" : "Ready?"}</span>
          {running && <span className="text-2xl font-display font-semibold tabular-nums">{secondsLeft}</span>}
        </div>
      </div>
      {done ? (
        <p className="text-sm text-[var(--w360-text-muted)] text-center">
          That's about two minutes of paced breathing. Do it again anytime you need a moment.
        </p>
      ) : (
        <p className="text-xs text-[var(--w360-text-muted)] text-center max-w-[220px]">
          Box breathing: 4 seconds in, hold 4, out 4, hold 4. About two minutes, no audio needed.
        </p>
      )}
      <Button size="sm" variant={running ? "secondary" : "primary"} onClick={running ? () => setRunning(false) : start}>
        {running ? "Stop" : done ? "Do it again" : "Start"}
      </Button>
    </div>
  );
}
