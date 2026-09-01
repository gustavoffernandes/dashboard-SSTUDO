import { Building2, FileText, X } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useSurveyData } from "@/hooks/useSurveyData";
import { useAuth } from "@/contexts/AuthContext";
import { useGlobalFilter } from "@/contexts/GlobalFilterContext";
import { cn } from "@/lib/utils";

// Rotas onde nenhum filtro global faz sentido (páginas sem recorte por
// empresa/formulário ou que já são o próprio cadastro de empresas/formulários).
const HIDE_ALL_FILTERS_ROUTES = [
  "/", // Visão Geral
  "/empresas", // Comparação de Empresas
  "/empresas-cadastro", // Empresas
  "/formularios", // Formulários
  "/respondentes", // Respondentes
  "/usuarios", // Usuários
];

// Rotas onde apenas o filtro de formulário deve sumir, mantendo o de empresa.
const HIDE_FORM_FILTER_ROUTES = [
  "/evolucao", // Evolução Temporal
  "/notas", // Bloco de Notas
];

/**
 * Filtro global de empresa/formulário exibido na barra superior.
 * Aplica-se às abas orientadas a uma única empresa (Análise, Heatmap,
 * Demográfico, Relatórios, Planos de Ação, Notas, Respostas Livres,
 * Evolução Temporal).
 */
export function GlobalFilter() {
  const { isCompanyUser } = useAuth();
  const { companies, formConfigs, isLoading } = useSurveyData();
  const { companyId, formId, setCompanyId, setFormId, resetFilter } = useGlobalFilter();
  const location = useLocation();

  if (isLoading || companies.length === 0) return null;
  if (HIDE_ALL_FILTERS_ROUTES.includes(location.pathname)) return null;

  const forms = companyId
    ? formConfigs.filter((f) => f.companyKey === companyId)
    : formConfigs;

  const hideFormFilter = HIDE_FORM_FILTER_ROUTES.includes(location.pathname);

  const showCompany = !isCompanyUser && companies.length > 1;
  const showForms = !hideFormFilter && forms.length > 1;

  if (!showCompany && !showForms) return null;

  const selectClass =
    "rounded-lg border border-border bg-secondary/60 py-1.5 pl-8 pr-2 text-xs text-foreground max-w-[190px] truncate focus:outline-none focus:ring-1 focus:ring-primary";

  return (
    <div className="hidden lg:flex items-center gap-2">
      {showCompany && (
        <div className="relative">
          <Building2 className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <select
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            className={cn(selectClass, companyId && "border-primary/60 text-primary")}
            title="Filtro global de empresa"
          >
            <option value="">Todas as empresas</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {showForms && (
        <div className="relative">
          <FileText className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <select
            value={formId}
            onChange={(e) => setFormId(e.target.value)}
            className={cn(selectClass, formId && "border-primary/60 text-primary")}
            title="Filtro global de formulário"
          >
            <option value="">Todos os formulários</option>
            {forms.map((f) => (
              <option key={f.configId} value={f.configId}>
                {f.title}
              </option>
            ))}
          </select>
        </div>
      )}

      {(companyId || formId) && (
        <button
          onClick={resetFilter}
          title="Limpar filtro global"
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
