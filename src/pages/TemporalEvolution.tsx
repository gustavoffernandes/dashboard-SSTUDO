import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ResponsiveChart, useChartConfig } from "@/components/dashboard/ResponsiveChart";
import { useSurveyData } from "@/hooks/useSurveyData";
import { useAuth } from "@/contexts/AuthContext";
import { questions } from "@/data/mockData";
import { ALL_FACTORS } from "@/lib/proartMethodology";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import { Loader2, TrendingUp, AlertTriangle } from "lucide-react";

const COLORS = ["hsl(217, 71%, 45%)", "hsl(170, 60%, 45%)", "hsl(38, 92%, 55%)", "hsl(280, 60%, 55%)", "hsl(0, 72%, 55%)", "hsl(200, 80%, 50%)"];

export default function TemporalEvolution() {
  const { isCompanyUser } = useAuth();
  const { isLoading, hasData, companies, respondents, formConfigs, getAvailableSections, getFormConfigsForCompany } = useSurveyData();
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const availableSections = getAvailableSections();
  const chart = useChartConfig();

  if (isLoading) return <DashboardLayout><div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></DashboardLayout>;
  if (!hasData) return <DashboardLayout><div className="flex flex-col items-center justify-center h-64 text-center"><p className="text-sm text-muted-foreground">Nenhum dado disponível.</p></div></DashboardLayout>;

  const effectiveCompany = isCompanyUser && companies.length === 1 ? companies[0].id : (selectedCompany || companies[0]?.id || "");
  const company = companies.find(c => c.id === effectiveCompany);
  const companyForms = getFormConfigsForCompany(effectiveCompany);

  // Group respondents by form (configId)
  const formGroups: Record<string, { title: string; respondents: typeof respondents }> = {};
  companyForms.forEach(f => {
    const formRespondents = respondents.filter(r => r.configId === f.configId);
    if (formRespondents.length > 0) {
      formGroups[f.configId] = { title: f.title, respondents: formRespondents };
    }
  });

  const formEntries = Object.entries(formGroups);
  const hasMultipleForms = formEntries.length >= 2;

  // Compute averages per section for each form
  const formSectionData = formEntries.map(([configId, { title, respondents: pool }]) => {
    const sectionAvgs: Record<string, number> = {};
    availableSections.forEach(s => {
      const qs = questions.filter(q => q.section === s.id);
      const qsWithData = qs.filter(q => pool.some(r => r.answers[q.id] !== undefined));
      if (qsWithData.length === 0) { sectionAvgs[s.shortName] = 0; return; }
      const avg = qsWithData.reduce((acc, q) => {
        const withAns = pool.filter(r => r.answers[q.id] !== undefined);
        return acc + (withAns.length > 0 ? withAns.reduce((a, r) => a + r.answers[q.id], 0) / withAns.length : 0);
      }, 0) / qsWithData.length;
      sectionAvgs[s.shortName] = Math.round(avg * 100) / 100;
    });
    return { configId, title, count: pool.length, sectionAvgs };
  });

  // Build chart data: one row per section, one key per form title
  const truncateTitle = (t: string) => t.length > 25 ? t.substring(0, 22) + "..." : t;
  const formTitles = formSectionData.map(f => truncateTitle(f.title));

  const evolutionBySection = availableSections.map(s => {
    const row: Record<string, string | number> = { escala: s.shortName };
    formSectionData.forEach(f => {
      row[truncateTitle(f.title)] = f.sectionAvgs[s.shortName] || 0;
    });
    return row;
  });

  // Variation table
  const deltas = hasMultipleForms ? availableSections.map(s => {
    const values = formSectionData.map(f => ({ title: truncateTitle(f.title), value: f.sectionAvgs[s.shortName] || 0 }));
    const min = Math.min(...values.map(v => v.value));
    const max = Math.max(...values.map(v => v.value));
    return { name: s.shortName, values, delta: max - min };
  }) : [];

  // Radar comparison
  const radarComparison = hasMultipleForms ? availableSections.map(s => {
    const row: Record<string, string | number> = { subject: s.shortName };
    formSectionData.forEach(f => {
      row[truncateTitle(f.title)] = f.sectionAvgs[s.shortName] || 0;
    });
    return row;
  }) : [];

  // Factor evolution per form
  const factorByForm = formEntries.map(([configId, { title, respondents: pool }]) => {
    const factorAvgs: Record<string, number> = {};
    ALL_FACTORS.forEach(f => {
      const answers = pool.flatMap(r => f.questionIds.map(qId => r.answers[qId]).filter(v => v !== undefined));
      factorAvgs[f.shortName] = answers.length > 0 ? Math.round((answers.reduce((a, b) => a + b, 0) / answers.length) * 100) / 100 : 0;
    });
    return { configId, title: truncateTitle(title), factorAvgs };
  });

  const evolutionByFactor = ALL_FACTORS.map(f => {
    const row: Record<string, string | number> = { fator: f.shortName };
    factorByForm.forEach(form => {
      row[form.title] = form.factorAvgs[f.shortName] || 0;
    });
    return row;
  });

  // Evolução das Médias por Escala (admin only) - line chart
  const scaleEvolutionData = !isCompanyUser ? (() => {
    // Group all forms across all companies, sorted by creation/configId
    const allForms = companies.flatMap(c => {
      const cForms = getFormConfigsForCompany(c.id);
      return cForms.map(f => {
        const pool = respondents.filter(r => r.configId === f.configId);
        const sectionAvgs: Record<string, number> = {};
        availableSections.forEach(s => {
          const qs = questions.filter(q => q.section === s.id);
          const qsWithData = qs.filter(q => pool.some(r => r.answers[q.id] !== undefined));
          if (qsWithData.length === 0) { sectionAvgs[s.shortName] = 0; return; }
          const avg = qsWithData.reduce((acc, q) => {
            const withAns = pool.filter(r => r.answers[q.id] !== undefined);
            return acc + (withAns.length > 0 ? withAns.reduce((a, r) => a + r.answers[q.id], 0) / withAns.length : 0);
          }, 0) / qsWithData.length;
          sectionAvgs[s.shortName] = Math.round(avg * 100) / 100;
        });
        return { label: `${c.name.split(" ")[0]} - ${f.title.length > 15 ? f.title.substring(0, 12) + "..." : f.title}`, sectionAvgs, count: pool.length };
      }).filter(f => f.count > 0);
    });
    if (allForms.length < 2) return null;
    // Build data: one row per scale, one key per form
    return availableSections.map(s => {
      const row: Record<string, string | number> = { escala: s.shortName };
      allForms.forEach(f => { row[f.label] = f.sectionAvgs[s.shortName] || 0; });
      return row;
    });
  })() : null;
  const scaleEvolutionKeys = scaleEvolutionData ? Object.keys(scaleEvolutionData[0] || {}).filter(k => k !== "escala") : [];

  return (
    <DashboardLayout>
      <div className="animate-fade-in space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
              <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-primary" /> Evolução Temporal
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">Compare formulários da mesma empresa lado a lado</p>
          </div>
          {!isCompanyUser && (
            <select value={effectiveCompany} onChange={e => setSelectedCompany(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm w-full sm:w-auto">
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
        </div>

        {!hasMultipleForms && (
          <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 sm:p-6 text-center">
            <AlertTriangle className="h-6 w-6 sm:h-8 sm:w-8 text-warning mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-foreground mb-1">Dados insuficientes para comparação</h3>
            <p className="text-xs text-muted-foreground">
              {formEntries.length === 0
                ? "Nenhum formulário com respostas encontrado para esta empresa."
                : "É necessário ter pelo menos 2 formulários com respostas para visualizar a comparação. Atualmente há apenas 1 formulário."}
            </p>
          </div>
        )}

        {hasMultipleForms && (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
              <div className="rounded-lg border border-border bg-card p-3 sm:p-4 text-center">
                <p className="text-[10px] sm:text-xs text-muted-foreground">Formulários</p>
                <p className="text-lg sm:text-2xl font-bold text-foreground">{formEntries.length}</p>
              </div>
              {formSectionData.slice(0, 3).map((f, i) => (
                <div key={f.configId} className="rounded-lg border border-border bg-card p-3 sm:p-4 text-center overflow-hidden">
                  <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{f.title}</p>
                  <p className="text-lg sm:text-2xl font-bold text-foreground">{f.count}</p>
                  <p className="text-[10px] text-muted-foreground">respondentes</p>
                </div>
              ))}
            </div>

            {/* Bar chart: sections by form */}
            <div className="rounded-xl border border-border bg-card p-3 sm:p-5 shadow-card min-w-0">
              <h3 className="mb-4 text-xs sm:text-sm font-semibold text-card-foreground">Comparação por Escala</h3>
              <ResponsiveChart height={350}>
                <BarChart data={evolutionBySection} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="escala" tick={{ fontSize: chart.tickFontSize, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis domain={[0, 5]} tick={{ fontSize: chart.tickFontSize, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={chart.tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: chart.legendFontSize }} />
                  {formTitles.map((title, i) => (
                    <Bar key={title} dataKey={title} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveChart>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-2">
              {/* Factor comparison */}
              <div className="rounded-xl border border-border bg-card p-3 sm:p-5 shadow-card min-w-0">
                <h3 className="mb-4 text-xs sm:text-sm font-semibold text-card-foreground">Comparação por Fator</h3>
                <ResponsiveChart height={300}>
                  <BarChart data={evolutionByFactor} barCategoryGap="15%">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="fator" tick={{ fontSize: chart.tickFontSize, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis domain={[0, 5]} tick={{ fontSize: chart.tickFontSize, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={chart.tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: chart.legendFontSize }} />
                    {formTitles.map((title, i) => (
                      <Bar key={title} dataKey={title} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveChart>
              </div>

              {/* Radar comparison */}
              <div className="rounded-xl border border-border bg-card p-3 sm:p-5 shadow-card min-w-0">
                <h3 className="mb-4 text-xs sm:text-sm font-semibold text-card-foreground">Radar: Comparação entre Formulários</h3>
                <ResponsiveChart height={300}>
                  <RadarChart data={radarComparison} cx="50%" cy="50%" outerRadius={chart.radarOuterRadius}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: chart.radarAngleFontSize, fill: "hsl(var(--muted-foreground))" }} />
                    <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fontSize: 9 }} />
                    {formTitles.map((title, i) => (
                      <Radar key={title} name={title} dataKey={title} stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.1} strokeWidth={2} />
                    ))}
                    <Legend wrapperStyle={{ fontSize: chart.legendFontSize }} />
                  </RadarChart>
                </ResponsiveChart>
              </div>
            </div>

            {/* Detail table */}
            <div className="rounded-xl border border-border bg-card p-3 sm:p-5 shadow-card">
              <h3 className="mb-4 text-xs sm:text-sm font-semibold text-card-foreground">Detalhamento por Escala</h3>
              <div className="overflow-x-auto -mx-3 sm:mx-0">
                <table className="w-full text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-2 sm:px-4 py-2 text-left font-semibold text-muted-foreground">Escala</th>
                      {formSectionData.map((f, i) => (
                        <th key={f.configId} className="px-2 sm:px-4 py-2 text-center font-semibold text-muted-foreground">
                          <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <span className="hidden sm:inline">{truncateTitle(f.title)}</span>
                          <span className="sm:hidden">F{i + 1}</span>
                        </th>
                      ))}
                      {formSectionData.length >= 2 && (
                        <th className="px-2 sm:px-4 py-2 text-center font-semibold text-muted-foreground">Variação</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {availableSections.map(s => {
                      const values = formSectionData.map(f => f.sectionAvgs[s.shortName] || 0);
                      const delta = values.length >= 2 ? Math.max(...values) - Math.min(...values) : 0;
                      return (
                        <tr key={s.id} className="border-b border-border/50">
                          <td className="px-2 sm:px-4 py-2 font-medium text-foreground">{s.shortName}</td>
                          {formSectionData.map(f => (
                            <td key={f.configId} className="px-2 sm:px-4 py-2 text-center text-foreground font-medium">
                              {(f.sectionAvgs[s.shortName] || 0).toFixed(2)}
                            </td>
                          ))}
                          {formSectionData.length >= 2 && (
                            <td className="px-2 sm:px-4 py-2 text-center">
                              <span className={cn("font-bold", delta > 0.3 ? "text-destructive" : delta > 0.1 ? "text-warning" : "text-success")}>
                                ±{delta.toFixed(2)}
                              </span>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Mobile legend */}
              <div className="sm:hidden mt-3 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                {formSectionData.map((f, i) => (
                  <span key={f.configId} className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    F{i + 1}: {truncateTitle(f.title)}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Evolução das Médias por Escala (admin only) */}
        {!isCompanyUser && scaleEvolutionData && scaleEvolutionData.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-3 sm:p-5 shadow-card min-w-0">
            <h3 className="mb-4 text-xs sm:text-sm font-semibold text-card-foreground">Evolução das Médias por Escala</h3>
            <ResponsiveChart height={350}>
              <BarChart data={scaleEvolutionData} barCategoryGap="15%">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="escala" tick={{ fontSize: chart.tickFontSize, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis domain={[0, 5]} tick={{ fontSize: chart.tickFontSize, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={chart.tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: chart.legendFontSize }} />
                {scaleEvolutionKeys.map((key, i) => (
                  <Bar key={key} dataKey={key} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveChart>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
