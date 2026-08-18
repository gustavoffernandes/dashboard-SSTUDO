import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useSurveyData } from "@/hooks/useSurveyData";
import { useActionPlans } from "@/hooks/useActionPlans";
import { FormFilter } from "@/components/dashboard/FormFilter";
import {
  PROART_SCALES, ALL_FACTORS, classifyRisk, getRiskLabel, getRiskColor, getRiskBgColor,
  calculatePxS, getPRLevelLabel, getPRLevelColor, getPRLevelBgColor,
  getSuggestedActions, PXS_MATRIX, getMatrixCellPR,
  type PRLevel, type RiskLevel,
} from "@/lib/proartMethodology";
import {
  COPSOQ_DIMENSIONS, COPSOQ_DOMAINS, COPSOQ_SCORABLE_DIMENSIONS,
  classifyCopsoq, copsoqClassToRiskLevel, dimensionAverage, dimensionScore,
  calculateCopsoqPxS, getCopsoqSuggestedActions,
} from "@/lib/copsoqMethodology";
import { methodologyLabel, type Methodology } from "@/lib/methodology";

import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Plus, CheckCircle2, Clock, AlertTriangle, Trash2, ChevronDown, ChevronUp, MessageSquare, Target, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

export default function ActionPlans() {
  const { user, isCompanyUser } = useAuth();
  const { isLoading: loadingSurvey, hasData, companies, respondents, getCompanyRespondents, getAvailableSections, getFormConfigsForCompany } = useSurveyData();
  const { plans, tasks, isLoading: loadingPlans, createPlan, updatePlanStatus, deletePlan, createTask, updateTask, deleteTask } = useActionPlans();
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [selectedFormId, setSelectedFormId] = useState<string>("");
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [editingObs, setEditingObs] = useState<string | null>(null);
  const [obsText, setObsText] = useState("");

  const isLoading = loadingSurvey || loadingPlans;
  const readOnly = isCompanyUser;

  if (isLoading) return <DashboardLayout><div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></DashboardLayout>;
  if (!hasData) return <DashboardLayout><div className="flex flex-col items-center justify-center h-64 text-center"><p className="text-sm text-muted-foreground">Nenhum dado disponível.</p></div></DashboardLayout>;

  const effectiveCompany = isCompanyUser && companies.length === 1 ? companies[0].id : (selectedCompany || companies[0]?.id || "");
  const company = companies.find(c => c.id === effectiveCompany);
  const companyForms = getFormConfigsForCompany(effectiveCompany);
  const allCompanyRespondents = getCompanyRespondents(effectiveCompany);

  // Helper: compute factor/dimension results and PxS for a given pool, per methodology
  const computeAnalysis = (pool: typeof respondents, methodology: Methodology = "proart") => {
    if (methodology === "copsoq") {
      const dimScores: Record<string, number> = {};
      const factorResults = COPSOQ_DIMENSIONS.map(d => {
        const avg = dimensionAverage(d, pool.map(r => ({ answers: r.answers })));
        dimScores[d.id] = avg;
        const cls = classifyCopsoq(d, avg);
        return {
          id: d.id,
          name: d.name,
          groupLabel: COPSOQ_DOMAINS.find(dom => dom.id === d.domainId)?.shortName || "",
          avg: Math.round(avg * 100) / 100,
          scoreLabel: d.scorable ? `${avg.toFixed(1)}/${d.maxScore}` : `${avg.toFixed(1)}`,
          risk: d.scorable ? copsoqClassToRiskLevel(cls) : ("low" as RiskLevel),
          scorable: d.scorable,
        };
      });
      const highRiskCount = pool.filter(r =>
        COPSOQ_SCORABLE_DIMENSIONS.some(d => {
          const s = dimensionScore(d, r.answers);
          return s !== null && classifyCopsoq(d, s) === "risco";
        })
      ).length;
      const pxs = calculateCopsoqPxS(dimScores, pool.length, highRiskCount);
      return { factorResults, pxs, methodology };
    }

    const factorResults = ALL_FACTORS.map(f => {
      const qIds = f.questionIds;
      const answers = pool.flatMap(r => qIds.map(qId => r.answers[qId]).filter(v => v !== undefined));
      const avg = answers.length > 0 ? answers.reduce((a, b) => a + b, 0) / answers.length : 0;
      const risk = classifyRisk(avg, f.type);
      return {
        id: f.id,
        name: f.name,
        groupLabel: PROART_SCALES.find(s => s.id === f.scaleId)?.shortName || "",
        avg: Math.round(avg * 100) / 100,
        scoreLabel: (Math.round(avg * 100) / 100).toFixed(2),
        risk,
        scorable: true,
        questionIds: f.questionIds,
        type: f.type,
      };
    });
    const byScale = (scaleId: string) => {
      const list = ALL_FACTORS.filter(f => f.scaleId === scaleId).map(f => factorResults.find(r => r.id === f.id)?.avg || 0);
      return list.length > 0 ? list.reduce((a, b) => a + b, 0) / list.length : 0;
    };
    const eotAvg = byScale("contexto");
    const eegColAvg = factorResults.find(f => f.id === "coletivista")?.avg || 0;
    const eistAvg = byScale("vivencias");
    const edtAvg = byScale("saude");
    const highRiskCount = pool.filter(r => {
      const negAvgs = ALL_FACTORS.filter(f => f.type === "negative").map(f => {
        const vals = f.questionIds.map(qId => r.answers[qId]).filter(v => v !== undefined);
        return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      });
      return negAvgs.some(v => v >= 3.70);
    }).length;
    const pxs = calculatePxS(eotAvg, eegColAvg, eistAvg, edtAvg, pool.length, highRiskCount);
    return { factorResults, pxs, methodology: "proart" as Methodology };
  };

  // Determine which form to show
  const activeFormId = selectedFormId || (companyForms.length > 0 ? companyForms[0].configId : "");
  const activeForm = companyForms.find(f => f.configId === activeFormId);
  const activeMethodology: Methodology = activeForm?.methodology || companyForms[0]?.methodology || "proart";

  // Compute data for active form only
  const activePool = activeFormId
    ? allCompanyRespondents.filter(r => r.configId === activeFormId)
    : allCompanyRespondents;
  const activeAnalysis = computeAnalysis(activePool, activeMethodology);
  const activeFormPlans = plans.filter(p => p.company_config_id === activeFormId);

  // Legacy plans
  const formConfigIds = new Set(companyForms.map(f => f.configId));
  const legacyPlans = plans.filter(p => p.company_config_id === effectiveCompany && !formConfigIds.has(p.company_config_id));

  // Fallback: if no forms exist
  const fallbackAnalysis = companyForms.length === 0 ? computeAnalysis(allCompanyRespondents, activeMethodology) : null;
  const fallbackPlans = companyForms.length === 0 ? plans.filter(p => p.company_config_id === effectiveCompany) : [];

  const handleGeneratePlansForForm = async (
    formConfigId: string,
    factorResults: ReturnType<typeof computeAnalysis>["factorResults"],
    pxs: ReturnType<typeof computeAnalysis>["pxs"],
    methodology: Methodology,
  ) => {
    if (!user || readOnly) return;
    const existingPlans = plans.filter(p => p.company_config_id === formConfigId);
    const riskyFactors = factorResults.filter(f => f.scorable && (f.risk === "high" || f.risk === "medium"));
    for (const factor of riskyFactors) {
      const existing = existingPlans.find(p => p.factor_id === factor.id);
      if (existing) continue;
      const suggested = methodology === "copsoq"
        ? getCopsoqSuggestedActions(factor.id, factor.risk)
        : getSuggestedActions(factor.id, factor.risk);
      if (!suggested) continue;
      const plan = await createPlan({
        company_config_id: formConfigId,
        user_id: user.id,
        title: suggested.title,
        description: `${methodology === "copsoq" ? "Dimensão" : "Fator"}: ${factor.name} | ${methodology === "copsoq" ? "Pontuação" : "Média"}: ${factor.scoreLabel} | ${getRiskLabel(factor.risk)}`,
        factor_id: factor.id,
        risk_level: pxs.prLevel,
        risk_score: pxs.risk,
        deadline_days: pxs.deadlineDays,
        status: "pending",
      });
      if (plan) {
        for (const task of suggested.tasks) {
          await createTask({ action_plan_id: plan.id, title: task.title, description: task.porQue, observation: task.como });
        }
      }
    }
  };


  const getPlanProgress = (planId: string) => {
    const planTasks = tasks.filter(t => t.action_plan_id === planId);
    if (planTasks.length === 0) return 0;
    return Math.round((planTasks.filter(t => t.is_completed).length / planTasks.length) * 100);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle2 className="h-4 w-4 text-success" />;
      case "in_progress": return <Clock className="h-4 w-4 text-warning" />;
      default: return <AlertTriangle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const renderPlanCard = (plan: typeof plans[0]) => {
    const progress = getPlanProgress(plan.id);
    const planTasks = tasks.filter(t => t.action_plan_id === plan.id);
    const isExpanded = expandedPlan === plan.id;

    return (
      <div key={plan.id} className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
        <div className="p-3 sm:p-4 cursor-pointer" onClick={() => setExpandedPlan(isExpanded ? null : plan.id)}>
          <div className="flex items-start justify-between gap-2 sm:gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                {getStatusIcon(plan.status)}
                <h4 className="text-xs sm:text-sm font-semibold text-foreground line-clamp-2">{plan.title}</h4>
              </div>
              <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-2">{plan.description}</p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <div className="text-right">
                <p className="text-base sm:text-lg font-bold text-foreground">{progress}%</p>
                <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap", getPRLevelBgColor(plan.risk_level as PRLevel), getPRLevelColor(plan.risk_level as PRLevel))}>
                  {plan.risk_level}
                </span>
              </div>
              {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
            </div>
          </div>
          <Progress value={progress} className="mt-3 h-2" />
        </div>

        {isExpanded && (
          <div className="border-t border-border p-3 sm:p-4 space-y-3">
            {!readOnly ? (
              <div className="flex flex-wrap items-center gap-2">
                {(["pending", "in_progress", "completed"] as const).map(s => (
                  <button key={s} onClick={() => updatePlanStatus(plan.id, s)} className={cn("text-xs px-3 py-1 rounded-full border transition-colors", plan.status === s ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50")}>
                    {s === "pending" ? "Pendente" : s === "in_progress" ? "Em andamento" : "Concluído"}
                  </button>
                ))}
                <button onClick={() => { if (confirm(`Excluir o plano "${plan.title}" e todas as suas ações? Esta ação não pode ser desfeita.`)) deletePlan(plan.id); }} className="ml-auto text-xs text-destructive hover:text-destructive/80 flex items-center gap-1">
                  <Trash2 className="h-3 w-3" /> Excluir
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs px-3 py-1 rounded-full border bg-primary text-primary-foreground border-primary">
                  {plan.status === "pending" ? "Pendente" : plan.status === "in_progress" ? "Em andamento" : "Concluído"}
                </span>
              </div>
            )}

            {planTasks.length > 0 && (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="px-3 py-2 text-left font-semibold text-muted-foreground w-8"></th>
                        <th className="px-3 py-2 text-left font-semibold text-muted-foreground">O que</th>
                        <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Por que</th>
                        <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Como</th>
                        <th className="px-3 py-2 text-center font-semibold text-muted-foreground">Status</th>
                        {!readOnly && <th className="px-3 py-2 text-center font-semibold text-muted-foreground">Ações</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {planTasks.map(task => (
                        <tr key={task.id} className={cn("border-b border-border/50 transition-colors", task.is_completed ? "bg-success/5" : "bg-warning/5")}>
                          <td className="px-3 py-2">
                            {readOnly ? (
                              <span className={cn("h-4 w-4 rounded border flex items-center justify-center shrink-0", task.is_completed ? "bg-primary border-primary" : "border-border")}>
                                {task.is_completed && <svg className="h-2.5 w-2.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                              </span>
                            ) : (
                              <input type="checkbox" checked={task.is_completed} onChange={() => updateTask(task.id, { is_completed: !task.is_completed })} className="h-4 w-4 rounded border-border accent-primary" />
                            )}
                          </td>
                          <td className={cn("px-3 py-2 font-medium", task.is_completed ? "line-through text-muted-foreground" : "text-foreground")}>{task.title}</td>
                          <td className="px-3 py-2 text-muted-foreground">{task.description || "—"}</td>
                          <td className="px-3 py-2 text-muted-foreground italic">{task.observation || "—"}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold", task.is_completed ? "bg-success/15 text-success" : "bg-warning/15 text-warning")}>
                              {task.is_completed ? "✓ Executada" : "⏳ Pendente"}
                            </span>
                          </td>
                          {!readOnly && (
                            <td className="px-3 py-2 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button onClick={() => { setEditingObs(editingObs === task.id ? null : task.id); setObsText(task.observation || ""); }} className="text-[10px] text-primary hover:underline flex items-center gap-1">
                                  <MessageSquare className="h-3 w-3" /> {task.observation ? "Editar" : "Como"}
                                </button>
                                <button onClick={() => { if (confirm(`Excluir a ação "${task.title}"?`)) deleteTask(task.id); }} className="text-[10px] text-destructive hover:underline">Excluir</button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="md:hidden space-y-2">
                  {planTasks.map(task => (
                    <div key={task.id} className={cn("rounded-lg border p-3 space-y-2", task.is_completed ? "bg-success/5 border-success/20" : "bg-warning/5 border-warning/20")}>
                      <div className="flex items-start gap-2">
                        {readOnly ? (
                          <span className={cn("h-4 w-4 rounded border flex items-center justify-center shrink-0 mt-0.5", task.is_completed ? "bg-primary border-primary" : "border-border")}>
                            {task.is_completed && <svg className="h-2.5 w-2.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                          </span>
                        ) : (
                          <input type="checkbox" checked={task.is_completed} onChange={() => updateTask(task.id, { is_completed: !task.is_completed })} className="h-4 w-4 rounded border-border accent-primary mt-0.5 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-xs font-semibold", task.is_completed ? "line-through text-muted-foreground" : "text-foreground")}>{task.title}</p>
                          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold mt-1", task.is_completed ? "bg-success/15 text-success" : "bg-warning/15 text-warning")}>
                            {task.is_completed ? "✓ Executada" : "⏳ Pendente"}
                          </span>
                        </div>
                      </div>
                      {task.description && (
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase">Por que</p>
                          <p className="text-xs text-muted-foreground">{task.description}</p>
                        </div>
                      )}
                      {task.observation && (
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase">Como</p>
                          <p className="text-xs text-muted-foreground italic">{task.observation}</p>
                        </div>
                      )}
                      {!readOnly && (
                        <div className="flex items-center gap-3 pt-1 border-t border-border/30">
                          <button onClick={() => { setEditingObs(editingObs === task.id ? null : task.id); setObsText(task.observation || ""); }} className="text-[10px] text-primary hover:underline flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" /> {task.observation ? "Editar" : "Como"}
                          </button>
                          <button onClick={() => { if (confirm(`Excluir a ação "${task.title}"?`)) deleteTask(task.id); }} className="text-[10px] text-destructive hover:underline">Excluir</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {!readOnly && editingObs && planTasks.some(t => t.id === editingObs) && (
              <div className="mt-2 flex gap-2 px-1 sm:px-3">
                <input value={obsText} onChange={e => setObsText(e.target.value)} placeholder="Como fazer (observação)..." className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs" />
                <button onClick={() => { updateTask(editingObs, { observation: obsText }); setEditingObs(null); }} className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded whitespace-nowrap">Salvar</button>
              </div>
            )}

            {!readOnly && (
              <div className="flex gap-2">
                <input value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} placeholder="Nova tarefa..." className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs" onKeyDown={e => { if (e.key === "Enter" && newTaskTitle.trim()) { createTask({ action_plan_id: plan.id, title: newTaskTitle.trim() }); setNewTaskTitle(""); } }} />
                <button onClick={() => { if (newTaskTitle.trim()) { createTask({ action_plan_id: plan.id, title: newTaskTitle.trim() }); setNewTaskTitle(""); } }} className="rounded-lg bg-primary px-3 py-2 text-xs text-primary-foreground shrink-0"><Plus className="h-3 w-3" /></button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderFormSection = (
    formTitle: string,
    formConfigId: string,
    factorResults: ReturnType<typeof computeAnalysis>["factorResults"],
    pxs: ReturnType<typeof computeAnalysis>["pxs"],
    formPlans: typeof plans,
    respondentCount: number,
    methodology: Methodology = "proart",
  ) => (
    <div key={formConfigId} className="space-y-4">
      {/* Form header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary shrink-0" />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-bold text-foreground">{formTitle}</h2>
              <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-primary/10 text-primary">{methodologyLabel(methodology)}</span>
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">{respondentCount} respondente(s)</p>
          </div>
        </div>

        <div className={cn("rounded-lg px-3 py-1 text-center self-start", getPRLevelBgColor(pxs.prLevel))}>
          <span className={cn("text-xs font-bold", getPRLevelColor(pxs.prLevel))}>Risco P×S: {pxs.risk} — {getPRLevelLabel(pxs.prLevel)}</span>
        </div>
      </div>

      {/* Compact diagnostics grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        {/* P×S Matrix */}
        <div className="rounded-xl border border-border bg-card p-3 sm:p-4 shadow-card">
          <h3 className="text-xs font-semibold text-card-foreground mb-3 flex items-center gap-2"><Target className="h-3.5 w-3.5 text-primary" /> Matriz P×S</h3>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="rounded-lg bg-muted/50 p-2 text-center">
              <p className="text-[10px] text-muted-foreground">P</p>
              <p className="text-lg sm:text-xl font-bold text-foreground">{pxs.P}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-2 text-center">
              <p className="text-[10px] text-muted-foreground">S</p>
              <p className="text-lg sm:text-xl font-bold text-foreground">{pxs.S}</p>
            </div>
            <div className={cn("rounded-lg p-2 text-center", getPRLevelBgColor(pxs.prLevel))}>
              <p className="text-[10px] text-muted-foreground">P×S</p>
              <p className={cn("text-lg sm:text-xl font-bold", getPRLevelColor(pxs.prLevel))}>{pxs.risk}</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px] sm:text-xs">
              <thead><tr><th className="p-0.5 sm:p-1"></th>{[1,2,3,4,5].map(s => <th key={s} className="p-0.5 sm:p-1 text-center text-muted-foreground">S={s}</th>)}</tr></thead>
              <tbody>{[5,4,3,2,1].map((p, pi) => (
                <tr key={p}>
                  <td className="p-0.5 sm:p-1 text-center text-muted-foreground font-medium">P={p}</td>
                  {[0,1,2,3,4].map(si => {
                    const val = PXS_MATRIX[pi][si];
                    const pr = getMatrixCellPR(val);
                    const isActive = pxs.P === p && pxs.S === (si + 1);
                    return <td key={si} className={cn("p-0.5 sm:p-1 text-center rounded", isActive ? "ring-2 ring-foreground font-bold" : "", getPRLevelBgColor(pr))}><span className={getPRLevelColor(pr)}>{val}</span></td>;
                  })}
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>

        {/* Factor diagnostics */}
        <div className="rounded-xl border border-border bg-card p-3 sm:p-4 shadow-card">
          <h3 className="text-xs font-semibold text-card-foreground mb-3">Diagnóstico por Fator</h3>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {factorResults.map(f => (
              <div key={f.id} className="flex items-center justify-between rounded-lg bg-muted/30 px-2 sm:px-3 py-1.5">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] sm:text-xs font-medium text-foreground truncate">{f.name}</p>
                  <p className="text-[9px] sm:text-[10px] text-muted-foreground">{PROART_SCALES.find(s => s.id === f.scaleId)?.shortName}</p>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                  <span className="text-xs sm:text-sm font-bold text-foreground">{f.avg.toFixed(2)}</span>
                  <span className={cn("text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full whitespace-nowrap", getRiskBgColor(f.risk), getRiskColor(f.risk))}>
                    {getRiskLabel(f.risk)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Generate button */}
      {!readOnly && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
          <button onClick={() => handleGeneratePlansForForm(formConfigId, factorResults, pxs)} className="flex items-center gap-2 rounded-lg bg-primary px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            <Plus className="h-4 w-4" /> Gerar Plano de Ação
          </button>
          <span className="text-[10px] sm:text-xs text-muted-foreground">{formPlans.length} plano(s) criado(s)</span>
        </div>
      )}

      {readOnly && formPlans.length === 0 && (
        <p className="text-xs text-muted-foreground italic">Nenhum plano de ação cadastrado para este formulário.</p>
      )}

      {/* Plans */}
      {formPlans.length > 0 && (
        <div className="space-y-3">
          {formPlans.map(plan => renderPlanCard(plan))}
        </div>
      )}
    </div>
  );

  return (
    <DashboardLayout>
      <div className="animate-fade-in space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Plano de Ação</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              {readOnly ? "Visualização dos planos de ação da sua empresa" : "Gestão de planos baseados no diagnóstico PROART — por formulário"}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {!isCompanyUser && (
              <select value={effectiveCompany} onChange={e => { setSelectedCompany(e.target.value); setSelectedFormId(""); }} className="rounded-lg border border-border bg-background px-3 py-2 text-sm w-full sm:w-auto">
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
            <FormFilter
              forms={companyForms}
              selectedFormId={selectedFormId}
              onChange={setSelectedFormId}
            />
          </div>
        </div>

        {/* Render the active form section only */}
        {companyForms.length > 0 && activeForm ? (
          renderFormSection(activeForm.title, activeForm.configId, activeAnalysis.factorResults, activeAnalysis.pxs, activeFormPlans, activePool.length)
        ) : fallbackAnalysis ? (
          renderFormSection(company?.name || "Empresa", effectiveCompany, fallbackAnalysis.factorResults, fallbackAnalysis.pxs, fallbackPlans, allCompanyRespondents.length)
        ) : (
          <div className="rounded-xl border border-border bg-card p-5 shadow-card text-center">
            <p className="text-sm text-muted-foreground">Nenhum formulário encontrado para esta empresa.</p>
          </div>
        )}

        {/* Legacy plans not linked to specific forms */}
        {legacyPlans.length > 0 && companyForms.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Planos anteriores (sem formulário vinculado)</h3>
            {legacyPlans.map(plan => renderPlanCard(plan))}
          </div>
        )}

        {/* Companies Progress Overview */}
        {!isCompanyUser && companies.length > 1 && (
          <div className="rounded-xl border border-border bg-card p-3 sm:p-5 shadow-card">
            <h3 className="text-xs sm:text-sm font-semibold text-card-foreground mb-3 sm:mb-4">Progresso por Empresa</h3>
            <div className="space-y-3">
              {companies.map(c => {
                const cForms = getFormConfigsForCompany(c.id);
                const cFormIds = new Set(cForms.map(f => f.configId));
                const cPlans = plans.filter(p => cFormIds.has(p.company_config_id) || p.company_config_id === c.id);
                const cTasks = tasks.filter(t => cPlans.some(p => p.id === t.action_plan_id));
                const completedTasks = cTasks.filter(t => t.is_completed).length;
                const progress = cTasks.length > 0 ? Math.round((completedTasks / cTasks.length) * 100) : 0;
                const hasOverdue = cPlans.some(p => {
                  const created = new Date(p.created_at);
                  const deadline = new Date(created.getTime() + p.deadline_days * 24 * 60 * 60 * 1000);
                  return p.status !== "completed" && deadline < new Date();
                });
                return (
                  <div key={c.id} className="flex items-center gap-2 sm:gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs sm:text-sm font-medium text-foreground truncate">{c.name}</p>
                        {hasOverdue && <span className="text-[9px] sm:text-[10px] font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">ATRASADO</span>}
                        {!hasOverdue && progress === 100 && cPlans.length > 0 && <span className="text-[9px] sm:text-[10px] font-bold text-success bg-success/10 px-2 py-0.5 rounded-full">CONCLUÍDO</span>}
                      </div>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">{cPlans.length} plano(s) · {completedTasks}/{cTasks.length} tarefas</p>
                    </div>
                    <div className="w-20 sm:w-32">
                      <Progress value={progress} className="h-2" />
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-foreground w-10 sm:w-12 text-right">{progress}%</span>
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
