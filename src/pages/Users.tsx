import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { UserPlus, Loader2, Pencil, Trash2, Check, X, AlertTriangle, Shield, User, Building2, Crown } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { usePlans, useCurrentUserPlan } from "@/hooks/usePlans";

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Administrador",
  user: "Usuário Geral",
  company_user: "Usuário Empresa",
};

export default function Users() {
  const { user, isAdmin, isSuperAdmin } = useAuth();
  const qc = useQueryClient();
  const { data: plans = [] } = usePlans();
  const { data: currentPlan } = useCurrentUserPlan();
  // Limite de usuários do plano contratado pelo admin (system_accounts). Fallback: menor plano.
  const userLimit = currentPlan?.max_users
    ?? (plans.length ? Math.min(...plans.map(p => p.max_users)) : 1);

  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<"admin" | "user" | "company_user">("user");
  const [newUserCompanyId, setNewUserCompanyId] = useState("");
  const [creatingUser, setCreatingUser] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState("");
  const [editingCompanyId, setEditingCompanyId] = useState("");

  const { data: companiesList = [] } = useQuery({
    queryKey: ["companies-for-user-creation"],
    queryFn: async () => {
      const { data, error } = await supabase.from("google_forms_config").select("id, company_name, cnpj").order("company_name");
      if (error) throw error;
      const seen = new Map<string, { id: string; company_name: string }>();
      (data || []).forEach((c: any) => { const key = c.cnpj || c.id; if (!seen.has(key)) seen.set(key, { id: c.id, company_name: c.company_name }); });
      return Array.from(seen.values());
    },
    enabled: isAdmin,
  });

  const { data: allCompanies = [] } = useQuery({
    queryKey: ["all-companies-for-lookup"],
    queryFn: async () => {
      const { data, error } = await supabase.from("google_forms_config").select("id, company_name, cnpj").order("company_name");
      if (error) throw error;
      const seen = new Map<string, { id: string; company_name: string }>();
      (data || []).forEach((c: any) => {
        const key = c.cnpj || c.company_name || c.id;
        if (!seen.has(key)) seen.set(key, { id: c.id, company_name: c.company_name });
      });
      return Array.from(seen.values());
    },
    enabled: isAdmin,
  });

  const { data: userRoles = [], isLoading } = useQuery({
    queryKey: ["all-user-roles"],
    queryFn: async () => {
      const { data: fnData, error: fnError } = await supabase.functions.invoke("create-user", {
        body: JSON.stringify({ action: "list" }),
        headers: { "Content-Type": "application/json" },
      });
      if (fnError) throw fnError;
      const parsed = typeof fnData === "string" ? JSON.parse(fnData) : fnData;
      const emailMap: Record<string, string> = {};
      if (parsed?.users) parsed.users.forEach((u: any) => { emailMap[u.id] = u.email; });
      const rolesData = parsed?.roles || [];
      return rolesData.map((r: any) => ({ ...r, email: emailMap[r.user_id] || "" }));
    },
    enabled: isAdmin,
  });

  const isAtLimit = userRoles.length >= userLimit;

  const handleCreateUser = async () => {
    if (!newUserEmail || !newUserPassword) { toast({ title: "Preencha todos os campos", variant: "destructive" }); return; }
    if (newUserPassword.length < 8) { toast({ title: "Senha deve ter pelo menos 8 caracteres", variant: "destructive" }); return; }
    if (newUserRole === "company_user" && !newUserCompanyId) { toast({ title: "Selecione uma empresa", variant: "destructive" }); return; }
    setCreatingUser(true);
    try {
      const body: Record<string, string> = { email: newUserEmail, password: newUserPassword, role: newUserRole };
      if (newUserRole === "company_user") body.company_id = newUserCompanyId;
      const { error } = await supabase.functions.invoke("create-user", { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
      if (error) throw error;
      toast({ title: "Usuário criado!", description: `${newUserEmail} foi adicionado.` });
      setNewUserEmail(""); setNewUserPassword(""); setNewUserRole("user"); setNewUserCompanyId(""); setShowCreateForm(false);
      qc.invalidateQueries({ queryKey: ["all-user-roles"] });
    } catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }
    setCreatingUser(false);
  };

  const handleUpdateRole = async (roleId: string) => {
    try {
      const body: any = { action: "update", role_id: roleId, role: editingRole };
      if (editingRole === "company_user") body.company_id = editingCompanyId || null;
      const { data, error } = await supabase.functions.invoke("create-user", { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Usuário atualizado!" });
      setEditingUserId(null);
      qc.invalidateQueries({ queryKey: ["all-user-roles"] });
    } catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }
  };

  const handleDeleteUser = async (roleId: string, userId: string) => {
    if (!confirm("Excluir este usuário permanentemente?")) return;
    try {
      const { data, error } = await supabase.functions.invoke("create-user", { body: JSON.stringify({ action: "delete", user_id: userId, role_id: roleId }), headers: { "Content-Type": "application/json" } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Usuário removido!" });
      qc.invalidateQueries({ queryKey: ["all-user-roles"] });
    } catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }
  };

  return (
    <DashboardLayout>
      <div className="animate-fade-in space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Usuários</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">Gerencie os usuários da sua conta</p>
          </div>
          {!isAtLimit && (
            <button onClick={() => setShowCreateForm(!showCreateForm)}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shrink-0">
              <UserPlus className="h-4 w-4" /> Novo Usuário
            </button>
          )}
        </div>

        {/* Limit warning */}
        {isAtLimit && (
          <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground">Limite Atingido</p>
              <p className="text-xs text-muted-foreground">Você atingiu o limite de {userLimit} usuário(s) do seu plano. Faça upgrade para adicionar mais.</p>
            </div>
          </div>
        )}

        {/* Create form */}
        {showCreateForm && !isAtLimit && (
          <div className="rounded-xl border border-border bg-card p-5 shadow-card space-y-4">
            <h3 className="text-sm font-semibold text-card-foreground">Criar Novo Usuário</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">E-mail</label>
                <input type="email" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} placeholder="novo@email.com"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Senha</label>
                <input type="password" value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} placeholder="Mínimo 8 caracteres"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Tipo de Usuário</label>
                <select value={newUserRole} onChange={e => { setNewUserRole(e.target.value as any); setNewUserCompanyId(""); }}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  <option value="user">Usuário Geral</option>
                  <option value="company_user">Usuário Empresa</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              {newUserRole === "company_user" && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Empresa Vinculada</label>
                  <select value={newUserCompanyId} onChange={e => setNewUserCompanyId(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                    <option value="">Selecione...</option>
                    {companiesList.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={handleCreateUser} disabled={creatingUser}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors">
                {creatingUser ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Criar
              </button>
              <button onClick={() => setShowCreateForm(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors">Cancelar</button>
            </div>
          </div>
        )}

        {/* Access levels */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <h3 className="text-sm font-semibold text-card-foreground mb-3">Níveis de Acesso</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Shield className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div><p className="text-sm font-medium text-foreground">Administrador</p><p className="text-xs text-muted-foreground">Acesso total ao sistema</p></div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <User className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div><p className="text-sm font-medium text-foreground">Usuário Geral</p><p className="text-xs text-muted-foreground">Visualiza todas as empresas</p></div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Building2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
              <div><p className="text-sm font-medium text-foreground">Usuário Empresa</p><p className="text-xs text-muted-foreground">Restrito a uma empresa</p></div>
            </div>
          </div>
        </div>

        {/* User list */}
        <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-card-foreground">Lista de Usuários</h3>
            <span className="text-xs text-muted-foreground">{userRoles.length}/{userLimit} usuário(s)</span>
          </div>

          {isLoading ? (
            <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></div>
          ) : userRoles.length === 0 ? (
            <div className="p-8 text-center"><p className="text-sm text-muted-foreground">Nenhum usuário encontrado.</p></div>
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Usuário</th>
                      <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Email</th>
                      <th className="px-4 py-3 text-center font-semibold text-muted-foreground">Tipo</th>
                      <th className="px-4 py-3 text-center font-semibold text-muted-foreground">Status</th>
                      <th className="px-4 py-3 text-center font-semibold text-muted-foreground">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userRoles.map((ur: any) => {
                      const isCurrentUser = ur.user_id === user?.id;
                      const companyName = ur.company_id ? allCompanies.find((c: any) => c.id === ur.company_id)?.company_name || "—" : "—";
                      return (
                        <tr key={ur.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 text-foreground">
                            {ur.email || ur.user_id.substring(0, 16) + "…"}
                            {isCurrentUser && <span className="ml-1 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">você</span>}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{ur.email || "—"}</td>
                          <td className="px-4 py-3 text-center">
                            <div>
                              <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
                                ur.role === "admin" ? "bg-destructive/10 text-destructive" :
                                ur.role === "company_user" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                                {ROLE_LABEL[ur.role] || ur.role}
                              </span>
                              {ur.role === "company_user" && companyName !== "—" && (
                                <p className="text-[10px] text-muted-foreground mt-0.5">{companyName}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center gap-1 rounded-full bg-success/10 text-success px-2 py-0.5 text-[10px] font-semibold">Ativo</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => { setEditingUserId(ur.id); setEditingRole(ur.role); setEditingCompanyId(ur.company_id || ""); }}
                                className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Editar"><Pencil className="h-3.5 w-3.5" /></button>
                              {!isCurrentUser && (
                                <button onClick={() => handleDeleteUser(ur.id, ur.user_id)}
                                  className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" title="Excluir"><Trash2 className="h-3.5 w-3.5" /></button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Mobile */}
              <div className="md:hidden divide-y divide-border">
                {userRoles.map((ur: any) => {
                  const isCurrentUser = ur.user_id === user?.id;
                  const companyName = ur.company_id ? allCompanies.find((c: any) => c.id === ur.company_id)?.company_name || "—" : "—";
                  return (
                    <div key={ur.id} className="p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{ur.email || ur.user_id.substring(0, 16) + "…"}
                          {isCurrentUser && <span className="ml-1 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">você</span>}
                        </p>
                        <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0",
                          ur.role === "admin" ? "bg-destructive/10 text-destructive" :
                          ur.role === "company_user" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                          {ROLE_LABEL[ur.role] || ur.role}
                        </span>
                      </div>
                      {ur.role === "company_user" && companyName !== "—" && (
                        <p className="text-[11px] text-muted-foreground">{companyName}</p>
                      )}
                      <div className="flex items-center gap-3 pt-1">
                        <button onClick={() => { setEditingUserId(ur.id); setEditingRole(ur.role); setEditingCompanyId(ur.company_id || ""); }}
                          className="text-xs text-primary hover:underline flex items-center gap-1"><Pencil className="h-3 w-3" /> Editar</button>
                        {!isCurrentUser && (
                          <button onClick={() => handleDeleteUser(ur.id, ur.user_id)}
                            className="text-xs text-destructive hover:underline flex items-center gap-1"><Trash2 className="h-3 w-3" /> Excluir</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Edit Dialog */}
        {editingUserId && (() => {
          const editingUser = userRoles.find((u: any) => u.id === editingUserId);
          if (!editingUser) return null;
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setEditingUserId(null)}>
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
              <div onClick={e => e.stopPropagation()}
                className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl animate-scale-in">
                <div className="flex items-center justify-between p-5 border-b border-border">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <Pencil className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-card-foreground">Editar Usuário</h3>
                      <p className="text-xs text-muted-foreground truncate max-w-[260px]">{editingUser.email || editingUser.user_id}</p>
                    </div>
                  </div>
                  <button onClick={() => setEditingUserId(null)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="p-5 space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-foreground uppercase tracking-wide">Tipo de Usuário</label>
                    <div className="grid grid-cols-1 gap-2">
                      {[
                        { value: "admin", label: "Administrador", desc: "Acesso total", icon: Shield, color: "text-destructive", bg: "bg-destructive/10 border-destructive/30" },
                        { value: "user", label: "Usuário Geral", desc: "Visualiza todas as empresas", icon: User, color: "text-primary", bg: "bg-primary/10 border-primary/30" },
                        { value: "company_user", label: "Usuário Empresa", desc: "Restrito a uma empresa", icon: Building2, color: "text-success", bg: "bg-success/10 border-success/30" },
                      ].map(opt => {
                        const Icon = opt.icon;
                        const selected = editingRole === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setEditingRole(opt.value)}
                            className={cn(
                              "flex items-center gap-3 rounded-lg border p-3 text-left transition-all",
                              selected ? `${opt.bg} ring-2 ring-offset-1 ring-offset-card` : "border-border hover:bg-muted/50",
                              selected && opt.value === "admin" && "ring-destructive/50",
                              selected && opt.value === "user" && "ring-primary/50",
                              selected && opt.value === "company_user" && "ring-success/50",
                            )}
                          >
                            <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg shrink-0", selected ? "bg-card" : "bg-muted/50")}>
                              <Icon className={cn("h-4 w-4", opt.color)} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground">{opt.label}</p>
                              <p className="text-[11px] text-muted-foreground">{opt.desc}</p>
                            </div>
                            {selected && <Check className={cn("h-4 w-4 shrink-0", opt.color)} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {editingRole === "company_user" && (
                    <div className="space-y-2 animate-fade-in">
                      <label className="text-xs font-semibold text-foreground uppercase tracking-wide">Empresa Vinculada</label>
                      <select value={editingCompanyId} onChange={e => setEditingCompanyId(e.target.value)}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition">
                        <option value="">Selecione uma empresa...</option>
                        {allCompanies.map((c: any) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                      </select>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 p-5 border-t border-border bg-muted/20 rounded-b-2xl">
                  <button onClick={() => setEditingUserId(null)}
                    className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors">
                    Cancelar
                  </button>
                  <button onClick={() => handleUpdateRole(editingUserId)}
                    className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm">
                    <Check className="h-4 w-4" /> Salvar Alterações
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </DashboardLayout>
  );
}
