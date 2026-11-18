-- GharHisab: single-project ledger. Run once in a NEW Supabase project.
begin;
create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.admin_profiles (
 id uuid primary key default gen_random_uuid(), user_id uuid not null unique references auth.users(id),
 singleton boolean not null default true unique check(singleton), created_at timestamptz not null default now()
);
create function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.admin_profiles where user_id=auth.uid())
$$;
create table public.project_settings (
 id uuid primary key default gen_random_uuid(), singleton boolean not null default true unique check(singleton),
 name text not null default 'Our home' check(length(name) between 1 and 120), description text not null default '',
 start_date date, completion_date date, stage text not null default 'Planning', completed_stages text[] not null default '{}',
 notes text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(completion_date is null or start_date is null or completion_date>=start_date),
 check(stage in ('Planning','Foundation','Plinth','Walls','Roofing','Electrical','Plumbing','Plaster','Flooring','Painting','Finishing','Completed')),
 check(completed_stages <@ array['Planning','Foundation','Plinth','Walls','Roofing','Electrical','Plumbing','Plaster','Flooring','Painting','Finishing','Completed']::text[])
);
insert into public.project_settings(name) values('Our home');
create table public.vendors (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 2 and 120),
 business text not null default '', phone text not null default '', address text not null default '', categories text not null default '',
 notes text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index vendors_name_key on public.vendors(lower(trim(name)));
create table public.materials (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 1 and 80),
 unit text not null check(length(unit) between 1 and 20), category text not null default 'Other',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index materials_identity_key on public.materials(lower(trim(name)),unit);
