import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FILM_COPY, FILM_FILES, HEADLINE_FROM, LIFE_FILM_ON, SCENES, SCROLL_SCREENS, timeline } from "@/content/lifeFilm";
import { approach, clamp01, labelOpacity, needsSeek, sectionProgress, targetTime } from "@/lib/filmScrub";

/**
 * "A Lifetime in Bloom": a short film that plays as the visitor scrolls. The section pins to the screen (with CSS `position: sticky`, so
 * scrolling is never taken over or blocked), the film's clock follows the scroll position, one quiet word at a time names the stage, and
 * the section lets go at the end. Scrolling up runs it backwards.
 *
 * It renders nothing unless the build has VITE_LIFE_FILM=on AND the film's files load: no placeholder ever stands in for the footage.
 * Nothing is downloaded until the visitor is within a screen or so of it. Visitors who prefer reduced motion, or have asked their
 * phone to save data, get a still version with the same words and no video. Production notes: docs/LIFE_FILM.md.
 */
export function LifeFilm() {
  if (!LIFE_FILM_ON) return null;
  return <Film />;
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatches(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return matches;
}

/** True when the phone or browser has been asked to save data: the film is large, so it is not fetched. */
function savesData(): boolean {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return connection?.saveData === true;
}

const FPS = 24;

function Film() {
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const portrait = useMediaQuery("(max-aspect-ratio: 1/1)");
  const still = reduced || savesData();
  const [failed, setFailed] = useState(false);
  const [posterMissing, setPosterMissing] = useState(false);
  if (failed) return null;

  const files = portrait ? FILM_FILES.portrait : FILM_FILES.landscape;
  return still ? (
    <StillFilm poster={posterMissing ? null : files.poster} onPosterMissing={() => setPosterMissing(true)} />
  ) : (
    <ScrollFilm key={portrait ? "portrait" : "landscape"} portrait={portrait} onFailed={() => setFailed(true)} />
  );
}

/** The words, readable by anyone: what the film shows, and the stages in order. */
function ReadableStory({ withHeading }: { withHeading: boolean }) {
  return (
    <>
      {withHeading && <h2 id="life-film-heading" className="sr-only">{FILM_COPY.title}</h2>}
      <p className="sr-only">{FILM_COPY.description}</p>
      <ol className="sr-only">
        {SCENES.map((s) => (
          <li key={s.id}>{s.label}</li>
        ))}
      </ol>
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// The scroll-driven film
// ---------------------------------------------------------------------------------------------------------------------

function ScrollFilm({ portrait, onFailed }: { portrait: boolean; onFailed: () => void }) {
  const scenes = useMemo(() => timeline(), []);
  const files = portrait ? FILM_FILES.portrait : FILM_FILES.landscape;
  const sectionRef = useRef<HTMLElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const labelRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const headlineRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLSpanElement>(null);

  const [near, setNear] = useState(false);
  const [ready, setReady] = useState(false);
  const [posterMissing, setPosterMissing] = useState(false);

  // Nothing is fetched while the page itself is still loading (the film must never slow the first paint), and after that only once
  // the visitor is within half a screen of it.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: "50% 0px 50% 0px" }
    );
    const idle = (fn: () => void) =>
      typeof window.requestIdleCallback === "function" ? window.requestIdleCallback(fn, { timeout: 2000 }) : window.setTimeout(fn, 200);
    let cancelled = false;
    const start = () => idle(() => !cancelled && io.observe(el));
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener("load", start);
      io.disconnect();
    };
  }, []);

  // The loop: read the scroll position, ease the film's clock towards it, and stop as soon as it has arrived.
  const durationRef = useRef(0);
  const seekingRef = useRef(false);
  const currentRef = useRef(0);
  const frameRef = useRef(0);

  const paint = useCallback(
    (p: number) => {
      scenes.forEach((scene, i) => {
        const el = labelRefs.current[i];
        if (!el) return;
        const headline = clamp01((p - HEADLINE_FROM) / 0.06);
        const o = labelOpacity(p, scene) * (1 - headline);
        el.style.opacity = String(o);
        el.style.transform = `translateY(${(1 - o) * 10}px)`;
      });
      if (headlineRef.current) {
        const o = clamp01((p - HEADLINE_FROM) / 0.06);
        headlineRef.current.style.opacity = String(o);
        headlineRef.current.style.transform = `translateY(${(1 - o) * 14}px)`;
      }
      if (markRef.current) markRef.current.style.transform = `scaleX(${p})`;
      const video = videoRef.current;
      const duration = durationRef.current;
      if (video && duration > 0 && !seekingRef.current) {
        const wanted = targetTime(p, duration);
        if (needsSeek(video.currentTime, wanted, FPS)) {
          seekingRef.current = true;
          video.currentTime = wanted;
        }
      }
    },
    [scenes]
  );

  const tick = useCallback(() => {
    frameRef.current = 0;
    const section = sectionRef.current;
    const pin = pinRef.current;
    if (!section || !pin) return;
    const target = sectionProgress(section.getBoundingClientRect().top, section.offsetHeight - pin.offsetHeight);
    currentRef.current = approach(currentRef.current, target);
    paint(currentRef.current);
    if (currentRef.current !== target) frameRef.current = requestAnimationFrame(tick);
  }, [paint]);

  const wake = useCallback(() => {
    if (!frameRef.current) frameRef.current = requestAnimationFrame(tick);
  }, [tick]);

  useEffect(() => {
    // Listening starts when the film is near; the first reading puts it exactly where the page already is (no catching up from zero).
    if (!near) return;
    const section = sectionRef.current;
    const pin = pinRef.current;
    if (section && pin) currentRef.current = sectionProgress(section.getBoundingClientRect().top, section.offsetHeight - pin.offsetHeight);
    paint(currentRef.current);
    window.addEventListener("scroll", wake, { passive: true });
    window.addEventListener("resize", wake);
    return () => {
      window.removeEventListener("scroll", wake);
      window.removeEventListener("resize", wake);
      cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
    };
  }, [near, paint, wake]);

  // Before the film is near, the words are in their first state: nothing showing.
  useEffect(() => paint(0), [paint]);

  const screens = portrait ? SCROLL_SCREENS.portrait : SCROLL_SCREENS.landscape;

  return (
    <section
      ref={sectionRef}
      aria-labelledby="life-film-heading"
      className="film-section relative bg-[#16110e]"
      style={{ ["--film-len" as string]: String(screens) }}
    >
      <div ref={pinRef} className="film-pin sticky top-0 overflow-hidden">
        <a
          href="#what"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-20 focus:rounded-md focus:bg-[var(--w360-bg-raised)] focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-[var(--w360-text)]"
        >
          Skip the film
        </a>

        {/* The still shown while the film loads, and kept if it is slow. Fetched on the same signal as the film, not before. */}
        {near && !posterMissing && (
          <img
            src={files.poster}
            alt=""
            aria-hidden
            loading="lazy"
            decoding="async"
            onError={() => setPosterMissing(true)}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${ready ? "opacity-0" : "opacity-100"}`}
          />
        )}

        {near && (
          <video
            ref={videoRef}
            muted
            playsInline
            preload="auto"
            tabIndex={-1}
            aria-hidden
            disablePictureInPicture
            disableRemotePlayback
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`}
            onLoadedMetadata={(e) => {
              const video = e.currentTarget;
              durationRef.current = video.duration;
              // Some phones only show a frame from a paused video once it has been started once.
              void video.play().then(() => video.pause()).catch(() => undefined);
            }}
            onLoadedData={() => {
              setReady(true);
              wake();
            }}
            onSeeked={() => {
              seekingRef.current = false;
              wake();
            }}
          >
            <source src={files.webm} type="video/webm" />
            <source src={files.mp4} type="video/mp4" onError={onFailed} />
          </video>
        )}

        {/* Darkens the lower part, only so that the words can be read over any footage. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent" />

        <ReadableStory withHeading />

        <div
          aria-hidden
          className="pointer-events-none absolute left-6 sm:left-14 bottom-[calc(4.5rem+var(--safe-bottom))] sm:bottom-[calc(5rem+var(--safe-bottom))] h-12"
        >
          {scenes.map((scene, i) => (
            <span
              key={scene.id}
              ref={(el) => {
                labelRefs.current[i] = el;
              }}
              style={{ opacity: 0 }}
              className="absolute bottom-0 left-0 whitespace-nowrap font-display italic text-3xl sm:text-5xl text-white will-change-[opacity,transform]"
            >
              {scene.label}
            </span>
          ))}
        </div>

        <div
          ref={headlineRef}
          style={{ opacity: 0 }}
          className="absolute left-6 right-6 sm:left-14 sm:right-auto bottom-[calc(4.5rem+var(--safe-bottom))] sm:bottom-[calc(5rem+var(--safe-bottom))] max-w-2xl text-white will-change-[opacity,transform]"
        >
          <p className="font-display text-4xl sm:text-6xl font-semibold tracking-tight leading-[1.06] [text-wrap:balance]">
            {FILM_COPY.headline}
          </p>
          <p className="mt-4 text-base sm:text-lg text-white/85 max-w-md">{FILM_COPY.support}</p>
        </div>

        {/* A hairline that fills as the film goes: the only sign that there is a "how far". */}
        <div aria-hidden className="absolute inset-x-6 sm:inset-x-14 bottom-[calc(2rem+var(--safe-bottom))] h-px bg-white/25">
          <span ref={markRef} className="block h-full origin-left bg-white/80" style={{ transform: "scaleX(0)" }} />
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// The still version: reduced motion, or data saving
// ---------------------------------------------------------------------------------------------------------------------

function StillFilm({ poster, onPosterMissing }: { poster: string | null; onPosterMissing: () => void }) {
  return (
    <section aria-labelledby="life-film-heading" className="px-4 py-20 border-t border-[var(--w360-border)]">
      <div className="max-w-5xl mx-auto">
        <ReadableStory withHeading={false} />
        {poster && (
          <img
            src={poster}
            alt=""
            loading="lazy"
            decoding="async"
            onError={onPosterMissing}
            className="w-full aspect-[16/10] sm:aspect-[16/7] object-cover rounded-[1.75rem] bg-[var(--w360-bg-warm)]"
          />
        )}
        <h2 id="life-film-heading" className="mt-10 font-display text-3xl sm:text-5xl font-semibold tracking-tight [text-wrap:balance]">
          {FILM_COPY.headline}
        </h2>
        <p className="mt-4 text-[var(--w360-text-muted)] max-w-xl">{FILM_COPY.support}</p>
        <ol aria-hidden className="mt-8 flex flex-wrap gap-x-6 gap-y-2 font-display italic text-lg text-[var(--w360-text-muted)]">
          {SCENES.map((s) => (
            <li key={s.id}>{s.label}</li>
          ))}
        </ol>
      </div>
    </section>
  );
}
