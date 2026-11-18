-- First create your account in Supabase Dashboard > Authentication > Users.
-- Replace the value with that existing user's UUID. Run in SQL Editor as owner.
-- This table has a singleton constraint: only one admin identity can exist.
insert into public.admin_profiles(user_id)
values ('REPLACE_WITH_YOUR_AUTH_USER_UUID'::uuid);
