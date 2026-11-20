begin;

-- Payment images stay private until an administrator shares them individually.
alter table public.payment_receipts add column is_public boolean not null default false;

create function private.is_public_payment_receipt(receipt_path text)
returns boolean language sql stable security definer set search_path='' as $$
 select exists (
  select 1
  from public.payment_receipts r
  join public.payments p on p.id=r.payment_id
  join public.expenses e on e.id=p.expense_id
  where r.path=receipt_path and r.is_public and e.is_public
 );
$$;
revoke all on function private.is_public_payment_receipt(text) from public;
grant execute on function private.is_public_payment_receipt(text) to anon,authenticated;

create policy receipts_public_payment_select on storage.objects
 for select to anon,authenticated
 using (bucket_id='receipts' and private.is_public_payment_receipt(name));

create or replace function public.save_payment(p jsonb,request_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare pid uuid;old public.payments;images jsonb;image jsonb;image_path text;
begin
 perform private.require_admin();
 if nullif(p->>'id','') is null then
  select id into pid from public.payments where request_key=request_id;
  if pid is not null then return pid;end if;
  insert into public.payments(request_key,expense_id,date,amount,method,reference,notes)
  values(request_id,(p->>'expense_id')::uuid,(p->>'date')::date,(p->>'amount')::numeric,p->>'method',coalesce(p->>'reference',''),coalesce(p->>'notes','')) returning id into pid;
 else
  pid=(p->>'id')::uuid;
  select * into old from public.payments where id=pid and expense_id=(p->>'expense_id')::uuid;
  if old.id is null then raise exception 'Payment not found';end if;
  if old.version<>coalesce((p->>'version')::integer,0) then raise exception 'This payment changed in another session. Refresh before editing.';end if;
  update public.payments set date=(p->>'date')::date,amount=(p->>'amount')::numeric,method=p->>'method',reference=coalesce(p->>'reference',''),notes=coalesce(p->>'notes',''),version=version+1 where id=pid;
 end if;
 -- Omitting proofs preserves all existing images for older application clients.
 if p ? 'proofs' then
  images=p->'proofs';
  if jsonb_typeof(images)<>'array' then raise exception 'Payment images must be a list';end if;
  if jsonb_array_length(images)>5 then raise exception 'At most 5 images are allowed per payment';end if;
  if (select count(distinct value->>'path') from jsonb_array_elements(images))<>jsonb_array_length(images) then raise exception 'Duplicate payment image path';end if;
  for image in select value from jsonb_array_elements(images) loop
   image_path=image->>'path';
   if image_path is null or split_part(image_path,'/',1)<>auth.uid()::text
    or not exists(select 1 from storage.objects where bucket_id='receipts' and name=image_path)
    or exists(select 1 from public.receipt_metadata where path=image_path)
    or exists(select 1 from public.payment_receipts where path=image_path and payment_id<>pid)
   then raise exception 'Invalid private payment image';end if;
  end loop;
  delete from public.payment_receipts where payment_id=pid and path not in(select value->>'path' from jsonb_array_elements(images));
  for image in select value from jsonb_array_elements(images) loop
   insert into public.payment_receipts(payment_id,path,name,mime_type,is_public)
    values(pid,image->>'path',image->>'name',image->>'type',coalesce((image->>'is_public')::boolean,false))
    on conflict(path) do update set name=excluded.name,mime_type=excluded.mime_type,
     is_public=case when image ? 'is_public' then excluded.is_public else payment_receipts.is_public end;
  end loop;
 end if;
 return pid;
end $$;

alter function public.app_snapshot() rename to app_snapshot_before_public_payment_receipts;
alter function public.app_snapshot_before_public_payment_receipts() set schema private;
revoke all on function private.app_snapshot_before_public_payment_receipts() from public,anon,authenticated;

create function public.app_snapshot() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare base jsonb; payment_rows jsonb; is_admin boolean;
begin
 base := private.app_snapshot_before_public_payment_receipts();
 is_admin := (base->>'admin')::boolean;

 select coalesce(jsonb_agg(
  case when is_admin or images.proofs <> '[]'::jsonb
   then entry.value || jsonb_build_object('proofs',images.proofs)
   else entry.value end
  order by entry.ordinality
 ),'[]'::jsonb) into payment_rows
 from jsonb_array_elements(base->'payments') with ordinality entry(value,ordinality)
 join public.payments p on p.id=(entry.value->>'id')::uuid
 join public.expenses e on e.id=p.expense_id
 cross join lateral (
  select coalesce(jsonb_agg(jsonb_build_object(
   'id',r.id,'path',r.path,'name',r.name,'type',r.mime_type,'url','','is_public',r.is_public
  ) order by r.created_at,r.id),'[]'::jsonb) as proofs
  from public.payment_receipts r
  where r.payment_id=p.id and (is_admin or (r.is_public and e.is_public))
 ) images;

 return jsonb_set(base,'{payments}',payment_rows) || jsonb_build_object('publicPaymentReceipts',true);
end $$;

revoke all on function public.app_snapshot() from public,anon,authenticated;
grant execute on function public.app_snapshot() to anon,authenticated;
notify pgrst,'reload schema';
commit;
