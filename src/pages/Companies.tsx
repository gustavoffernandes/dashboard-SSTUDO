import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, Trash2, Loader2, Edit2, Check, X, MapPin, Phone } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { METHODOLOGIES, methodologyLabel, normalizeMethodology } from "@/lib/methodology";

interface CompanyEntry {
  id: string;
  key: string;
  cnpj: string;
  company_name: string;
  address_city: string;
  sector: string;
  employee_count: number | null;
  methodology: string;
  form_count: number;
  sectors: CompanySector[];
  has_branches: boolean;
}

interface CompanySector {
  name: string;
  code: string;
  description: string;
  roles?: string[];
}

function formatCNPJ(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function cleanCNPJ(cnpj: string): string {
  return cnpj.replace(/\D/g, "");
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export default function Companies() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    company_name: "", cnpj: "", sector: "", employee_count: "", methodology: "proart",
    contact_name: "", contact_email: "", contact_phone: "",
    address_street: "", address_city: "", address_state: "", address_zip: "",
  });
  const [formSectors, setFormSectors] = useState<CompanySector[]>([]);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editData, setEditData] = useState({
    name: "", cnpj: "", sector: "", employee_count: "", methodology: "proart",
    contact_name: "", contact_email: "", contact_phone: "",
    address_street: "", address_city: "", address_state: "", address_zip: "",
  });

  const [editSectors, setEditSectors] = useState<CompanySector[]>([]);
  const [newSector, setNewSector] = useState<CompanySector>({ name: "", code: "", description: "", roles: [] });
  const [editingSectorIdx, setEditingSectorIdx] = useState<number | null>(null);
  const [editSectorData, setEditSectorData] = useState<CompanySector>({ name: "", code: "", description: "", roles: [] });
  const [newRoleInputs, setNewRoleInputs] = useState<Record<number, string>>({});

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ["google-forms-config"],
    queryFn: async () => {
      const { data, error } = await supabase.from("google_forms_config").select("*").order("company_name");
      if (error) throw error;
      return data || [];
    },
  });

  const normalizeCity = (v: any) => (v || "").toString().trim().toLowerCase();
  const branchKey = (cnpj: string, city: any) => `${cnpj}__${normalizeCity(city)}`;

  const companies: CompanyEntry[] = [];
  const branchMap = new Map<string, { id: string; cnpj: string; city: string; name: string; sector: string; employee_count: number | null; methodology: string; count: number; sectors: CompanySector[]; priority: 0 | 1 }>();
  const cnpjCounts = new Map<string, number>();

  configs.forEach((c: any) => {
    const cnpj = c.cnpj || "";
    if (!cnpj) return;
    const city = (c.address_city || "").toString().trim();
    const key = branchKey(cnpj, city);
    const isPlaceholder = c.spreadsheet_id === "__placeholder__";
    const priority: 0 | 1 = isPlaceholder ? 0 : 1;
    const parsedSectors: CompanySector[] = Array.isArray(c.sectors) ? c.sectors : [];
    if (branchMap.has(key)) {
      const current = branchMap.get(key)!;
      if (!isPlaceholder) current.count++;
      if (priority > current.priority || (isPlaceholder && current.priority === 0)) {
        current.name = c.company_name || current.name;
        current.sector = c.sector || current.sector;
        current.employee_count = c.employee_count || current.employee_count;
        current.methodology = c.methodology || current.methodology;
        current.priority = priority;
        if (parsedSectors.length > 0 || isPlaceholder) current.sectors = parsedSectors;
      }
    } else {
      branchMap.set(key, { id: c.id, cnpj, city, name: c.company_name, sector: c.sector || "", employee_count: c.employee_count || null, methodology: c.methodology || "proart", count: isPlaceholder ? 0 : 1, priority, sectors: parsedSectors });
    }
  });
  branchMap.forEach(val => {
    cnpjCounts.set(val.cnpj, (cnpjCounts.get(val.cnpj) || 0) + 1);
  });
  branchMap.forEach((val, key) => {
    companies.push({
      id: val.id, key, cnpj: val.cnpj, company_name: val.name, address_city: val.city,
      sector: val.sector, employee_count: val.employee_count, methodology: val.methodology,
      form_count: val.count, sectors: val.sectors, has_branches: (cnpjCounts.get(val.cnpj) || 0) > 1,
    });
  });


  const addCompany = useMutation({
    mutationFn: async (data: { formData: typeof formData; sectors: CompanySector[] }) => {
      const cnpjDigits = cleanCNPJ(data.formData.cnpj);
      if (cnpjDigits.length !== 14) throw new Error("CNPJ deve ter 14 dígitos");
      const cityNorm = normalizeCity(data.formData.address_city);
      const existing = configs.find((c: any) => c.cnpj === cnpjDigits && normalizeCity(c.address_city) === cityNorm);
      if (existing) {
        throw new Error(cityNorm
          ? `Já existe uma filial cadastrada com este CNPJ na cidade "${data.formData.address_city}"`
          : "Já existe uma empresa cadastrada com este CNPJ. Para cadastrar uma filial, informe a cidade.");
      }
      const { error } = await supabase.from("google_forms_config").insert([{
        company_name: data.formData.company_name, cnpj: cnpjDigits,
        spreadsheet_id: "__placeholder__", sheet_name: "Form Responses 1", is_active: false,
        sector: data.formData.sector || null,
        methodology: data.formData.methodology || "proart",
        employee_count: data.formData.employee_count ? parseInt(data.formData.employee_count) : null,
        sectors: data.sectors as any,
        contact_name: data.formData.contact_name || null,
        contact_email: data.formData.contact_email || null,
        contact_phone: data.formData.contact_phone || null,
        address_street: data.formData.address_street || null,
        address_city: data.formData.address_city || null,
        address_state: data.formData.address_state || null,
        address_zip: data.formData.address_zip || null,
      }] as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["google-forms-config"] });
      queryClient.invalidateQueries({ queryKey: ["google-forms-config-all"] });
      setShowForm(false);
      setFormData({ company_name: "", cnpj: "", sector: "", employee_count: "", methodology: "proart", contact_name: "", contact_email: "", contact_phone: "", address_street: "", address_city: "", address_state: "", address_zip: "" });
      setFormSectors([]);
      toast({ title: "Empresa cadastrada com sucesso!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const updateCompany = useMutation({
    mutationFn: async ({ cnpj, city, data, sectors }: { cnpj: string; city: string; data: typeof editData; sectors: CompanySector[] }) => {
      const normalizedName = data.name.trim();
      if (!normalizedName) throw new Error("Razão Social é obrigatória");
      const newCnpjDigits = cleanCNPJ(data.cnpj);
      if (newCnpjDigits.length !== 14) throw new Error("CNPJ deve ter 14 dígitos");
      const newCityNorm = normalizeCity(data.address_city);
      if (newCnpjDigits !== cnpj || newCityNorm !== normalizeCity(city)) {
        const exists = configs.find((c: any) => c.cnpj === newCnpjDigits && normalizeCity(c.address_city) === newCityNorm);
        if (exists) throw new Error("Já existe uma empresa/filial cadastrada com este CNPJ e cidade");
      }
      const parsedEmployeeCount = data.employee_count ? Number(data.employee_count) : null;
      const branchConfigIds = configs.filter((c: any) => c.cnpj === cnpj && normalizeCity(c.address_city) === normalizeCity(city)).map((c: any) => c.id);

      // Trocar a metodologia é bloqueado quando já existem respostas coletadas
      const currentMethodology = (configs.find((c: any) => c.cnpj === cnpj && normalizeCity(c.address_city) === normalizeCity(city) && c.spreadsheet_id === "__placeholder__") as any)?.methodology || "proart";
      const newMethodology = data.methodology || "proart";
      if (newMethodology !== currentMethodology && branchConfigIds.length > 0) {
        const { count } = await supabase
          .from("survey_responses")
          .select("id", { count: "exact", head: true })
          .in("config_id", branchConfigIds);
        if ((count || 0) > 0) {
          throw new Error("Não é possível trocar a metodologia: esta empresa já possui respostas coletadas. As respostas antigas não são comparáveis entre metodologias.");
        }
      }

      const updatePayload: any = {
        company_name: normalizedName,
        cnpj: newCnpjDigits,
        sector: data.sector?.trim() || null,
        methodology: newMethodology,
        employee_count: parsedEmployeeCount,
        sectors: sectors as any,
        contact_name: data.contact_name || null,
        contact_email: data.contact_email || null,
        contact_phone: data.contact_phone || null,
        address_street: data.address_street || null,
        address_city: data.address_city || null,
        address_state: data.address_state || null,
        address_zip: data.address_zip || null,
      };
      for (const cid of branchConfigIds) {

        const { error } = await (supabase.from("google_forms_config") as any).update(updatePayload).eq("id", cid);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["google-forms-config"] });
      queryClient.invalidateQueries({ queryKey: ["google-forms-config-all"] });
      setEditingKey(null);
      toast({ title: "Empresa atualizada!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteCompany = useMutation({
    mutationFn: async ({ cnpj, city }: { cnpj: string; city: string }) => {
      const cityNorm = normalizeCity(city);
      const configIds = configs.filter((c: any) => c.cnpj === cnpj && normalizeCity(c.address_city) === cityNorm).map((c: any) => c.id);
      for (const configId of configIds) {
        await (supabase.from("user_roles") as any).delete().eq("company_id", configId);
        await supabase.from("survey_responses").delete().eq("config_id", configId);
        const { error } = await (supabase.from("google_forms_config") as any).delete().eq("id", configId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["google-forms-config"] });
      queryClient.invalidateQueries({ queryKey: ["google-forms-config-all"] });
      queryClient.invalidateQueries({ queryKey: ["survey-responses"] });
      toast({ title: "Empresa removida!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const addSectorToList = (list: CompanySector[], setList: (s: CompanySector[]) => void) => {
    if (!newSector.name) return;
    setList([...list, { ...newSector, roles: newSector.roles || [] }]);
    setNewSector({ name: "", code: "", description: "", roles: [] });
  };

  const removeSectorFromList = (list: CompanySector[], setList: (s: CompanySector[]) => void, index: number) => {
    const s = list[index];
    if (!confirm(`Remover o setor "${s?.name}" e todas as suas funções?`)) return;
    setList(list.filter((_, i) => i !== index));
  };

  const startEditSector = (idx: number, sectors: CompanySector[]) => {
    setEditingSectorIdx(idx);
    setEditSectorData({ ...sectors[idx] });
  };

  const saveEditSector = (sectors: CompanySector[], setList: (s: CompanySector[]) => void) => {
    if (editingSectorIdx === null || !editSectorData.name) return;
    setList(sectors.map((s, i) => i === editingSectorIdx ? { ...editSectorData } : s));
    setEditingSectorIdx(null);
    toast({ title: "Setor atualizado!" });
  };

  const startEditCompany = (company: CompanyEntry) => {
    const cfg = configs.find((c: any) => c.cnpj === company.cnpj && normalizeCity(c.address_city) === normalizeCity(company.address_city) && c.spreadsheet_id === "__placeholder__") as any;
    setEditingKey(company.key);
    setEditData({
      name: company.company_name,
      cnpj: formatCNPJ(company.cnpj),
      sector: company.sector || "",
      methodology: company.methodology || "proart",
      employee_count: company.employee_count ? String(company.employee_count) : "",
      contact_name: cfg?.contact_name || "",
      contact_email: cfg?.contact_email || "",
      contact_phone: cfg?.contact_phone || "",
      address_street: cfg?.address_street || "",
      address_city: cfg?.address_city || "",
      address_state: cfg?.address_state || "",
      address_zip: cfg?.address_zip || "",
    });
    setEditSectors([...company.sectors]);
    setEditingSectorIdx(null);
  };

  const addRoleToSector = (list: CompanySector[], setList: (s: CompanySector[]) => void, idx: number) => {
    const roleName = (newRoleInputs[idx] || "").trim();
    if (!roleName) return;
    const updated = list.map((s, i) => {
      if (i !== idx) return s;
      const roles = s.roles || [];
      if (roles.includes(roleName)) return s;
      return { ...s, roles: [...roles, roleName] };
    });
    setList(updated);
    setNewRoleInputs(prev => ({ ...prev, [idx]: "" }));
  };

  const removeRoleFromSector = (list: CompanySector[], setList: (s: CompanySector[]) => void, sectorIdx: number, roleIdx: number) => {
    const roleName = list[sectorIdx]?.roles?.[roleIdx];
    if (!confirm(`Remover a função "${roleName}"?`)) return;
    setList(list.map((s, i) => i === sectorIdx ? { ...s, roles: (s.roles || []).filter((_, ri) => ri !== roleIdx) } : s));
  };

  const renderSectorEditor = (sectors: CompanySector[], setList: (s: CompanySector[]) => void) => (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Setores e Funções da Empresa</h4>
      <p className="text-xs text-muted-foreground">Cadastre os setores. Em cada setor, você pode opcionalmente adicionar funções (cargos) que aparecerão como opções no formulário.</p>
      {sectors.length > 0 && (
        <div className="space-y-3">
          {sectors.map((s, i) => (
            <div key={i} className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                {editingSectorIdx === i ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input value={editSectorData.name} onChange={e => setEditSectorData({ ...editSectorData, name: e.target.value })}
                      className="rounded border border-border bg-background px-2 py-1 text-xs flex-1" placeholder="Nome" />
                    <input value={editSectorData.code} onChange={e => setEditSectorData({ ...editSectorData, code: e.target.value.toUpperCase() })}
                      className="rounded border border-border bg-background px-2 py-1 text-xs w-16" placeholder="Código" />
                    <button onClick={() => saveEditSector(sectors, setList)} className="p-1 rounded text-success hover:bg-success/10"><Check className="h-3.5 w-3.5" /></button>
                    <button onClick={() => setEditingSectorIdx(null)} className="p-1 rounded text-muted-foreground hover:bg-muted"><X className="h-3.5 w-3.5" /></button>
                  </div>
                ) : (
                  <>
                    <span className="text-sm font-semibold text-foreground">{s.code ? `${s.code} - ` : ""}{s.name}</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => startEditSector(i, sectors)} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"><Edit2 className="h-3.5 w-3.5" /></button>
                      <button onClick={() => removeSectorFromList(sectors, setList, i)} className="p-1 rounded text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </>
                )}
              </div>
              {/* Roles */}
              <div className="pl-2 border-l-2 border-primary/20 space-y-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Funções</p>
                {(s.roles && s.roles.length > 0) ? (
                  <div className="flex flex-wrap gap-1.5">
                    {s.roles.map((role, ri) => (
                      <span key={ri} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                        {role}
                        <button onClick={() => removeRoleFromSector(sectors, setList, i, ri)} className="hover:text-destructive transition-colors"><X className="h-3 w-3" /></button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground italic">Nenhuma função cadastrada (opcional).</p>
                )}
                <div className="flex gap-2">
                  <input
                    value={newRoleInputs[i] || ""}
                    onChange={e => setNewRoleInputs(prev => ({ ...prev, [i]: e.target.value }))}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addRoleToSector(sectors, setList, i); } }}
                    placeholder="Ex: Operador, Analista, Coordenador"
                    className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
                  <button onClick={() => addRoleToSector(sectors, setList, i)} disabled={!(newRoleInputs[i] || "").trim()}
                    className="rounded bg-primary/90 px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary disabled:opacity-50 transition-colors">
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Nome *</label>
          <input value={newSector.name} onChange={e => setNewSector({ ...newSector, name: e.target.value })}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition" placeholder="Ex: Produção, RH" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Código</label>
          <input value={newSector.code} onChange={e => setNewSector({ ...newSector, code: e.target.value.toUpperCase() })}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition" placeholder="Ex: PROD, RH" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Descrição</label>
          <div className="flex gap-2">
            <input value={newSector.description} onChange={e => setNewSector({ ...newSector, description: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition" placeholder="Opcional" />
            <button onClick={() => addSectorToList(sectors, setList)} disabled={!newSector.name}
              className="shrink-0 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors">
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="animate-fade-in space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Empresas</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">Cadastre e gerencie as empresas mentoradas</p>
          </div>
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shrink-0">
            <Plus className="h-4 w-4" /> Nova Empresa
          </button>
        </div>

        {showForm && (
          <div className="rounded-xl border border-border bg-card p-5 shadow-card space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-card-foreground">Cadastrar Empresa</h3>
              <button onClick={() => setShowForm(false)} className="p-1 rounded text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dados Básicos</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Razão Social *</label>
                  <input value={formData.company_name} onChange={e => setFormData({ ...formData, company_name: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition" placeholder="Ex: TechSol Soluções Ltda" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">CNPJ *</label>
                  <input value={formData.cnpj} onChange={e => setFormData({ ...formData, cnpj: formatCNPJ(e.target.value) })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition" placeholder="00.000.000/0000-00" maxLength={18} />
                  <p className="text-[10px] text-muted-foreground">Para cadastrar uma filial com o mesmo CNPJ, informe uma cidade diferente no endereço.</p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Setor de Atuação</label>
                  <input value={formData.sector} onChange={e => setFormData({ ...formData, sector: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition" placeholder="Ex: Tecnologia, Indústria" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Nº de Funcionários</label>
                  <input type="number" value={formData.employee_count} onChange={e => setFormData({ ...formData, employee_count: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition" placeholder="Ex: 50" min="1" />
                </div>
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-medium text-foreground">Metodologia do Diagnóstico *</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {METHODOLOGIES.map(m => (
                      <button key={m.id} type="button" onClick={() => setFormData({ ...formData, methodology: m.id })}
                        className={`text-left rounded-lg border-2 p-3 transition-colors ${formData.methodology === m.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"}`}>
                        <span className="block text-sm font-semibold text-foreground">{m.label}</span>
                        <span className="block text-[11px] text-muted-foreground mt-0.5">{m.description}</span>
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground">Os formulários desta empresa usarão automaticamente esta metodologia.</p>
                </div>
              </div>

            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Phone className="h-3 w-3" /> Contato</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Nome do Responsável</label>
                  <input value={formData.contact_name} onChange={e => setFormData({ ...formData, contact_name: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition" placeholder="Ex: João Silva" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">E-mail</label>
                  <input type="email" value={formData.contact_email} onChange={e => setFormData({ ...formData, contact_email: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition" placeholder="contato@empresa.com" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Telefone</label>
                  <input value={formData.contact_phone} onChange={e => setFormData({ ...formData, contact_phone: formatPhone(e.target.value) })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition" placeholder="(00) 00000-0000" maxLength={15} />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1"><MapPin className="h-3 w-3" /> Endereço</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-medium text-foreground">Logradouro</label>
                  <input value={formData.address_street} onChange={e => setFormData({ ...formData, address_street: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition" placeholder="Rua, número, complemento" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Cidade</label>
                  <input value={formData.address_city} onChange={e => setFormData({ ...formData, address_city: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition" placeholder="Ex: São Paulo" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">UF</label>
                    <input value={formData.address_state} onChange={e => setFormData({ ...formData, address_state: e.target.value.toUpperCase().slice(0, 2) })}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition" placeholder="SP" maxLength={2} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">CEP</label>
                    <input value={formData.address_zip} onChange={e => setFormData({ ...formData, address_zip: e.target.value })}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition" placeholder="00000-000" maxLength={9} />
                  </div>
                </div>
              </div>
            </div>

            {renderSectorEditor(formSectors, setFormSectors)}

            <div className="flex gap-2">
              <button onClick={() => addCompany.mutate({ formData, sectors: formSectors })}
                disabled={addCompany.isPending || !formData.company_name || cleanCNPJ(formData.cnpj).length !== 14}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors">
                {addCompany.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Salvar
              </button>
              <button onClick={() => setShowForm(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors">Cancelar</button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : companies.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <Building2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma empresa cadastrada.</p>
            <p className="text-xs text-muted-foreground mt-1">Clique em "Nova Empresa" para começar.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {companies.map(company => (
              <div key={company.key} className="rounded-xl border border-border bg-card p-5 shadow-card">
                <div className="flex flex-col gap-3">
                  {editingKey === company.key ? (
                    <div className="space-y-4">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dados Básicos</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-muted-foreground">Razão Social *</label>
                          <input value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })}
                            className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition" autoFocus />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-muted-foreground">CNPJ *</label>
                          <input value={editData.cnpj} onChange={e => setEditData({ ...editData, cnpj: formatCNPJ(e.target.value) })}
                            className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition" maxLength={18} placeholder="00.000.000/0000-00" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-muted-foreground">Setor de Atuação</label>
                          <input value={editData.sector} onChange={e => setEditData({ ...editData, sector: e.target.value })}
                            className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-muted-foreground">Nº de Funcionários</label>
                          <input type="number" value={editData.employee_count} onChange={e => setEditData({ ...editData, employee_count: e.target.value })}
                            className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition" min="1" />
                        </div>
                      </div>

                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contato</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-muted-foreground">Responsável</label>
                          <input value={editData.contact_name} onChange={e => setEditData({ ...editData, contact_name: e.target.value })}
                            className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-muted-foreground">E-mail</label>
                          <input value={editData.contact_email} onChange={e => setEditData({ ...editData, contact_email: e.target.value })}
                            className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-muted-foreground">Telefone</label>
                          <input value={editData.contact_phone} onChange={e => setEditData({ ...editData, contact_phone: formatPhone(e.target.value) })}
                            className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition" />
                        </div>
                      </div>

                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Endereço</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="sm:col-span-2 space-y-1">
                          <label className="text-xs font-medium text-muted-foreground">Logradouro</label>
                          <input value={editData.address_street} onChange={e => setEditData({ ...editData, address_street: e.target.value })}
                            className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-muted-foreground">Cidade</label>
                          <input value={editData.address_city} onChange={e => setEditData({ ...editData, address_city: e.target.value })}
                            className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">UF</label>
                            <input value={editData.address_state} onChange={e => setEditData({ ...editData, address_state: e.target.value.toUpperCase().slice(0, 2) })}
                              className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">CEP</label>
                            <input value={editData.address_zip} onChange={e => setEditData({ ...editData, address_zip: e.target.value })}
                              className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition" />
                          </div>
                        </div>
                      </div>

                      {renderSectorEditor(editSectors, setEditSectors)}

                      <div className="flex items-center gap-2 pt-2">
                        <button onClick={() => updateCompany.mutate({ cnpj: company.cnpj, city: company.address_city, data: editData, sectors: editSectors })}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
                          <Check className="h-3 w-3" /> Salvar
                        </button>
                        <button onClick={() => setEditingKey(null)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted transition-colors">
                          <X className="h-3 w-3" /> Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="text-sm font-semibold text-card-foreground">
                            {company.company_name}{company.address_city ? ` — ${company.address_city}` : ""}
                          </h3>
                          {company.has_branches && (
                            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary uppercase tracking-wider">Filial</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">CNPJ: {formatCNPJ(company.cnpj)}</p>
                        {company.sector && <p className="text-xs text-muted-foreground">Setor: {company.sector}</p>}
                        {company.employee_count && <p className="text-xs text-muted-foreground">Funcionários: {company.employee_count}</p>}
                        <p className="text-xs text-muted-foreground">{company.form_count} formulário(s) vinculado(s)</p>
                        <p className="text-xs text-muted-foreground">
                          {company.sectors.length} setor(es) · {company.sectors.reduce((acc, s) => acc + (s.roles?.length || 0), 0)} função(ões) cadastrada(s)
                        </p>

                        {company.sectors.length > 0 && (
                          <div className="mt-2">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Setores:</p>
                            <div className="flex flex-wrap gap-1.5">
                              {company.sectors.map((s, i) => (
                                <span key={i} className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
                                  {s.code ? `${s.code} - ` : ""}{s.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => startEditCompany(company)}
                          className="rounded-lg border border-border p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Editar empresa">
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => { const label = company.company_name + (company.address_city ? ` — ${company.address_city}` : ""); if (confirm(`Remover empresa "${label}" e todos os formulários vinculados?`)) deleteCompany.mutate({ cnpj: company.cnpj, city: company.address_city }); }}
                          className="rounded-lg border border-destructive/30 p-2 text-destructive hover:bg-destructive/10 transition-colors" title="Excluir empresa">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
