-- Run AFTER 202611170001_core.sql. Preserves existing invoices and payments.
-- One expense remains one invoice; material lines never create extra expenses.
begin;
create table public.expense_items (
 id uuid primary key default gen_random_uuid(),
 expense_id uuid not null references public.expenses(id) on delete cascade,
 material_id uuid not null references public.materials(id),
 position integer not null check(position between 1 and 50),
 quantity numeric(15,3) not null check(quantity>0),
 rate numeric(15,2) not null check(rate>0),
 amount numeric(15,2) generated always as (round(quantity*rate,2)) stored check(amount>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(expense_id,position)
);
create index expense_items_material_idx on public.expense_items(material_id);
alter table public.expense_items enable row level security;
create policy admin_read on public.expense_items for select to authenticated using(public.is_admin());
revoke all on public.expense_items from public,anon,authenticated;
insert into public.expense_items(expense_id,material_id,position,quantity,rate,created_at,updated_at)
 select id,material_id,1,quantity,rate,created_at,updated_at from public.expenses where category='Materials';
alter table public.expenses drop constraint expenses_check;
alter table public.expenses add constraint expenses_purchase_shape check(
 (category='Materials' and ((material_id is not null and amount=round(quantity*rate,2)) or (material_id is null and quantity=1 and rate=amount)))
 or (category<>'Materials' and material_id is null and quantity=1)
);
create trigger audit_change after insert or update or delete on public.expense_items for each row execute function private.audit_change();
create trigger touch_row before update on public.expense_items for each row execute function private.touch_row();
create or replace function private.validate_ledger() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.expenses e where (select coalesce(sum(p.amount),0) from public.payments p where p.expense_id=e.id)>e.amount)
 then raise exception 'Payment exceeds the invoice amount';end if;
 if exists(select 1 from public.expenses e where
 (e.category='Materials' and (not exists(select 1 from public.expense_items i where i.expense_id=e.id) or e.amount<>(select coalesce(sum(i.amount),0) from public.expense_items i where i.expense_id=e.id)))
 or (e.category<>'Materials' and exists(select 1 from public.expense_items i where i.expense_id=e.id)))
 then raise exception 'Invoice total must equal its material line totals';end if;
 if exists(select 1 from public.materials m where
 (select coalesce(sum(c.quantity),0) from public.material_consumption c where c.material_id=m.id)>
 (select coalesce(sum(i.quantity),0) from public.expense_items i where i.material_id=m.id))
 then raise exception 'Consumption exceeds available stock. Correct usage before reducing a purchase.';end if;
 return null;
end $$;
create constraint trigger ledger_integrity after insert or update or delete on public.expense_items deferrable initially deferred for each row execute function private.validate_ledger();

