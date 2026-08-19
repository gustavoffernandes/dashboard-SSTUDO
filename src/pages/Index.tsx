import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { KPICard } from "@/components/dashboard/KPICard";
import { DateRangeFilter } from "@/components/dashboard/DateRangeFilter";
import { ResponsiveChart, useChartConfig } from "@/components/dashboard/ResponsiveChart";
import { useSurveyData } from "@/hooks/useSurveyData";
import { useActionPlans } from "@/hooks/useActionPlans";
import { useAuth } from "@/contexts/AuthContext";
import { questions } from "@/data/mockData";
import { detectMethodologyFromAnswers, methodologyLabel, type Methodology } from "@/lib/methodology";
import {
  COPSOQ_DOMAINS, COPSOQ_SCORABLE_DIMENSIONS, dimensionAverage, normalizedRisk,
  classifyCopsoq, copsoqClassLabel, copsoqClassBgColor,
} from "@/lib/copsoqMethodology";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  LineChart, Line,
} from "recharts";
import { ClipboardCheck, Loader2, Target, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

const COLORS = ["hsl(217, 71%, 45%)", "hsl(170, 60%, 45%)", "hsl(38, 92%, 55%)", "hsl(280, 60%, 55%)", "hsl(0, 72%, 55%)"];

export default function Index() {
  const { isCompanyUser } = useAuth();
  const { isLoading, hasData, companies, respondents, formConfigs, getSectionAverage, getCompanyRespondents, getAvailableSections } = useSurveyData();
  const { plans, tasks, isLoading: loadingPlans } = useActionPlans();
  const availableSections = getAvailableSections();
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const chart = useChartConfig();

  // ===== Metodologia por formulário / respondente / empresa =====
  const configMethodology = useMemo(() => {
    const m = new Map<string, Methodology>();
    formConfigs?.forEach(f => m.set(f.configId, f.methodology));
    return m;
  }, [formConfigs]);

  const respondentMethodology = (r: any): Methodology =>
    configMethodology.get(r.configId) || detectMethodologyFromAnswers(r.answers || {});

  const companyMethodologies = useMemo(() => {
    const map = new Map<string, Set<Methodology>>();
    respondents.forEach(r => {
      const set = map.get(r.companyId) || new Set<Methodology>();
      set.add(respondentMethodology(r));
      map.set(r.companyId, set);
    });
    formConfigs?.forEach(f => {
      const set = map.get(f.companyKey) || new Set<Methodology>();
      set.add(f.methodology);
      map.set(f.companyKey, set);
    });
    return map;
  }, [respondents, formConfigs, configMethodology]);

  const proartRespondents = respondents.filter(r => respondentMethodology(r) === "proart");
  const copsoqRespondents = respondents.filter(r => respondentMethodology(r) === "copsoq");

  const availableMethodologies: Methodology[] = [];
  if (proartRespondents.length > 0) availableMethodologies.push("proart");
  if (copsoqRespondents.length > 0) availableMethodologies.push("copsoq");

  const [tab, setTab] = useState<Methodology | null>(null);
  const active: Methodology = tab && availableMethodologies.includes(tab)
    ? tab
    : (availableMethodologies[0] || "proart");

  const isFullLoading = isLoading || loadingPlans;

  if (isFullLoading) {
    return <DashboardLayout><div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></DashboardLayout>;
  }

  if (!hasData) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <ClipboardCheck className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold text-foreground">Nenhum dado sincronizado</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {isCompanyUser ? "Nenhum dado disponível para sua empresa." : "Vá para Integrações para configurar e sincronizar dados."}
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const inRange = (r: any) => {
    if (!startDate && !endDate) return true;
    if (!r.responseTimestamp) return false;
    const ts = new Date(r.responseTimestamp);
    if (startDate && ts < startDate) return false;
    if (endDate) { const end = new Date(endDate); end.setHours(23, 59, 59, 999); if (ts > end) return false; }
    return true;
  };

  const activeRespondents = (active === "copsoq" ? copsoqRespondents : proartRespondents).filter(inRange);
  const activeCompanies = companies.filter(c => companyMethodologies.get(c.id)?.has(active));
  const activeForms = (formConfigs || []).filter(f => f.methodology === active);

  const subtitle = isCompanyUser && companies.length === 1
    ? `Dados da empresa ${companies[0].name}`
    : `Benchmark consolidado — ${methodologyLabel(active)}`;

  // ===================== PROART =====================
  const proartView = () => {
    const companyRanking = activeCompanies.map((c) => {
      const avg = availableSections.length > 0 ? availableSections.reduce((acc, s) => acc + getSectionAverage(s.id, c.id), 0) / availableSections.length : 0;
      return { ...c, average: Math.round(avg * 100) / 100, respondentCount: getCompanyRespondents(c.id).filter(r => respondentMethodology(r) === "proart").length };
    }).sort((a, b) => b.average - a.average);

    const benchmarkData = activeCompanies.map((c) => {
      const row: Record<string, string | number> = { name: c.name.split(" ")[0] };
      availableSections.forEach((s) => { row[s.shortName] = getSectionAverage(s.id, c.id); });
      return row;
    });

    const radarData = availableSections.map((s) => ({
      subject: s.shortName,
      ...Object.fromEntries(activeCompanies.map((c) => [c.name.split(" ")[0], getSectionAverage(s.id, c.id)])),
    }));

    const months = new Set<string>();
    proartRespondents.forEach(r => {
      if (!r.responseTimestamp) return;
      const d = new Date(r.responseTimestamp);
      months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    });
    const evolutionData = [...months].sort().map(month => {
      const row: Record<string, string | number> = { month };
      activeCompanies.forEach(c => {
        const pool = proartRespondents.filter(r => {
          if (!r.responseTimestamp || r.companyId !== c.id) return false;
          const d = new Date(r.responseTimestamp);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` <= month;
        });
        if (pool.length === 0) return;
        const avg = availableSections.reduce((acc, s) => {
          const qs = questions.filter(q => q.section === s.id);
          const qsWithData = qs.filter(q => pool.some(r => r.answers[q.id] !== undefined));
          if (qsWithData.length === 0) return acc;
          return acc + qsWithData.reduce((a, q) => {
            const withAns = pool.filter(r => r.answers[q.id] !== undefined);
            return a + (withAns.length > 0 ? withAns.reduce((x, r) => x + r.answers[q.id], 0) / withAns.length : 0);
          }, 0) / qsWithData.length;
        }, 0) / (availableSections.length || 1);
        row[c.name.split(" ")[0]] = Math.round(avg * 100) / 100;
      });
      return row;
    });

    const overallAvg = availableSections.length > 0
      ? availableSections.reduce((acc, s) => acc + getSectionAverage(s.id), 0) / availableSections.length
      : 0;

    return (
      <>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {!isCompanyUser && <KPICard title="Empresas (PROART)" value={activeCompanies.length} subtitle="com dados nesta metodologia" sparkData={[activeCompanies.length]} color={COLORS[0]} />}
          <KPICard title="Respostas PROART" value={activeRespondents.length} subtitle="respondentes" sparkData={[activeRespondents.length]} color={COLORS[1]} />
          <KPICard title="Média Geral" value={overallAvg.toFixed(2)} subtitle="escala 1-5" sparkData={[overallAvg]} color={COLORS[2]} />
          <KPICard title="Formulários PROART" value={activeForms.length} subtitle="pesquisas cadastradas" sparkData={[activeForms.length]} color={COLORS[3]} />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-card min-w-0">
            <h3 className="mb-4 text-sm font-semibold text-card-foreground">{isCompanyUser ? "Resultado por Pilar" : "Benchmark por Pilar"} (1-5)</h3>
            <ResponsiveChart height={300}>
              <BarChart data={benchmarkData} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: chart.tickFontSize, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis domain={[0, 5]} tick={{ fontSize: chart.tickFontSize, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={chart.tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: chart.legendFontSize }} />
                {availableSections.map((s, i) => <Bar key={s.id} dataKey={s.shortName} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />)}
              </BarChart>
            </ResponsiveChart>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-card min-w-0">
            <h3 className="mb-4 text-sm font-semibold text-card-foreground">Perfil Comparativo (Radar)</h3>
            <ResponsiveChart height={300}>
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius={chart.radarOuterRadius}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: chart.radarAngleFontSize, fill: "hsl(var(--muted-foreground))" }} />
                <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fontSize: 9 }} />
                {activeCompanies.map((c, i) => <Radar key={c.id} name={c.name.split(" ")[0]} dataKey={c.name.split(" ")[0]} stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.1} strokeWidth={2} />)}
                <Legend wrapperStyle={{ fontSize: chart.legendFontSize }} />
              </RadarChart>
            </ResponsiveChart>
          </div>
        </div>

        {evolutionData.length > 1 && (
          <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-card min-w-0">
            <h3 className="mb-4 text-sm font-semibold text-card-foreground">Evolução Temporal (PROART)</h3>
            <ResponsiveChart height={300}>
              <LineChart data={evolutionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: chart.tickFontSize, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis domain={[0, 5]} tick={{ fontSize: chart.tickFontSize, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={chart.tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: chart.legendFontSize }} />
                {activeCompanies.map((c, i) => <Line key={c.id} type="monotone" dataKey={c.name.split(" ")[0]} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: chart.isMobile ? 2 : 4 }} connectNulls />)}
              </LineChart>
            </ResponsiveChart>
          </div>
        )}

        {!isCompanyUser && (
          <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-card">
            <h3 className="mb-4 text-sm font-semibold text-card-foreground">Ranking de Empresas (PROART)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left font-semibold text-muted-foreground">#</th>
                    <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Empresa</th>
                    <th className="px-4 py-3 text-center font-semibold text-muted-foreground">Respostas</th>
                    {availableSections.map((s) => <th key={s.id} className="px-4 py-3 text-center font-semibold text-muted-foreground">{s.shortName}</th>)}
                    <th className="px-4 py-3 text-center font-semibold text-muted-foreground">Média</th>
                  </tr>
                </thead>
                <tbody>
                  {companyRanking.map((c, i) => (
                    <tr key={c.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-bold text-muted-foreground">{i + 1}</td>
                      <td className="px-4 py-3 font-semibold text-foreground">{c.name}</td>
                      <td className="px-4 py-3 text-center text-muted-foreground">{c.respondentCount}</td>
                      {availableSections.map((s) => <td key={s.id} className="px-4 py-3 text-center"><span className="font-medium">{getSectionAverage(s.id, c.id).toFixed(1)}</span></td>)}
                      <td className="px-4 py-3 text-center"><span className="inline-flex items-center justify-center rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">{c.average.toFixed(2)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </>
    );
  };

  // ===================== COPSOQ =====================
  const copsoqView = () => {
    const poolOf = (companyId?: string) =>
      companyId ? activeRespondents.filter(r => r.companyId === companyId) : activeRespondents;

    const domainRisk = (domainId: string, companyId?: string) => {
      const pool = poolOf(companyId);
      if (pool.length === 0) return 0;
      const dims = COPSOQ_SCORABLE_DIMENSIONS.filter(d => d.domainId === domainId);
      const values = dims.map(d => normalizedRisk(d, dimensionAverage(d, pool))).filter(v => !isNaN(v));
      if (values.length === 0) return 0;
      return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100);
    };

    const scorableDomains = COPSOQ_DOMAINS.filter(d => d.dimensions.some(x => x.scorable));

    const overallRisk = (companyId?: string) => {
      const vals = scorableDomains.map(d => domainRisk(d.id, companyId));
      return Math.round(vals.reduce((a, b) => a + b, 0) / (vals.length || 1));
    };

    const benchmarkData = activeCompanies.map(c => {
      const row: Record<string, string | number> = { name: c.name.split(" ")[0] };
      scorableDomains.forEach(d => { row[d.shortName] = domainRisk(d.id, c.id); });
      return row;
    });

    const radarData = scorableDomains.map(d => ({
      subject: d.shortName,
      ...Object.fromEntries(activeCompanies.map(c => [c.name.split(" ")[0], domainRisk(d.id, c.id)])),
    }));

    const ranking = activeCompanies.map(c => ({
      ...c,
      risk: overallRisk(c.id),
      respondentCount: poolOf(c.id).length,
    })).sort((a, b) => a.risk - b.risk);

    const dimensionRows = COPSOQ_SCORABLE_DIMENSIONS.map(d => {
      const avg = dimensionAverage(d, activeRespondents);
      const cls = classifyCopsoq(d, avg);
      return { d, avg, cls };
    }).sort((a, b) => normalizedRisk(b.d, b.avg) - normalizedRisk(a.d, a.avg));

    return (
      <>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {!isCompanyUser && <KPICard title="Empresas (COPSOQ)" value={activeCompanies.length} subtitle="com dados nesta metodologia" sparkData={[activeCompanies.length]} color={COLORS[0]} />}
          <KPICard title="Respostas COPSOQ" value={activeRespondents.length} subtitle="respondentes" sparkData={[activeRespondents.length]} color={COLORS[1]} />
          <KPICard title="Índice de Risco" value={`${overallRisk()}%`} subtitle="0% ótimo · 100% crítico" sparkData={[overallRisk()]} color={COLORS[4]} />
          <KPICard title="Formulários COPSOQ" value={activeForms.length} subtitle="pesquisas cadastradas" sparkData={[activeForms.length]} color={COLORS[3]} />
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            O COPSOQ II-Br usa somatórios por dimensão (0-8 / 0-4) com faixas próprias, portanto não é comparável às médias 1-5 do PROART.
            Para o benchmark entre empresas usamos o <strong>índice de risco normalizado (0-100)</strong>: quanto menor, melhor.
          </span>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-card min-w-0">
            <h3 className="mb-4 text-sm font-semibold text-card-foreground">{isCompanyUser ? "Risco por Domínio" : "Benchmark por Domínio"} (0-100)</h3>
            <ResponsiveChart height={300}>
              <BarChart data={benchmarkData} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: chart.tickFontSize, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: chart.tickFontSize, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={chart.tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: chart.legendFontSize }} />
                {scorableDomains.map((d, i) => <Bar key={d.id} dataKey={d.shortName} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />)}
              </BarChart>
            </ResponsiveChart>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-card min-w-0">
            <h3 className="mb-4 text-sm font-semibold text-card-foreground">Perfil de Risco (Radar)</h3>
            <ResponsiveChart height={300}>
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius={chart.radarOuterRadius}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: chart.radarAngleFontSize, fill: "hsl(var(--muted-foreground))" }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9 }} />
                {activeCompanies.map((c, i) => <Radar key={c.id} name={c.name.split(" ")[0]} dataKey={c.name.split(" ")[0]} stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.1} strokeWidth={2} />)}
                <Legend wrapperStyle={{ fontSize: chart.legendFontSize }} />
              </RadarChart>
            </ResponsiveChart>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-card">
          <h3 className="mb-4 text-sm font-semibold text-card-foreground">Dimensões com maior risco (COPSOQ II-Br)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Domínio</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Dimensão</th>
                  <th className="px-4 py-3 text-center font-semibold text-muted-foreground">Pontuação</th>
                  <th className="px-4 py-3 text-center font-semibold text-muted-foreground">Classificação</th>
                </tr>
              </thead>
              <tbody>
                {dimensionRows.slice(0, 10).map(({ d, avg, cls }) => (
                  <tr key={d.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground">{COPSOQ_DOMAINS.find(x => x.id === d.domainId)?.shortName}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{d.name}</td>
                    <td className="px-4 py-3 text-center font-medium">{avg.toFixed(1)} / {d.maxScore}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-bold", copsoqClassBgColor(cls))}>{copsoqClassLabel(cls)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {!isCompanyUser && (
          <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-card">
            <h3 className="mb-4 text-sm font-semibold text-card-foreground">Ranking de Empresas (COPSOQ II-Br)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left font-semibold text-muted-foreground">#</th>
                    <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Empresa</th>
                    <th className="px-4 py-3 text-center font-semibold text-muted-foreground">Respostas</th>
                    {scorableDomains.map(d => <th key={d.id} className="px-4 py-3 text-center font-semibold text-muted-foreground">{d.shortName}</th>)}
                    <th className="px-4 py-3 text-center font-semibold text-muted-foreground">Índice</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((c, i) => (
                    <tr key={c.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-bold text-muted-foreground">{i + 1}</td>
                      <td className="px-4 py-3 font-semibold text-foreground">{c.name}</td>
                      <td className="px-4 py-3 text-center text-muted-foreground">{c.respondentCount}</td>
                      {scorableDomains.map(d => <td key={d.id} className="px-4 py-3 text-center font-medium">{domainRisk(d.id, c.id)}</td>)}
                      <td className="px-4 py-3 text-center"><span className="inline-flex items-center justify-center rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">{c.risk}%</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </>
    );
  };

  return (
    <DashboardLayout>
      <div className="animate-fade-in space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Visão Geral</h1>
            <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
          </div>
          <DateRangeFilter startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate} />
        </div>

        {availableMethodologies.length > 1 && (
          <div className="inline-flex rounded-lg border border-border bg-card p-1">
            {availableMethodologies.map(m => (
              <button
                key={m}
                onClick={() => setTab(m)}
                className={cn(
                  "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                  active === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                )}
              >
                {methodologyLabel(m)}
                <span className="ml-2 text-xs opacity-70">
                  {(m === "copsoq" ? copsoqRespondents : proartRespondents).length}
                </span>
              </button>
            ))}
          </div>
        )}

        {active === "copsoq" ? copsoqView() : proartView()}

        {plans.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-card">
            <h3 className="mb-4 text-sm font-semibold text-card-foreground flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> Execução dos Planos de Ação</h3>
            <div className="space-y-3">
              {activeCompanies.map(c => {
                const cConfigIds = new Set(respondents.filter(r => r.companyId === c.id).map(r => (r as any).configId).filter(Boolean));
                const cPlans = plans.filter(p => p.company_config_id === c.id || cConfigIds.has(p.company_config_id));
                if (cPlans.length === 0) return null;
                const cTasks = tasks.filter(t => cPlans.some(p => p.id === t.action_plan_id));
                const completedTasks = cTasks.filter(t => t.is_completed).length;
                const progress = cTasks.length > 0 ? Math.round((completedTasks / cTasks.length) * 100) : 0;
                const hasOverdue = cPlans.some(p => {
                  const created = new Date(p.created_at);
                  const deadline = new Date(created.getTime() + p.deadline_days * 24 * 60 * 60 * 1000);
                  return p.status !== "completed" && deadline < new Date();
                });
                return (
                  <div key={c.id} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                        {hasOverdue && <span className="text-[10px] font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">ATRASADO</span>}
                      </div>
                      <p className="text-xs text-muted-foreground">{cPlans.length} plano(s) · {completedTasks}/{cTasks.length} tarefas</p>
                    </div>
                    <div className="w-32"><Progress value={progress} className="h-2" /></div>
                    <span className="text-sm font-bold text-foreground w-12 text-right">{progress}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
