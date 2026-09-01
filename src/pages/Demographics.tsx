import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DateRangeFilter } from "@/components/dashboard/DateRangeFilter";
import { ResponsiveChart, useChartConfig } from "@/components/dashboard/ResponsiveChart";
import { questions } from "@/data/mockData";
import { useSurveyData } from "@/hooks/useSurveyData";
import { useAuth } from "@/contexts/AuthContext";
import { useGlobalFilter } from "@/contexts/GlobalFilterContext";
import { PageSkeleton } from "@/components/dashboard/PageSkeleton";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useSearchParams } from "react-router-dom";
import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";
import { cn, uniqueSectors } from "@/lib/utils";
import { methodologyLabel } from "@/lib/methodology";
import {
  COPSOQ_DOMAINS, COPSOQ_SCORABLE_DIMENSIONS, COPSOQ_OFFENSIVE_DIMENSIONS,
  dimensionAverage, normalizedRisk, classifyCopsoq, copsoqClassLabel,
} from "@/lib/copsoqMethodology";

const COLORS = ["hsl(217, 71%, 45%)", "hsl(170, 60%, 45%)", "hsl(38, 92%, 55%)", "hsl(280, 60%, 55%)", "hsl(0, 72%, 55%)", "hsl(200, 80%, 50%)", "hsl(330, 65%, 50%)"];

function normalizeSex(raw: string | null | undefined): string {
  if (!raw) return "Não informado";
  const v = raw.trim().toLowerCase();
  if (v === "masculino" || v === "m" || v === "masc") return "Masculino";
  if (v === "feminino" || v === "f" || v === "fem") return "Feminino";
  return "Prefiro não declarar";
}

const AGE_RANGES = [
  { label: "18-25", min: 18, max: 25 },
  { label: "26-35", min: 26, max: 35 },
  { label: "36-45", min: 36, max: 45 },
  { label: "46-55", min: 46, max: 55 },
  { label: "56+", min: 56, max: 120 },
];

