import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useApp } from "@/context/AppContext";
import { clampIndex, drumHeight, drumPosition, easeOut, glideDuration, indexAt, restingIndex, rubberBand } from "@/lib/wheel";
import { playTick } from "@/lib/sound";
import { cn } from "@/lib/utils";

export interface WheelItem<T extends string | number> {
  value: T;
  label: string;
}

interface WheelPickerProps<T extends string | number> {
  items: WheelItem<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name, e.g. "Year". Shown above the wheel unless `hideLabel`. */
  label: string;
  hideLabel?: boolean;
  /** Called the first time she moves the wheel (used to tell "chosen" apart from "still at its starting place"). */
  onTouch?: () => void;
  className?: string;
}

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * A picker you spin: a drum of items, the chosen one level in the middle.
 * Drag it, flick it (it keeps its momentum and glides to rest on a whole item), scroll it, tap an item, or use the
 * keyboard (arrows, Page Up/Down, Home/End); each item passing the middle clicks. Items turn away and soften with
 * distance, so the middle one is unmistakable. For screen readers it is a single spin button that announces the
 * chosen label. Reduced motion: no glide and no blur. Senior Mode: larger items.
 */
export function WheelPicker<T extends string | number>({ items, value, onChange, label, hideLabel, onTouch, className }: WheelPickerProps<T>) {
  const { senior } = useApp();
  const itemHeight = senior.seniorMode ? 52 : 40;
  const count = items.length;
  const max = (count - 1) * itemHeight;
  const selected = Math.max(0, items.findIndex((i) => i.value === value));
  const [offset, setOffsetState] = useState(selected * itemHeight);
  const offsetRef = useRef(offset);
  const lastIndex = useRef(selected);
  const anim = useRef(0);
  // Where the wheel is heading: key presses and wheel notches count from here, so quick presses never lose a step.
  const target = useRef(selected);
  const drag = useRef<{ startY: number; startOffset: number; samples: { t: number; y: number }[]; moved: boolean; pointerId: number } | null>(null);
  const touched = useRef(false);
  const wheelAccumulator = useRef(0);
  const root = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const height = drumHeight(itemHeight);

  const setOffset = useCallback(
    (next: number) => {
      offsetRef.current = next;
      setOffsetState(next);
      const i = indexAt(next, itemHeight, count);
      if (i !== lastIndex.current) {
        lastIndex.current = i;
        playTick();
      }
    },
    [itemHeight, count]
  );

  const touch = useCallback(() => {
    if (!touched.current) {
      touched.current = true;
      onTouch?.();
    }
  }, [onTouch]);

  const settle = useCallback(
    (index: number) => {
      cancelAnimationFrame(anim.current);
      target.current = clampIndex(index, count);
      const to = target.current * itemHeight;
      const from = offsetRef.current;
      const done = () => {
        anim.current = 0;
        setOffset(to);
        const item = items[clampIndex(index, count)];
        if (item && item.value !== value) onChange(item.value);
      };
      if (reducedMotion() || Math.abs(to - from) < 0.5) return done();
      const duration = glideDuration(to - from);
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        setOffset(from + (to - from) * easeOut(t));
        if (t < 1) anim.current = requestAnimationFrame(step);
        else done();
      };
      anim.current = requestAnimationFrame(step);
    },
    [count, itemHeight, items, onChange, setOffset, value]
  );

  // Follow the value when it changes from outside (or when the list changes, e.g. fewer days in a month).
  useEffect(() => {
    if (drag.current) return;
    const at = selected * itemHeight;
    if (Math.abs(offsetRef.current - at) > 0.5 && !anim.current) {
      lastIndex.current = selected;
      target.current = selected;
      offsetRef.current = at;
      setOffsetState(at);
    }
     
  }, [selected, itemHeight]);

  useEffect(() => () => cancelAnimationFrame(anim.current), []);

  // Mouse wheel / trackpad: one detent per notch, accumulated for smooth trackpads. Non-passive so the page doesn't scroll.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      touch();
      wheelAccumulator.current += e.deltaY;
      const steps = Math.trunc(wheelAccumulator.current / 40);
      if (steps !== 0) {
        wheelAccumulator.current -= steps * 40;
        settle((anim.current ? target.current : indexAt(offsetRef.current, itemHeight, count)) + steps);
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [settle, touch, itemHeight, count]);

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    cancelAnimationFrame(anim.current);
    anim.current = 0;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startY: e.clientY, startOffset: offsetRef.current, samples: [{ t: performance.now(), y: e.clientY }], moved: false, pointerId: e.pointerId };
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.abs(dy) < 4) return;
    if (!d.moved) touch();
    d.moved = true;
    d.samples.push({ t: performance.now(), y: e.clientY });
    if (d.samples.length > 6) d.samples.shift();
    setOffset(rubberBand(d.startOffset - dy, 0, max, height));
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    if (!d.moved) {
      // A tap: choose the item that was tapped.
      const rect = e.currentTarget.getBoundingClientRect();
      const fromCentre = e.clientY - (rect.top + rect.height / 2);
      const steps = Math.round(fromCentre / (itemHeight * 0.95));
      if (steps !== 0) {
        touch();
        settle(indexAt(offsetRef.current, itemHeight, count) + steps);
      }
      return;
    }
    // Release velocity from the last ~100 ms of movement (px/ms; dragging up moves to later items).
    const now = performance.now();
    const recent = d.samples.filter((s) => now - s.t < 100);
    const first = recent[0] ?? d.samples[0];
    const last = d.samples[d.samples.length - 1];
    const dt = Math.max(1, last.t - first.t);
    const velocity = recent.length > 1 ? -(last.y - first.y) / dt : 0;
    settle(restingIndex(offsetRef.current, reducedMotion() ? 0 : velocity, itemHeight, count));
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const current = anim.current ? target.current : indexAt(offsetRef.current, itemHeight, count);
    const moves: Record<string, number> = { ArrowDown: current + 1, ArrowUp: current - 1, PageDown: current + 5, PageUp: current - 5, Home: 0, End: count - 1 };
    if (!(e.key in moves)) return;
    e.preventDefault();
    touch();
    settle(moves[e.key]);
  }

  const centre = offset / itemHeight;
  const first = Math.max(0, Math.floor(centre) - 4);
  const last = Math.min(count - 1, Math.ceil(centre) + 4);
  const blur = !reducedMotion();

  return (
    <div className={cn("flex flex-col items-stretch min-w-0", className)}>
      <span id={labelId} className={cn("text-xs font-medium text-[var(--w360-text-muted)] text-center mb-1 senior:text-sm", hideLabel && "sr-only")}>
        {label}
      </span>
      <div
        ref={root}
        role="spinbutton"
        tabIndex={0}
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={count - 1}
        aria-valuenow={selected}
        aria-valuetext={items[selected]?.label}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        className="relative select-none touch-none cursor-grab active:cursor-grabbing rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--w360-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--w360-bg)]"
        style={{ height, WebkitMaskImage: "linear-gradient(to bottom, transparent, #000 22%, #000 78%, transparent)", maskImage: "linear-gradient(to bottom, transparent, #000 22%, #000 78%, transparent)" }}
      >
        {/* The band that marks the middle: a soft fill, no borders. */}
        <div aria-hidden className="absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-xl bg-[var(--w360-tint)]" style={{ height: itemHeight }} />
        <div aria-hidden className="absolute inset-0" style={{ perspective: 600 }}>
          {items.slice(first, last + 1).map((item, k) => {
            const i = first + k;
            const p = drumPosition(i - centre, itemHeight);
            if (!p.visible) return null;
            const isMiddle = Math.abs(i - centre) < 0.5;
            return (
              <div
                key={String(item.value)}
                className={cn(
                  "absolute inset-x-0 top-1/2 flex items-center justify-center tabular-nums tracking-[0.01em] whitespace-nowrap will-change-transform",
                  isMiddle ? "font-semibold text-[var(--w360-text)]" : "text-[var(--w360-text-muted)]",
                  senior.seniorMode ? "text-xl" : "text-base"
                )}
                style={{
                  height: itemHeight,
                  marginTop: -itemHeight / 2,
                  transform: `translateY(${p.y}px) rotateX(${-p.angle}deg)`,
                  opacity: 0.25 + 0.75 * p.facing ** 1.5,
                  filter: blur ? `blur(${((1 - p.facing) * 2.2).toFixed(2)}px)` : undefined,
                  backfaceVisibility: "hidden",
                }}
              >
                {item.label}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
