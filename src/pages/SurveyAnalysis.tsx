import { useState, useMemo } from "react";
import { LayoutList, List } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { QuestionChart } from "@/components/dashboard/QuestionChart";
import { ResponsiveChart, useChartConfig } from "@/components/dashboard/ResponsiveChart";
import { useSurveyData } from "@/hooks/useSurveyData";
import { useAuth } from "@/contexts/AuthContext";
import { useGlobalFilter } from "@/contexts/GlobalFilterContext";
import { questions } from "@/data/mockData";
import { cn, uniqueSectors } from "@/lib/utils";
import { PageSkeleton } from "@/components/dashboard/PageSkeleton";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useSearchParams } from "react-router-dom";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";
import { COPSOQ_QUESTIONS, COPSOQ_OPTION_SETS, getCopsoqQuestionsByDomain } from "@/lib/copsoqQuestions";
import {
  COPSOQ_DOMAINS, COPSOQ_SCORABLE_DIMENSIONS, classifyCopsoq, copsoqClassLabel,
  dimensionAverage, offensiveSummary,
} from "@/lib/copsoqMethodology";

const COLORS = ["hsl(217, 71%, 45%)", "hsl(170, 60%, 45%)", "hsl(38, 92%, 55%)", "hsl(280, 60%, 55%)", "hsl(0, 72%, 55%)"];

const COPSOQ_DOMAIN_STEPS = getCopsoqQuestionsByDomain();

