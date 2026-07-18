-- ============================================================
-- SQL Migrations for Flow Payments and Beneficiary Assignment
-- Run these statements in your Supabase SQL Editor.
-- ============================================================

-- 1. Add beneficiary_id column to public.payments table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'payments' 
          AND column_name = 'beneficiary_id'
    ) THEN
        ALTER TABLE public.payments 
        ADD COLUMN beneficiary_id uuid REFERENCES public.beneficiaries(id) ON DELETE SET NULL;
        RAISE NOTICE 'Added beneficiary_id column to public.payments table.';
    ELSE
        RAISE NOTICE 'beneficiary_id column already exists in public.payments table.';
    END IF;
END $$;

-- 2. Insert missing beneficiary records for historical profiles (profiles without a beneficiary)
INSERT INTO public.beneficiaries (profile_id)
SELECT id FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.beneficiaries b WHERE b.profile_id = p.id
);

-- 3. Verify column and table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'payments' 
  AND column_name = 'beneficiary_id';
