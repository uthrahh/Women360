import { useCallback } from "react";
import { navVisible } from "@/config/navigation";
import { useFeatures } from "@/context/FeaturesContext";
import { useApp } from "@/context/AppContext";
import { useFamily } from "@/context/FamilyContext";

/** Whether a screen belongs in the menus right now (see navVisible): switched-on features, her own settings, and whose records are shown. */
export function useNavVisible() {
  const features = useFeatures();
  const { auth } = useApp();
  const { acting } = useFamily();
  const u = auth.user;
  return useCallback(
    (to: string) =>
      navVisible(to, features, {
        isDemo: !!u?.isDemo,
        cycleTracking: acting ? acting.cycleTracking : u?.cycleTracking !== false,
        gameMode: !!u?.gameMode,
        acting: !!acting,
      }),
    [features, u, acting]
  );
}
