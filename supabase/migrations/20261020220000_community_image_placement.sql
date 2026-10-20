-- Personal crops never mutate shared assets. Shared geometry is published only by
-- bounded consensus or an authenticated moderator, with reversible history.
alter table public.food_image_assets
  add column placement_revision bigint not null default 0 check (placement_revision >= 0),
  add column community_placement_locked boolean not null default false,
  add column community_placement_anchor jsonb check (community_placement_anchor is null or jsonb_typeof(community_placement_anchor)='object');

create table public.food_image_placement_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  image_id uuid not null references public.food_image_assets(id) on delete cascade,
  image_url text not null,
  placement jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, image_id)
);
create table public.food_image_placement_suggestions (
  id uuid primary key default gen_random_uuid(),
  image_id uuid not null references public.food_image_assets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  base_revision bigint not null,
  placement jsonb not null,
  status text not null default 'pending' check (status in ('pending','published','rejected','stale')),
  created_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text check (length(review_note) <= 1000),
  unique (image_id, user_id, base_revision)
);
create index food_image_placement_preferences_image_idx on public.food_image_placement_preferences(image_id);
create index food_image_placement_suggestions_user_created_idx
  on public.food_image_placement_suggestions(user_id, created_at desc);
create index food_image_placement_suggestions_pending_idx
  on public.food_image_placement_suggestions(image_id, base_revision, created_at)
  where status = 'pending';
create index food_image_placement_suggestions_reviewer_idx on public.food_image_placement_suggestions(reviewed_by) where reviewed_by is not null;
create index food_image_placement_eligible_history_idx on public.shared_product_submissions(submitted_by,barcode)
  where status='approved' and reviewed_by is not null;
