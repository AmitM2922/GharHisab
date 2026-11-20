begin;

-- Keep the bucket private and authorize reads only for linked public expenses.
create or replace function private.is_public_expense_receipt(receipt_path text)
returns boolean language sql stable security definer set search_path='' as $$
 select exists (
  select 1 from public.receipt_metadata r
  join public.expenses e on e.id=r.expense_id
  where r.path=receipt_path and e.is_public
 );
$$;
revoke all on function private.is_public_expense_receipt(text) from public;
grant execute on function private.is_public_expense_receipt(text) to anon,authenticated;

drop policy if exists receipts_public_expense_select on storage.objects;
create policy receipts_public_expense_select on storage.objects
 for select to anon,authenticated
 using (bucket_id='receipts' and private.is_public_expense_receipt(name));

do $$
begin
 if to_regprocedure('private.app_snapshot_before_public_receipts()') is null then
  alter function public.app_snapshot() rename to app_snapshot_before_public_receipts;
  alter function public.app_snapshot_before_public_receipts() set schema private;
 end if;
end $$;
revoke all on function private.app_snapshot_before_public_receipts() from public,anon,authenticated;

create or replace function public.app_snapshot() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare base jsonb; rows jsonb;
begin
 base=private.app_snapshot_before_public_receipts();
 if not (base->>'admin')::boolean then
  select coalesce(jsonb_agg(
   case when r.path is null then x.value else x.value||jsonb_build_object(
    'proof',jsonb_build_object('name',r.name,'type',r.mime_type,'path',r.path,'url','')
   ) end order by x.ordinality
  ),'[]'::jsonb) into rows
  from jsonb_array_elements(base->'expenses') with ordinality x(value,ordinality)
  join public.expenses e on e.id=(x.value->>'id')::uuid and e.is_public
  left join public.receipt_metadata r on r.expense_id=e.id;
  base=jsonb_set(base,'{expenses}',rows);
 end if;
 return base||jsonb_build_object('publicExpenseReceipts',true);
end $$;
revoke all on function public.app_snapshot() from public,anon,authenticated;
grant execute on function public.app_snapshot() to anon,authenticated;

notify pgrst,'reload schema';
commit;
