begin;

-- Payment dates remain the ledger dates. Creation time breaks ties within a day.
alter function public.app_snapshot() rename to app_snapshot_before_payment_order;
alter function public.app_snapshot_before_payment_order() set schema private;
revoke all on function private.app_snapshot_before_payment_order() from public,anon,authenticated;

create function public.app_snapshot() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
 snapshot jsonb;
 payment_rows jsonb;
begin
 snapshot := private.app_snapshot_before_payment_order();
 select coalesce(jsonb_agg(
  entry.value || jsonb_build_object('created_at',p.created_at)
  order by p.date desc,p.created_at desc,p.id
 ),'[]'::jsonb) into payment_rows
 from jsonb_array_elements(snapshot->'payments') entry(value)
 join public.payments p on p.id=(entry.value->>'id')::uuid;
 return jsonb_set(snapshot,'{payments}',payment_rows);
end $$;

revoke all on function public.app_snapshot() from public,anon,authenticated;
grant execute on function public.app_snapshot() to anon,authenticated;
notify pgrst,'reload schema';
commit;