create table public.food_image_placement_contributors (
  user_id uuid primary key references auth.users(id) on delete cascade,
  trusted boolean not null default false,
  restricted boolean not null default false,
  reviewed_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
create table public.food_image_placement_policy (
  singleton boolean primary key default true check (singleton),
  automation_enabled boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.food_image_placement_policy(singleton) values (true);
create table public.food_image_placement_history (
  id uuid primary key default gen_random_uuid(),
  image_id uuid not null references public.food_image_assets(id) on delete cascade,
  revision bigint not null,
  image_url text not null,
  previous_placement jsonb not null,
  next_placement jsonb not null,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(image_id, revision)
);
create index food_image_placement_history_actor_idx on public.food_image_placement_history(actor_id) where actor_id is not null;
create index food_image_placement_contributors_reviewer_idx on public.food_image_placement_contributors(reviewed_by) where reviewed_by is not null;

-- Canonical input drops provenance supplied by a browser. A suggestion is manual
-- geometry, not OCR verification, moderator approval or a new image upload.
create function private.normalize_food_image_placement(p jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare x numeric; y numeric; z numeric; r numeric;
begin
  if p is null or jsonb_typeof(p) <> 'object'
    or jsonb_typeof(p->'cropX') is distinct from 'number'
    or jsonb_typeof(p->'cropY') is distinct from 'number'
    or jsonb_typeof(p->'cropZoom') is distinct from 'number'
    or jsonb_typeof(p->'rotationDegrees') is distinct from 'number'
    or coalesce(p->>'fitMode','') not in ('contain','cover','custom') then
    raise exception 'Invalid image placement' using errcode = '22023';
  end if;
  x := (p->>'cropX')::numeric; y := (p->>'cropY')::numeric;
  z := (p->>'cropZoom')::numeric; r := (p->>'rotationDegrees')::numeric;
  if x not between 50 and 100 or y not between 0 and 100
    or z not between 1 and 8 or r not in (0,90,180,270) then
    raise exception 'Invalid image placement' using errcode = '22023';
  end if;
  return jsonb_build_object('cropX',x,'cropY',y,'cropZoom',z,
    'rotationDegrees',r,'fitMode',p->>'fitMode','placementVersion',2,'placementMethod','manual');
end $$;
create function private.food_image_placement_value(a public.food_image_assets) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('cropX',a.crop_x,'cropY',a.crop_y,'cropZoom',a.crop_zoom,
    'rotationDegrees',a.rotation_degrees,'fitMode',a.fit_mode,
    'placementVersion',a.placement_version,'placementMethod',a.placement_method);
$$;
create function private.assert_food_image_placement_user() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare u uuid := auth.uid();
begin
  if u is null or not exists(select 1 from auth.users where id=u
    and (banned_until is null or banned_until <= now()))
    or exists(select 1 from public.account_moderation where user_id=u
      and (status='banned' or (status='suspended' and expires_at>now()))) then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  return u;
end $$;
create function private.assert_food_image_placement_moderator() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare u uuid := private.assert_food_image_placement_user();
begin
  if not public.authorize_app_permission('moderation.catalog.review')
    or not exists(select 1 from public.app_role_assignments where user_id=u
      and role in ('moderator','admin','developer')) then
    raise exception 'Moderator verification required' using errcode='42501';
  end if;
  return u;
end $$;
create function private.food_image_placement_contributor_eligible(u uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from auth.users a
    left join public.food_image_placement_contributors c on c.user_id=a.id
    where a.id=u and a.email_confirmed_at is not null
      and (a.banned_until is null or a.banned_until <= now())
      and not coalesce(c.restricted,false)
      and not exists(select 1 from public.account_moderation m where m.user_id=u
        and (m.status='banned' or (m.status='suspended' and m.expires_at>now())))
      and (coalesce(c.trusted,false) or (a.created_at <= now()-interval '30 days'
        and (select count(distinct s.barcode) from public.shared_product_submissions s
          where s.submitted_by=u and s.status='approved' and s.reviewed_by is not null) >= 3)));
$$;

-- Every geometry, replacement, retirement or lock change invalidates old proposals.
-- This also covers the pre-existing moderator PATCH and provider update paths.
create function private.record_food_image_placement_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.image_url is distinct from old.image_url then new.community_placement_anchor := null; end if;
  if row(new.crop_x,new.crop_y,new.crop_zoom,new.rotation_degrees,new.fit_mode,
    new.placement_version,new.image_url,new.thumbnail_url,new.storage_path,new.status,new.community_placement_locked,
    new.crop_source,new.placement_method,new.approved_at,new.community_placement_anchor)
    is distinct from row(old.crop_x,old.crop_y,old.crop_zoom,old.rotation_degrees,old.fit_mode,
    old.placement_version,old.image_url,old.thumbnail_url,old.storage_path,old.status,old.community_placement_locked,
    old.crop_source,old.placement_method,old.approved_at,old.community_placement_anchor) then
    new.placement_revision := old.placement_revision+1;
    insert into public.food_image_placement_history(image_id,revision,image_url,
      previous_placement,next_placement,actor_id)
    values(old.id,new.placement_revision,old.image_url,
      private.food_image_placement_value(old),private.food_image_placement_value(new),
      auth.uid());
    update public.food_image_placement_suggestions set status='stale'
      where image_id=old.id and status='pending';
  else
    new.placement_revision := old.placement_revision;
  end if;
  return new;
end $$;
create trigger record_food_image_placement_change before update on public.food_image_assets
  for each row execute function private.record_food_image_placement_change();

create function public.save_food_image_placement(
  p_image_id uuid, p_image_url text, p_action text, p_placement jsonb default null,
  p_base_revision bigint default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  u uuid := private.assert_food_image_placement_user();
  a public.food_image_assets; v jsonb; prior public.food_image_placement_suggestions;
  enabled boolean; eligible_count integer; competing boolean; result_status text := 'pending';
begin
  if p_action not in ('personal','reset','suggest') or p_action is null then
    raise exception 'Invalid placement action' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('food-image-placement:'||u::text,0));
  delete from public.food_image_placement_preferences p where p.user_id=u
    and not exists(select 1 from public.food_image_assets image
      where image.id=p.image_id and image.status='active' and image.image_url=p.image_url);
  if p_action='suggest' then
    select automation_enabled into enabled from public.food_image_placement_policy where singleton for share;
    select * into a from public.food_image_assets where id=p_image_id and status='active' for update;
  else
    -- Personal saves share a read lock instead of serializing every account's
    -- private adjustment behind an exclusive lock on the same popular image.
    select * into a from public.food_image_assets where id=p_image_id and status='active' for share;
  end if;
  if not found then raise exception 'Image not found' using errcode='P0002'; end if;
  if a.image_url is distinct from p_image_url then return jsonb_build_object('status','stale'); end if;
  if p_action='reset' then
    delete from public.food_image_placement_preferences where user_id=u and image_id=a.id;
    return jsonb_build_object('status','personal_reset','placement',private.food_image_placement_value(a),
      'sharedPlacement',private.food_image_placement_value(a),'revision',a.placement_revision,'locked',a.community_placement_locked);
  end if;
  v := private.normalize_food_image_placement(p_placement);
  if p_action='personal' then
    if not exists(select 1 from public.food_image_placement_preferences where user_id=u and image_id=a.id)
      and (select count(*) from public.food_image_placement_preferences where user_id=u)>=2000 then
      return jsonb_build_object('status','limit_reached');
    end if;
    insert into public.food_image_placement_preferences(user_id,image_id,image_url,placement)
    values(u,a.id,a.image_url,v) on conflict(user_id,image_id) do update
      set image_url=excluded.image_url,placement=excluded.placement,updated_at=now();
    return jsonb_build_object('status','personal_saved','placement',v,'sharedPlacement',private.food_image_placement_value(a),
      'revision',a.placement_revision,'locked',a.community_placement_locked);
  end if;
  if exists(select 1 from public.food_image_placement_contributors where user_id=u and restricted) then
    return jsonb_build_object('status','restricted');
  end if;
  if p_base_revision is distinct from a.placement_revision then return jsonb_build_object('status','stale'); end if;
  if a.community_placement_locked then return jsonb_build_object('status','locked'); end if;
  -- Deterministic, bounded grouping: two position points and .05 zoom per bucket.
  v := jsonb_set(jsonb_set(jsonb_set(v,'{cropX}',to_jsonb(round((v->>'cropX')::numeric/2)*2)),
    '{cropY}',to_jsonb(round((v->>'cropY')::numeric/2)*2)),
    '{cropZoom}',to_jsonb(round((v->>'cropZoom')::numeric*20)/20));
  if (v->>'cropX')::numeric=a.crop_x and (v->>'cropY')::numeric=a.crop_y
    and (v->>'cropZoom')::numeric=a.crop_zoom and (v->>'rotationDegrees')::integer=a.rotation_degrees
    and v->>'fitMode'=a.fit_mode and a.placement_version=2 then
    return jsonb_build_object('status','unchanged');
  end if;
  select * into prior from public.food_image_placement_suggestions
    where image_id=a.id and user_id=u and base_revision=a.placement_revision;
  if found then return jsonb_build_object('status','already_submitted','outcome',prior.status); end if;
  if (select count(*) from public.food_image_placement_suggestions where user_id=u and status='pending')>=5
    or (select count(*) from public.food_image_placement_suggestions where user_id=u and created_at>now()-interval '1 day')>=5
    or (select count(*) from public.food_image_placement_suggestions where image_id=a.id and status='pending')>=200 then
    return jsonb_build_object('status','limit_reached');
  end if;
  insert into public.food_image_placement_suggestions(image_id,user_id,base_revision,placement)
    values(a.id,u,a.placement_revision,v);
  select count(*),coalesce(bool_or(s.placement<>v),false) into eligible_count,competing
    from public.food_image_placement_suggestions s where s.image_id=a.id and s.status='pending'
    and s.base_revision=a.placement_revision and private.food_image_placement_contributor_eligible(s.user_id);
  if enabled and not a.community_placement_locked and not competing and eligible_count>=3
    and a.crop_source='auto' and a.approved_at is null and a.placement_suggestion_accepted_at is null
    and a.placement_version=2 and v->>'fitMode'=a.fit_mode
    and (v->>'rotationDegrees')::integer=a.rotation_degrees
    and abs((v->>'cropX')::numeric-a.crop_x)<=10
    and abs((v->>'cropY')::numeric-a.crop_y)<=10
    and abs((v->>'cropZoom')::numeric-a.crop_zoom)<=0.15
    and abs((v->>'cropX')::numeric-coalesce((a.community_placement_anchor->>'cropX')::numeric,a.crop_x))<=10
    and abs((v->>'cropY')::numeric-coalesce((a.community_placement_anchor->>'cropY')::numeric,a.crop_y))<=10
    and abs((v->>'cropZoom')::numeric-coalesce((a.community_placement_anchor->>'cropZoom')::numeric,a.crop_zoom))<=0.15 then
    update public.food_image_assets set crop_x=(v->>'cropX')::numeric,
      crop_y=(v->>'cropY')::numeric,crop_zoom=(v->>'cropZoom')::numeric,
      rotation_degrees=(v->>'rotationDegrees')::integer,fit_mode=v->>'fitMode',
      placement_version=2,placement_method='manual',crop_source='auto',
      placement_suggestion_version=null,placement_suggestion_confidence=null,placement_suggestion_accepted_at=null,
      community_placement_anchor=coalesce(a.community_placement_anchor,private.food_image_placement_value(a))
      where id=a.id;
    update public.food_image_placement_suggestions set status='published',reviewed_at=now()
      where image_id=a.id and base_revision=a.placement_revision and placement=v;
    result_status := 'published';
  end if;
  return jsonb_build_object('status',result_status);
end $$;

create function public.review_food_image_placement(
  p_action text, p_image_id uuid default null, p_revision bigint default null,
  p_suggestion_id uuid default null, p_user_id uuid default null,
  p_enabled boolean default null, p_note text default ''
) returns void language plpgsql security definer set search_path = '' as $$
declare u uuid := private.assert_food_image_placement_moderator();
  a public.food_image_assets; s public.food_image_placement_suggestions; h public.food_image_placement_history; v jsonb;
begin
  if p_action is null or p_action not in ('automation','trust','restrict','lock','approve','reject','undo')
    or length(coalesce(p_note,''))>1000 then raise exception 'Invalid review action' using errcode='22023'; end if;
  if p_action='automation' then
    if p_enabled is null then raise exception 'Choose automation setting' using errcode='22023'; end if;
    update public.food_image_placement_policy set automation_enabled=p_enabled,updated_by=u,updated_at=now() where singleton;
    return;
  end if;
  if p_action in ('trust','restrict') then
    -- Serialize eligibility changes against consensus decisions already in flight.
    perform 1 from public.food_image_placement_policy where singleton for update;
    if p_user_id is null or p_enabled is null then raise exception 'Choose contributor and setting' using errcode='22023'; end if;
    insert into public.food_image_placement_contributors(user_id,reviewed_by) values(p_user_id,u)
      on conflict(user_id) do nothing;
    update public.food_image_placement_contributors set
      trusted=case when p_action='trust' then p_enabled else trusted end,
      restricted=case when p_action='restrict' then p_enabled else restricted end,
      reviewed_by=u,updated_at=now() where user_id=p_user_id;
    if p_action='restrict' and p_enabled then
      update public.food_image_placement_suggestions set status='rejected',reviewed_by=u,reviewed_at=now(),review_note='Contributor restricted'
        where user_id=p_user_id and status='pending';
    end if;
    return;
  end if;
  select * into a from public.food_image_assets where id=p_image_id and status='active' for update;
  if not found then raise exception 'Image not found' using errcode='P0002'; end if;
  if p_revision is distinct from a.placement_revision then raise exception 'Image changed; refresh before reviewing' using errcode='40001'; end if;
  if p_action='lock' then
    if p_enabled is null then raise exception 'Choose lock setting' using errcode='22023'; end if;
    update public.food_image_assets set community_placement_locked=p_enabled where id=a.id;
    return;
  end if;
  if p_action='undo' then
    select * into h from public.food_image_placement_history where image_id=a.id and image_url=a.image_url
      and revision<=a.placement_revision and previous_placement-'placementMethod'<>next_placement-'placementMethod'
      order by revision desc limit 1;
    if not found or h.image_url<>a.image_url then raise exception 'No current placement to undo' using errcode='22023'; end if;
    v := h.previous_placement;
  else
    select * into s from public.food_image_placement_suggestions where id=p_suggestion_id and image_id=a.id and status='pending';
    if not found or s.base_revision<>a.placement_revision then raise exception 'Suggestion changed; refresh' using errcode='40001'; end if;
    if p_action='reject' then
      if btrim(coalesce(p_note,''))='' then raise exception 'Give a review reason' using errcode='22023'; end if;
      update public.food_image_placement_suggestions set status='rejected',reviewed_by=u,reviewed_at=now(),review_note=p_note
        where image_id=a.id and base_revision=a.placement_revision and placement=s.placement and status='pending';
      return;
    end if;
    v := s.placement;
  end if;
  update public.food_image_assets set crop_x=(v->>'cropX')::numeric,crop_y=(v->>'cropY')::numeric,
    crop_zoom=(v->>'cropZoom')::numeric,rotation_degrees=(v->>'rotationDegrees')::integer,
    fit_mode=v->>'fitMode',placement_version=(v->>'placementVersion')::integer,
    placement_method='manual',crop_source='moderator',approved_by=u,approved_at=now(),
    placement_suggestion_version=null,placement_suggestion_confidence=null,placement_suggestion_accepted_at=null,
    community_placement_locked=true,community_placement_anchor=null where id=a.id;
  if p_action='approve' then
    update public.food_image_placement_suggestions set status='published',reviewed_by=u,reviewed_at=now(),review_note=nullif(btrim(p_note),'')
      where image_id=a.id and base_revision=a.placement_revision and placement=v;
  end if;
end $$;

create function public.read_food_image_placement_preferences(p_image_ids uuid[])
returns table(image_id uuid,image_url text,placement jsonb)
language plpgsql stable security definer set search_path = '' as $$
begin
  if coalesce(cardinality(p_image_ids),0)>1000 then
    raise exception 'Too many images' using errcode='22023';
  end if;
  return query select p.image_id,p.image_url,p.placement
    from public.food_image_placement_preferences p
    join public.food_image_assets a on a.id=p.image_id and a.status='active' and a.image_url=p.image_url
    where p.user_id=auth.uid() and p.image_id=any(p_image_ids);
end $$;

-- Existing direct moderator publishing uses the same authenticated database
-- boundary as review decisions, so its history retains the actual caller.
create function public.publish_food_image_placement(p_image_id uuid,p_image_url text,p_revision bigint,p_placement jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare u uuid := private.assert_food_image_placement_moderator();
  a public.food_image_assets; v jsonb; method text; suggestion_version text; v_confidence numeric;
begin
  v := private.normalize_food_image_placement(p_placement);
  method := coalesce(p_placement->>'placementMethod','manual');
  if method not in ('default','manual','automatic-ocr','smart-ocr','smart-ocr-adjusted') then
    raise exception 'Invalid image placement' using errcode='22023';
  end if;
  if method in ('automatic-ocr','smart-ocr','smart-ocr-adjusted') then
    suggestion_version := btrim(p_placement->>'suggestionVersion');
    if coalesce(length(suggestion_version),0) not between 1 and 200
      or jsonb_typeof(p_placement->'suggestionConfidence') is distinct from 'number' then
      raise exception 'Invalid image placement' using errcode='22023';
    end if;
    v_confidence := (p_placement->>'suggestionConfidence')::numeric;
    if v_confidence not between 0 and 100 then raise exception 'Invalid image placement' using errcode='22023'; end if;
  end if;
  select * into a from public.food_image_assets where id=p_image_id and status='active' for update;
  if not found then raise exception 'Image not found' using errcode='P0002'; end if;
  if p_revision is distinct from a.placement_revision or p_image_url is distinct from a.image_url then
    raise exception 'Image changed; refresh before reviewing' using errcode='40001';
  end if;
  update public.food_image_assets set crop_x=(v->>'cropX')::numeric,crop_y=(v->>'cropY')::numeric,
    crop_zoom=(v->>'cropZoom')::numeric,rotation_degrees=(v->>'rotationDegrees')::integer,
    fit_mode=v->>'fitMode',placement_version=2,placement_method=method,crop_source='moderator',
    approved_by=u,approved_at=now(),community_placement_locked=true,community_placement_anchor=null,
    placement_suggestion_version=suggestion_version,placement_suggestion_confidence=v_confidence,
    placement_suggestion_accepted_at=case when suggestion_version is not null then now() end
    where id=a.id;
end $$;
revoke all on function public.publish_food_image_placement(uuid,text,bigint,jsonb) from public,anon,service_role;
grant execute on function public.publish_food_image_placement(uuid,text,bigint,jsonb) to authenticated;

create function public.get_food_image_placement_workspace(p_image_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare u uuid := private.assert_food_image_placement_moderator(); result jsonb;
begin
  select jsonb_build_object(
    'automationEnabled',(select automation_enabled from public.food_image_placement_policy where singleton),
    'pendingImages',(select count(distinct s.image_id) from public.food_image_placement_suggestions s
      join public.food_image_assets a on a.id=s.image_id and a.status='active' and a.placement_revision=s.base_revision where s.status='pending'),
    'images',coalesce(jsonb_agg(item order by needs_review desc,sort_at), '[]'::jsonb)) into result
  from (
    select a.id,exists(select 1 from public.food_image_placement_suggestions s where s.image_id=a.id and s.status='pending') needs_review,
      coalesce((select min(s.created_at) from public.food_image_placement_suggestions s where s.image_id=a.id and s.status='pending'),a.updated_at) sort_at,
      jsonb_build_object('id',a.id,'imageUrl',a.image_url,'source',a.source,'sourceReference',a.source_reference,
        'name',coalesce((select product_name from public.shared_products where id=a.shared_product_id),a.barcode,'Food image'),
        'licenseName',a.license_name,'licenseUrl',a.license_url,'attributionText',a.attribution_text,
        'revision',a.placement_revision,'locked',a.community_placement_locked,'placement',private.food_image_placement_value(a),
        'suggestions',(select coalesce(jsonb_agg(g.item order by g.oldest),'[]'::jsonb) from (
          select min(s.created_at) oldest,jsonb_build_object('id',(array_agg(s.id order by s.created_at,s.id))[1],
            'placement',s.placement,'votes',count(*),
            'eligibleVotes',count(*) filter(where private.food_image_placement_contributor_eligible(s.user_id)),
            'contributors',(select coalesce(jsonb_agg(c.item),'[]'::jsonb) from (
              select jsonb_build_object('id',v.user_id,'trusted',coalesce(c.trusted,false),'restricted',coalesce(c.restricted,false)) item
                from public.food_image_placement_suggestions v left join public.food_image_placement_contributors c on c.user_id=v.user_id
                where v.image_id=a.id and v.base_revision=a.placement_revision and v.placement=s.placement and v.status='pending'
                order by v.created_at,v.id limit 10) c)) item
            from public.food_image_placement_suggestions s where s.image_id=a.id and s.status='pending' and s.base_revision=a.placement_revision
            group by s.placement order by min(s.created_at) limit 10) g),
        'history',(select coalesce(jsonb_agg(h.item order by h.revision desc),'[]'::jsonb) from (
          select h.revision,jsonb_build_object('revision',h.revision,'previous',h.previous_placement,'next',h.next_placement,
            'createdAt',h.created_at,'canUndo',h.id=(select latest.id from public.food_image_placement_history latest
              where latest.image_id=a.id and latest.image_url=a.image_url
                and latest.previous_placement-'placementMethod'<>latest.next_placement-'placementMethod'
              order by latest.revision desc limit 1)) item
            from public.food_image_placement_history h where h.image_id=a.id order by h.revision desc limit 10) h)) item
      from public.food_image_assets a where a.status='active' and (p_image_id is null or a.id=p_image_id)
        and (p_image_id is not null or exists(select 1 from public.food_image_placement_suggestions s where s.image_id=a.id and s.status='pending')
          or exists(select 1 from public.food_image_placement_history h where h.image_id=a.id))
      order by needs_review desc,sort_at limit 25
  ) images;
  return result;
end $$;

alter table public.food_image_placement_preferences enable row level security;
alter table public.food_image_placement_suggestions enable row level security;
alter table public.food_image_placement_contributors enable row level security;
alter table public.food_image_placement_history enable row level security;
alter table public.food_image_placement_policy enable row level security;
create policy own_image_placements on public.food_image_placement_preferences for select to authenticated using(user_id=(select auth.uid()));
create policy own_or_moderator_image_suggestions on public.food_image_placement_suggestions for select to authenticated
  using(user_id=(select auth.uid()) or (public.authorize_app_permission('moderation.catalog.review')
    and exists(select 1 from public.app_role_assignments where user_id=(select auth.uid()) and role in ('moderator','admin','developer'))
    and not exists(select 1 from public.account_moderation where user_id=(select auth.uid())
      and (status='banned' or (status='suspended' and expires_at>now())))));
create policy moderator_image_contributors on public.food_image_placement_contributors for select to authenticated
  using(public.authorize_app_permission('moderation.catalog.review') and exists(select 1 from public.app_role_assignments where user_id=(select auth.uid()) and role in ('moderator','admin','developer'))
    and not exists(select 1 from public.account_moderation where user_id=(select auth.uid())
      and (status='banned' or (status='suspended' and expires_at>now()))));
create policy moderator_image_history on public.food_image_placement_history for select to authenticated
  using(public.authorize_app_permission('moderation.catalog.review') and exists(select 1 from public.app_role_assignments where user_id=(select auth.uid()) and role in ('moderator','admin','developer'))
    and not exists(select 1 from public.account_moderation where user_id=(select auth.uid())
      and (status='banned' or (status='suspended' and expires_at>now()))));
create policy moderator_image_policy on public.food_image_placement_policy for select to authenticated
  using(public.authorize_app_permission('moderation.catalog.review') and exists(select 1 from public.app_role_assignments where user_id=(select auth.uid()) and role in ('moderator','admin','developer'))
    and not exists(select 1 from public.account_moderation where user_id=(select auth.uid())
      and (status='banned' or (status='suspended' and expires_at>now()))));
revoke all on public.food_image_placement_preferences,public.food_image_placement_suggestions,
  public.food_image_placement_contributors,public.food_image_placement_history,public.food_image_placement_policy from public,anon,authenticated;
grant select on public.food_image_placement_preferences,public.food_image_placement_suggestions,
  public.food_image_placement_contributors,public.food_image_placement_history,public.food_image_placement_policy to authenticated;
grant all on public.food_image_placement_preferences,public.food_image_placement_suggestions,
  public.food_image_placement_contributors,public.food_image_placement_history,public.food_image_placement_policy to service_role;
revoke all on function private.normalize_food_image_placement(jsonb),private.food_image_placement_value(public.food_image_assets),
  private.assert_food_image_placement_user(),private.assert_food_image_placement_moderator(),
  private.food_image_placement_contributor_eligible(uuid),private.record_food_image_placement_change() from public,anon,authenticated,service_role;
revoke all on function public.save_food_image_placement(uuid,text,text,jsonb,bigint),
  public.review_food_image_placement(text,uuid,bigint,uuid,uuid,boolean,text) from public,anon,service_role;
grant execute on function public.save_food_image_placement(uuid,text,text,jsonb,bigint),
  public.review_food_image_placement(text,uuid,bigint,uuid,uuid,boolean,text) to authenticated;
revoke all on function public.read_food_image_placement_preferences(uuid[]),public.get_food_image_placement_workspace(uuid)
  from public,anon,service_role;
grant execute on function public.read_food_image_placement_preferences(uuid[]) to authenticated,service_role;
grant execute on function public.get_food_image_placement_workspace(uuid) to authenticated;

-- Preserve the existing role-aware summary owner and its one-snapshot read contract.
create or replace function public.get_privileged_tool_action_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_role public.app_role;
	v_can_manage_accounts boolean;
	v_can_review_catalog boolean;
	v_can_review_warnings boolean;
	v_can_read_data_operations boolean;
	v_pending_product_submissions bigint := 0;
	v_pending_image_placement_reviews bigint := 0;
	v_pending_catalog_conflicts bigint := 0;
	v_pending_provider_changes bigint := 0;
	v_pending_safety_matches bigint := 0;
	v_pending_catalog_review_items bigint := 0;
	v_pending_food_warning_reports bigint := 0;
	v_pending_food_warning_follow_ups bigint := 0;
	v_pending_profile_image_reviews bigint := 0;
	v_pending_catalog_data_operations bigint := 0;
	v_catalog_data_operation_subjects jsonb := '[]'::jsonb;
	v_catalog_data_operation_subjects_truncated boolean := false;
	v_total_actionable_items bigint := 0;
begin
	if auth.uid() is null or coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
		raise exception using
			errcode = '42501',
			message = 'MFA-verified privileged-tool access is required.';
	end if;

	select assignment.role
	into v_role
	from public.app_role_assignments assignment
	where assignment.user_id = auth.uid();

	if v_role is null then
		raise exception using
			errcode = '42501',
			message = 'MFA-verified privileged-tool access is required.';
	end if;

	select
		coalesce(bool_or(permission.permission = 'moderation.accounts.manage'), false),
		coalesce(bool_or(permission.permission = 'moderation.catalog.review'), false),
		coalesce(bool_or(permission.permission = 'moderation.warnings.review'), false),
		coalesce(bool_or(permission.permission = 'data_operations.catalog_health.read'), false)
	into
		v_can_manage_accounts,
		v_can_review_catalog,
		v_can_review_warnings,
		v_can_read_data_operations
	from public.app_role_permissions permission
	where permission.role = v_role;

	if v_can_review_catalog then
		select count(distinct suggestion.image_id) into v_pending_image_placement_reviews
		from public.food_image_placement_suggestions suggestion
		join public.food_image_assets image on image.id=suggestion.image_id
			and image.status='active' and image.placement_revision=suggestion.base_revision
		where suggestion.status='pending';

		select count(*) into v_pending_product_submissions
		from public.shared_product_submissions submission
		where submission.status = 'pending';

		select count(*) into v_pending_catalog_conflicts
		from public.catalog_actionable_product_conflicts;

		select count(*) into v_pending_provider_changes
		from public.catalog_actionable_provider_change_reviews;

		select count(*) into v_pending_safety_matches
		from public.official_food_safety_alert_matches alert_match
		where alert_match.status = 'needs_review';

		v_pending_catalog_review_items :=
			v_pending_catalog_conflicts
			+ v_pending_provider_changes
			+ v_pending_safety_matches;
	end if;

	if v_can_review_warnings then
		select count(*) into v_pending_food_warning_reports
		from public.food_compatibility_feedback feedback
		where feedback.status = 'pending';

		select count(*) into v_pending_food_warning_follow_ups
		from (
			select correction.id
			from public.catalog_correction_origins correction
			where correction.origin_type = 'food_warning_report'
				and correction.status in ('waiting_for_correction', 'linked')
			union all
			select review_case.id
			from public.food_warning_policy_review_cases review_case
			where review_case.status in ('open', 'deferred')
		) warning_follow_up;
	end if;

	if v_can_manage_accounts then
		select count(*) into v_pending_profile_image_reviews
		from (
			select report.reported_profile_user_id, report.avatar_path
			from public.profile_image_reports report
			where report.status = 'pending'
			group by report.reported_profile_user_id, report.avatar_path
		) pending_images;
	end if;

	if v_can_read_data_operations then
		with actionable_issue_rows as (
			select
				occurrence.subject_type,
				occurrence.subject_key,
				occurrence.issue_code,
				occurrence.source_reason,
				occurrence.parameters,
				issue.resolution_action,
				issue.operational_severity,
				case issue.operational_severity
					when 'blocking' then 1
					when 'critical' then 2
					when 'attention' then 3
					else 4
				end as severity_rank
			from public.catalog_health_actionable_issue_occurrences occurrence
			join public.app_issue_codes issue
				on issue.code = occurrence.issue_code
			where occurrence.status = 'open'
				and issue.enabled
				and issue.responsible_group = 'data_operations'
				and occurrence.issue_code <> 'CATALOG_REVISION_EXPLANATION_MISSING'
		), subject_groups as (
			select
				row.subject_type,
				row.subject_key,
				count(*)::integer as issue_count,
				min(row.severity_rank) as severity_rank,
				(array_agg(
					row.operational_severity
					order by row.severity_rank, row.issue_code
				))[1] as severity,
				(array_agg(
					row.resolution_action
					order by row.severity_rank, row.issue_code
				))[1] as resolution_action,
				jsonb_agg(
					jsonb_build_object(
						'code', row.issue_code,
						'sourceReason', row.source_reason,
						'resolutionAction', row.resolution_action,
						'severity', row.operational_severity,
						'parameters', row.parameters
					)
					order by row.severity_rank, row.issue_code
				) as issues
			from actionable_issue_rows row
			group by row.subject_type, row.subject_key
		), labeled_subjects as (
			select
				subject.subject_type,
				subject.subject_key,
				case subject.subject_type
					when 'shared_product' then coalesce(
						nullif(btrim(product.food ->> 'description'), ''),
						'Unnamed catalog product'
					)
					when 'nutrient_mapping' then coalesce(
						nullif(btrim(mapping.source_nutrient_name), ''),
						nullif(btrim(mapping.source_nutrient_key), ''),
						'Unnamed nutrient identity'
					)
					when 'generic_food_dataset' then coalesce(
						nullif(btrim(dataset.display_name), ''),
						'Unnamed dataset'
					)
					when 'product_data_source' then coalesce(
						nullif(btrim(source.display_name), ''),
						'Unnamed product source'
					)
					when 'food_preference' then initcap(
						replace(replace(subject.subject_key, '-', ' '), '_', ' ')
					)
					else 'Unidentified operational subject'
				end as display_name,
				case subject.subject_type
					when 'shared_product' then nullif(product.food ->> 'brandOwner', '')
					when 'nutrient_mapping' then mapping.source_key
					when 'generic_food_dataset' then dataset.source_key
					when 'product_data_source' then source.key
					else null
				end as context,
				subject.issue_count,
				subject.severity_rank,
				subject.severity,
				subject.resolution_action,
				subject.issues,
				case subject.subject_type
					when 'shared_product' then
						'/profile/privileged-tools/data-operations/products/' || subject.subject_key
					when 'nutrient_mapping' then
						'/profile/privileged-tools/data-operations/nutrient-mappings/' || subject.subject_key
					else null
				end as destination,
				case
					when subject.subject_type in ('shared_product', 'nutrient_mapping') then null
					when subject.resolution_action = 'review_dataset_import' then
						'The ingestion workflow must record the missing import date or checksum; no in-app editor exists yet.'
					when subject.resolution_action = 'review_policy_coverage' then
						'A reviewed policy migration must add the missing coverage; no in-app editor exists.'
					else
						'The required workflow is not available in the app yet.'
				end as missing_prerequisite
			from subject_groups subject
			left join public.shared_products product
				on subject.subject_type = 'shared_product'
				and product.id::text = subject.subject_key
			left join public.nutrient_source_mappings mapping
				on subject.subject_type = 'nutrient_mapping'
				and mapping.id::text = subject.subject_key
			left join public.generic_food_datasets dataset
				on subject.subject_type = 'generic_food_dataset'
				and dataset.key = subject.subject_key
			left join public.product_data_sources source
				on subject.subject_type = 'product_data_source'
				and source.key = subject.subject_key
		), ordered_subjects as (
			select subject.*
			from labeled_subjects subject
			order by
				subject.severity_rank,
				lower(subject.display_name),
				subject.subject_type,
				subject.subject_key
			limit 50
		)
		select
			(select count(*) from labeled_subjects),
			coalesce(
				jsonb_agg(
					jsonb_build_object(
						'subjectType', subject.subject_type,
						'subjectKey', subject.subject_key,
						'displayName', subject.display_name,
						'context', subject.context,
						'issueCount', subject.issue_count,
						'severity', subject.severity,
						'resolutionAction', subject.resolution_action,
						'destination', subject.destination,
						'missingPrerequisite', subject.missing_prerequisite,
						'issues', subject.issues
					)
					order by
						subject.severity_rank,
						lower(subject.display_name),
						subject.subject_type,
						subject.subject_key
				),
				'[]'::jsonb
			)
		into
			v_pending_catalog_data_operations,
			v_catalog_data_operation_subjects
		from ordered_subjects subject;

		v_catalog_data_operation_subjects_truncated :=
			v_pending_catalog_data_operations
			> jsonb_array_length(v_catalog_data_operation_subjects);
	end if;

	v_total_actionable_items :=
		v_pending_product_submissions
		+ v_pending_catalog_review_items
		+ v_pending_food_warning_reports
		+ v_pending_food_warning_follow_ups
		+ v_pending_profile_image_reviews
		+ v_pending_catalog_data_operations
		+ v_pending_image_placement_reviews;

	return jsonb_build_object(
		'pendingProductSubmissions', v_pending_product_submissions,
		'pendingImagePlacementReviews', v_pending_image_placement_reviews,
		'pendingCatalogReviewItems', v_pending_catalog_review_items,
		'pendingFoodWarningReports', v_pending_food_warning_reports,
		'pendingFoodWarningFollowUps', v_pending_food_warning_follow_ups,
		'pendingProfileImageReviews', v_pending_profile_image_reviews,
		'pendingCatalogDataOperations', v_pending_catalog_data_operations,
		'catalogDataOperationSubjects', v_catalog_data_operation_subjects,
		'catalogDataOperationSubjectsTruncated', v_catalog_data_operation_subjects_truncated,
		'totalActionableItems', v_total_actionable_items
	);
end;
$$;

comment on function public.get_privileged_tool_action_summary() is
	'Returns exact role-filtered privileged action counts and a bounded named data-operations subject list after AAL2, including every open food-warning follow-up that remains in the focused queue; historical revision-audit diagnostics remain outside the required-work count. Includes grouped pending image-placement work.';
