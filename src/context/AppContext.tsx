import { createContext, useContext, ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useSeniorMode } from "@/hooks/useSeniorMode";

type AuthApi = ReturnType<typeof useAuth>;
type ThemeApi = ReturnType<typeof useTheme>;
type SeniorApi = ReturnType<typeof useSeniorMode>;

interface AppContextValue {
  auth: AuthApi;
  theme: ThemeApi;
  senior: SeniorApi;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const theme = useTheme();
  const senior = useSeniorMode();

  return (
    <AppContext.Provider value={{ auth, theme, senior }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
