-- Add private image galleries to individual payments. Apply once at release.
-- Run after 202611180002_whole_rupee_rounding.sql. Existing receipt images stay
-- attached to their invoice; no images or payment history are moved or removed.
begin;
alter table public.payments add column version integer not null default 1;
create table public.payment_receipts (
 id uuid primary key default gen_random_uuid(),
 payment_id uuid not null references public.payments(id) on delete cascade,
 path text not null unique,
 name text not null check(length(name) between 1 and 255),
 mime_type text not null check(mime_type in ('image/png','image/jpeg','image/webp')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index payment_receipts_payment_idx on public.payment_receipts(payment_id);
alter table public.payment_receipts enable row level security;
create policy admin_read on public.payment_receipts for select to authenticated using(public.is_admin());
revoke all on public.payment_receipts from public,anon,authenticated;
create trigger audit_change after insert or update or delete on public.payment_receipts for each row execute function private.audit_change();
create trigger touch_row before update on public.payment_receipts for each row execute function private.touch_row();

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
   insert into public.payment_receipts(payment_id,path,name,mime_type)
    values(pid,image->>'path',image->>'name',image->>'type')
    on conflict(path) do update set name=excluded.name,mime_type=excluded.mime_type;
  end loop;
 end if;
 return pid;
end $$;

alter function public.app_snapshot() rename to app_snapshot_before_payment_images;
alter function public.app_snapshot_before_payment_images() set schema private;
revoke all on function private.app_snapshot_before_payment_images() from public,anon,authenticated;
create function public.app_snapshot() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare base jsonb;rows jsonb;begin
 base=private.app_snapshot_before_payment_images();
 if public.is_admin() then
  select coalesce(jsonb_agg(p.value||jsonb_build_object(
   'version',(select version from public.payments where id=(p.value->>'id')::uuid),
   'proofs',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'path',r.path,'name',r.name,'type',r.mime_type,'url','') order by r.created_at,r.id) from public.payment_receipts r where r.payment_id=(p.value->>'id')::uuid),'[]'::jsonb)
  ) order by p.ordinality),'[]'::jsonb) into rows from jsonb_array_elements(base->'payments') with ordinality p(value,ordinality);
  base=jsonb_set(base,'{payments}',rows);
 end if;
 return base||jsonb_build_object('paymentAttachments',true);
end $$;
revoke all on function public.app_snapshot() from public,anon,authenticated;
grant execute on function public.app_snapshot() to anon,authenticated;
-- save_payment retains its authenticated-only execute grant and admin check.
notify pgrst,'reload schema';
commit;
