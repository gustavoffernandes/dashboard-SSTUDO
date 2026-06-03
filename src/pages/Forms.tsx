import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Plus, Trash2, Loader2, CheckCircle2, XCircle, Copy, Eye, Edit2, Download, X, Link2, Lock, Shield, FileCheck, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { useSurveyData } from "@/hooks/useSurveyData";
import { questions, sections } from "@/data/mockData";
import { exportCompanyPDF } from "@/lib/pdfExport";

interface FormConfig {
  id: string;
  company_name: string;
  cnpj: string | null;
  spreadsheet_id: string;
  sheet_name: string;
  form_url: string | null;
  form_title: string | null;
  is_active: boolean;
  created_at: string;
  sectors: any[];
  link_token?: string | null;
}

function generateSurveyLink(formId: string, companyName?: string, linkToken?: string | null) {
  const slug = companyName 
    ? companyName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    : "";
  const shortId = formId.substring(0, 8);
  const tokenPart = linkToken ? `-${linkToken}` : "";
  return `${window.location.origin}/pesquisa/${shortId}${slug ? `-${slug}` : ""}${tokenPart}/${formId}`;
}

export default function Forms() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const surveyData = useSurveyData();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    company_cnpj: "",
    form_title: "",
    description: "",
    instructions: "Esta pesquisa é anônima e confidencial. Suas respostas serão utilizadas para melhorar o ambiente de trabalho. Por favor, responda com sinceridade.",
    start_date: "",
    end_date: "",
    form_status: "ativa",
    is_anonymous: true,
    require_cpf: false,
    require_consent: true,
    require_password: false,
    survey_password: "",
  });

  const { data: allConfigs = [], isLoading } = useQuery({
    queryKey: ["google-forms-config-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("google_forms_config").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as FormConfig[];
    },
  });

  const configs = allConfigs.filter(c => c.spreadsheet_id !== "__placeholder__");
  const normalizeCity = (v: any) => (v || "").toString().trim().toLowerCase();
  const placeholderConfigs = allConfigs.filter((c: any) => c.spreadsheet_id === "__placeholder__");
  const registeredCompanies = placeholderConfigs.map((c: any) => {
    const city = (c.address_city || "").toString().trim();
    return {
      id: c.id,
      cnpj: c.cnpj || "",
      name: c.company_name || "Empresa sem nome",
      city,
      label: city ? `${c.company_name} — ${city}` : c.company_name,
    };
  }).sort((a, b) => a.label.localeCompare(b.label));

  const { data: responseCounts = {} } = useQuery({
    queryKey: ["form-response-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("survey_responses").select("config_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach((r: any) => { counts[r.config_id] = (counts[r.config_id] || 0) + 1; });
      return counts;
    },
  });

  const resetForm = () => {
    setFormData({
      company_cnpj: "", form_title: "", description: "",
      instructions: "Esta pesquisa é anônima e confidencial. Suas respostas serão utilizadas para melhorar o ambiente de trabalho. Por favor, responda com sinceridade.",
      start_date: "", end_date: "", form_status: "ativa", is_anonymous: true,
      require_cpf: false, require_consent: true, require_password: false, survey_password: "",
    });
    setEditingId(null);
    setShowForm(false);
  };

  const saveForm = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!data.company_cnpj) throw new Error("Selecione uma empresa");
      if (!data.form_title) throw new Error("Título é obrigatório");
      const branch = registeredCompanies.find(c => c.id === data.company_cnpj);
      if (!branch) throw new Error("Empresa/filial não encontrada");
      const placeholder = placeholderConfigs.find((c: any) => c.id === branch.id) as any;
      const companySectors = placeholder && Array.isArray(placeholder.sectors) ? placeholder.sectors : [];

      if (data.require_password && !data.survey_password.trim()) {
        throw new Error("Defina uma senha para acesso ao formulário.");
      }
      const payload: any = {
        company_name: branch.name,
        cnpj: branch.cnpj,
        address_city: branch.city || null,
        form_title: data.form_title,
        spreadsheet_id: "__internal__",
        sheet_name: "internal",
        is_active: data.form_status === "ativa",
        form_status: data.form_status,
        description: data.description || "",
        instructions: data.instructions || "",
        start_date: data.start_date || null,
        end_date: data.end_date || null,
        is_anonymous: data.is_anonymous,
        require_consent: data.require_consent,
        require_password: !!data.require_password,
        survey_password: data.require_password ? data.survey_password.trim() : "",
        sectors: companySectors,
      };

      if (editingId) {
        const { error } = await (supabase.from("google_forms_config") as any).update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("google_forms_config").insert([payload] as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["google-forms-config-all"] });
      queryClient.invalidateQueries({ queryKey: ["google-forms-config"] });
      resetForm();
      toast({ title: editingId ? "Formulário atualizado!" : "Formulário criado!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteForm = useMutation({
    mutationFn: async (id: string) => {
      await (supabase.from("user_roles") as any).delete().eq("company_id", id);
      await supabase.from("survey_responses").delete().eq("config_id", id);
      const { error } = await supabase.from("google_forms_config").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["google-forms-config-all"] });
      queryClient.invalidateQueries({ queryKey: ["google-forms-config"] });
      queryClient.invalidateQueries({ queryKey: ["survey-responses"] });
      toast({ title: "Formulário excluído!" });
    },
  });

  const refreshLink = useMutation({
    mutationFn: async (config: FormConfig) => {
      const newToken = Math.random().toString(36).substring(2, 10);
      const { error } = await (supabase.from("google_forms_config") as any)
        .update({ link_token: newToken })
        .eq("id", config.id);
      if (error) throw error;
      return newToken;
    },
    onSuccess: (newToken, config) => {
      queryClient.invalidateQueries({ queryKey: ["google-forms-config-all"] });
      queryClient.invalidateQueries({ queryKey: ["google-forms-config"] });
      const newLink = generateSurveyLink(config.id, config.company_name, newToken);
      navigator.clipboard.writeText(newLink);
      toast({ title: "Link atualizado e copiado!", description: "O link da pesquisa foi regenerado." });
    },
    onError: (e: Error) => toast({ title: "Erro ao atualizar link", description: e.message, variant: "destructive" }),
  });

  const copyLink = (id: string, companyName?: string, linkToken?: string | null) => {
    navigator.clipboard.writeText(generateSurveyLink(id, companyName, linkToken));
    toast({ title: "Link copiado!" });
  };

  const handleViewResponses = (configId: string) => {
    navigate(`/respondentes?form=${configId}`);
  };

  const handleDownloadPDF = (config: FormConfig) => {
    try {
      const cfgAny = config as any;
      const cityNorm = normalizeCity(cfgAny.address_city);
      const companyKey = config.cnpj ? `${config.cnpj}__${cityNorm}` : config.id;
      const company = surveyData.companies.find(c => c.id === companyKey);
      if (!company) { toast({ title: "Nenhum dado disponível para gerar PDF", variant: "destructive" }); return; }
      
      const companyRespondents = surveyData.getCompanyRespondents(companyKey);
      if (companyRespondents.length === 0) { toast({ title: "Nenhuma resposta encontrada para este formulário", variant: "destructive" }); return; }

      exportCompanyPDF(companyKey, {
        companies: [company],
        sections,
        questions,
        respondents: companyRespondents,
        getCompanyRespondents: () => companyRespondents,
        getSectionAverage: surveyData.getSectionAverage,
        getQuestionAverage: surveyData.getQuestionAverage,
        getAnswerDistribution: surveyData.getAnswerDistribution,
        getAvailableSections: surveyData.getAvailableSections,
        getAvailableQuestions: surveyData.getAvailableQuestions,
        formConfigs: [{ configId: config.id, title: (config as any).form_title || config.company_name }],
      });
      toast({ title: "PDF gerado com sucesso!" });
    } catch (e: any) {
      toast({ title: "Erro ao gerar PDF", description: e.message, variant: "destructive" });
    }
  };

  const startEdit = (config: FormConfig) => {
    const cfg = config as any;
    const cnpj = config.cnpj || "";
    const city = (cfg.address_city || "").toString().trim();
    const cityNorm = normalizeCity(city);
    let branch = registeredCompanies.find(c => c.cnpj === cnpj && normalizeCity(c.city) === cityNorm);
    if (!branch) branch = registeredCompanies.find(c => c.cnpj === cnpj);
    setFormData({
      company_cnpj: branch?.id || "",
      form_title: cfg.form_title || config.company_name,
      description: cfg.description || "",
      instructions: cfg.instructions || "Esta pesquisa é anônima e confidencial. Suas respostas serão utilizadas para melhorar o ambiente de trabalho. Por favor, responda com sinceridade.",
      start_date: cfg.start_date || "",
      end_date: cfg.end_date || "",
      form_status: cfg.form_status || (config.is_active ? "ativa" : "encerrada"),
      is_anonymous: cfg.is_anonymous ?? true,
      require_cpf: false,
      require_consent: cfg.require_consent ?? true,
      require_password: cfg.require_password ?? false,
      survey_password: cfg.survey_password || "",
    });
    setEditingId(config.id);
    setShowForm(true);
  };

  const getStatus = (config: FormConfig) => {
    const status = (config as any).form_status || (config.is_active ? "ativa" : "encerrada");
    const statusMap: Record<string, { label: string; color: string; bg: string }> = {
      ativa: { label: "Ativa", color: "text-success", bg: "bg-success/10" },
      rascunho: { label: "Rascunho", color: "text-muted-foreground", bg: "bg-muted" },
      pausada: { label: "Pausada", color: "text-warning", bg: "bg-warning/10" },
      encerrada: { label: "Encerrada", color: "text-destructive", bg: "bg-destructive/10" },
    };
    return statusMap[status] || statusMap.ativa;
  };

  return (
    <DashboardLayout>
      <div className="animate-fade-in space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Formulários</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">Crie e gerencie suas pesquisas de avaliação</p>
          </div>
          <button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shrink-0">
            <Plus className="h-4 w-4" /> Novo Formulário
          </button>
        </div>

        {showForm && (
          <div className="rounded-xl border border-border bg-card p-4 sm:p-6 shadow-card space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-card-foreground">{editingId ? "Editar Formulário" : "Novo Formulário"}</h3>
              <button onClick={resetForm} className="p-1 rounded text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Informações do Formulário</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Empresa *</label>
                  <select value={formData.company_cnpj} onChange={e => setFormData({ ...formData, company_cnpj: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition">
                    <option value="">Selecione uma empresa...</option>
                    {registeredCompanies.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Título do Formulário *</label>
                  <input value={formData.form_title} onChange={e => setFormData({ ...formData, form_title: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
                    placeholder="Ex: Pesquisa PROART 2026 - Sede" />
                </div>
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-medium text-foreground">Descrição</label>
                  <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition min-h-[60px]"
                    placeholder="Breve descrição sobre a pesquisa (opcional)" />
                </div>
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-medium text-foreground">Instruções para os Respondentes</label>
                  <textarea value={formData.instructions} onChange={e => setFormData({ ...formData, instructions: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition min-h-[60px]" />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Período</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Data de Início</label>
                  <input type="date" value={formData.start_date} onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition" />
                  <p className="text-[10px] text-muted-foreground">Deixe em branco para início imediato</p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Data de Término</label>
                  <input type="date" value={formData.end_date} onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition" />
                  <p className="text-[10px] text-muted-foreground">Deixe em branco para não ter prazo</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Configurações</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-foreground">Status do Formulário</label>
                  <select value={formData.form_status} onChange={e => setFormData({ ...formData, form_status: e.target.value })}
                    className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm">
                    <option value="ativa">Ativa</option>
                    <option value="rascunho">Rascunho</option>
                    <option value="pausada">Pausada</option>
                    <option value="encerrada">Encerrada</option>
                  </select>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg border border-border">
                  <Checkbox checked={formData.is_anonymous} onCheckedChange={(v) => setFormData({ ...formData, is_anonymous: !!v })} />
                  <div><p className="text-sm font-medium text-foreground">Pesquisa Anônima</p><p className="text-xs text-muted-foreground">Respostas não serão identificadas</p></div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg border border-border">
                  <Checkbox checked={formData.require_consent} onCheckedChange={(v) => setFormData({ ...formData, require_consent: !!v })} />
                  <div><p className="text-sm font-medium text-foreground flex items-center gap-1"><Shield className="h-3 w-3" /> Termo de Consentimento (LGPD)</p><p className="text-xs text-muted-foreground">Exige aceite antes de responder a pesquisa</p></div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-start gap-3 p-3 rounded-lg border border-border">
                    <Checkbox checked={formData.require_password} onCheckedChange={(v) => setFormData({ ...formData, require_password: !!v })} />
                    <div><p className="text-sm font-medium text-foreground flex items-center gap-1"><Lock className="h-3 w-3" /> Proteger com Senha</p></div>
                  </div>
                  {formData.require_password && (
                    <div className="ml-10 space-y-1">
                      <label className="text-xs font-medium text-foreground">Senha da Pesquisa</label>
                      <input type="text" value={formData.survey_password} onChange={e => setFormData({ ...formData, survey_password: e.target.value })}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
                        placeholder="Digite a senha" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {editingId && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Link da Pesquisa</h4>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
                  <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-xs text-foreground truncate flex-1">{generateSurveyLink(editingId, registeredCompanies.find(c => c.id === formData.company_cnpj)?.name, configs.find(c => c.id === editingId)?.link_token)}</span>
                  <button onClick={() => copyLink(editingId, registeredCompanies.find(c => c.id === formData.company_cnpj)?.name, configs.find(c => c.id === editingId)?.link_token)} className="flex items-center gap-1 px-3 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors shrink-0">
                    <Copy className="h-3 w-3" /> Copiar Link
                  </button>
                  <button onClick={() => { const cfg = configs.find(c => c.id === editingId); if (cfg) refreshLink.mutate(cfg); }} disabled={refreshLink.isPending} className="flex items-center gap-1 px-3 py-1 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors shrink-0" title="Atualizar link">
                    <RefreshCw className={cn("h-3 w-3", refreshLink.isPending && "animate-spin")} /> Refresh
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button onClick={() => saveForm.mutate(formData)} disabled={saveForm.isPending || !formData.company_cnpj || !formData.form_title}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors">
                {saveForm.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck className="h-4 w-4" />} Salvar Alterações
              </button>
              <button onClick={resetForm} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors">Cancelar</button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : configs.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum formulário criado.</p>
            <p className="text-xs text-muted-foreground mt-1">Clique em "Novo Formulário" para começar.</p>
          </div>
        ) : (
          <>
            <div className="hidden md:block rounded-xl border border-border bg-card shadow-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Nome do Formulário</th>
                    <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Empresa</th>
                    <th className="px-4 py-3 text-center font-semibold text-muted-foreground">Período</th>
                    <th className="px-4 py-3 text-center font-semibold text-muted-foreground">Respostas</th>
                    <th className="px-4 py-3 text-center font-semibold text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-center font-semibold text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {configs.map(config => {
                    const status = getStatus(config);
                    const count = responseCounts[config.id] || 0;
                    return (
                      <tr key={config.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground">{(config as any).form_title || config.company_name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{config.company_name}{(config as any).address_city ? ` — ${(config as any).address_city}` : ""}</td>
                        <td className="px-4 py-3 text-center text-xs text-muted-foreground">{new Date(config.created_at).toLocaleDateString("pt-BR")}</td>
                        <td className="px-4 py-3 text-center font-medium text-foreground">{count}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", status.bg, status.color)}>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => copyLink(config.id, config.company_name, config.link_token)} className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Copiar link"><Copy className="h-3.5 w-3.5" /></button>
                            <button onClick={() => refreshLink.mutate(config)} disabled={refreshLink.isPending} className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Atualizar link"><RefreshCw className={cn("h-3.5 w-3.5", refreshLink.isPending && "animate-spin")} /></button>
                            <button onClick={() => handleViewResponses(config.id)} className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Ver respostas"><Eye className="h-3.5 w-3.5" /></button>
                            <button onClick={() => startEdit(config)} className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Editar"><Edit2 className="h-3.5 w-3.5" /></button>
                            <button onClick={() => handleDownloadPDF(config)} className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Gerar PDF"><Download className="h-3.5 w-3.5" /></button>
                            <button onClick={() => { if (confirm("Excluir formulário?")) deleteForm.mutate(config.id); }}
                              className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" title="Excluir"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="md:hidden space-y-3">
              {configs.map(config => {
                const status = getStatus(config);
                const count = responseCounts[config.id] || 0;
                return (
                  <div key={config.id} className="rounded-xl border border-border bg-card p-4 shadow-card space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-card-foreground truncate">{(config as any).form_title || config.company_name}</h3>
                        <p className="text-xs text-muted-foreground">{config.company_name}{(config as any).address_city ? ` — ${(config as any).address_city}` : ""}</p>
                      </div>
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold shrink-0", status.bg, status.color)}>
                        {status.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{new Date(config.created_at).toLocaleDateString("pt-BR")}</span>
                      <span className="font-medium text-foreground">{count} respostas</span>
                    </div>
                    <div className="flex items-center gap-1 pt-1 border-t border-border">
                      <button onClick={() => copyLink(config.id, config.company_name, config.link_token)} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><Copy className="h-3 w-3" /> Copiar</button>
                      <button onClick={() => refreshLink.mutate(config)} disabled={refreshLink.isPending} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><RefreshCw className={cn("h-3 w-3", refreshLink.isPending && "animate-spin")} /> Refresh</button>
                      <button onClick={() => handleViewResponses(config.id)} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><Eye className="h-3 w-3" /> Ver</button>
                      <button onClick={() => handleDownloadPDF(config)} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><Download className="h-3 w-3" /> PDF</button>
                      <button onClick={() => startEdit(config)} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><Edit2 className="h-3 w-3" /> Editar</button>
                      <button onClick={() => { if (confirm("Excluir?")) deleteForm.mutate(config.id); }}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-xs text-destructive hover:bg-destructive/10 transition-colors"><Trash2 className="h-3 w-3" /> Excluir</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
