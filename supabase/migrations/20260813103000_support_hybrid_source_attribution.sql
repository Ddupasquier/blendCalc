create or replace function public.blendcalc_api_v1_source_attribution_is_complete(
	p_source text,
	p_source_reference text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	with source_policy as (
		select source.*
		from public.product_data_sources source
		where source.key = case
				when p_source in ('community', 'community-reviewed')
					then 'shared-catalog'
				else p_source
			end
			and source.enabled
			and source.canonical_storage_allowed
			and source.api_redistribution_allowed
			and source.canonical_policy_reviewed_at is not null
			and nullif(btrim(source.display_name), '') is not null
			and nullif(btrim(source.homepage_url), '') is not null
			and nullif(btrim(source.canonical_license_name), '') is not null
			and nullif(btrim(source.terms_url), '') is not null
			and nullif(btrim(source.attribution_text), '') is not null
	), dataset_source as (
		select exists (
			select 1
			from public.generic_food_datasets dataset
			join source_policy source on source.key = dataset.source_key
		) as has_datasets
	), direct_provider_reference as (
		select exists (
			select 1
			from source_policy source
			where source.source_type = 'external_api'
				and nullif(btrim(p_source_reference), '') is not null
				and position(':' in btrim(p_source_reference)) = 0
		) as is_valid
	), referenced_dataset as (
		select split_part(btrim(p_source_reference), ':', 1) as dataset_key
		where position(':' in coalesce(p_source_reference, '')) > 1
	)
	select exists (select 1 from source_policy)
		and not public.blendcalc_api_v1_source_has_active_hold(
			p_source,
			p_source_reference
		)
		and (
			not (select has_datasets from dataset_source)
			or (select is_valid from direct_provider_reference)
			or exists (
				select 1
				from referenced_dataset reference
				join public.generic_food_datasets dataset
					on dataset.key = reference.dataset_key
				join source_policy source
					on source.key = dataset.source_key
				where dataset.active
					and dataset.import_enabled
					and dataset.license_review_status = 'approved'
					and nullif(btrim(dataset.display_name), '') is not null
					and nullif(btrim(dataset.version), '') is not null
					and nullif(btrim(dataset.source_url), '') is not null
					and nullif(btrim(dataset.license_name), '') is not null
					and nullif(btrim(dataset.license_url), '') is not null
					and nullif(btrim(dataset.attribution_text), '') is not null
					and dataset.imported_at is not null
			)
		);
$$;

revoke all on function public.blendcalc_api_v1_source_attribution_is_complete(text, text)
	from public, anon, authenticated;
grant execute on function public.blendcalc_api_v1_source_attribution_is_complete(text, text)
	to service_role;

comment on function public.blendcalc_api_v1_source_attribution_is_complete(text, text) is
	'Validates complete reviewed API attribution for direct provider records and exact imported dataset releases, while honoring active source and dataset publication holds.';
