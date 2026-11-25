import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { setActing } from "@/services/apiClient";
import { familyService } from "@/services/familyService";
import type { OpenedPerson } from "@/types/family";

interface FamilyApi {
  /** Whose records the screens show, when it isn't her own. */
  acting: OpenedPerson | null;
  open: (personId: string) => Promise<OpenedPerson>;
  backToMe: () => void;
}

const FamilyContext = createContext<FamilyApi>({ acting: null, open: async () => Promise.reject(new Error("No family provider")), backToMe: () => {} });

/** Which person's records the signed-in screens show. Opening one checks access on the server and is recorded; it lasts until she goes back (or reloads). */
export function FamilyProvider({ children }: { children: ReactNode }) {
  const [acting, setState] = useState<OpenedPerson | null>(null);
  const open = useCallback(async (personId: string) => {
    const p = await familyService.open(personId);
    setActing({ id: p.id, name: p.name, access: p.access });
    setState(p);
    return p;
  }, []);
  const backToMe = useCallback(() => {
    setActing(null);
    setState(null);
  }, []);
  const value = useMemo(() => ({ acting, open, backToMe }), [acting, open, backToMe]);
  return <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>;
}

export const useFamily = () => useContext(FamilyContext);
