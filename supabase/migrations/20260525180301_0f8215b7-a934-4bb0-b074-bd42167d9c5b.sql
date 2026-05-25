
-- Create a public view exposing only non-sensitive fields needed to render the public survey
CREATE OR REPLACE VIEW public.public_form_configs
WITH (security_invoker=off) AS
SELECT
  id,
  company_name,
  form_title,
  description,
  instructions,
  is_active,
  is_anonymous,
  require_consent,
  require_password,
  survey_password,
  start_date,
  end_date,
  sector,
  sectors,
  cnpj,
  form_status
FROM public.google_forms_config;

GRANT SELECT ON public.public_form_configs TO anon, authenticated;

-- Allow anon/authenticated to read survey_sessions rows that belong to active configs
-- (needed so the public survey page can detect an existing in-progress/completed session)
CREATE POLICY "Anon reads sessions of active configs"
ON public.survey_sessions
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.google_forms_config c
    WHERE c.id = survey_sessions.config_id AND c.is_active = true
  )
);
