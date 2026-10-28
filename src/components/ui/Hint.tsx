import type { ReactNode } from "react";
import { useHintVisible } from "@/hooks/useHintVisible";

/**
 * An instruction or explanation: shown the first time it is met and whenever she asks for
 * tips, never permanently. It takes the paragraph's own classes so it looks exactly as the
 * text did before. Anything that must always be visible (a medical disclaimer, a privacy
 * promise, what an action will delete) is not a hint and stays a plain paragraph.
 */
export function Hint({ id, className, children, ...rest }: { id: string; className?: string; children: ReactNode } & Record<string, unknown>) {
  const visible = useHintVisible(id);
  if (!visible) return null;
  return (
    <p className={className} {...rest}>
      {children}
    </p>
  );
}
