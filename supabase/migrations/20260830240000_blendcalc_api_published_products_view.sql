create or replace view public.blendcalc_api_v1_published_products
with (security_invoker = true)
as
select
	product.id as shared_product_id,
	product.barcode,
	product.product_name,
	product.brand_owner,
	product.source as catalog_source,
	product.source_reference,
	product.confidence as catalog_confidence,
	product.approved_submission_id,
	readiness.publication_status,
	readiness.profile_key as publication_profile_key,
	readiness.quality_dimensions,
	catalog_readiness.current_revision_id,
	catalog_readiness.current_revision_number,
	catalog_readiness.current_label_observed_at,
	product.last_verified_at,
	product.created_at as catalog_created_at,
	product.updated_at as catalog_updated_at,
	'/api/v1/products/' || product.barcode as api_path
from public.shared_products product
join public.blendcalc_api_v1_product_readiness readiness
	on readiness.shared_product_id = product.id
join public.blendcalc_api_catalog_product_readiness catalog_readiness
	on catalog_readiness.shared_product_id = product.id
where readiness.publishable
	and catalog_readiness.blendcalc_api_v1_status = 'Ready';

revoke all on table public.blendcalc_api_v1_published_products
	from public, anon, authenticated;
grant select on table public.blendcalc_api_v1_published_products
	to service_role;

comment on view public.blendcalc_api_v1_published_products is
	'Current service-only inventory of canonical shared products exposed by blendCalcAPI v1. Community submissions remain separate intake records.';
