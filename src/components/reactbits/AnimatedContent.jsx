'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';

// Women360 change: React Bits' AnimatedContent drives this with GSAP and its ScrollTrigger plugin, which is
// about 70 KB of JavaScript that every landing-page visitor had to download before anything could appear (the
// original also keeps the content `visibility: hidden` until that has run). This keeps the same props for the
// effect the app uses (a fade-and-slide reveal, on mount or when scrolled into view, optionally staggered across
// the children) with the browser's own IntersectionObserver and CSS transitions, and no library. Not carried
// over because nothing uses them: blur, rotate, tilt, wipe, scrub, disappear-after and replaying on scroll back.
// Reduced-motion visitors get the content with no movement at all.

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

// The GSAP ease names this app passes, as the CSS curves they match.
const EASES = {
  'power1.out': 'cubic-bezier(0.5, 1, 0.89, 1)',
  'power2.out': 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  'power3.out': 'cubic-bezier(0.215, 0.61, 0.355, 1)',
  'power4.out': 'cubic-bezier(0.165, 0.84, 0.44, 1)'
};

const AnimatedContent = ({
  children,
  container,
  distance = 100,
  direction = 'vertical',
  reverse = false,
  duration = 0.8,
  ease = 'power3.out',
  initialOpacity = 0,
  animateOpacity = true,
  scale = 1,
  threshold = 0.1,
  delay = 0,
  stagger = 0,
  trigger = 'scroll',
  onStart,
  onComplete,
  className = '',
  style,
  ...props
}) => {
  const ref = useRef(null);
  const callbacksRef = useRef({ onStart, onComplete });
  callbacksRef.current = { onStart, onComplete };

  useIsomorphicLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (reduce) {
      callbacksRef.current.onComplete?.();
      return undefined;
    }

    const targets = stagger > 0 && el.children.length ? Array.from(el.children) : [el];
    const axis = direction === 'horizontal' ? 'X' : 'Y';
    const offset = distance * (reverse ? -1 : 1);
    const curve = EASES[ease] || 'ease-out';
    let timer;
    let frame;
    let observer;

    // Start hidden and displaced, without a transition so it doesn't animate into the hidden state.
    for (const t of targets) {
      t.style.transition = 'none';
      t.style.opacity = animateOpacity ? String(initialOpacity) : '1';
      t.style.transform = `translate${axis}(${offset}px) scale(${scale})`;
      t.style.willChange = 'opacity, transform';
    }

    const play = () => {
      callbacksRef.current.onStart?.();
      el.getBoundingClientRect(); // commit the hidden state before transitioning out of it
      targets.forEach((t, i) => {
        const wait = delay + i * stagger;
        t.style.transition = `opacity ${duration}s ${curve} ${wait}s, transform ${duration}s ${curve} ${wait}s`;
        t.style.opacity = '1';
        t.style.transform = 'none';
      });
      const total = (delay + Math.max(targets.length - 1, 0) * stagger + duration) * 1000;
      timer = setTimeout(() => {
        for (const t of targets) {
          t.style.transition = '';
          t.style.opacity = '';
          t.style.transform = '';
          t.style.willChange = '';
        }
        callbacksRef.current.onComplete?.();
      }, total + 50);
    };

    if (trigger === 'mount') {
      // Two frames: the first paints the hidden state, the second starts the transition.
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(play);
      });
    } else {
      let root = container || null;
      if (typeof root === 'string') root = document.querySelector(root);
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            observer.disconnect();
            play();
          }
        },
        // Reveal once the top of the element is `threshold` of the way up the viewport, as the original did.
        { root, rootMargin: `0px 0px -${Math.round(threshold * 100)}% 0px`, threshold: 0 }
      );
      observer.observe(el);
    }

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      observer?.disconnect();
      for (const t of targets) {
        t.style.transition = '';
        t.style.opacity = '';
        t.style.transform = '';
        t.style.willChange = '';
      }
    };
  }, [container, distance, direction, reverse, duration, ease, initialOpacity, animateOpacity, scale, threshold, delay, stagger, trigger]);

  return (
    <div ref={ref} className={className} style={style} {...props}>
      {children}
    </div>
  );
};

export default AnimatedContent;
