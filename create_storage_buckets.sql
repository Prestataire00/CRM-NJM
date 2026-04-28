-- Création des buckets Storage utilisés par l'app
-- Bucket 'documents' : uploads docs formation, convocations, supports, Qualiopi
-- Bucket 'templates' : téléchargement des modèles Word côté client

insert into storage.buckets (id, name, public)
values
  ('documents', 'documents', true),
  ('templates', 'templates', true)
on conflict (id) do nothing;

-- Policies bucket 'documents' (utilisateurs authentifiés)
drop policy if exists "Authenticated users can upload documents" on storage.objects;
create policy "Authenticated users can upload documents"
on storage.objects for insert to authenticated
with check (bucket_id = 'documents');

drop policy if exists "Authenticated users can read documents" on storage.objects;
create policy "Authenticated users can read documents"
on storage.objects for select to authenticated
using (bucket_id = 'documents');

drop policy if exists "Authenticated users can update documents" on storage.objects;
create policy "Authenticated users can update documents"
on storage.objects for update to authenticated
using (bucket_id = 'documents');

drop policy if exists "Authenticated users can delete documents" on storage.objects;
create policy "Authenticated users can delete documents"
on storage.objects for delete to authenticated
using (bucket_id = 'documents');

-- Lecture publique pour les liens partagés (getPublicUrl)
drop policy if exists "Public can read documents" on storage.objects;
create policy "Public can read documents"
on storage.objects for select to public
using (bucket_id = 'documents');

-- Policies bucket 'templates' (lecture publique)
drop policy if exists "Public can read templates" on storage.objects;
create policy "Public can read templates"
on storage.objects for select to public
using (bucket_id = 'templates');
