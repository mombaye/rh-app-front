import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { getAlertesPeriodeEssai } from "@/services/employeeService";
import type { AlertePeriodeEssai } from "@/services/employeeService";

interface AlertesContextValue {
  alertes:      AlertePeriodeEssai[];
  loading:      boolean;
  urgentsCount: number;
  totalCount:   number;
}

const AlertesContext = createContext<AlertesContextValue>({
  alertes:      [],
  loading:      true,
  urgentsCount: 0,
  totalCount:   0,
});

export function AlertesProvider({ children }: { children: ReactNode }) {
  const [alertes, setAlertes] = useState<AlertePeriodeEssai[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAlertesPeriodeEssai(30)
      .then((r) => setAlertes(r.results))
      .catch(() => setAlertes([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AlertesContext.Provider value={{
      alertes,
      loading,
      urgentsCount: alertes.filter((a) => a.jours_restants <= 7).length,
      totalCount:   alertes.length,
    }}>
      {children}
    </AlertesContext.Provider>
  );
}

export const useAlertes = () => useContext(AlertesContext);
