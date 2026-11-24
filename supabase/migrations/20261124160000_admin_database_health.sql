-- Admin-only RPC for database size / table storage on System Health.
-- Executable by the service role only. Safe to re-run.

create or replace function public.admin_database_health()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  db_size bigint;
  tables jsonb;
begin
  select pg_database_size(current_database()) into db_size;

  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.size_bytes desc), '[]'::jsonb)
  into tables
  from (
    select
      n.nspname || '.' || c.relname as name,
      pg_total_relation_size(c.oid) as size_bytes
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relkind in ('r', 'm', 'p')
      and n.nspname = 'public'
    order by pg_total_relation_size(c.oid) desc
    limit 20
  ) t;

  return jsonb_build_object(
    'databaseName', current_database(),
    'sizeBytes', db_size,
    'tables', tables
  );
end;
$$;

revoke all on function public.admin_database_health() from public, anon, authenticated;
grant execute on function public.admin_database_health() to service_role;

comment on function public.admin_database_health() is
  'Returns database and top public table sizes for the admin System Health page. Service role only.';
