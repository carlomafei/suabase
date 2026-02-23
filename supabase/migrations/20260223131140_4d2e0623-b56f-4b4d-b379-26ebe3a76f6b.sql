
-- Add provider_message_id to messages for WhatsApp message tracking
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS provider_message_id text DEFAULT null;

-- Index for fast lookup by provider_message_id
CREATE INDEX IF NOT EXISTS idx_messages_provider_message_id 
  ON public.messages(provider_message_id) 
  WHERE provider_message_id IS NOT NULL;