export default function Demographics() {
  const { isCompanyUser } = useAuth();
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isLoading, hasData, companies, respondents, formConfigs, getAvailableSections } = useSurveyData();
  const availableSections = getAvailableSections();
  const chart = useChartConfig();

  const { companyId: companyFilter, formId: globalFormId } = useGlobalFilter();
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

  if (isLoading) return <PageSkeleton />;
  if (!hasData) return (
    <DashboardLayout>
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <p className="text-sm text-muted-foreground">Nenhum dado disponível.</p>
      </div>
    </DashboardLayout>
  );

  const effectiveCompanyFilter = isCompanyUser && companies.length === 1 ? companies[0].id : companyFilter;

  // ===== Metodologia ativa conforme empresa selecionada =====
  const relevantForms = effectiveCompanyFilter
    ? formConfigs.filter(f => f.companyKey === effectiveCompanyFilter)
    : formConfigs;
  const isCopsoq = relevantForms.length > 0 && relevantForms.every(f => f.methodology === "copsoq");
  const isMixed = relevantForms.some(f => f.methodology === "copsoq") && relevantForms.some(f => f.methodology !== "copsoq");

  const effectiveSections = selectedSections.length > 0
    ? availableSections.filter(s => selectedSections.includes(s.id))
    : availableSections;
  const effectiveDomains = selectedDomains.length > 0
    ? COPSOQ_DOMAINS.filter(d => selectedDomains.includes(d.id))
    : COPSOQ_DOMAINS.filter(d => d.id !== "ofensivos");

  const toggleSection = (id: string) => {
    setSelectedSections(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };
  const toggleDomain = (id: string) => {
    setSelectedDomains(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const dateFiltered = respondents.filter(r => {
    if (!startDate && !endDate) return true;
    if (!r.responseTimestamp) return false;
    const ts = new Date(r.responseTimestamp);
    if (startDate && ts < startDate) return false;
    if (endDate) { const end = new Date(endDate); end.setHours(23, 59, 59, 999); if (ts > end) return false; }
    return true;
  });
  const companyPool = effectiveCompanyFilter ? dateFiltered.filter(r => r.companyId === effectiveCompanyFilter) : dateFiltered;
  const availableSectors = uniqueSectors(companyPool.map(r => r.sector));
  const pool = sectorFilter
    ? companyPool.filter(r => r.sector.toLowerCase().trim() === sectorFilter.toLowerCase().trim())
    : companyPool;

  const poolWithSex = pool.map(r => ({ ...r, normalizedSex: normalizeSex(r.sex) }));
  const sexGroups = [...new Set(poolWithSex.map(r => r.normalizedSex))].filter(Boolean);
  const sexData = sexGroups.map(s => ({ name: s, count: poolWithSex.filter(r => r.normalizedSex === s).length }));
  const sectorList = [...new Set(pool.map(r => r.sector))];

  // ===== PROART =====
  function groupAverage(group: typeof pool, sectionId: string): number {
    const qs = questions.filter(q => q.section === sectionId);
    if (group.length === 0 || qs.length === 0) return 0;
    const qsWithData = qs.filter(q => group.some(r => r.answers[q.id] !== undefined));
    if (qsWithData.length === 0) return 0;
    const sum = group.reduce((acc, r) => acc + qsWithData.reduce((a, q) => a + (r.answers[q.id] || 0), 0), 0);
    return Math.round((sum / (group.length * qsWithData.length)) * 100) / 100;
  }

  // ===== COPSOQ: índice de risco 0-100 por domínio =====
  function domainRisk(group: typeof pool, domainId: string): number {
    const domain = COPSOQ_DOMAINS.find(d => d.id === domainId);
    if (!domain || group.length === 0) return 0;
    const dims = domain.dimensions.filter(d => d.scorable);
    if (dims.length === 0) return 0;
    const values = dims.map(d => normalizedRisk(d, dimensionAverage(d, group as any)) * 100);
    return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
  }

  const sexPerception = sexGroups.map(s => {
    const group = poolWithSex.filter(r => r.normalizedSex === s);
    return {
      name: s.substring(0, 8),
      ...(isCopsoq
        ? Object.fromEntries(effectiveDomains.map(d => [d.shortName, domainRisk(group, d.id)]))
        : Object.fromEntries(effectiveSections.map(sec => [sec.shortName, groupAverage(group, sec.id)]))),
    };
  });

  const ageData = AGE_RANGES.map(r => {
    const group = pool.filter(resp => resp.age >= r.min && resp.age <= r.max);
    return {
      name: r.label,
      ...(isCopsoq
        ? Object.fromEntries(effectiveDomains.map(d => [d.shortName, domainRisk(group, d.id)]))
        : Object.fromEntries(effectiveSections.map(s => [s.shortName, groupAverage(group, s.id)]))),
    };
  });

  const sectorSectionId = effectiveSections[0]?.id || "contexto";
  const sectorData = sectorList.map(s => {
    const group = pool.filter(r => r.sector === s);
    const value = isCopsoq
      ? Math.round((effectiveDomains.reduce((acc, d) => acc + domainRisk(group, d.id), 0) / (effectiveDomains.length || 1)) * 10) / 10
      : groupAverage(group, sectorSectionId);
    return { name: s.substring(0, 10), média: value, count: group.length };
  });

  const radarData = isCopsoq
    ? effectiveDomains.map(d => ({
        subject: d.shortName,
        "Geral": domainRisk(pool, d.id),
        ...Object.fromEntries(sexGroups.map(sg => [sg.substring(0, 4), domainRisk(poolWithSex.filter(r => r.normalizedSex === sg), d.id)])),
      }))
    : effectiveSections.map(s => ({
        subject: s.shortName,
        "Geral": groupAverage(pool, s.id),
        ...Object.fromEntries(sexGroups.map(sg => [sg.substring(0, 4), groupAverage(poolWithSex.filter(r => r.normalizedSex === sg), s.id)])),
      }));

  const maxY = isCopsoq ? 100 : 5;
  const seriesKeys = isCopsoq ? effectiveDomains.map(d => d.shortName) : effectiveSections.map(s => s.shortName);

  // COPSOQ: dimensões por gênero (tabela)
  const copsoqDimensionBySex = isCopsoq
    ? COPSOQ_SCORABLE_DIMENSIONS
        .filter(d => effectiveDomains.some(dom => dom.id === d.domainId))
        .map(d => {
          const geral = dimensionAverage(d, pool as any);
          return {
            dimension: d,
            geral,
            cls: classifyCopsoq(d, geral),
            bySex: sexGroups.map(sg => {
              const group = poolWithSex.filter(r => r.normalizedSex === sg);
              const score = dimensionAverage(d, group as any);
              return { sex: sg, score, cls: classifyCopsoq(d, score) };
            }),
          };
        })
    : [];

  // COPSOQ: comportamentos ofensivos por gênero
  const offensiveBySex = isCopsoq
    ? COPSOQ_OFFENSIVE_DIMENSIONS.map(d => {
        const qid = d.questionIds[0];
        return {
          name: d.shortName,
          ...Object.fromEntries(sexGroups.map(sg => {
            const group = poolWithSex.filter(r => r.normalizedSex === sg && typeof r.answers[qid] === "number");
            const exposed = group.filter(r => (r.answers[qid] || 0) > 0).length;
            return [sg.substring(0, 8), group.length > 0 ? Math.round((exposed / group.length) * 100) : 0];
          })),
        };
      })
    : [];

  const clsColor = (cls: string) => cls === "risco" ? "text-destructive" : cls === "atencao" ? "text-amber-600" : "text-emerald-600";

  return (
    <DashboardLayout>
      <ErrorBoundary>
        <div className="animate-fade-in space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">Perfil Demográfico</h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Cruzamento entre dados demográficos e percepção — {methodologyLabel(isCopsoq ? "copsoq" : "proart")}
              </p>
            </div>
            <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              {methodologyLabel(isCopsoq ? "copsoq" : "proart")}
            </span>
          </div>

          {isMixed && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
              A seleção atual mistura formulários PROART e COPSOQ II-Br. Selecione uma empresa para uma leitura correta — os gráficos estão exibindo a metodologia {methodologyLabel(isCopsoq ? "copsoq" : "proart")}.
            </div>
          )}

          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 sm:gap-4">
            <select
              value={sectorFilter}
              onChange={(e) => updateParams({ sector: e.target.value })}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm w-full sm:w-auto"
            >
              <option value="">Todos os setores</option>
              {availableSectors.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <DateRangeFilter startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate} />
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="text-xs font-medium text-muted-foreground self-center mr-1">
              {isCopsoq ? "Domínios:" : "Pilares:"}
            </span>
            {isCopsoq
              ? COPSOQ_DOMAINS.filter(d => d.id !== "ofensivos").map(d => {
                  const isSelected = selectedDomains.length === 0 || selectedDomains.includes(d.id);
                  return (
                    <button key={d.id} onClick={() => toggleDomain(d.id)}
                      className={cn("flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                        isSelected ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50")}>
                      <span className={cn("h-3 w-3 rounded-sm border flex items-center justify-center", isSelected ? "bg-primary border-primary" : "border-border")}>
                        {isSelected && <svg className="h-2 w-2 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                      </span>
                      {d.shortName}
                    </button>
                  );
                })
              : availableSections.map(s => {
                  const isSelected = selectedSections.length === 0 || selectedSections.includes(s.id);
                  return (
                    <button key={s.id} onClick={() => toggleSection(s.id)}
                      className={cn("flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                        isSelected ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50")}>
                      <span className={cn("h-3 w-3 rounded-sm border flex items-center justify-center", isSelected ? "bg-primary border-primary" : "border-border")}>
                        {isSelected && <svg className="h-2 w-2 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                      </span>
                      {s.shortName}
                    </button>
                  );
                })}
            {(isCopsoq ? selectedDomains.length > 0 : selectedSections.length > 0) && (
              <button onClick={() => (isCopsoq ? setSelectedDomains([]) : setSelectedSections([]))} className="text-xs text-muted-foreground hover:text-foreground underline">Limpar</button>
            )}
          </div>

          {isCopsoq && (
            <p className="text-xs text-muted-foreground">
              Índice de risco normalizado (0 = melhor cenário, 100 = pior cenário), calculado a partir das pontuações das dimensões COPSOQ II-Br de cada domínio.
            </p>
          )}

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-card min-w-0">
              <h3 className="mb-4 text-sm font-semibold text-card-foreground">Distribuição por Gênero</h3>
              <ResponsiveChart height={260}>
                <PieChart><Pie data={sexData} cx="50%" cy="50%" outerRadius={chart.isMobile ? 65 : 90} dataKey="count" label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} labelLine={!chart.isMobile}>
                  {sexData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie><Tooltip /></PieChart>
              </ResponsiveChart>
            </div>

            <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-card min-w-0">
              <h3 className="mb-4 text-sm font-semibold text-card-foreground">
                {isCopsoq ? "Radar de Risco por Domínio (Gênero)" : "Radar Demográfico por Gênero"}
              </h3>
              <ResponsiveChart height={260}>
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius={chart.radarOuterRadius - 10}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: chart.radarAngleFontSize - 1, fill: "hsl(var(--muted-foreground))" }} />
                  <PolarRadiusAxis angle={90} domain={[0, maxY]} tick={{ fontSize: 8 }} />
                  <Radar dataKey="Geral" stroke={COLORS[0]} fill={COLORS[0]} fillOpacity={0.1} strokeWidth={2} />
                  {sexGroups.map((sg, i) => (
                    <Radar key={sg} dataKey={sg.substring(0, 4)} stroke={COLORS[(i + 1) % COLORS.length]} fill={COLORS[(i + 1) % COLORS.length]} fillOpacity={0.05} strokeWidth={1.5} />
                  ))}
                  <Legend wrapperStyle={{ fontSize: chart.legendFontSize - 1 }} />
                </RadarChart>
              </ResponsiveChart>
            </div>

            <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-card min-w-0">
              <h3 className="mb-4 text-sm font-semibold text-card-foreground">
                {isCopsoq ? "Gênero × Risco por Domínio" : "Gênero × Percepção por Pilar"}
              </h3>
              <ResponsiveChart height={260}>
                <BarChart data={sexPerception} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: chart.tickFontSize, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis domain={[0, maxY]} tick={{ fontSize: chart.tickFontSize, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={chart.tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: chart.legendFontSize - 1 }} />
                  {seriesKeys.map((key, i) => <Bar key={key} dataKey={key} fill={COLORS[i % COLORS.length]} radius={[3, 3, 0, 0]} />)}
                </BarChart>
              </ResponsiveChart>
            </div>

            <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-card min-w-0">
              <h3 className="mb-4 text-sm font-semibold text-card-foreground">
                {isCopsoq ? "Faixa Etária × Risco por Domínio" : "Faixa Etária × Percepção"}
              </h3>
              <ResponsiveChart height={260}>
                <BarChart data={ageData} barCategoryGap="15%">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: chart.tickFontSize, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis domain={[0, maxY]} tick={{ fontSize: chart.tickFontSize, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={chart.tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: chart.legendFontSize - 1 }} />
                  {seriesKeys.map((key, i) => <Bar key={key} dataKey={key} fill={COLORS[i % COLORS.length]} radius={[3, 3, 0, 0]} />)}
                </BarChart>
              </ResponsiveChart>
            </div>

            <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-card min-w-0">
              <h3 className="mb-4 text-sm font-semibold text-card-foreground">
                {isCopsoq
                  ? "Setor × Índice de Risco (0-100)"
                  : `Setor × Média (${effectiveSections.find(s => s.id === sectorSectionId)?.shortName || sectorSectionId})`}
              </h3>
              <ResponsiveChart height={260}>
                <BarChart data={sectorData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" domain={[0, maxY]} tick={{ fontSize: chart.tickFontSize, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: chart.tickFontSize, fill: "hsl(var(--muted-foreground))" }} width={chart.isMobile ? 60 : 80} />
                  <Tooltip contentStyle={chart.tooltipStyle} />
                  <Bar dataKey="média" fill={COLORS[0]} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveChart>
            </div>

            {isCopsoq && offensiveBySex.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-card min-w-0">
                <h3 className="mb-4 text-sm font-semibold text-card-foreground">Comportamentos Ofensivos por Gênero (% expostos)</h3>
                <ResponsiveChart height={260}>
                  <BarChart data={offensiveBySex} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: chart.tickFontSize, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: chart.tickFontSize, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={chart.tooltipStyle} formatter={(v: any) => `${v}%`} />
                    <Legend wrapperStyle={{ fontSize: chart.legendFontSize - 1 }} />
                    {sexGroups.map((sg, i) => (
                      <Bar key={sg} dataKey={sg.substring(0, 8)} fill={COLORS[i % COLORS.length]} radius={[3, 3, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveChart>
              </div>
            )}
          </div>

          {isCopsoq && copsoqDimensionBySex.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-card overflow-x-auto">
              <h3 className="mb-4 text-sm font-semibold text-card-foreground">Pontuação por Dimensão × Gênero</h3>
              <table className="w-full min-w-[600px] text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-2 text-left font-medium">Dimensão</th>
                    <th className="py-2 text-center font-medium">Geral</th>
                    {sexGroups.map(sg => <th key={sg} className="py-2 text-center font-medium">{sg}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {copsoqDimensionBySex.map(row => (
                    <tr key={row.dimension.id} className="border-b border-border/50">
                      <td className="py-2 pr-3 text-card-foreground">{row.dimension.name}</td>
                      <td className={cn("py-2 text-center font-semibold", clsColor(row.cls))}>
                        {row.geral.toFixed(1)} <span className="font-normal text-[10px]">({copsoqClassLabel(row.cls)})</span>
                      </td>
                      {row.bySex.map(s => (
                        <td key={s.sex} className={cn("py-2 text-center font-medium", clsColor(s.cls))}>{s.score.toFixed(1)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </ErrorBoundary>
    </DashboardLayout>
  );
}
