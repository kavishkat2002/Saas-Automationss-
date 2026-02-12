-- Update conversations channel to support telegram
-- This migration adds telegram as a valid channel option
-- Check current channel constraint
ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_channel_check;
-- Add new constraint with telegram
ALTER TABLE public.conversations
ADD CONSTRAINT conversations_channel_check CHECK (
        channel IN ('whatsapp', 'telegram', 'web', 'email')
    );
-- Create index on channel for better query performance
CREATE INDEX IF NOT EXISTS idx_conversations_channel ON public.conversations(channel);
-- Create index on telegram customer lookups
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);