export default function SurveyAnalysis() {
  const { isCompanyUser } = useAuth();
  const [activeSection, setActiveSection] = useState("contexto");
  const [activeDomain, setActiveDomain] = useState("demandas");
  const [showCopsoqSummary, setShowCopsoqSummary] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const chart = useChartConfig();

  const { companyId: selectedCompany, formId: selectedFormId } = useGlobalFilter();
  const sectorFilter = searchParams.get("sector") || "";

  const updateParams = (updates: Record<string, string>) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      Object.entries(updates).forEach(([key, value]) => {
        if (value === "") next.delete(key);
        else next.set(key, value);
      });
      return next;
    }, { replace: true });
  };

  const { isLoading, hasData, companies, respondents, getAvailableSections, getAvailableQuestions, getAnswerDistribution, getFormConfigsForCompany, formConfigs } = useSurveyData();

  const availableSections = getAvailableSections();
  const availableQuestions = getAvailableQuestions();
  const sectionQuestions = availableQuestions.filter((q) => q.section === activeSection);

  const effectiveCompany = isCompanyUser && companies.length === 1 ? companies[0].id : selectedCompany;

  const companyForms = effectiveCompany ? getFormConfigsForCompany(effectiveCompany) : [];

  // Metodologia ativa: formulário selecionado > formulários da empresa > todos
  const methodologyForms = selectedFormId
    ? formConfigs.filter(f => f.configId === selectedFormId)
    : effectiveCompany
      ? companyForms
      : formConfigs;
  const isCopsoq = methodologyForms.length > 0 && methodologyForms.every(f => f.methodology === "copsoq");

  let companyRespondents = effectiveCompany ? respondents.filter(r => r.companyId === effectiveCompany) : respondents;
  if (selectedFormId) {
    companyRespondents = companyRespondents.filter(r => (r as any).configId === selectedFormId);
  }
  const availableSectors = uniqueSectors(companyRespondents.map(r => r.sector));
  const filteredRespondents = sectorFilter
    ? companyRespondents.filter(r => r.sector.toLowerCase().trim() === sectorFilter.toLowerCase().trim())
    : companyRespondents;

  const customDistribution = (questionId: string) => {
    const pool = filteredRespondents.filter(r => r.answers[questionId] !== undefined);
    return [1, 2, 3, 4, 5].map(value => {
      const count = pool.filter(r => r.answers[questionId] === value).length;
      return { value, count, percentage: pool.length > 0 ? Math.round((count / pool.length) * 100) : 0 };
    });
  };

  const copsoqDistribution = (questionId: string) => {
    const question = COPSOQ_QUESTIONS.find(q => q.id === questionId);
    const options = question ? COPSOQ_OPTION_SETS[question.optionSet] : COPSOQ_OPTION_SETS.freq_risk;
    const pool = filteredRespondents.filter(r => r.answers[questionId] !== undefined);
    return options.map(o => {
      const count = pool.filter(r => r.answers[questionId] === o.value).length;
      return { value: o.value, count, percentage: pool.length > 0 ? Math.round((count / pool.length) * 100) : 0 };
    });
  };

  const radarData = useMemo(() => {
    if (isCopsoq) {
      const bags = filteredRespondents.map(r => ({ answers: r.answers }));
      return COPSOQ_SCORABLE_DIMENSIONS.map(d => {
        const avg = dimensionAverage(d, bags);
        return { subject: d.shortName, média: d.maxScore > 0 ? Math.round((avg / d.maxScore) * 5 * 100) / 100 : 0 };
      });
    }
    return availableSections.map(s => {
      const qs = questions.filter(q => q.section === s.id);
      const qsWithData = qs.filter(q => filteredRespondents.some(r => r.answers[q.id] !== undefined));
      if (qsWithData.length === 0) return { subject: s.shortName, média: 0 };
      const avg = qsWithData.reduce((acc, q) => {
        const pool = filteredRespondents.filter(r => r.answers[q.id] !== undefined);
        return acc + (pool.length > 0 ? pool.reduce((a, r) => a + r.answers[q.id], 0) / pool.length : 0);
      }, 0) / qsWithData.length;
      return { subject: s.shortName, média: Math.round(avg * 100) / 100 };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCopsoq, filteredRespondents, availableSections]);

  const copsoqDimensionResults = useMemo(() => {
    const bags = filteredRespondents.map(r => ({ answers: r.answers }));
    return COPSOQ_DOMAINS.map(domain => ({
      domain,
      dimensions: domain.dimensions.filter(d => d.scorable).map(d => {
        const avg = dimensionAverage(d, bags);
        return { dimension: d, avg, cls: classifyCopsoq(d, avg) };
      }),
    })).filter(g => g.dimensions.length > 0);
  }, [filteredRespondents]);

  const offensive = useMemo(
    () => offensiveSummary(filteredRespondents.map(r => ({ answers: r.answers }))),
    [filteredRespondents],
  );

  if (isLoading) return <PageSkeleton />;
  if (!hasData) return (
    <DashboardLayout>
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <p className="text-sm text-muted-foreground">
          Nenhum dado disponível.{" "}
          {!isCompanyUser && <a href="/integracoes" className="text-primary underline">Sincronize dados</a>} primeiro.
        </p>
      </div>
    </DashboardLayout>
  );

  const useCustomDist = !!(sectorFilter || selectedFormId || effectiveCompany);

  const domainStep = COPSOQ_DOMAIN_STEPS.find(d => d.id === activeDomain) || COPSOQ_DOMAIN_STEPS[0];
  const answeredIds = new Set(filteredRespondents.flatMap(r => Object.keys(r.answers)));
  const domainQuestions = domainStep.questions.filter(q => answeredIds.has(q.id));

  return (
    <DashboardLayout>
      <ErrorBoundary>
        <div className="animate-fade-in space-y-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Análise por Pergunta</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              {isCopsoq
                ? "Distribuição das respostas por domínio COPSOQ II-Br"
                : "Visualize a distribuição de respostas para cada item"}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap gap-3">
            <div className="flex flex-wrap gap-2">
              {isCopsoq
                ? COPSOQ_DOMAIN_STEPS.map(d => (
                    <button key={d.id} onClick={() => setActiveDomain(d.id)} title={d.fullName}
                      className={cn("rounded-lg px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-all", activeDomain === d.id ? "bg-primary text-primary-foreground shadow-md" : "bg-secondary text-secondary-foreground hover:bg-secondary/80")}>
                      {d.shortName}
                    </button>
                  ))
                : availableSections.map((s) => (
                    <button key={s.id} onClick={() => setActiveSection(s.id)}
                      className={cn("rounded-lg px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-all", activeSection === s.id ? "bg-primary text-primary-foreground shadow-md" : "bg-secondary text-secondary-foreground hover:bg-secondary/80")}>
                      {s.shortName}
                    </button>
                  ))}
            </div>

            <select 
              value={sectorFilter} 
              onChange={(e) => updateParams({ sector: e.target.value })}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm w-full sm:w-auto"
            >
              <option value="">Todos os setores</option>
              {availableSectors.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            {isCopsoq && (
              <button
                type="button"
                onClick={() => setShowCopsoqSummary(v => !v)}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all w-full sm:w-auto",
                  showCopsoqSummary
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-foreground hover:bg-secondary/50"
                )}
                title={showCopsoqSummary ? "Ocultar pontuação por dimensão e comportamentos ofensivos" : "Mostrar pontuação por dimensão e comportamentos ofensivos"}
              >
                {showCopsoqSummary ? <List className="h-4 w-4" /> : <LayoutList className="h-4 w-4" />}
                {showCopsoqSummary ? "Ocultar resumo" : "Resumo por dimensão"}
              </button>
            )}
          </div>

          {isCopsoq && showCopsoqSummary && (
            <>
              <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-card min-w-0">
                <h3 className="mb-3 text-sm font-semibold text-card-foreground">Radar das Dimensões (normalizado 0-5)</h3>
                <ResponsiveChart height={320}>
                  <RadarChart data={radarData} cx="50%" cy="50%" outerRadius={chart.radarOuterRadius - 10}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }} />
                    <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fontSize: 9 }} />
                    <Radar dataKey="média" stroke={COLORS[0]} fill={COLORS[0]} fillOpacity={0.15} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveChart>
              </div>

              {/* Resumo das dimensões */}
              <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-card">
                <h3 className="mb-3 text-sm font-semibold text-card-foreground">Pontuação por Dimensão</h3>
                <div className="space-y-4">
                  {copsoqDimensionResults.map(group => (
                    <div key={group.domain.id}>
                      <p className="text-xs font-semibold text-muted-foreground mb-2">{group.domain.name}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {group.dimensions.map(({ dimension, avg, cls }) => (
                          <div key={dimension.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                            <span className="text-xs font-medium text-foreground">{dimension.name}</span>
                            <span className="flex items-center gap-2 shrink-0">
                              <span className="text-sm font-bold text-foreground">{avg.toFixed(1)}<span className="text-[10px] font-normal text-muted-foreground">/{dimension.maxScore}</span></span>
                              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold",
                                cls === "seguro" ? "bg-success/15 text-success" : cls === "atencao" ? "bg-warning/15 text-warning" : "bg-destructive/15 text-destructive")}>
                                {copsoqClassLabel(cls)}
                              </span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Comportamentos ofensivos */}
              <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-card">
                <h3 className="mb-1 text-sm font-semibold text-card-foreground">Comportamentos Ofensivos</h3>
                <p className="text-xs text-muted-foreground mb-3">Exposição relatada nos últimos 12 meses — sem classificação de risco por faixas.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {offensive.map(o => (
                    <div key={o.dimension.id} className={cn("rounded-lg border p-3", o.exposed > 0 ? "border-destructive/30 bg-destructive/5" : "border-border bg-muted/30")}>
                      <p className="text-xs font-semibold text-foreground">{o.dimension.name}</p>
                      <p className="text-2xl font-bold text-foreground mt-1">{o.pctExposed}%</p>
                      <p className="text-[11px] text-muted-foreground">{o.exposed} de {o.total} relataram exposição</p>
                      {o.frequent > 0 && (
                        <p className="text-[11px] font-semibold text-destructive mt-1">{o.frequent} com frequência semanal/diária</p>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground mt-3">
                  Qualquer relato exige acolhimento imediato da pessoa exposta, apuração com sigilo e divulgação dos canais de denúncia.
                </p>
              </div>
            </>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {isCopsoq
              ? domainQuestions.map(q => (
                  <QuestionChart
                    key={q.id}
                    questionId={q.id}
                    questionText={`${q.code}. ${q.text}`}
                    getAnswerDistribution={copsoqDistribution}
                    valueLabels={Object.fromEntries(COPSOQ_OPTION_SETS[q.optionSet].map(o => [o.value, o.label]))}
                  />
                ))
              : sectionQuestions.map((q) => (
                  <QuestionChart
                    key={q.id}
                    questionId={q.id}
                    questionText={`${q.number}. ${q.text}`}
                    companyId={effectiveCompany || undefined}
                    getAnswerDistribution={useCustomDist ? customDistribution : getAnswerDistribution}
                  />
                ))}
          </div>
          {(isCopsoq ? domainQuestions.length === 0 : sectionQuestions.length === 0) && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma pergunta com dados {isCopsoq ? "neste domínio" : "nesta seção"}.
            </p>
          )}
        </div>
      </ErrorBoundary>
    </DashboardLayout>
  );
}
