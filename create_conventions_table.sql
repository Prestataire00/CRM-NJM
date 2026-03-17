-- Create conventions table to store training convention data
-- This table keeps a record of all generated conventions with their metadata

create table if not exists public.conventions (
    id bigserial primary key,
    formation_id bigint references public.formations(id) on delete cascade,

    -- Convention metadata
    convention_name text not null,
    google_doc_id text,
    google_doc_url text,

    -- Client information
    client_name text,
    company_name text,
    company_address text,
    company_postal_code text,
    company_city text,
    company_director_name text,

    -- Formation details
    formation_name text,
    objectives text,
    module_1 text,
    methods_tools text,

    -- Scheduling
    start_date date,
    end_date date,
    training_location text,

    -- Quantitative data
    hours_per_learner integer,
    number_of_learners integer,
    learners_names text,
    learners_data jsonb,

    -- Financial
    total_amount numeric(10,2),

    -- Timestamps
    generated_at timestamptz default now(),
    created_by uuid references auth.users(id),

    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Add RLS policies
alter table public.conventions enable row level security;

-- Allow authenticated users to view all conventions
create policy "Enable read access for authenticated users"
on public.conventions
for select
to authenticated
using (true);

-- Allow authenticated users to insert conventions
create policy "Enable insert for authenticated users"
on public.conventions
for insert
to authenticated
with check (true);

-- Allow users to update conventions they created
create policy "Enable update for creators"
on public.conventions
for update
to authenticated
using (created_by = auth.uid());

-- Allow users to delete conventions they created
create policy "Enable delete for creators"
on public.conventions
for delete
to authenticated
using (created_by = auth.uid());

-- Create indexes for better performance
create index conventions_formation_id_idx on public.conventions(formation_id);
create index conventions_created_by_idx on public.conventions(created_by);
create index conventions_generated_at_idx on public.conventions(generated_at desc);

-- Add trigger for updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger set_conventions_updated_at
    before update on public.conventions
    for each row
    execute function public.handle_updated_at();
