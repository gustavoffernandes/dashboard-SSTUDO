import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useSurveyData } from "@/hooks/useSurveyData";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Users, CheckCircle2, Clock, AlertCircle, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

interface SurveySession {
  id: string;
  config_id: string;
  session_token: string;
  status: string;
  respondent_name: string | null;
  sector: string | null;
  started_at: string;
  completed_at: string | null;
  last_activity_at: string;
}

type RespondentRow = {
  type: "completed" | "in_progress";
  name: string;
  companyName: string;
  companyId: string;
  configId: string;
  sector: string;
  formTitle: string;
  date: string;
};

export default function Respondents() {
  const { isLoading, companies, respondents, formConfigs } = useSurveyData();
  const [filterForm, setFilterForm] = useState("");
  const [filterCompany, setFilterCompany] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSector, setFilterSector] = useState("");

  const { data: sessions = [], isLoading: loadingSessions } = useQuery({
    queryKey: ["survey-sessions"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("survey_sessions") as any).select("*").neq("status", "completed");
      if (error) throw error;
      return (data || []) as SurveySession[];
    },
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  });

  const allRows = useMemo(() => {
    const rows: RespondentRow[] = [];

    // Completed respondents
    respondents.forEach(r => {
      const company = companies.find(c => c.id === r.companyId);
      const form = formConfigs?.find(f => f.configId === r.configId);
      rows.push({
        type: "completed",
        name: r.name || `RESP${r.id?.replace(/-/g, '').substring(0, 8).toUpperCase() || '0000'}`,
        companyName: company?.name || "—",
        companyId: r.companyId,
        configId: r.configId,
        sector: r.sector || "—",
        formTitle: form?.title || "—",
        date: r.responseTimestamp ? new Date(r.responseTimestamp).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—",
      });
    });

    // In-progress sessions (exclude those that have a matching completed response)
    const completedTokens = new Set(respondents.map(r => r.configId + "_" + (r.name || "")));
    sessions.forEach(s => {
      const form = formConfigs?.find(f => f.configId === s.config_id);
      const companyKey = companies.find(c => {
        const companyConfigs = formConfigs?.filter(f => f.companyKey === c.id) || [];
        return companyConfigs.some(f => f.configId === s.config_id);
      });
      rows.push({
        type: "in_progress",
        name: s.respondent_name || `RESP${s.id?.replace(/-/g, '').substring(0, 8).toUpperCase() || '0000'}`,
        companyName: companyKey?.name || "—",
        companyId: companyKey?.id || "",
        configId: s.config_id,
        sector: s.sector || "—",
        formTitle: form?.title || "—",
        date: new Date(s.started_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }),
      });
    });

    return rows;
  }, [respondents, sessions, companies, formConfigs]);

  const filtered = useMemo(() => {
    return allRows.filter(r => {
      if (filterForm && r.configId !== filterForm) return false;
      if (filterCompany && r.companyId !== filterCompany) return false;
      if (filterStatus === "completed" && r.type !== "completed") return false;
      if (filterStatus === "in_progress" && r.type !== "in_progress") return false;
      if (filterSector && r.sector !== filterSector) return false;
      return true;
    });
  }, [allRows, filterForm, filterCompany, filterStatus, filterSector]);

  const completed = filtered.filter(r => r.type === "completed").length;
  const inProgress = filtered.filter(r => r.type === "in_progress").length;
  const totalRecords = filtered.length;
  const completionRate = totalRecords > 0 ? Math.round((completed / totalRecords) * 100) : 0;

  const allSectors = useMemo(() => {
    const s = new Set<string>();
    allRows.forEach(r => { if (r.sector && r.sector !== "—") s.add(r.sector); });
    return Array.from(s).sort();
  }, [allRows]);

  if (isLoading || loadingSessions) return <DashboardLayout><div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></DashboardLayout>;

  const StatusBadge = ({ type }: { type: "completed" | "in_progress" }) => {
    if (type === "completed") return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success/10 text-success px-2 py-0.5 text-xs font-semibold">
        <CheckCircle2 className="h-3 w-3" /> Concluído
      </span>
    );
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 text-warning px-2 py-0.5 text-xs font-semibold">
        <Clock className="h-3 w-3" /> Em andamento
      </span>
    );
  };

  return (
    <DashboardLayout>
      <div className="animate-fade-in space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Respondentes</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">Visualize quem respondeu, quem está em andamento e quem ainda não iniciou</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <div className="rounded-xl border border-border bg-card p-4 text-center">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-bold text-foreground">{totalRecords}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 text-center">
            <p className="text-xs text-muted-foreground">Concluídos</p>
            <p className="text-2xl font-bold text-success">{completed}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 text-center">
            <p className="text-xs text-muted-foreground">Em Andamento</p>
            <p className="text-2xl font-bold text-warning">{inProgress}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 text-center col-span-2 sm:col-span-1">
            <p className="text-xs text-muted-foreground">Taxa de Conclusão</p>
            <p className="text-2xl font-bold text-primary">{completionRate}%</p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-foreground">Progresso geral</p>
            <p className="text-sm text-muted-foreground">{completed}/{totalRecords} concluídos</p>
          </div>
          <Progress value={completionRate} className="h-3" />
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-success" /> Concluído</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-warning" /> Em andamento</span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-card-foreground">Filtros</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <select value={filterForm} onChange={e => setFilterForm(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
              <option value="">Todos os formulários</option>
              {[...(formConfigs || [])].sort((a, b) => a.title.localeCompare(b.title, "pt-BR")).map(f => <option key={f.configId} value={f.configId}>{f.title}</option>)}
            </select>
            <select value={filterCompany} onChange={e => setFilterCompany(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
              <option value="">Todas as empresas</option>
              {[...companies].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
              <option value="">Todos os status</option>
              <option value="completed">Concluído</option>
              <option value="in_progress">Em andamento</option>
            </select>
            <select value={filterSector} onChange={e => setFilterSector(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
              <option value="">Todos os setores</option>
              {allSectors.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="text-sm font-semibold text-card-foreground">Detalhamento ({filtered.length} registros)</h3>
          </div>

          {filtered.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum respondente encontrado.</p>
            </div>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Colaborador</th>
                      <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Empresa</th>
                      <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Setor</th>
                      <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Pesquisa</th>
                      <th className="px-4 py-3 text-center font-semibold text-muted-foreground">Status</th>
                      <th className="px-4 py-3 text-center font-semibold text-muted-foreground">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice(0, 50).map((r, i) => (
                      <tr key={i} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 text-foreground">{r.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{r.companyName}</td>
                        <td className="px-4 py-3 text-muted-foreground">{r.sector}</td>
                        <td className="px-4 py-3 text-muted-foreground truncate max-w-[200px]">{r.formTitle}</td>
                        <td className="px-4 py-3 text-center"><StatusBadge type={r.type} /></td>
                        <td className="px-4 py-3 text-center text-xs text-muted-foreground">{r.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden divide-y divide-border">
                {filtered.slice(0, 50).map((r, i) => (
                  <div key={i} className="p-4 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-foreground">{r.name}</p>
                      <StatusBadge type={r.type} />
                    </div>
                    <p className="text-xs text-muted-foreground">{r.companyName} · {r.formTitle}</p>
                    <p className="text-xs text-muted-foreground">{r.date}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
