import { useEffect, useRef, useState, type CSSProperties } from "react";
import { pickScene, sceneViewBox } from "@/lib/sceneScroll";
import { SCENES, SceneDefs } from "./art";
import "./scenes.css";

/**
 * "A lifetime in bloom": the landing page's moving background. A fixed, hand-drawn stage behind the page whose
 * scene follows the section being read (sections opt in with `data-scene="<id>"`) and whose drawing moves with the
 * scroll, forwards and backwards, like scrubbing a film. Purely decorative: hidden from assistive technology,
 * never takes a tap, and the words on the page never depend on it.
 */
export default function LifeScenes() {
  const [ids, setIds] = useState<string[]>([]);
  const [at, setAt] = useState({ index: 0, progress: 0 });
  const [viewBox, setViewBox] = useState(() => sceneViewBox(window.innerWidth, window.innerHeight));
  const [still, setStill] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const tops = useRef<number[]>([]);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotion = () => setStill(motion.matches);
    motion.addEventListener("change", onMotion);

    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.scrollY + window.innerHeight * 0.55;
      const end = document.documentElement.scrollHeight - window.innerHeight * 0.45;
      const next = pickScene(tops.current, line, end);
      setAt((s) => (s.index === next.index && s.progress === next.progress ? s : next));
    };
    const measure = () => {
      const marks = Array.from(document.querySelectorAll<HTMLElement>("[data-scene]")).filter((el) => el.dataset.scene! in SCENES);
      tops.current = marks.map((el) => el.getBoundingClientRect().top + window.scrollY);
      const nextIds = marks.map((el) => el.dataset.scene!);
      setIds((old) => (old.join() === nextIds.join() ? old : nextIds));
      setViewBox(sceneViewBox(window.innerWidth, window.innerHeight));
      update();
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure);
    // Sections change height as they reveal, fonts load and answers open: re-measure when the page does.
    const resize = new ResizeObserver(() => measure());
    resize.observe(document.body);
    return () => {
      motion.removeEventListener("change", onMotion);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
      resize.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="sc-root" aria-hidden="true" data-testid="life-scenes" data-scene-active={ids[at.index] ?? ""}>
      <SceneDefs />
      <div className="sc-stage">
        {ids.map((id, i) => {
          const scene = SCENES[id];
          // Scenes already passed rest finished, scenes ahead rest at their start; reduced motion shows each one complete.
          const p = still ? 1 : i < at.index ? 1 : i > at.index ? 0 : at.progress;
          const active = i === at.index;
          return (
            <div key={`${id}-${i}`} className="sc-scene" data-active={active ? "" : undefined} data-scene-id={id} style={{ "--p": p } as CSSProperties}>
              <svg className="sc-back" viewBox={viewBox} preserveAspectRatio="xMidYMid slice" focusable="false">
                {scene.back()}
              </svg>
              <svg className="sc-front" viewBox={viewBox} preserveAspectRatio="xMidYMid slice" focusable="false">
                {scene.front()}
              </svg>
            </div>
          );
        })}
      </div>
      <div className="sc-veil" />
    </div>
  );
}
