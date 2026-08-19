import { useEffect, useState, useCallback } from "react";
import type { SeniorEssential } from "@/types";
import { defaultSeniorEssentials } from "@/mock/seed";

const MODE_KEY = "w360_senior_mode";
const ESSENTIALS_KEY = "w360_senior_essentials";

export function useSeniorMode() {
  const [seniorMode, setSeniorModeState] = useState<boolean>(
    () => localStorage.getItem(MODE_KEY) === "true"
  );
  const [essentials, setEssentialsState] = useState<SeniorEssential[]>(() => {
    const raw = localStorage.getItem(ESSENTIALS_KEY);
    return raw ? JSON.parse(raw) : defaultSeniorEssentials;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("senior", seniorMode);
    localStorage.setItem(MODE_KEY, String(seniorMode));
  }, [seniorMode]);

  useEffect(() => {
    localStorage.setItem(ESSENTIALS_KEY, JSON.stringify(essentials));
  }, [essentials]);

  const setSeniorMode = useCallback((v: boolean) => setSeniorModeState(v), []);
  const toggleSeniorMode = useCallback(() => setSeniorModeState((v) => !v), []);

  const toggleEssential = useCallback((key: SeniorEssential["key"]) => {
    setEssentialsState((list) =>
      list.map((e) => (e.key === key ? { ...e, enabled: !e.enabled } : e))
    );
  }, []);

  return { seniorMode, setSeniorMode, toggleSeniorMode, essentials, toggleEssential };
}
