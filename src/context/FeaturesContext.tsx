import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { request } from "@/services/apiClient";

interface Features {
  /** The screening schedule, "worth discussing" patterns, condition guidance, activity plans, explain-this cards and Learn. Off until a clinician has reviewed them. */
  clinicalContent: boolean;
  supportEmail: string | null;
  /** False until the server has answered, so nothing flashes in and out. */
  loaded: boolean;
}

// While loading, and if the server can't be reached, everything that needs review stays hidden.
const OFF: Features = { clinicalContent: false, supportEmail: null, loaded: false };
const FeaturesContext = createContext<Features>(OFF);

/** Asks the server once which features are switched on. Public: it works before anyone signs in. */
export function FeaturesProvider({ children }: { children: ReactNode }) {
  const [features, setFeatures] = useState<Features>(OFF);
  useEffect(() => {
    request<{ clinicalContent: boolean; supportEmail: string | null }>("/config")
      .then((c) => setFeatures({ clinicalContent: c.clinicalContent === true, supportEmail: c.supportEmail, loaded: true }))
      .catch(() => setFeatures({ ...OFF, loaded: true }));
  }, []);
  const value = useMemo(() => features, [features]);
  return <FeaturesContext.Provider value={value}>{children}</FeaturesContext.Provider>;
}

export const useFeatures = () => useContext(FeaturesContext);
