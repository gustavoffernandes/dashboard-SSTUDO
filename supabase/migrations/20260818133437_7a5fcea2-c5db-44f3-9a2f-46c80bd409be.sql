CREATE OR REPLACE VIEW public.public_form_configs AS
SELECT id, company_name, form_title, description, instructions, is_active,
       is_anonymous, require_consent, require_password, survey_password,
       start_date, end_date, sector, sectors, cnpj, form_status, methodology
FROM public.google_forms_config;

GRANT SELECT ON public.public_form_configs TO anon, authenticated;