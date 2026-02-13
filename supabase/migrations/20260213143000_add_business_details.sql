-- Add business_type and description for AI context
ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS business_type TEXT;
ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS description TEXT;
-- Ensure contact_phone is TEXT (already is, but good to be sure)
-- Ensure whatsapp_phone_number_id is TEXT