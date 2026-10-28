import { useEffect, useState } from "react";
import { useTips } from "@/context/TipsContext";
import { hintSeen, markHintSeen } from "@/lib/hints";

/**
 * Whether an instruction should be on screen: the first time it is ever met, or while she
 * has tips switched on. Meeting it once is enough; it is remembered from then on.
 */
export function useHintVisible(id: string): boolean {
  const { tipsOn } = useTips();
  const [firstTime] = useState(() => !hintSeen(id));
  useEffect(() => markHintSeen(id), [id]);
  return firstTime || tipsOn;
}
