import { useEffect } from "react";

const BASE = "Women360";

/** Sets the browser tab title for this page (and in history), restoring the default on leave. */
export function usePageTitle(title?: string) {
  useEffect(() => {
    const previous = document.title;
    document.title = title ? `${title} · ${BASE}` : `${BASE} — Your health, understood`;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
