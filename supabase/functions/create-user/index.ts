import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callerUser }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !callerUser) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Garante que o caller é admin ou super_admin
    const { data: callerRoles } = await adminClient
      .from("user_roles")
      .select("role, parent_admin_id")
      .eq("user_id", callerUser.id);

    const rolesList = callerRoles || [];
    const isSuperAdmin = rolesList.some((r: any) => r.role === "super_admin");
    const adminRow = rolesList.find((r: any) => r.role === "admin");

    if (!isSuperAdmin && !adminRow) {
      return new Response(
        JSON.stringify({ error: "Acesso negado. Apenas administradores podem gerenciar usuários." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // O "dono" da família é o próprio caller (admins raiz têm parent_admin_id NULL).
    const familyOwnerId: string = adminRow?.parent_admin_id ?? callerUser.id;

    const body = await req.json();

    // ==========================================
    // LISTAR USUÁRIOS
    // Super admin: lista TODOS os usuários do sistema
    // Admin: apenas a própria família
    // ==========================================
    if (body.action === "list") {
      let rolesQuery = adminClient.from("user_roles").select("*").order("role");
      if (!isSuperAdmin) {
        rolesQuery = rolesQuery.or(`user_id.eq.${familyOwnerId},parent_admin_id.eq.${familyOwnerId}`);
      }
      const { data: rolesData, error: rolesErr } = await rolesQuery;

      if (rolesErr) {
        return new Response(JSON.stringify({ error: rolesErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const userIds = Array.from(new Set((rolesData || []).map((r: any) => r.user_id)));
      const emailMap: Record<string, string> = {};

      // Busca emails dos usuários (paralelizado)
      await Promise.all(userIds.map(async (uid) => {
        const { data: u } = await adminClient.auth.admin.getUserById(uid);
        if (u?.user) emailMap[uid] = u.user.email || "";
      }));

      const users = userIds.map((id) => ({ id, email: emailMap[id] || "" }));
      return new Response(
        JSON.stringify({ users, roles: rolesData || [], isSuperAdmin }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==========================================
    // ATUALIZAR USUÁRIO (somente da própria família)
    // ==========================================
    if (body.action === "update") {
      const { role_id, role, company_id } = body;

      // Verifica que role_id pertence à família
      const { data: targetRole } = await adminClient
        .from("user_roles")
        .select("user_id, parent_admin_id")
        .eq("id", role_id)
        .maybeSingle();

      if (!targetRole) {
        return new Response(JSON.stringify({ error: "Usuário não encontrado." }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const isInFamily = targetRole.user_id === familyOwnerId || targetRole.parent_admin_id === familyOwnerId;
      if (!isSuperAdmin && !isInFamily) {
        return new Response(JSON.stringify({ error: "Acesso negado." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const updateData: any = { role };
      if (role === "company_user") updateData.company_id = company_id || null;
      else updateData.company_id = null;

      const { error } = await adminClient.from("user_roles").update(updateData).eq("id", role_id);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ==========================================
    // EXCLUIR USUÁRIO (somente da própria família, nunca o próprio dono)
    // ==========================================
    if (body.action === "delete") {
      const { user_id, role_id } = body;

      if (user_id === familyOwnerId) {
        return new Response(JSON.stringify({ error: "Não é possível excluir o administrador raiz da conta." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: targetRole } = await adminClient
        .from("user_roles")
        .select("user_id, parent_admin_id")
        .eq("id", role_id)
        .maybeSingle();

      if (!targetRole || targetRole.parent_admin_id !== familyOwnerId) {
        return new Response(JSON.stringify({ error: "Acesso negado." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { error: authError } = await adminClient.auth.admin.deleteUser(user_id);
      if (authError) {
        return new Response(JSON.stringify({ error: authError.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (role_id) {
        await adminClient.from("user_roles").delete().eq("id", role_id);
      }
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ==========================================
    // CRIAR NOVO USUÁRIO (filho do admin caller)
    // ==========================================
    const { email, password, role = "user", company_id = null } = body;

    if (!email || !password) return new Response(JSON.stringify({ error: "E-mail e senha são obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (password.length < 8) return new Response(JSON.stringify({ error: "A senha deve ter pelo menos 8 caracteres" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const allowedRoles = ["admin", "user", "company_user"];
    if (!allowedRoles.includes(role)) return new Response(JSON.stringify({ error: "Role inválido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (role === "company_user" && !company_id) return new Response(JSON.stringify({ error: "Para 'Usuário Empresa', selecione uma empresa." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data, error } = await adminClient.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const roleInsert: Record<string, unknown> = {
      user_id: data.user.id,
      role,
      parent_admin_id: familyOwnerId, // marca como filho do admin caller
    };
    if (role === "company_user" && company_id) roleInsert.company_id = company_id;

    const { error: roleError } = await adminClient.from("user_roles").insert(roleInsert);
    if (roleError) {
      await adminClient.auth.admin.deleteUser(data.user.id);
      return new Response(JSON.stringify({ error: "Erro ao atribuir role ao usuário." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    try {
      await adminClient.from("audit_logs").insert({
        user_id: callerUser.id,
        action: "create_user",
        entity: "auth.user",
        entity_id: data.user.id,
        metadata: { email, role, company_id: role === "company_user" ? company_id : null, parent_admin_id: familyOwnerId },
      });
    } catch (_) {}

    return new Response(
      JSON.stringify({ success: true, user: { id: data.user.id, email: data.user.email, role, company_id: role === "company_user" ? company_id : null } }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
