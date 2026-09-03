import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useSurveyData } from "@/hooks/useSurveyData";
import { useAuth } from "@/contexts/AuthContext";
import { questions } from "@/data/mockData";
import { DateRangeFilter } from "@/components/dashboard/DateRangeFilter";
import { PageSkeleton } from "@/components/dashboard/PageSkeleton";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Filter } from "lucide-react";
import {
  PROART_SCALES, ALL_FACTORS, classifyRisk, getRiskColor,
} from "@/lib/proartMethodology";
import {
  COPSOQ_DOMAINS, COPSOQ_SCORABLE_DIMENSIONS, classifyCopsoq, copsoqClassToRiskLevel, dimensionAverage,
} from "@/lib/copsoqMethodology";
import { METHODOLOGIES, methodologyLabel, type Methodology } from "@/lib/methodology";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";
import { ResponsiveChart, useChartConfig } from "@/components/dashboard/ResponsiveChart";
import { cn, uniqueSectors } from "@/lib/utils";

const COLORS = ["hsl(217, 71%, 45%)", "hsl(170, 60%, 45%)", "hsl(38, 92%, 55%)", "hsl(280, 60%, 55%)", "hsl(0, 72%, 55%)", "hsl(200, 80%, 50%)"];

interface Pillar { id: string; name: string; shortName: string; }
interface ComparisonItem { id: string; name: string; shortName: string; scaleName: string; type: "positive" | "negative"; }

