import { useEffect, useState } from "react";

/** True while a request to the server has been waiting longer than a few seconds (the free server sleeps when idle and takes a while to wake). */
export function useApiWaking(): boolean {
  const [waking, setWaking] = useState(false);
  useEffect(() => {
    const on = (e: Event) => setWaking((e as CustomEvent<boolean>).detail === true);
    window.addEventListener("w360:api-slow", on);
    return () => window.removeEventListener("w360:api-slow", on);
  }, []);
  return waking;
}
