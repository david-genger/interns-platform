-- Storage buckets for re-hosted Airtable attachments.
-- Run once (after 0001_init.sql). Airtable attachment URLs expire (~2h), so the
-- sync job copies files here and the app serves them with stable / signed URLs.

-- Public bucket for profile images (safe to serve directly).
insert into storage.buckets (id, name, public)
values ('profile-images', 'profile-images', true)
on conflict (id) do nothing;

-- Private bucket for resumes. Served only via short-lived signed URLs created
-- server-side for approved users.
insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;

-- Allow approved company users to read resume objects through RLS as well
-- (defense in depth; the app uses signed URLs from the service role).
drop policy if exists "approved read resumes" on storage.objects;
create policy "approved read resumes"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'resumes' and public.is_approved_user());
