ALTER TABLE public.google_forms_config
  ADD COLUMN IF NOT EXISTS methodology text NOT NULL DEFAULT 'proart';

UPDATE public.google_forms_config SET methodology = 'proart' WHERE methodology IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'google_forms_config_methodology_check'
  ) THEN
    ALTER TABLE public.google_forms_config
      ADD CONSTRAINT google_forms_config_methodology_check
      CHECK (methodology IN ('proart', 'copsoq'));
  END IF;
END $$;