export default function CompanyComparison() {
  const { isCompanyUser } = useAuth();
  const {
    isLoading, hasData, companies, respondents, getCompanyRespondents,
    getAvailableSections, getFormConfigsForCompany,
  } = useSurveyData();

  const [methodology, setMethodology] = useState<Methodology | "">("");
  const [selected, setSelected] = useState<string[]>([]);
  const [compareMode, setCompareMode] = useState<"company" | "sector" | "factor">("company");
  const [sectorCompanyId, setSectorCompanyId] = useState<string>("");
  const [crossSector, setCrossSector] = useState<string>("");
  const [sectionFilter, setSectionFilter] = useState<string>("");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [sectorFilter, setSectorFilter] = useState<string>("");
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [selectedFactors, setSelectedFactors] = useState<string[]>([]);

  const chart = useChartConfig();

  const handleMethodologyChange = (m: Methodology | "") => {
    setMethodology(m);
    setSelected([]);
    setSelectedFactors([]);
    setSelectedSectors([]);
    setSectionFilter("");
    setSectorFilter("");
    setCrossSector("");
    setSectorCompanyId("");
  };

  if (isLoading) return <PageSkeleton />;
  if (!hasData) return <DashboardLayout><div className="flex flex-col items-center justify-center h-64 text-center"><p className="text-sm text-muted-foreground">Nenhum dado disponível.</p></div></DashboardLayout>;

  const isCopsoq = methodology === "copsoq";

  const getCompanyMethodology = (companyId: string): Methodology => {
    const forms = getFormConfigsForCompany(companyId);
    return forms.length > 0 && forms.every(f => f.methodology === "copsoq") ? "copsoq" : "proart";
  };

  const methodologyCompanies = methodology
    ? companies.filter(c => getCompanyMethodology(c.id) === methodology)
    : [];

  const dateFiltered = respondents.filter(r => {
    if (!startDate && !endDate) return true;
    if (!r.responseTimestamp) return false;
    const ts = new Date(r.responseTimestamp);
    if (startDate && ts < startDate) return false;
    if (endDate) { const end = new Date(endDate); end.setHours(23, 59, 59, 999); if (ts > end) return false; }
    return true;
  });

  const methodologyRespondents = methodology
    ? dateFiltered.filter(r => methodologyCompanies.some(c => c.id === r.companyId))
    : [];

  const allSectors = uniqueSectors(methodologyRespondents.map(r => r.sector));
  const filteredByAll = sectorFilter
    ? methodologyRespondents.filter(r => r.sector.toLowerCase().trim() === sectorFilter.toLowerCase().trim())
    : methodologyRespondents;

  const effectiveSelected = selected.length > 0 ? selected : methodologyCompanies.map(c => c.id);
  const toggle = (id: string) => { const current = effectiveSelected; setSelected(current.includes(id) ? current.filter(x => x !== id) : [...current, id]); };
  const selectedCompanies = methodologyCompanies.filter(c => effectiveSelected.includes(c.id));

  // Pillars: PROART sections vs COPSOQ domains (only domains with scorable dimensions)
  const proartAvailableSections = getAvailableSections();
  const pillars: Pillar[] = isCopsoq
    ? COPSOQ_DOMAINS.filter(d => d.dimensions.some(x => x.scorable)).map(d => ({ id: d.id, name: d.name, shortName: d.shortName }))
    : proartAvailableSections;
  const pillarLabel = isCopsoq ? "Domínio" : "Pilar";
  const pillarLabelPlural = isCopsoq ? "Domínios" : "Pilares";

  const displaySections = sectionFilter ? pillars.filter(s => s.id === sectionFilter) : pillars;

  // Unified pillar/domain average (normalized to a 0-5 scale for both methodologies)
  const getPillarAverage = (pillarId: string, pool: typeof respondents): number => {
    if (isCopsoq) {
      const domain = COPSOQ_DOMAINS.find(d => d.id === pillarId);
      if (!domain) return 0;
      const dims = domain.dimensions.filter(x => x.scorable);
      if (dims.length === 0) return 0;
      const bags = pool.map(r => ({ answers: r.answers }));
      const vals = dims.map(d => {
        const avg = dimensionAverage(d, bags);
        return d.maxScore > 0 ? (avg / d.maxScore) * 5 : 0;
      });
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      return Math.round(mean * 100) / 100;
    }
    const qs = questions.filter(q => q.section === pillarId);
    const qsWithData = qs.filter(q => pool.some(r => r.answers[q.id] !== undefined));
    if (qsWithData.length === 0) return 0;
    const avg = qsWithData.reduce((acc, q) => {
      const withAns = pool.filter(r => r.answers[q.id] !== undefined);
      return acc + (withAns.length > 0 ? withAns.reduce((a, r) => a + r.answers[q.id], 0) / withAns.length : 0);
    }, 0) / qsWithData.length;
    return Math.round(avg * 100) / 100;
  };

  const getFilteredAverage = (pillarId: string, companyId: string) =>
    getPillarAverage(pillarId, filteredByAll.filter(r => r.companyId === companyId));

  const data = displaySections.map((s) => {
    const row: Record<string, string | number> = { name: s.shortName };
    selectedCompanies.forEach(c => { row[c.name.split(" ")[0]] = getFilteredAverage(s.id, c.id); });
    return row;
  });

  const radarData = displaySections.map((s) => {
    const row: Record<string, string | number> = { subject: s.shortName };
    selectedCompanies.forEach(c => { row[c.name.split(" ")[0]] = getFilteredAverage(s.id, c.id); });
    return row;
  });

  // Sector comparison
  const effectiveSectorCompany = sectorCompanyId || methodologyCompanies[0]?.id || "";

  const getMethodologySectorAverages = (companyId: string) => {
    const pool = getCompanyRespondents(companyId);
    const sectorSet = [...new Set(pool.map(r => r.sector))].sort();
    return sectorSet.map(sector => {
      const sectorPool = pool.filter(r => r.sector === sector);
      const sectionAvgs: Record<string, number> = {};
      pillars.forEach(s => { sectionAvgs[s.id] = getPillarAverage(s.id, sectorPool); });
      return { sector, count: sectorPool.length, sectionAvgs };
    });
  };

  const allSectorAvgs = effectiveSectorCompany ? getMethodologySectorAverages(effectiveSectorCompany) : [];
  const sectorAvgs = selectedSectors.length > 0
    ? allSectorAvgs.filter(sa => selectedSectors.includes(sa.sector))
    : allSectorAvgs;

  const sectorChartData = displaySections.map(s => {
    const row: Record<string, string | number> = { name: s.shortName };
    sectorAvgs.forEach(sa => { row[sa.sector.substring(0, 8)] = sa.sectionAvgs[s.id] || 0; });
    return row;
  });

  const toggleSector = (sector: string) => {
    setSelectedSectors(prev => prev.includes(sector) ? prev.filter(s => s !== sector) : [...prev, sector]);
  };

  // Cross-company sector comparison
  const effectiveCrossSector = crossSector || allSectors[0] || "";
  const crossSectorData = effectiveCrossSector ? displaySections.map(s => {
    const row: Record<string, string | number> = { name: s.shortName };
    selectedCompanies.forEach(c => {
      const pool = filteredByAll.filter(r => r.companyId === c.id && r.sector === effectiveCrossSector);
      row[c.name.split(" ")[0]] = pool.length === 0 ? 0 : getPillarAverage(s.id, pool);
    });
    return row;
  }) : [];

  // Factor / dimension-level comparison
  const comparisonItems: ComparisonItem[] = isCopsoq
    ? COPSOQ_SCORABLE_DIMENSIONS.map(d => ({
        id: d.id, name: d.name, shortName: d.shortName, type: d.type,
        scaleName: COPSOQ_DOMAINS.find(dom => dom.id === d.domainId)?.shortName || "",
      }))
    : ALL_FACTORS.map(f => ({
        id: f.id, name: f.name, shortName: f.shortName, type: f.type,
        scaleName: PROART_SCALES.find(s => s.id === f.scaleId)?.shortName || "",
      }));

  const effectiveItems = selectedFactors.length > 0
    ? comparisonItems.filter(f => selectedFactors.includes(f.id))
    : comparisonItems;

  const toggleFactor = (factorId: string) => {
    setSelectedFactors(prev => prev.includes(factorId) ? prev.filter(f => f !== factorId) : [...prev, factorId]);
  };

  const factorData = effectiveItems.map(item => {
    const row: Record<string, string | number> = { name: item.shortName };
    selectedCompanies.forEach(c => {
      const pool = filteredByAll.filter(r => r.companyId === c.id);
      if (isCopsoq) {
        const dim = COPSOQ_SCORABLE_DIMENSIONS.find(d => d.id === item.id);
        if (!dim) { row[c.name.split(" ")[0]] = 0; return; }
        const bags = pool.map(r => ({ answers: r.answers }));
        const avg = dimensionAverage(dim, bags);
        row[c.name.split(" ")[0]] = dim.maxScore > 0 ? Math.round((avg / dim.maxScore) * 5 * 100) / 100 : 0;
      } else {
        const factor = ALL_FACTORS.find(f => f.id === item.id);
        if (!factor) { row[c.name.split(" ")[0]] = 0; return; }
        const answers = pool.flatMap(r => factor.questionIds.map(qId => r.answers[qId]).filter(v => v !== undefined));
        row[c.name.split(" ")[0]] = answers.length > 0 ? Math.round((answers.reduce((a, b) => a + b, 0) / answers.length) * 100) / 100 : 0;
      }
    });
    return row;
  });

  return (
    <DashboardLayout>
      <ErrorBoundary>
      <div className="animate-fade-in space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Comparação</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">Compare desempenho entre empresas, setores e fatores</p>
        </div>

        {/* Global methodology filter */}
        <div className={cn("rounded-xl border-2 p-4 sm:p-5 transition-colors", methodology ? "border-primary/40 bg-primary/[0.04]" : "border-primary bg-primary/5")}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 shrink-0">
                <Filter className="h-3.5 w-3.5 text-primary" />
              </span>
              <span className="text-sm font-bold text-foreground">Filtro Global — Metodologia</span>
            </div>
            {methodology && (
              <button onClick={() => handleMethodologyChange("")} className="text-xs font-medium text-muted-foreground hover:text-foreground underline shrink-0">Limpar seleção</button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mb-3 ml-9">Escolha a metodologia para liberar a comparação — todo o conteúdo da tela depende dela.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {METHODOLOGIES.map(m => (
              <button key={m.id} type="button" onClick={() => handleMethodologyChange(m.id)}
                className={cn("text-left rounded-lg border-2 p-3 transition-colors",
                  methodology === m.id ? "border-primary bg-primary/10 shadow-sm" : "border-border bg-card hover:bg-muted/40")}>
                <span className="flex items-center gap-2">
                  <span className={cn("h-2.5 w-2.5 rounded-full shrink-0 border-2", methodology === m.id ? "bg-primary border-primary" : "border-muted-foreground/40")} />
                  <span className="text-sm font-semibold text-foreground">{m.label}</span>
                </span>
                <span className="block text-[11px] text-muted-foreground mt-1 ml-[18px]">{m.description}</span>
              </button>
            ))}
          </div>
        </div>

        {!methodology && (
          <div className="flex flex-col items-center justify-center gap-1 h-40 text-center rounded-xl border border-dashed border-border bg-card/50">
            <p className="text-sm font-medium text-foreground">Nenhuma metodologia selecionada</p>
            <p className="text-xs text-muted-foreground">Escolha PROART ou COPSOQ II-Br no filtro global acima para ver a comparação.</p>
          </div>
        )}

        {methodology && (
        <>
        {/* Mode tabs */}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setCompareMode("company")} className={cn("rounded-lg px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-all", compareMode === "company" ? "bg-primary text-primary-foreground shadow-md" : "bg-secondary text-secondary-foreground hover:bg-secondary/80")}>Por Empresa</button>
          <button onClick={() => setCompareMode("factor")} className={cn("rounded-lg px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-all", compareMode === "factor" ? "bg-primary text-primary-foreground shadow-md" : "bg-secondary text-secondary-foreground hover:bg-secondary/80")}>{isCopsoq ? "Por Dimensão" : "Por Fator"}</button>
          <button onClick={() => setCompareMode("sector")} className={cn("rounded-lg px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-all", compareMode === "sector" ? "bg-primary text-primary-foreground shadow-md" : "bg-secondary text-secondary-foreground hover:bg-secondary/80")}>Por Setor</button>
        </div>

        {methodologyCompanies.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center rounded-xl border border-dashed border-border bg-card/50">
            <p className="text-sm text-muted-foreground">Nenhuma empresa encontrada com a metodologia {methodologyLabel(methodology)}.</p>
          </div>
        ) : (
        <>
        {/* Global filters */}
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
          {compareMode === "company" && (
            <>
              <select value={sectionFilter} onChange={e => setSectionFilter(e.target.value)} className="rounded-lg border border-border bg-card px-3 py-2 text-sm w-full sm:w-auto">
                <option value="">Todos os {pillarLabelPlural.toLowerCase()}</option>
                {pillars.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select value={sectorFilter} onChange={e => setSectorFilter(e.target.value)} className="rounded-lg border border-border bg-card px-3 py-2 text-sm w-full sm:w-auto">
                <option value="">Todos os setores</option>
                {allSectors.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </>
          )}
          <DateRangeFilter startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate} />
        </div>

        {compareMode === "company" && (
          <>
            <div className="flex flex-wrap gap-2">
              {methodologyCompanies.map(c => {
                const pool = filteredByAll.filter(r => r.companyId === c.id);
                return (
                  <button key={c.id} onClick={() => toggle(c.id)}
                    className={cn("flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                      effectiveSelected.includes(c.id) ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary/70 text-secondary-foreground hover:bg-secondary hover:border-primary/50")}>
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} /> {c.name} ({pool.length})
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-2">
              <div className="rounded-xl border border-border bg-card p-3 sm:p-5 shadow-card min-w-0">
                <h3 className="mb-4 text-xs sm:text-sm font-semibold text-card-foreground">Comparação por {pillarLabel}</h3>
                <ResponsiveChart height={300}>
                  <BarChart data={data} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: chart.tickFontSize, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis domain={[0, 5]} tick={{ fontSize: chart.tickFontSize, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={chart.tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: chart.legendFontSize }} />
                    {selectedCompanies.map((c, i) => <Bar key={c.id} dataKey={c.name.split(" ")[0]} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />)}
                  </BarChart>
                </ResponsiveChart>
              </div>
              <div className="rounded-xl border border-border bg-card p-3 sm:p-5 shadow-card min-w-0">
                <h3 className="mb-4 text-xs sm:text-sm font-semibold text-card-foreground">Radar Comparativo</h3>
                <ResponsiveChart height={300}>
                  <RadarChart data={radarData} cx="50%" cy="50%" outerRadius={chart.radarOuterRadius}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: chart.radarAngleFontSize, fill: "hsl(var(--muted-foreground))" }} />
                    <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fontSize: 9 }} />
                    {selectedCompanies.map((c, i) => <Radar key={c.id} name={c.name.split(" ")[0]} dataKey={c.name.split(" ")[0]} stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.1} strokeWidth={2} />)}
                    <Legend wrapperStyle={{ fontSize: chart.legendFontSize }} />
                  </RadarChart>
                </ResponsiveChart>
              </div>
              <div className="rounded-xl border border-border bg-card p-3 sm:p-5 shadow-card min-w-0">
                <h3 className="mb-4 text-xs sm:text-sm font-semibold text-card-foreground">Tendência por {pillarLabel}</h3>
                <ResponsiveChart height={300}>
                  <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: chart.tickFontSize, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis domain={[0, 5]} tick={{ fontSize: chart.tickFontSize, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={chart.tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: chart.legendFontSize }} />
                    {selectedCompanies.map((c, i) => <Line key={c.id} type="monotone" dataKey={c.name.split(" ")[0]} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: chart.isMobile ? 2 : 4 }} />)}
                  </LineChart>
                </ResponsiveChart>
              </div>
              <div className="rounded-xl border border-border bg-card p-3 sm:p-5 shadow-card min-w-0">
                <h3 className="mb-3 text-xs sm:text-sm font-semibold text-card-foreground">Mesmo Setor entre Empresas</h3>
                <select value={effectiveCrossSector} onChange={e => setCrossSector(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm mb-3 w-full">
                  {allSectors.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <ResponsiveChart height={300}>
                  <BarChart data={crossSectorData} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: chart.tickFontSize, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis domain={[0, 5]} tick={{ fontSize: chart.tickFontSize, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={chart.tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: chart.legendFontSize }} />
                    {selectedCompanies.map((c, i) => <Bar key={c.id} dataKey={c.name.split(" ")[0]} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />)}
                  </BarChart>
                </ResponsiveChart>
              </div>
            </div>

            {/* Tabela comparativa detalhada */}
            <div className="rounded-xl border border-border bg-card p-3 sm:p-5 shadow-card">
              <h3 className="mb-4 text-xs sm:text-sm font-semibold text-card-foreground">Tabela Comparativa Detalhada</h3>
              <div className="overflow-x-auto -mx-3 sm:mx-0">
                <table className="w-full text-xs sm:text-sm">
                  <thead><tr className="border-b border-border">
                    <th className="px-2 sm:px-4 py-2 text-left font-semibold text-muted-foreground">Empresa</th>
                    <th className="px-2 sm:px-4 py-2 text-center font-semibold text-muted-foreground">Resp.</th>
                    {displaySections.map(s => <th key={s.id} className="px-2 sm:px-4 py-2 text-center font-semibold text-muted-foreground">{s.shortName}</th>)}
                    <th className="px-2 sm:px-4 py-2 text-center font-semibold text-muted-foreground">Média</th>
                  </tr></thead>
                  <tbody>{selectedCompanies.map(c => {
                    const pool = filteredByAll.filter(r => r.companyId === c.id);
                    const avgs = displaySections.map(s => getFilteredAverage(s.id, c.id));
                    const overall = avgs.length > 0 ? avgs.reduce((a, b) => a + b, 0) / avgs.length : 0;
                    return (
                      <tr key={c.id} className="border-b border-border/50">
                        <td className="px-2 sm:px-4 py-2 font-medium text-foreground">{c.name}</td>
                        <td className="px-2 sm:px-4 py-2 text-center text-muted-foreground">{pool.length}</td>
                        {avgs.map((v, i) => <td key={i} className="px-2 sm:px-4 py-2 text-center"><span className={cn("font-medium", v < 2.3 ? "text-destructive" : v >= 3.7 ? "text-success" : "text-foreground")}>{v.toFixed(2)}</span></td>)}
                        <td className="px-2 sm:px-4 py-2 text-center"><span className="inline-flex items-center justify-center rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">{overall.toFixed(2)}</span></td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {compareMode === "factor" && (
          <>
            <div className="flex flex-wrap gap-2">
              {methodologyCompanies.map(c => {
                const pool = filteredByAll.filter(r => r.companyId === c.id);
                return (
                  <button key={c.id} onClick={() => toggle(c.id)}
                    className={cn("flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                      effectiveSelected.includes(c.id) ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary/70 text-secondary-foreground hover:bg-secondary hover:border-primary/50")}>
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} /> {c.name} ({pool.length})
                  </button>
                );
              })}
            </div>

            <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-muted-foreground">{isCopsoq ? "Filtrar Dimensões COPSOQ" : "Filtrar Fatores PROART"}</span>
                {selectedFactors.length > 0 && (
                  <button onClick={() => setSelectedFactors([])} className="text-xs text-muted-foreground hover:text-foreground underline">Limpar</button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {comparisonItems.map((item) => {
                  const isSelected = selectedFactors.length === 0 || selectedFactors.includes(item.id);
                  return (
                    <button key={item.id} onClick={() => toggleFactor(item.id)}
                      className={cn("flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                        isSelected ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary/70 text-secondary-foreground hover:bg-secondary hover:border-primary/50")}>
                      <span className={cn("h-3 w-3 rounded-sm border flex items-center justify-center flex-shrink-0",
                        isSelected ? "bg-primary border-primary" : "border-border")}>
                        {isSelected && <svg className="h-2 w-2 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                      </span>
                      {item.shortName}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-2">
              <div className="rounded-xl border border-border bg-card p-3 sm:p-5 shadow-card min-w-0">
                <h3 className="mb-4 text-xs sm:text-sm font-semibold text-card-foreground">Comparação por {isCopsoq ? "Dimensão" : "Fator"} ({comparisonItems.length} {isCopsoq ? "Dimensões COPSOQ" : "Fatores PROART"})</h3>
                <ResponsiveChart height={400} mobileHeight={300}>
                  <BarChart data={factorData} barCategoryGap="15%" layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" domain={[0, 5]} tick={{ fontSize: chart.tickFontSize, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: chart.isMobile ? 7 : 9, fill: "hsl(var(--muted-foreground))" }} width={chart.isMobile ? 55 : 100} />
                    <Tooltip contentStyle={chart.tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: chart.legendFontSize }} />
                    {selectedCompanies.map((c, i) => <Bar key={c.id} dataKey={c.name.split(" ")[0]} fill={COLORS[i % COLORS.length]} radius={[0, 4, 4, 0]} />)}
                  </BarChart>
                </ResponsiveChart>
              </div>
              <div className="rounded-xl border border-border bg-card p-3 sm:p-5 shadow-card min-w-0">
                <h3 className="mb-4 text-xs sm:text-sm font-semibold text-card-foreground">Radar por {isCopsoq ? "Dimensão" : "Fator"}</h3>
                <ResponsiveChart height={400} mobileHeight={300}>
                  <RadarChart data={factorData} cx="50%" cy="50%" outerRadius={chart.radarOuterRadius + 20}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis dataKey="name" tick={{ fontSize: chart.isMobile ? 6 : 8, fill: "hsl(var(--muted-foreground))" }} />
                    <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fontSize: 8 }} />
                    {selectedCompanies.map((c, i) => <Radar key={c.id} name={c.name.split(" ")[0]} dataKey={c.name.split(" ")[0]} stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.1} strokeWidth={2} />)}
                    <Legend wrapperStyle={{ fontSize: chart.legendFontSize }} />
                  </RadarChart>
                </ResponsiveChart>
              </div>
            </div>

            {/* Factor / dimension detail table */}
            <div className="rounded-xl border border-border bg-card p-3 sm:p-5 shadow-card">
              <h3 className="mb-4 text-xs sm:text-sm font-semibold text-card-foreground">Detalhamento por {isCopsoq ? "Dimensão" : "Fator"}</h3>
              <div className="overflow-x-auto -mx-3 sm:mx-0">
                <table className="w-full text-xs sm:text-sm">
                  <thead><tr className="border-b border-border">
                    <th className="px-2 sm:px-3 py-2 text-left font-semibold text-muted-foreground">{isCopsoq ? "Domínio" : "Escala"}</th>
                    <th className="px-2 sm:px-3 py-2 text-left font-semibold text-muted-foreground">{isCopsoq ? "Dimensão" : "Fator"}</th>
                    {selectedCompanies.map(c => <th key={c.id} className="px-2 sm:px-3 py-2 text-center font-semibold text-muted-foreground">{c.name.split(" ")[0]}</th>)}
                  </tr></thead>
                  <tbody>{effectiveItems.map(item => (
                    <tr key={item.id} className="border-b border-border/50">
                      <td className="px-2 sm:px-3 py-2 text-xs text-muted-foreground">{item.scaleName}</td>
                      <td className="px-2 sm:px-3 py-2 text-xs font-medium text-foreground">{item.name}</td>
                      {selectedCompanies.map(c => {
                        const pool = filteredByAll.filter(r => r.companyId === c.id);
                        if (isCopsoq) {
                          const dim = COPSOQ_SCORABLE_DIMENSIONS.find(d => d.id === item.id);
                          if (!dim) return <td key={c.id} className="px-2 sm:px-3 py-2 text-center">-</td>;
                          const bags = pool.map(r => ({ answers: r.answers }));
                          const avgRaw = dimensionAverage(dim, bags);
                          const avgDisplay = dim.maxScore > 0 ? (avgRaw / dim.maxScore) * 5 : 0;
                          const risk = copsoqClassToRiskLevel(classifyCopsoq(dim, avgRaw));
                          return <td key={c.id} className="px-2 sm:px-3 py-2 text-center">
                            <span className={cn("font-medium text-xs", getRiskColor(risk))}>{avgDisplay.toFixed(2)}</span>
                          </td>;
                        }
                        const factor = ALL_FACTORS.find(f => f.id === item.id);
                        if (!factor) return <td key={c.id} className="px-2 sm:px-3 py-2 text-center">-</td>;
                        const answers = pool.flatMap(r => factor.questionIds.map(qId => r.answers[qId]).filter(v => v !== undefined));
                        const avg = answers.length > 0 ? answers.reduce((a, b) => a + b, 0) / answers.length : 0;
                        const risk = classifyRisk(avg, factor.type);
                        return <td key={c.id} className="px-2 sm:px-3 py-2 text-center">
                          <span className={cn("font-medium text-xs", getRiskColor(risk))}>{avg.toFixed(2)}</span>
                        </td>;
                      })}
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {compareMode === "sector" && (
          <>
            <div className="flex flex-col sm:flex-row gap-3">
              <select value={effectiveSectorCompany} onChange={e => { setSectorCompanyId(e.target.value); setSelectedSectors([]); }} className="rounded-lg border border-border bg-card px-3 py-2 text-sm w-full sm:w-auto">
                {methodologyCompanies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select value={sectionFilter} onChange={e => setSectionFilter(e.target.value)} className="rounded-lg border border-border bg-card px-3 py-2 text-sm w-full sm:w-auto">
                <option value="">Todos os {pillarLabelPlural.toLowerCase()}</option>
                {pillars.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {allSectorAvgs.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-muted-foreground">Filtrar Setores</span>
                  {selectedSectors.length > 0 && (
                    <button onClick={() => setSelectedSectors([])} className="text-xs text-muted-foreground hover:text-foreground underline">Limpar ({selectedSectors.length} selecionados)</button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {allSectorAvgs.map((sa) => {
                    const isSelected = selectedSectors.length === 0 || selectedSectors.includes(sa.sector);
                    return (
                      <button key={sa.sector} onClick={() => toggleSector(sa.sector)}
                        className={cn("flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                          isSelected ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary/70 text-secondary-foreground hover:bg-secondary hover:border-primary/50")}>
                        <span className={cn("h-3 w-3 rounded-sm border flex items-center justify-center flex-shrink-0",
                          isSelected ? "bg-primary border-primary" : "border-border")}>
                          {isSelected && <svg className="h-2 w-2 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                        </span>
                        {sa.sector} ({sa.count})
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-2">
              <div className="rounded-xl border border-border bg-card p-3 sm:p-5 shadow-card min-w-0">
                <h3 className="mb-4 text-xs sm:text-sm font-semibold text-card-foreground">Setores por {pillarLabel}</h3>
                <ResponsiveChart height={300}>
                  <BarChart data={sectorChartData} barCategoryGap="15%">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: chart.tickFontSize, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis domain={[0, 5]} tick={{ fontSize: chart.tickFontSize, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={chart.tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: chart.legendFontSize }} />
                    {sectorAvgs.map((sa, i) => <Bar key={sa.sector} dataKey={sa.sector.substring(0, 8)} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />)}
                  </BarChart>
                </ResponsiveChart>
              </div>
              <div className="rounded-xl border border-border bg-card p-3 sm:p-5 shadow-card min-w-0">
                <h3 className="mb-4 text-xs sm:text-sm font-semibold text-card-foreground">Radar por Setor</h3>
                <ResponsiveChart height={300}>
                  <RadarChart data={sectorChartData.map(d => ({ ...d, subject: d.name }))} cx="50%" cy="50%" outerRadius={chart.radarOuterRadius}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: chart.radarAngleFontSize, fill: "hsl(var(--muted-foreground))" }} />
                    <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fontSize: 9 }} />
                    {sectorAvgs.map((sa, i) => <Radar key={sa.sector} name={sa.sector} dataKey={sa.sector.substring(0, 8)} stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.1} strokeWidth={2} />)}
                    <Legend wrapperStyle={{ fontSize: chart.legendFontSize }} />
                  </RadarChart>
                </ResponsiveChart>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-3 sm:p-5 shadow-card">
              <h3 className="mb-4 text-xs sm:text-sm font-semibold text-card-foreground">Detalhamento por Setor</h3>
              <div className="overflow-x-auto -mx-3 sm:mx-0">
                <table className="w-full text-xs sm:text-sm">
                  <thead><tr className="border-b border-border"><th className="px-2 sm:px-4 py-2 text-left font-semibold text-muted-foreground">Setor</th><th className="px-2 sm:px-4 py-2 text-center font-semibold text-muted-foreground">Resp.</th>{displaySections.map(s => <th key={s.id} className="px-2 sm:px-4 py-2 text-center font-semibold text-muted-foreground">{s.shortName}</th>)}</tr></thead>
                  <tbody>{sectorAvgs.map(sa => (
                    <tr key={sa.sector} className="border-b border-border/50">
                      <td className="px-2 sm:px-4 py-2 font-medium text-foreground">{sa.sector}</td>
                      <td className="px-2 sm:px-4 py-2 text-center text-muted-foreground">{sa.count}</td>
                      {displaySections.map(s => {
                        const val = sa.sectionAvgs[s.id] || 0;
                        return <td key={s.id} className="px-2 sm:px-4 py-2 text-center"><span className={cn("font-medium", val < 2.3 ? "text-destructive" : val >= 3.7 ? "text-success" : "text-foreground")}>{val.toFixed(2)}</span></td>;
                      })}
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          </>
        )}
        </>
        )}
        </>
        )}
      </div>
      </ErrorBoundary>
    </DashboardLayout>
  );
}
