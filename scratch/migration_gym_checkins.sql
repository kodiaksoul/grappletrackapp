-- Create gym_checkins table
CREATE TABLE public.gym_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES public.gym_locations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  class_name TEXT NOT NULL,
  week_topic TEXT,
  lesson_topic TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.gym_checkins ENABLE ROW LEVEL SECURITY;

-- Select policy: users can see their own checkins, gym staff (Teachers/Admins) can see all gym checkins
CREATE POLICY "Enable read for gym members and staff"
ON public.gym_checkins FOR SELECT TO authenticated
USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.gym_memberships
    WHERE gym_memberships.gym_id = gym_checkins.gym_id
      AND gym_memberships.user_id = auth.uid()
      AND gym_memberships.role_token IN ('Teacher', 'Admin')
  )
);

-- Insert policy: users can insert their own checkins, gym staff can insert any checkin
CREATE POLICY "Enable insert for authenticated users and staff"
ON public.gym_checkins FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.gym_memberships
    WHERE gym_memberships.gym_id = gym_checkins.gym_id
      AND gym_memberships.user_id = auth.uid()
      AND gym_memberships.role_token IN ('Teacher', 'Admin')
  )
);

-- Delete policy: gym staff can delete checkins
CREATE POLICY "Enable delete for gym staff"
ON public.gym_checkins FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.gym_memberships
    WHERE gym_memberships.gym_id = gym_checkins.gym_id
      AND gym_memberships.user_id = auth.uid()
      AND gym_memberships.role_token IN ('Teacher', 'Admin')
  )
);
