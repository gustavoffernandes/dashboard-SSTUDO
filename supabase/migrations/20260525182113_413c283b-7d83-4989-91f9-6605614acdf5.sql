
-- O problema: as policies de INSERT em survey_responses e survey_sessions usam EXISTS
-- contra google_forms_config, mas anon não tem SELECT nessa tabela (RLS bloqueia).
-- Solução: usar função SECURITY DEFINER para verificar se o config está ativo.

CREATE OR REPLACE FUNCTION public.is_config_active(_config_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.google_forms_config
    WHERE id = _config_id AND is_active = true
  );
$$;

-- survey_responses
DROP POLICY IF EXISTS "Anon can submit to active surveys" ON public.survey_responses;
DROP POLICY IF EXISTS "Authenticated can submit to active surveys" ON public.survey_responses;

CREATE POLICY "Anon can submit to active surveys"
ON public.survey_responses FOR INSERT
TO anon
WITH CHECK (public.is_config_active(config_id));

CREATE POLICY "Authenticated can submit to active surveys"
ON public.survey_responses FOR INSERT
TO authenticated
WITH CHECK (public.is_config_active(config_id));

-- survey_sessions
DROP POLICY IF EXISTS "Anon can create sessions" ON public.survey_sessions;
DROP POLICY IF EXISTS "Anon reads sessions of active configs" ON public.survey_sessions;
DROP POLICY IF EXISTS "Anon updates session of active config" ON public.survey_sessions;

CREATE POLICY "Anon can create sessions"
ON public.survey_sessions FOR INSERT
TO anon, authenticated
WITH CHECK (public.is_config_active(config_id));

CREATE POLICY "Anon reads sessions of active configs"
ON public.survey_sessions FOR SELECT
TO anon, authenticated
USING (public.is_config_active(config_id));

CREATE POLICY "Anon updates session of active config"
ON public.survey_sessions FOR UPDATE
TO anon, authenticated
USING (public.is_config_active(config_id))
WITH CHECK (public.is_config_active(config_id));