create table public.expenses (
 id uuid primary key default gen_random_uuid(), request_key uuid not null unique,
 title text not null check(length(trim(title)) between 3 and 180), date date not null,
 category text not null check(category in ('Materials','Contractor costs','Other')),
 material_id uuid references public.materials(id), vendor_id uuid not null references public.vendors(id),
 quantity numeric(15,3) not null check(quantity>0), rate numeric(15,2) not null check(rate>0),
 amount numeric(15,2) not null check(amount>0 and amount<=999999999),
 method text not null check(method in ('Cash','UPI','Bank Transfer','Cheque','Other')),
 description text not null default '', notes text not null default '', is_public boolean not null default true,
 version integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check((category='Materials' and material_id is not null and amount=round(quantity*rate,2)) or (category<>'Materials' and material_id is null and quantity=1))
);
create index expenses_date_idx on public.expenses(date desc);
create index expenses_vendor_idx on public.expenses(vendor_id);
create index expenses_material_idx on public.expenses(material_id);
create index expenses_category_idx on public.expenses(category,date);
create table public.material_consumption (
 id uuid primary key default gen_random_uuid(), request_key uuid not null unique,
 material_id uuid not null references public.materials(id), date date not null, quantity numeric(15,3) not null check(quantity>0),
 location text not null check(length(trim(location)) between 1 and 180), notes text not null default '',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index consumption_material_idx on public.material_consumption(material_id,date);
create table public.labour_entries (
 id uuid primary key default gen_random_uuid(), expense_id uuid not null unique references public.expenses(id) on delete cascade,
 work_type text not null default '', workers integer check(workers>0), days numeric(10,2) check(days>0),
 daily_rate numeric(15,2) check(daily_rate>0), period_end date,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.payments (
 id uuid primary key default gen_random_uuid(), request_key uuid not null unique,
 expense_id uuid not null references public.expenses(id) on delete cascade, date date not null,
 amount numeric(15,2) not null check(amount>0), method text not null check(method in ('Cash','UPI','Bank Transfer','Cheque','Other')),
 reference text not null default '', notes text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index payments_expense_idx on public.payments(expense_id,date);
create table public.contributions (
 id uuid primary key default gen_random_uuid(), request_key uuid not null unique,
 name text not null check(length(trim(name)) between 1 and 80), date date not null,
 amount numeric(15,2) not null check(amount>0 and amount<=999999999), is_public boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.receipt_metadata (
 id uuid primary key default gen_random_uuid(), expense_id uuid not null unique references public.expenses(id) on delete cascade,
 path text not null unique, name text not null, mime_type text not null check(mime_type in ('image/png','image/jpeg','image/webp')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.activity_logs (
 id uuid primary key default gen_random_uuid(), actor_id uuid references auth.users(id), table_name text not null,
 record_id uuid not null, action text not null, before_data jsonb, after_data jsonb,
 created_at timestamptz not null default now()
);
create index activity_time_idx on public.activity_logs(created_at desc);
create function private.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.activity_logs(actor_id,table_name,record_id,action,before_data,after_data)
 values(auth.uid(),tg_table_name,coalesce(new.id,old.id),tg_op,case when tg_op<>'INSERT' then to_jsonb(old) end,case when tg_op<>'DELETE' then to_jsonb(new) end);
 return coalesce(new,old);
end $$;
create function private.touch_row() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=now();return new;end $$;
-- Every write locks the same project row. This serializes stock/payment mutations,
-- including simultaneous browser tabs, without trusting the frontend.
create function private.require_admin() returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Only the project administrator can change records' using errcode='42501';end if;
 perform id from public.project_settings where singleton for update;
end $$;
create function private.validate_ledger() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.expenses e where (select coalesce(sum(p.amount),0) from public.payments p where p.expense_id=e.id)>e.amount)
 then raise exception 'Payment exceeds the invoice amount';end if;
 if exists(select 1 from public.materials m where
 (select coalesce(sum(c.quantity),0) from public.material_consumption c where c.material_id=m.id)>
 (select coalesce(sum(e.quantity),0) from public.expenses e where e.material_id=m.id))
 then raise exception 'Consumption exceeds available stock. Correct usage before reducing a purchase.';end if;
 return null;
end $$;
do $$ declare t text;begin
 foreach t in array array['admin_profiles','project_settings','vendors','materials','expenses','material_consumption','labour_entries','payments','contributions','receipt_metadata','activity_logs'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy admin_read on public.%I for select to authenticated using (public.is_admin())',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 if t not in ('admin_profiles','activity_logs') then
 execute format('create trigger audit_change after insert or update or delete on public.%I for each row execute function private.audit_change()',t);
 execute format('create trigger touch_row before update on public.%I for each row execute function private.touch_row()',t);
 end if;
 end loop;
 foreach t in array array['expenses','payments','material_consumption'] loop
 execute format('create constraint trigger ledger_integrity after insert or update or delete on public.%I deferrable initially deferred for each row execute function private.validate_ledger()',t);
 end loop;
end $$;

create function public.save_expense(p jsonb, request_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare eid uuid;vid uuid;mid uuid;old public.expenses;amt numeric;qty numeric;rt numeric;paid numeric;rid text;
begin
 perform private.require_admin();
 if nullif(p->>'id','') is null then
 select id into eid from public.expenses where request_key=request_id;
 if eid is not null then return eid;end if;
 else
 eid=(p->>'id')::uuid;select * into old from public.expenses where id=eid;
 if old.id is null then raise exception 'Expense not found';end if;
 if old.version<>coalesce((p->>'version')::integer,0) then raise exception 'This expense changed in another session. Refresh and try again.';end if;
 end if;
 select id into vid from public.vendors where lower(trim(name))=lower(trim(p->>'vendor'));
 if vid is null then insert into public.vendors(name) values(trim(p->>'vendor')) returning id into vid;end if;
 qty=case when p->>'category'='Materials' then (p->>'quantity')::numeric else 1 end;
 rt=(p->>'rate')::numeric;
 if p->>'category'='Materials' then
 select id into mid from public.materials where lower(trim(name))=lower(trim(p->>'material')) and unit=p->>'unit';
 if mid is null then insert into public.materials(name,unit,category) values(trim(p->>'material'),p->>'unit',p->>'material') returning id into mid;end if;
 amt=round(qty*rt,2);
 else amt=round(rt,2);end if;
 if eid is null then
 insert into public.expenses(request_key,title,date,category,material_id,vendor_id,quantity,rate,amount,method,description,notes,is_public)
 values(request_id,trim(p->>'title'),(p->>'date')::date,p->>'category',mid,vid,qty,rt,amt,p->>'method',coalesce(p->>'description',''),coalesce(p->>'notes',''),coalesce((p->>'is_public')::boolean,true)) returning id into eid;
 paid=coalesce((p->>'paid')::numeric,0);
 if paid<0 or paid>amt then raise exception 'Invalid initial payment';end if;
 if paid>0 then insert into public.payments(request_key,expense_id,date,amount,method) values(request_id,eid,(p->>'date')::date,paid,p->>'method');end if;
 else
 update public.expenses set title=trim(p->>'title'),date=(p->>'date')::date,category=p->>'category',material_id=mid,vendor_id=vid,quantity=qty,rate=rt,amount=amt,method=p->>'method',description=coalesce(p->>'description',''),notes=coalesce(p->>'notes',''),is_public=coalesce((p->>'is_public')::boolean,true),version=version+1 where id=eid;
 end if;
 if p->>'category'='Contractor costs' then
 insert into public.labour_entries(expense_id,work_type,workers,days,daily_rate,period_end)
 values(eid,coalesce(p->>'work_type',''),nullif(p->>'workers','')::integer,nullif(p->>'days','')::numeric,nullif(p->>'daily_rate','')::numeric,nullif(p->>'period_end','')::date)
 on conflict(expense_id) do update set work_type=excluded.work_type,workers=excluded.workers,days=excluded.days,daily_rate=excluded.daily_rate,period_end=excluded.period_end;
 else delete from public.labour_entries where expense_id=eid;end if;
 if p ? 'proof' then
 if p->'proof'='null'::jsonb then delete from public.receipt_metadata where expense_id=eid;
 else
 rid=p->'proof'->>'path';
 if split_part(rid,'/',1)<>auth.uid()::text or not exists(select 1 from storage.objects where bucket_id='receipts' and name=rid) then raise exception 'Invalid private receipt';end if;
 insert into public.receipt_metadata(expense_id,path,name,mime_type) values(eid,rid,p->'proof'->>'name',p->'proof'->>'type')
 on conflict(expense_id) do update set path=excluded.path,name=excluded.name,mime_type=excluded.mime_type;
 end if;end if;
 return eid;
end $$;
create function public.save_payment(p jsonb,request_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare pid uuid;begin
 perform private.require_admin();
 if nullif(p->>'id','') is null then
 select id into pid from public.payments where request_key=request_id;if pid is not null then return pid;end if;
 insert into public.payments(request_key,expense_id,date,amount,method,reference,notes)
 values(request_id,(p->>'expense_id')::uuid,(p->>'date')::date,(p->>'amount')::numeric,p->>'method',coalesce(p->>'reference',''),coalesce(p->>'notes','')) returning id into pid;
 else
 update public.payments set date=(p->>'date')::date,amount=(p->>'amount')::numeric,method=p->>'method',reference=coalesce(p->>'reference',''),notes=coalesce(p->>'notes','') where id=(p->>'id')::uuid and expense_id=(p->>'expense_id')::uuid returning id into pid;
 if pid is null then raise exception 'Payment not found';end if;
 end if;return pid;
end $$;
create function public.save_record(kind text,p jsonb,request_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare rid uuid;begin
 perform private.require_admin();rid=nullif(p->>'id','')::uuid;
 if kind in ('contributions','material_consumption') and rid is null then
 execute format('select id from public.%I where request_key=$1',kind) into rid using request_id;
 if rid is not null then return rid;end if;end if;
 if kind='contributions' then
 if rid is null then insert into public.contributions(request_key,name,date,amount,is_public) values(request_id,trim(p->>'name'),(p->>'date')::date,(p->>'amount')::numeric,coalesce((p->>'is_public')::boolean,true)) returning id into rid;
 else update public.contributions set name=trim(p->>'name'),date=(p->>'date')::date,amount=(p->>'amount')::numeric,is_public=coalesce((p->>'is_public')::boolean,true) where id=rid;if not found then raise exception 'Contribution not found';end if;end if;
 elsif kind='material_consumption' then
 if rid is null then insert into public.material_consumption(request_key,material_id,date,quantity,location,notes) values(request_id,(p->>'material_id')::uuid,(p->>'date')::date,(p->>'quantity')::numeric,trim(p->>'location'),coalesce(p->>'notes','')) returning id into rid;
 else update public.material_consumption set date=(p->>'date')::date,quantity=(p->>'quantity')::numeric,location=trim(p->>'location'),notes=coalesce(p->>'notes','') where id=rid and material_id=(p->>'material_id')::uuid;if not found then raise exception 'Usage not found';end if;end if;
 elsif kind='vendors' then
 if rid is null then insert into public.vendors(name,business,phone,address,categories,notes) values(trim(p->>'name'),coalesce(p->>'business',''),coalesce(p->>'phone',''),coalesce(p->>'address',''),coalesce(p->>'categories',''),coalesce(p->>'notes','')) returning id into rid;
 else update public.vendors set name=trim(p->>'name'),business=coalesce(p->>'business',''),phone=coalesce(p->>'phone',''),address=coalesce(p->>'address',''),categories=coalesce(p->>'categories',''),notes=coalesce(p->>'notes','') where id=rid;if not found then raise exception 'Vendor not found';end if;end if;
 elsif kind='materials' then
 if rid is null then insert into public.materials(name,unit,category) values(trim(p->>'name'),p->>'unit',coalesce(p->>'category','Other')) returning id into rid;
 else update public.materials set name=trim(p->>'name'),category=coalesce(p->>'category','Other') where id=rid;if not found then raise exception 'Material not found';end if;end if;
 elsif kind='project_settings' then
 update public.project_settings set name=trim(p->>'name'),description=coalesce(p->>'description',''),start_date=nullif(p->>'start_date','')::date,completion_date=nullif(p->>'completion_date','')::date,stage=p->>'stage',completed_stages=array(select jsonb_array_elements_text(coalesce(p->'completed_stages','[]'::jsonb))),notes=coalesce(p->>'notes','') where singleton returning id into rid;
 else raise exception 'Unsupported record type';end if;
 return rid;
end $$;
create function public.delete_record(kind text,record_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare affected integer;
begin
 perform private.require_admin();
 if kind not in ('expenses','payments','material_consumption','contributions','vendors','materials') then raise exception 'Unsupported record type';end if;
 execute format('delete from public.%I where id=$1',kind) using record_id;
 get diagnostics affected=row_count;
 if affected=0 then raise exception 'Record not found';end if;
end $$;

-- A deliberately narrow public projection. Base tables have no public SELECT
-- grants, so adding a new private column cannot accidentally publish it.
create function public.app_snapshot() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare a boolean=public.is_admin();result jsonb;begin
 select jsonb_build_object(
 'admin',a,
 'project',(select (to_jsonb(s)-'notes')||case when a then jsonb_build_object('notes',s.notes) else '{}'::jsonb end from public.project_settings s where singleton),
 'expenses',coalesce((select jsonb_agg(jsonb_build_object(
 'id',e.id,'version',e.version,'date',e.date,'title',e.title,'category',e.category,'material',coalesce(m.name,''),'materialId',m.id,'unit',coalesce(m.unit,'contract'),'quantity',e.quantity,'rate',e.rate,'amount',e.amount,'paid',(select coalesce(sum(p.amount),0) from public.payments p where p.expense_id=e.id),'vendor',v.name,'vendorId',v.id,'method',e.method,'description',e.description,'created_at',e.created_at,'is_public',e.is_public
 )||case when a then jsonb_build_object('notes',e.notes,'proof',(select jsonb_build_object('name',r.name,'type',r.mime_type,'path',r.path,'url','') from public.receipt_metadata r where r.expense_id=e.id),'labour',(select to_jsonb(l)-'id'-'expense_id' from public.labour_entries l where l.expense_id=e.id)) else '{}'::jsonb end order by e.date desc,e.created_at desc)
 from public.expenses e left join public.materials m on m.id=e.material_id join public.vendors v on v.id=e.vendor_id where a or e.is_public),'[]'::jsonb),
 'vendors',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'name',v.name,'business',v.business,'categories',v.categories)||case when a then jsonb_build_object('phone',v.phone,'address',v.address,'notes',v.notes) else '{}'::jsonb end) from public.vendors v where a or exists(select 1 from public.expenses e where e.vendor_id=v.id and e.is_public)),'[]'::jsonb),
 'materials',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'name',m.name,'unit',m.unit,'category',m.category,'partial',not a and exists(select 1 from public.expenses e where e.material_id=m.id and not e.is_public))) from public.materials m),'[]'::jsonb),
 'consumption',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'material_id',c.material_id,'date',c.date,'quantity',c.quantity,'location',c.location)||case when a then jsonb_build_object('notes',c.notes) else '{}'::jsonb end order by c.date desc) from public.material_consumption c where a or not exists(select 1 from public.expenses e where e.material_id=c.material_id and not e.is_public)),'[]'::jsonb),
 'contributions',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'date',c.date,'amount',c.amount,'is_public',c.is_public) order by c.date desc) from public.contributions c where a or c.is_public),'[]'::jsonb),
 'payments',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'expense_id',p.expense_id,'date',p.date,'amount',p.amount,'method',p.method)||case when a then jsonb_build_object('reference',p.reference,'notes',p.notes) else '{}'::jsonb end order by p.date desc) from public.payments p join public.expenses e on e.id=p.expense_id where a or e.is_public),'[]'::jsonb),
 'activity',case when a then coalesce((select jsonb_agg(to_jsonb(l) order by l.created_at desc) from (select * from public.activity_logs order by created_at desc limit 100) l),'[]'::jsonb) else '[]'::jsonb end
 ) into result;return result;
end $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('receipts','receipts',false,5242880,array['image/jpeg','image/png','image/webp'])
 on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy receipts_admin_select on storage.objects for select to authenticated using(bucket_id='receipts' and public.is_admin());
create policy receipts_admin_insert on storage.objects for insert to authenticated with check(bucket_id='receipts' and public.is_admin() and (storage.foldername(name))[1]=auth.uid()::text);
create policy receipts_admin_delete on storage.objects for delete to authenticated using(bucket_id='receipts' and public.is_admin());
-- No update policy: replacements get a new immutable object name.
revoke all on all functions in schema private from public,anon,authenticated;
revoke all on function public.is_admin(),public.app_snapshot(),public.save_expense(jsonb,uuid),public.save_payment(jsonb,uuid),public.save_record(text,jsonb,uuid),public.delete_record(text,uuid) from public,anon,authenticated;
grant execute on function public.is_admin(),public.app_snapshot() to anon,authenticated;
grant execute on function public.save_expense(jsonb,uuid),public.save_payment(jsonb,uuid),public.save_record(text,jsonb,uuid),public.delete_record(text,uuid) to authenticated;
commit;
