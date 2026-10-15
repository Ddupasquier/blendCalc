-- Additive, account-owned relationships. List rows are deliberately not targets.
create table public.user_shared_product_favorites (
 user_id uuid not null references auth.users(id) on delete cascade,
 product_id uuid not null references public.shared_products(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key (user_id, product_id)
);
create table public.user_generic_food_favorites (
 user_id uuid not null references auth.users(id) on delete cascade,
 dataset_key text not null,
 source_food_key text not null,
 created_at timestamptz not null default now(),
 primary key (user_id, dataset_key, source_food_key),
 foreign key (dataset_key, source_food_key) references public.generic_food_records(dataset_key, source_food_key) on delete cascade
);
alter table public.custom_foods add constraint custom_foods_favorite_owner_key unique (id, user_id);
alter table public.saved_drinks add constraint saved_drinks_favorite_owner_key unique (id, user_id);
create table public.user_custom_food_favorites (
 user_id uuid not null references auth.users(id) on delete cascade,
 custom_food_id uuid not null,
 created_at timestamptz not null default now(),
 primary key (user_id, custom_food_id),
 foreign key (custom_food_id, user_id) references public.custom_foods(id, user_id) on delete cascade
);
create table public.user_saved_recipe_favorites (
 user_id uuid not null references auth.users(id) on delete cascade,
 recipe_id uuid not null,
 created_at timestamptz not null default now(),
 primary key (user_id, recipe_id),
 foreign key (recipe_id, user_id) references public.saved_drinks(id, user_id) on delete cascade
);
create index shared_products_favorite_application_id_idx on public.shared_products ((food->>'fdcId')) where status = 'active';
create index user_shared_product_favorites_target_idx on public.user_shared_product_favorites(product_id);
create index user_generic_food_favorites_target_idx on public.user_generic_food_favorites(dataset_key, source_food_key);
create index user_custom_food_favorites_target_idx on public.user_custom_food_favorites(custom_food_id, user_id);
create index user_saved_recipe_favorites_target_idx on public.user_saved_recipe_favorites(recipe_id, user_id);

alter table public.user_shared_product_favorites enable row level security;
alter table public.user_generic_food_favorites enable row level security;
alter table public.user_custom_food_favorites enable row level security;
alter table public.user_saved_recipe_favorites enable row level security;
create policy own_active_product_favorites on public.user_shared_product_favorites for select to authenticated using (
 user_id = auth.uid() and exists (select 1 from public.shared_products p where p.id = product_id and p.status = 'active')
);
create policy own_generic_food_favorites on public.user_generic_food_favorites for select to authenticated using (user_id = auth.uid() and exists (select 1 from public.generic_food_datasets d where d.key=dataset_key and d.active and d.import_enabled));
create policy own_custom_food_favorites on public.user_custom_food_favorites for select to authenticated using (user_id = auth.uid());
create policy own_saved_recipe_favorites on public.user_saved_recipe_favorites for select to authenticated using (user_id = auth.uid());
revoke all on public.user_shared_product_favorites, public.user_generic_food_favorites, public.user_custom_food_favorites, public.user_saved_recipe_favorites from public, anon, authenticated;
grant select on public.user_shared_product_favorites, public.user_generic_food_favorites, public.user_custom_food_favorites, public.user_saved_recipe_favorites to authenticated;
grant all on public.user_shared_product_favorites, public.user_generic_food_favorites, public.user_custom_food_favorites, public.user_saved_recipe_favorites to service_role;

create function public.resolve_user_favorite_food(p_food_id bigint)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_target jsonb;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
 select jsonb_build_object('kind','custom','id',c.id,'favorite',exists(select 1 from public.user_custom_food_favorites f where f.user_id=auth.uid() and f.custom_food_id=c.id))
 into v_target from public.custom_foods c where c.user_id=auth.uid() and c.fdc_id=p_food_id;
 if v_target is not null then return v_target; end if;
 select jsonb_build_object('kind','shared','id',p.id,'favorite',exists(select 1 from public.user_shared_product_favorites f where f.user_id=auth.uid() and f.product_id=p.id))
 into v_target from public.shared_products p where p.status='active' and p.food->>'fdcId'=p_food_id::text;
 if v_target is not null then return v_target; end if;
 select jsonb_build_object('kind','generic','dataset',g.dataset_key,'id',g.source_food_key,'favorite',exists(select 1 from public.user_generic_food_favorites f where f.user_id=auth.uid() and f.dataset_key=g.dataset_key and f.source_food_key=g.source_food_key))
 into v_target from public.generic_food_records g join public.generic_food_datasets d on d.key=g.dataset_key where g.application_food_id=p_food_id and d.active and d.import_enabled;
 return v_target;
end $$;

create function public.set_user_favorite(p_kind text, p_target_id text, p_favorite boolean)
returns text language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_target jsonb;
begin
 if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
 if p_favorite is null or p_target_id is null or length(p_target_id)>80 then raise exception 'Invalid favorite' using errcode='22023'; end if;
 if p_kind='recipe' and p_target_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
  perform 1 from public.saved_drinks where id=p_target_id::uuid and user_id=v_user for key share;
  if not found then return 'unavailable'; end if;
  if p_favorite then insert into public.user_saved_recipe_favorites(user_id,recipe_id) values(v_user,p_target_id::uuid) on conflict do nothing;
  else delete from public.user_saved_recipe_favorites where user_id=v_user and recipe_id=p_target_id::uuid; end if;
 elsif p_kind='food' and p_target_id ~ '^-?[0-9]{1,16}$' then
  v_target := public.resolve_user_favorite_food(p_target_id::bigint);
  if v_target is null then return 'unavailable'; end if;
  case v_target->>'kind'
  when 'custom' then
   if p_favorite then insert into public.user_custom_food_favorites(user_id,custom_food_id) values(v_user,(v_target->>'id')::uuid) on conflict do nothing;
   else delete from public.user_custom_food_favorites where user_id=v_user and custom_food_id=(v_target->>'id')::uuid; end if;
  when 'shared' then
   if p_favorite then insert into public.user_shared_product_favorites(user_id,product_id) values(v_user,(v_target->>'id')::uuid) on conflict do nothing;
   else delete from public.user_shared_product_favorites where user_id=v_user and product_id=(v_target->>'id')::uuid; end if;
  when 'generic' then
   if p_favorite then insert into public.user_generic_food_favorites(user_id,dataset_key,source_food_key) values(v_user,v_target->>'dataset',v_target->>'id') on conflict do nothing;
   else delete from public.user_generic_food_favorites where user_id=v_user and dataset_key=v_target->>'dataset' and source_food_key=v_target->>'id'; end if;
  end case;
 else raise exception 'Invalid favorite target' using errcode='22023'; end if;
 return 'saved';
end $$;

create function public.read_user_food_favorite_states(p_food_ids bigint[])
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if cardinality(p_food_ids)>100 then raise exception 'Too many foods' using errcode='22023'; end if;
 return coalesce((select jsonb_object_agg(id::text,public.resolve_user_favorite_food(id)) from unnest(p_food_ids) id),'{}'::jsonb);
end $$;

create function public.read_user_favorite_food_page(p_query text default '', p_sort text default 'recent', p_limit integer default 15, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_limit is null or p_offset is null or p_query is null or p_sort is null or p_limit not between 1 and 100 or p_offset<0 or length(p_query)>120 or p_sort not in ('recent','oldest','name-asc','name-desc') then raise exception 'Invalid page' using errcode='22023'; end if;
 with targets as (
  select (p.food->>'fdcId')::bigint food_id,p.product_name name,f.created_at from public.user_shared_product_favorites f join public.shared_products p on p.id=f.product_id where f.user_id=auth.uid() and p.status='active'
  union all select g.application_food_id,g.description,f.created_at from public.user_generic_food_favorites f join public.generic_food_records g using(dataset_key,source_food_key) join public.generic_food_datasets d on d.key=g.dataset_key where f.user_id=auth.uid() and d.active and d.import_enabled
  union all select c.fdc_id,c.food->>'description',f.created_at from public.user_custom_food_favorites f join public.custom_foods c on c.id=f.custom_food_id and c.user_id=f.user_id where f.user_id=auth.uid()
 ), matching as materialized (select * from targets where position(lower(btrim(p_query)) in lower(name))>0), paged as (
  select * from matching order by
   case when p_sort='name-asc' then lower(name) end asc,
   case when p_sort='name-desc' then lower(name) end desc,
   case when p_sort='oldest' then created_at end asc,
   case when p_sort='recent' then created_at end desc,food_id asc
  limit p_limit offset p_offset
 ) select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(paged)) from paged),'[]'::jsonb),'totalCount',(select count(*) from matching)) into v_result;
 return v_result;
end $$;

revoke all on function public.resolve_user_favorite_food(bigint), public.set_user_favorite(text,text,boolean), public.read_user_food_favorite_states(bigint[]), public.read_user_favorite_food_page(text,text,integer,integer) from public, anon, authenticated;
grant execute on function public.set_user_favorite(text,text,boolean), public.read_user_food_favorite_states(bigint[]), public.read_user_favorite_food_page(text,text,integer,integer) to authenticated;
