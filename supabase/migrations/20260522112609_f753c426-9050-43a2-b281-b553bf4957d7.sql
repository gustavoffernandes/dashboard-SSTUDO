
-- Função para verificar super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin'::app_role
  );
$$;

-- google_forms_config
CREATE POLICY "Super admin sees all companies" ON public.google_forms_config
  FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admin manages all companies" ON public.google_forms_config
  FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- survey_responses
CREATE POLICY "Super admin sees all responses" ON public.survey_responses
  FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admin manages all responses" ON public.survey_responses
  FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- survey_sessions
CREATE POLICY "Super admin sees all sessions" ON public.survey_sessions
  FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admin manages all sessions" ON public.survey_sessions
  FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- action_plans
CREATE POLICY "Super admin sees all action plans" ON public.action_plans
  FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admin manages all action plans" ON public.action_plans
  FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- action_plan_tasks
CREATE POLICY "Super admin sees all tasks" ON public.action_plan_tasks
  FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admin manages all tasks" ON public.action_plan_tasks
  FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- company_notes
CREATE POLICY "Super admin sees all notes" ON public.company_notes
  FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admin manages all notes" ON public.company_notes
  FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- sync_logs
CREATE POLICY "Super admin sees all sync logs" ON public.sync_logs
  FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));

-- user_roles
CREATE POLICY "Super admin sees all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admin manages all roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- subscriptions (já tem SELECT via has_role super_admin; adicionar gestão)
CREATE POLICY "Super admin manages subscriptions" ON public.subscriptions
  FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- system_accounts
CREATE POLICY "Super admin sees all system accounts" ON public.system_accounts
  FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admin manages system accounts" ON public.system_accounts
  FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- profiles
CREATE POLICY "Super admin sees all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admin manages profiles" ON public.profiles
  FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- audit_logs (já tem admin SELECT; estender p/ super_admin)
CREATE POLICY "Super admin reads audit logs" ON public.audit_logs
  FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));

-- contact_messages (já coberto por has_role super_admin nas policies existentes)
