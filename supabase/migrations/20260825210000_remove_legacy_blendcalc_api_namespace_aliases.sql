do $$
begin
	if not exists (
		select 1
		from public.blendcalc_api_publication_profiles profile
		where profile.key = 'blendcalc-api-v1-packaged-product-v1'
			and profile.enabled
			and profile.is_default
	) then
		raise exception
			'Canonical blendCalcAPI publication profile must be active before legacy aliases are removed';
	end if;

	if exists (
		select 1
		from public.blendcalc_api_publication_profiles profile
		where profile.key = 'api-v1-packaged-product-v1'
			and (profile.enabled or profile.is_default)
	) then
		raise exception
			'Legacy blendCalcAPI publication profile must be disabled before removal';
	end if;

	if exists (
		select 1
		from public.blendcalc_api_publication_profiles profile
		where profile.key <> 'api-v1-packaged-product-v1'
			and profile.nutrition_profile_key = 'api-v1-packaged-core-v1'
	) then
		raise exception
			'Another blendCalcAPI publication profile still depends on the legacy nutrition profile';
	end if;

	if exists (
		select 1
		from public.product_regulatory_disclosure_profiles profile
		where profile.nutrition_profile_key = 'api-v1-packaged-core-v1'
	) then
		raise exception
			'A regulatory disclosure profile still depends on the legacy blendCalcAPI nutrition profile';
	end if;
end;
$$;

create or replace function public.validate_blendcalc_api_publication_hold_concern_target()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	concern public.blendcalc_api_publication_concerns%rowtype;
begin
	if new.concern_id is null then
		return new;
	end if;

	select report.* into concern
	from public.blendcalc_api_publication_concerns report
	where report.id = new.concern_id;

	if not found
		or concern.subject_type <> new.subject_type
		or concern.shared_product_id is distinct from new.shared_product_id
		or concern.food_image_asset_id is distinct from new.food_image_asset_id
		or concern.dataset_key is distinct from new.dataset_key
		or concern.source_key is distinct from new.source_key
	then
		raise exception using
			errCode = '23514',
			message = 'API_PUBLICATION_HOLD_CONCERN_MISMATCH';
	end if;

	return new;
end;
$$;

create or replace function public.validate_blendcalc_api_publication_concern_resolution()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	if new.status = 'dismissed' and new.resolution_action <> 'no-change' then
		raise exception using
			errCode = '23514',
			message = 'API_PUBLICATION_DISMISSAL_ACTION_INVALID';
	end if;

	if new.status = 'resolved'
		and new.resolution_action = 'publication-hold'
		and not exists (
			select 1
			from public.blendcalc_api_publication_holds hold
			where hold.concern_id = new.id
		)
	then
		raise exception using
			errCode = '23514',
			message = 'API_PUBLICATION_RESOLUTION_HOLD_MISSING';
	end if;

	return new;
end;
$$;

create or replace function public.blendcalc_api_v1_source_has_active_hold(
	p_source text,
	p_source_reference text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	select exists (
		select 1
		from public.blendcalc_api_publication_holds hold
		where hold.released_at is null
			and (
				(hold.source_key = case
					when p_source in ('community', 'community-reviewed')
						then 'shared-catalog'
					else p_source
				end)
				or (
					hold.dataset_key is not null
					and hold.dataset_key = split_part(
						btrim(p_source_reference),
						':',
						1
					)
				)
			)
	);
$$;

revoke all on function public.blendcalc_api_v1_source_has_active_hold(text, text)
	from public, anon, authenticated;
grant execute on function public.blendcalc_api_v1_source_has_active_hold(text, text)
	to service_role;

drop view if exists public.api_publication_concerns;
drop view if exists public.api_publication_holds;

drop function if exists public.get_blendcalc_product_v1(text);
drop function if exists public.search_blendcalc_products_v1(
	text,
	text[],
	integer,
	integer
);
drop function if exists public.get_blendcalc_product_revision_history_v1(
	text,
	integer,
	integer
);
drop function if exists public.get_catalog_product_readiness_passport(uuid);

delete from public.blendcalc_api_publication_profiles
where key = 'api-v1-packaged-product-v1';

delete from public.nutrition_completeness_profiles
where key = 'api-v1-packaged-core-v1';
