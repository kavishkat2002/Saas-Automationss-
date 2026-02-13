-- Add bank and payment gateway fields to businesses table
ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS bank_name TEXT,
    ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
    ADD COLUMN IF NOT EXISTS bank_account_holder TEXT,
    ADD COLUMN IF NOT EXISTS bank_branch TEXT,
    ADD COLUMN IF NOT EXISTS bank_swift_code TEXT,
    ADD COLUMN IF NOT EXISTS payment_gateway_link TEXT,
    ADD COLUMN IF NOT EXISTS payment_gateway_name TEXT;
-- Add comment to describe the new fields
COMMENT ON COLUMN public.businesses.bank_name IS 'Name of the bank for customer payments';
COMMENT ON COLUMN public.businesses.bank_account_number IS 'Bank account number to receive payments';
COMMENT ON COLUMN public.businesses.bank_account_holder IS 'Name of the account holder';
COMMENT ON COLUMN public.businesses.bank_branch IS 'Bank branch information';
COMMENT ON COLUMN public.businesses.bank_swift_code IS 'SWIFT/BIC code for international transfers';
COMMENT ON COLUMN public.businesses.payment_gateway_link IS 'Payment gateway URL to send to customers';
COMMENT ON COLUMN public.businesses.payment_gateway_name IS 'Name of the payment gateway provider';