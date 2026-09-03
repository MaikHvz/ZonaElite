-- ============================================================
-- 028_personalized_packs_purchased_by_fk.sql
-- Agrega FK de purchased_by hacia profiles en personalized_packs
-- Idempotente.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'personalized_packs_purchased_by_fkey'
  ) THEN
    ALTER TABLE public.personalized_packs
      ADD CONSTRAINT personalized_packs_purchased_by_fkey
      FOREIGN KEY (purchased_by) REFERENCES public.profiles(id);
  END IF;
END $$;