create or replace function public.save_expense(p jsonb,request_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare eid uuid;vid uuid;mid uuid;old public.expenses;amt numeric;qty numeric;rt numeric;paid numeric;
 lines jsonb;line jsonb;resolved jsonb='[]';pos integer=0;rid text;
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
 if p->>'category'='Materials' then
 -- Old application versions remain compatible with single-line invoices.
 lines=case when p ? 'items' then p->'items' else jsonb_build_array(jsonb_build_object('material',p->>'material','unit',p->>'unit','quantity',p->'quantity','rate',p->'rate')) end;
 if jsonb_typeof(lines)<>'array' then raise exception 'Materials must be a list';end if;
 if jsonb_array_length(lines)<1 or jsonb_array_length(lines)>50 then raise exception 'Select between 1 and 50 materials';end if;
 amt=0;
 for line in select value from jsonb_array_elements(lines) loop
 qty=(line->>'quantity')::numeric;rt=(line->>'rate')::numeric;
 if qty is null or rt is null or qty<=0 or rt<=0 or qty<>round(qty,3) or rt<>round(rt,2) then raise exception 'Each material needs a positive quantity (up to 3 decimals) and rate (up to 2 decimals)';end if;
 mid=null;
 select id into mid from public.materials where lower(trim(name))=lower(trim(line->>'material')) and unit=line->>'unit';
 if mid is null then insert into public.materials(name,unit,category) values(trim(line->>'material'),line->>'unit',trim(line->>'material')) returning id into mid;end if;
 pos=pos+1;amt=amt+round(qty*rt,2);
 resolved=resolved||jsonb_build_array(jsonb_build_object('material_id',mid,'quantity',qty,'rate',rt,'position',pos));
 end loop;
 if pos=1 then mid=(resolved->0->>'material_id')::uuid;qty=(resolved->0->>'quantity')::numeric;rt=(resolved->0->>'rate')::numeric;
 else mid=null;qty=1;rt=amt;end if;
 else amt=round((p->>'rate')::numeric,2);mid=null;qty=1;rt=amt;end if;
 if eid is null then
 insert into public.expenses(request_key,title,date,category,material_id,vendor_id,quantity,rate,amount,method,description,notes,is_public)
 values(request_id,trim(p->>'title'),(p->>'date')::date,p->>'category',mid,vid,qty,rt,amt,p->>'method',coalesce(p->>'description',''),coalesce(p->>'notes',''),coalesce((p->>'is_public')::boolean,true)) returning id into eid;
 paid=coalesce((p->>'paid')::numeric,0);
 if paid<0 or paid>amt then raise exception 'Invalid initial payment';end if;
 if paid>0 then insert into public.payments(request_key,expense_id,date,amount,method) values(request_id,eid,(p->>'date')::date,paid,p->>'method');end if;
 else
 update public.expenses set title=trim(p->>'title'),date=(p->>'date')::date,category=p->>'category',material_id=mid,vendor_id=vid,quantity=qty,rate=rt,amount=amt,method=p->>'method',description=coalesce(p->>'description',''),notes=coalesce(p->>'notes',''),is_public=coalesce((p->>'is_public')::boolean,true),version=version+1 where id=eid;
 end if;
 delete from public.expense_items where expense_id=eid;
 for line in select value from jsonb_array_elements(resolved) loop
 insert into public.expense_items(expense_id,material_id,position,quantity,rate)
 values(eid,(line->>'material_id')::uuid,(line->>'position')::integer,(line->>'quantity')::numeric,(line->>'rate')::numeric);
 end loop;
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

-- Preserve the original privacy projection; augment it with explicit safe lines.
alter function public.app_snapshot() rename to app_snapshot_v1;
alter function public.app_snapshot_v1() set schema private;
revoke all on function private.app_snapshot_v1() from public,anon,authenticated;
create function public.app_snapshot() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare base jsonb;rows jsonb; a boolean=public.is_admin();begin
 base=private.app_snapshot_v1();
 select coalesce(jsonb_agg(r.value||jsonb_build_object(
 'items',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'materialId',i.material_id,'material',m.name,'unit',m.unit,'quantity',i.quantity,'rate',i.rate,'amount',i.amount) order by i.position) from public.expense_items i join public.materials m on m.id=i.material_id where i.expense_id=(r.value->>'id')::uuid),'[]'::jsonb),
 'material',case when r.value->>'category'='Materials' then coalesce((select string_agg(m.name,', ' order by i.position) from public.expense_items i join public.materials m on m.id=i.material_id where i.expense_id=(r.value->>'id')::uuid),'') else '' end,
 'unit',case when (select count(*) from public.expense_items i where i.expense_id=(r.value->>'id')::uuid)>1 then 'materials' else r.value->>'unit' end,
 'quantity',case when (select count(*) from public.expense_items i where i.expense_id=(r.value->>'id')::uuid)>1 then (select count(*) from public.expense_items i where i.expense_id=(r.value->>'id')::uuid) else (r.value->>'quantity')::numeric end
 ) order by r.ordinality),'[]'::jsonb) into rows from jsonb_array_elements(base->'expenses') with ordinality r(value,ordinality);
 base=jsonb_set(base,'{expenses}',rows);
 base=jsonb_set(base,'{materials}',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'name',m.name,'unit',m.unit,'category',m.category,'partial',not a and exists(select 1 from public.expense_items i join public.expenses e on e.id=i.expense_id where i.material_id=m.id and not e.is_public))) from public.materials m),'[]'::jsonb));
 base=jsonb_set(base,'{consumption}',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'material_id',c.material_id,'date',c.date,'quantity',c.quantity,'location',c.location)||case when a then jsonb_build_object('notes',c.notes) else '{}'::jsonb end order by c.date desc) from public.material_consumption c where a or not exists(select 1 from public.expense_items i join public.expenses e on e.id=i.expense_id where i.material_id=c.material_id and not e.is_public)),'[]'::jsonb));
 return base||jsonb_build_object('schemaVersion',2);
end $$;
revoke all on function public.app_snapshot() from public,anon,authenticated;
grant execute on function public.app_snapshot() to anon,authenticated;
-- CREATE OR REPLACE retains save_expense's existing restricted grants.
notify pgrst,'reload schema';
commit;
