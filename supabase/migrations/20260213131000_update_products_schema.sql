-- Add currency and stock_unit columns to products
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'Rs',
    ADD COLUMN IF NOT EXISTS stock_unit TEXT DEFAULT 'Quantity';
-- Change stock_quantity to numeric to support fractional units (e.g. 1.5 Kg)
ALTER TABLE public.products
ALTER COLUMN stock_quantity TYPE NUMERIC(10, 3);
-- Helper comments
COMMENT ON COLUMN public.products.currency IS 'Currency symbol (Rs or $)';
COMMENT ON COLUMN public.products.stock_unit IS 'Stock unit (Quantity or Kg)';
-- Create storage bucket for product images if it doesn't separate
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true) ON CONFLICT (id) DO NOTHING;
-- Policies for product-images bucket
-- Note: We skip enabling RLS as it is enabled by default on storage.objects
-- 1. Public Read Access
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
        AND tablename = 'objects'
        AND policyname = 'Public Access Product Images'
) THEN CREATE POLICY "Public Access Product Images" ON storage.objects FOR
SELECT USING (bucket_id = 'product-images');
END IF;
END $$;
-- 2. Authenticated Upload Access
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
        AND tablename = 'objects'
        AND policyname = 'Authenticated Upload Product Images'
) THEN CREATE POLICY "Authenticated Upload Product Images" ON storage.objects FOR
INSERT TO authenticated WITH CHECK (bucket_id = 'product-images');
END IF;
END $$;
-- 3. Authenticated Delete Access
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
        AND tablename = 'objects'
        AND policyname = 'Authenticated Delete Product Images'
) THEN CREATE POLICY "Authenticated Delete Product Images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'product-images');
END IF;
END $$;
-- 4. Authenticated Update Access
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
        AND tablename = 'objects'
        AND policyname = 'Authenticated Update Product Images'
) THEN CREATE POLICY "Authenticated Update Product Images" ON storage.objects FOR
UPDATE TO authenticated USING (bucket_id = 'product-images');
END IF;
END $$;