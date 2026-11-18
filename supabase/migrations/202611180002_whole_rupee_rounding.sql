-- Whole-rupee material pricing. Run AFTER 202611180001_material_lines.sql.
-- Existing prices remain exact unless explicitly rounded when editing.
-- The guarded repair below corrects ONLY the invoice shown in the reported
-- screenshot, and only if its amounts and payment total still match exactly.
begin;
alter table public.expense_items add column round_to_rupee boolean not null default false;
alter table public.expense_items alter column amount drop expression;
create function private.price_material_line() returns trigger language plpgsql set search_path='' as $$
begin
 new.amount=round(new.quantity*new.rate,case when new.round_to_rupee then 0 else 2 end);
 return new;
end $$;
create trigger price_material_line before insert or update on public.expense_items for each row execute function private.price_material_line();
alter table public.expense_items add constraint material_line_price_matches check(amount=round(quantity*rate,case when round_to_rupee then 0 else 2 end));
alter table public.expenses drop constraint expenses_purchase_shape;
alter table public.expenses add constraint expenses_purchase_shape check(
 (category='Materials' and (material_id is not null or (quantity=1 and rate=amount)))
 or (category<>'Materials' and material_id is null and quantity=1)
);
revoke all on function private.price_material_line() from public,anon,authenticated;
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
 pos=pos+1;amt=amt+round(qty*rt,case when coalesce((line->>'roundToRupee')::boolean,false) then 0 else 2 end);
 resolved=resolved||jsonb_build_array(jsonb_build_object('material_id',mid,'quantity',qty,'rate',rt,'position',pos,'round_to_rupee',coalesce((line->>'roundToRupee')::boolean,false)));
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
 insert into public.expense_items(expense_id,material_id,position,quantity,rate,round_to_rupee)
 values(eid,(line->>'material_id')::uuid,(line->>'position')::integer,(line->>'quantity')::numeric,(line->>'rate')::numeric,(line->>'round_to_rupee')::boolean);
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

create or replace function public.app_snapshot() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare base jsonb;rows jsonb; a boolean=public.is_admin();begin
 base=private.app_snapshot_v1();
 select coalesce(jsonb_agg(r.value||jsonb_build_object(
 'items',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'materialId',i.material_id,'material',m.name,'unit',m.unit,'quantity',i.quantity,'rate',i.rate,'amount',i.amount,'roundToRupee',i.round_to_rupee) order by i.position) from public.expense_items i join public.materials m on m.id=i.material_id where i.expense_id=(r.value->>'id')::uuid),'[]'::jsonb),
 'material',case when r.value->>'category'='Materials' then coalesce((select string_agg(m.name,', ' order by i.position) from public.expense_items i join public.materials m on m.id=i.material_id where i.expense_id=(r.value->>'id')::uuid),'') else '' end,
 'unit',case when (select count(*) from public.expense_items i where i.expense_id=(r.value->>'id')::uuid)>1 then 'materials' else r.value->>'unit' end,
 'quantity',case when (select count(*) from public.expense_items i where i.expense_id=(r.value->>'id')::uuid)>1 then (select count(*) from public.expense_items i where i.expense_id=(r.value->>'id')::uuid) else (r.value->>'quantity')::numeric end
 ) order by r.ordinality),'[]'::jsonb) into rows from jsonb_array_elements(base->'expenses') with ordinality r(value,ordinality);
 base=jsonb_set(base,'{expenses}',rows);
 base=jsonb_set(base,'{materials}',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'name',m.name,'unit',m.unit,'category',m.category,'partial',not a and exists(select 1 from public.expense_items i join public.expenses e on e.id=i.expense_id where i.material_id=m.id and not e.is_public))) from public.materials m),'[]'::jsonb));
 base=jsonb_set(base,'{consumption}',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'material_id',c.material_id,'date',c.date,'quantity',c.quantity,'location',c.location)||case when a then jsonb_build_object('notes',c.notes) else '{}'::jsonb end order by c.date desc) from public.material_consumption c where a or not exists(select 1 from public.expense_items i join public.expenses e on e.id=i.expense_id where i.material_id=c.material_id and not e.is_public)),'[]'::jsonb));
 return base||jsonb_build_object('schemaVersion',2,'wholeRupeeRounding',true);
end $$;
revoke all on function public.app_snapshot() from public,anon,authenticated;
grant execute on function public.app_snapshot() to anon,authenticated;
-- Do not alter other invoices or invent a payment for the missing paise.
do $$declare target uuid='f67f6bf1-4bff-4c78-991d-e329117aba93';begin
 perform id from public.project_settings where singleton for update;
 if exists(select 1 from public.expenses e where e.id=target and e.category='Materials' and e.amount=9790.01
   and (select coalesce(sum(p.amount),0) from public.payments p where p.expense_id=e.id)=9790
   and (select count(*) from public.expense_items i where i.expense_id=e.id)=1
   and exists(select 1 from public.expense_items i where i.expense_id=e.id and i.quantity=1.5 and i.rate=6526.67 and i.amount=9790.01)) then
  update public.expense_items set round_to_rupee=true where expense_id=target;
  update public.expenses set amount=(select sum(i.amount) from public.expense_items i where i.expense_id=target),version=version+1 where id=target;
 end if;
end $$;
notify pgrst,'reload schema';
commit;
