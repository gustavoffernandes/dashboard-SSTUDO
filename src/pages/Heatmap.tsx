import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { HeatmapTable } from "@/components/dashboard/HeatmapTable";
import { MultiSelectCompanies } from "@/components/dashboard/MultiSelectCompanies";
import { DateRangeFilter } from "@/components/dashboard/DateRangeFilter";
import { FormFilter } from "@/components/dashboard/FormFilter";
import { useSurveyData } from "@/hooks/useSurveyData";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { PageSkeleton } from "@/components/dashboard/PageSkeleton";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Filter } from "lucide-react";

export default function Heatmap() {
  const { isCompanyUser, userCompanyId } = useAuth();
  const [activeSection, setActiveSection] = useState<string>("contexto");
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [selectedFormId, setSelectedFormId] = useState<string>("");
  const [selectedSector, setSelectedSector] = useState<string>("");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const { isLoading, hasData, companies, respondents, formConfigs, getAvailableSections, getAvailableQuestions, getFormConfigsForCompany } = useSurveyData();
  const availableSections = getAvailableSections();

  const relevantForms = isCompanyUser && userCompanyId
    ? getFormConfigsForCompany(userCompanyId)
    : selectedCompanies.length === 1
      ? formConfigs.filter(f => f.companyKey === selectedCompanies[0])
      : selectedCompanies.length === 0
        ? formConfigs
        : formConfigs.filter(f => selectedCompanies.includes(f.companyKey));

  const handleFormChange = (formId: string) => {
    setSelectedFormId(formId);
    if (formId && !isCompanyUser) {
      const form = formConfigs.find(f => f.configId === formId);
      if (form && !selectedCompanies.includes(form.companyKey)) {
        setSelectedCompanies([form.companyKey]);
      }
    }
  };

  // Available sectors (respect company/form filters loosely — show all)
  const availableSectors = useMemo(() => {
    let pool = respondents;
    if (selectedCompanies.length > 0) pool = pool.filter(r => selectedCompanies.includes(r.companyId));
    if (selectedFormId) pool = pool.filter(r => (r as any).configId === selectedFormId);
    return [...new Set(pool.map(r => r.sector).filter(Boolean))].sort();
  }, [respondents, selectedCompanies, selectedFormId]);

  if (isLoading) return <PageSkeleton />;
  if (!hasData) return <DashboardLayout><div className="flex flex-col items-center justify-center h-64 text-center"><p className="text-sm text-muted-foreground">Nenhum dado disponível.</p></div></DashboardLayout>;

  let filteredRespondents = respondents.filter(r => {
    if (selectedSector && r.sector !== selectedSector) return false;
    if (!r.responseTimestamp) return !startDate && !endDate;
    const ts = new Date(r.responseTimestamp);
    if (startDate && ts < startDate) return false;
    if (endDate) { const end = new Date(endDate); end.setHours(23, 59, 59, 999); if (ts > end) return false; }
    return true;
  });

  const isSingleFormSelected = !!selectedFormId;
  const companyFormsToShow = !isSingleFormSelected && selectedCompanies.length === 1
    ? formConfigs.filter(f => f.companyKey === selectedCompanies[0])
    : [];
  const showFormColumns = companyFormsToShow.length > 1;

  type HeatmapColumn = { id: string; name: string };

  let columns: HeatmapColumn[];
  let customGetQuestionAverage: (questionId: string, columnId?: string) => number;

  if (isSingleFormSelected) {
    const form = formConfigs.find(f => f.configId === selectedFormId);
    const pool = filteredRespondents.filter(r => (r as any).configId === selectedFormId);
    columns = [{ id: selectedFormId, name: form?.title || "Formulário" }];
    customGetQuestionAverage = (questionId: string) => {
      const withAnswer = pool.filter(r => r.answers[questionId] !== undefined);
      if (withAnswer.length === 0) return 0;
      return Math.round((withAnswer.reduce((acc, r) => acc + (r.answers[questionId] || 0), 0) / withAnswer.length) * 100) / 100;
    };
  } else if (showFormColumns) {
    columns = companyFormsToShow.map(f => ({ id: f.configId, name: f.title }));
    customGetQuestionAverage = (questionId: string, columnId?: string) => {
      let pool = filteredRespondents.filter(r => r.companyId === selectedCompanies[0]);
      if (columnId) pool = pool.filter(r => (r as any).configId === columnId);
      const withAnswer = pool.filter(r => r.answers[questionId] !== undefined);
      if (withAnswer.length === 0) return 0;
      return Math.round((withAnswer.reduce((acc, r) => acc + (r.answers[questionId] || 0), 0) / withAnswer.length) * 100) / 100;
    };
  } else {
    const effectiveCompanies = selectedCompanies.length > 0
      ? companies.filter(c => selectedCompanies.includes(c.id))
      : companies;
    columns = effectiveCompanies.map(c => ({ id: c.id, name: c.name }));
    customGetQuestionAverage = (questionId: string, columnId?: string) => {
      let pool = filteredRespondents;
      if (columnId) pool = pool.filter(r => r.companyId === columnId);
      else if (selectedCompanies.length > 0) pool = pool.filter(r => selectedCompanies.includes(r.companyId));
      const withAnswer = pool.filter(r => r.answers[questionId] !== undefined);
      if (withAnswer.length === 0) return 0;
      return Math.round((withAnswer.reduce((acc, r) => acc + (r.answers[questionId] || 0), 0) / withAnswer.length) * 100) / 100;
    };
  }

  const showAll = activeSection === "todos";

  return (
    <DashboardLayout>
      <ErrorBoundary>
        <div className="animate-fade-in space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Heatmap de Satisfação</h1>
            <p className="text-sm text-muted-foreground mt-1">Mapa de calor comparativo entre empresas</p>
          </div>
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActiveSection("todos")}
                className={cn("rounded-lg px-4 py-2 text-sm font-medium transition-all", showAll ? "bg-primary text-primary-foreground shadow-md" : "bg-secondary text-secondary-foreground hover:bg-secondary/80")}
              >
                Todos
              </button>
              {availableSections.map((s) => (
                <button key={s.id} onClick={() => setActiveSection(s.id)}
                  className={cn("rounded-lg px-4 py-2 text-sm font-medium transition-all", activeSection === s.id ? "bg-primary text-primary-foreground shadow-md" : "bg-secondary text-secondary-foreground hover:bg-secondary/80")}>
                  {s.shortName}
                </button>
              ))}
            </div>
            {!isCompanyUser && <MultiSelectCompanies companies={companies} selected={selectedCompanies} onChange={(ids) => { setSelectedCompanies(ids); setSelectedFormId(""); }} />}
            <FormFilter forms={relevantForms} selectedFormId={selectedFormId} onChange={handleFormChange} />
            {availableSectors.length > 0 && (
              <div className="flex items-center gap-2">
                <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <select
                  value={selectedSector}
                  onChange={(e) => setSelectedSector(e.target.value)}
                  className="rounded-lg border border-border bg-card px-3 py-2 text-sm w-full sm:w-auto"
                >
                  <option value="">Todos os setores</option>
                  {availableSectors.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
            <DateRangeFilter startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate} />
          </div>

          {showAll ? (
            <div className="space-y-6">
              {availableSections.map((s) => (
                <HeatmapTable
                  key={s.id}
                  sectionId={s.id}
                  columns={columns}
                  getQuestionAverage={customGetQuestionAverage}
                  getAvailableQuestions={getAvailableQuestions}
                  isNegativeSection={s.id === "vivencias" || s.id === "saude"}
                  title={s.name}
                />
              ))}
            </div>
          ) : (
            <HeatmapTable
              sectionId={activeSection}
              columns={columns}
              getQuestionAverage={customGetQuestionAverage}
              getAvailableQuestions={getAvailableQuestions}
              isNegativeSection={activeSection === "vivencias" || activeSection === "saude"}
            />
          )}
        </div>
      </ErrorBoundary>
    </DashboardLayout>
  );
}
