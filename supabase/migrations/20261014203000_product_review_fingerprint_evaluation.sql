-- Evaluate each fingerprint only for its matching review outcome. The lateral
-- aggregate keeps the lookup product-scoped without materializing the catalog.
create or replace view public.catalog_health_actionable_issue_occurrences
with (security_invoker = true)
as
select occurrence.*
from public.catalog_health_issue_occurrences occurrence
left join lateral (
 select
  bool_or(disposition.issue_fingerprint=private.catalog_health_product_issue_fingerprint(occurrence.shared_product_id)) filter (where disposition.outcome='accepted_withheld') as accepted_publication,
  bool_or(disposition.issue_fingerprint=private.catalog_health_product_diagnostic_fingerprint(occurrence.shared_product_id)) filter (where disposition.outcome='accepted_evidence_gap') as accepted_diagnostic
 from public.catalog_health_review_dispositions disposition
 where disposition.shared_product_id=occurrence.shared_product_id
) accepted on true
where occurrence.shared_product_id is null
 or (occurrence.source_scope='blendcalc_api_publication' and not coalesce(accepted.accepted_publication,false))
 or (occurrence.source_scope<>'blendcalc_api_publication' and not coalesce(accepted.accepted_diagnostic,false))
;

revoke all on table public.catalog_health_actionable_issue_occurrences
 from public, anon, authenticated;
grant select on table public.catalog_health_actionable_issue_occurrences
 to service_role;
