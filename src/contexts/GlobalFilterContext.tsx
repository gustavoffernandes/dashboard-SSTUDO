import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";

const STORAGE_KEY = "proativa:global-filter";

interface GlobalFilterContextType {
  /** Empresa selecionada globalmente ("" = todas) */
  companyId: string;
  /** Formulário selecionado globalmente ("" = todos) */
  formId: string;
  setCompanyId: (id: string) => void;
  setFormId: (id: string) => void;
  resetFilter: () => void;
}

const GlobalFilterContext = createContext<GlobalFilterContextType | undefined>(undefined);

function readStored(): { companyId: string; formId: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { companyId: "", formId: "" };
    const parsed = JSON.parse(raw);
    return { companyId: parsed?.companyId ?? "", formId: parsed?.formId ?? "" };
  } catch {
    return { companyId: "", formId: "" };
  }
}

export function GlobalFilterProvider({ children }: { children: ReactNode }) {
  const initial = readStored();
  const [companyId, setCompanyIdState] = useState(initial.companyId);
  const [formId, setFormIdState] = useState(initial.formId);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ companyId, formId }));
    } catch {
      /* ignore */
    }
  }, [companyId, formId]);

  // Trocar de empresa sempre limpa o formulário (formulários pertencem a uma empresa)
  const setCompanyId = useCallback((id: string) => {
    setCompanyIdState(id);
    setFormIdState("");
  }, []);

  const setFormId = useCallback((id: string) => setFormIdState(id), []);

  const resetFilter = useCallback(() => {
    setCompanyIdState("");
    setFormIdState("");
  }, []);

  return (
    <GlobalFilterContext.Provider value={{ companyId, formId, setCompanyId, setFormId, resetFilter }}>
      {children}
    </GlobalFilterContext.Provider>
  );
}

export function useGlobalFilter() {
  const ctx = useContext(GlobalFilterContext);
  if (!ctx) throw new Error("useGlobalFilter must be used within GlobalFilterProvider");
  return ctx;
}
