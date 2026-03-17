-- Enable delete policy for formation_documents
-- Allows authenticated users to delete documents (or you can restrict to uploaded_by)

create policy "Enable delete for authenticated users"
on "public"."formation_documents"
as PERMISSIVE
for DELETE
to authenticated
using ( true );
