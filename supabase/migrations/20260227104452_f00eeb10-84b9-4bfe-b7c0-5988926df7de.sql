
-- Create super_admins table
CREATE TABLE public.super_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

-- Only the user themselves can SELECT their own record (to check if they're SA)
CREATE POLICY "Users can check own super admin status"
  ON public.super_admins
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Only service_role can manage super_admins
CREATE POLICY "Service role manages super admins"
  ON public.super_admins
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create SECURITY DEFINER function to check super admin status
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.super_admins
    WHERE user_id = _user_id
  );
$$;

-- Insert the initial super admin by email
INSERT INTO public.super_admins (user_id)
SELECT id FROM auth.users WHERE email = 'carlos.ap.mafei@hotmail.com'
ON CONFLICT DO NOTHING;
