import { useCallback } from "react";
import { flushSync } from "react-dom";
import { useNavigate } from "react-router-dom";

type WithTransitions = Document & { startViewTransition?: (update: () => void) => unknown };

/**
 * Navigate with a short cross-fade between screens, where the browser supports View Transitions (Chrome, Edge, Safari 18).
 * React Router's BrowserRouter ignores its own viewTransition option (only the data-router API honours it), so this
 * asks the browser directly: the screen change is applied synchronously inside the transition, so the browser can
 * capture the "before" and "after". Without browser support, or for someone who prefers reduced motion, it is a plain navigation.
 */
export function useTransitionNavigate() {
  const navigate = useNavigate();
  return useCallback(
    (to: string) => {
      const doc = document as WithTransitions;
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (!doc.startViewTransition || reduce) {
        navigate(to);
        return;
      }
      doc.startViewTransition(() => flushSync(() => navigate(to)));
    },
    [navigate]
  );
}
