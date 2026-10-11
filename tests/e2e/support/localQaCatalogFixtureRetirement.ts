// Retire only purpose-created browser fixtures through the real review boundary.
// History and publication blockers remain; no guessed evidence or purge is allowed.
export const retireLocalQaCatalogFixtureHealth = (
	scope: string,
	execute: (sql: string) => { toString(): string },
	firstProduct = 1,
	lastProduct = 16,
) => {
	if (
		typeof scope !== "string" ||
		scope.length !== 5 ||
		!/^[4-7]\d{4}$/u.test(scope)
	) {
		throw new Error("Invalid purpose-owned catalog fixture namespace.");
	}
	if (
		!Number.isInteger(firstProduct) ||
		!Number.isInteger(lastProduct) ||
		firstProduct < 1 ||
		lastProduct > 61 ||
		lastProduct < firstProduct ||
		lastProduct - firstProduct >= 16
	) {
		throw new Error("Invalid bounded catalog fixture retirement batch.");
	}
	const lower = `${scope}000-0000-4000-8000-${String(firstProduct).padStart(12, "0")}`;
	const upper = `${scope}000-0000-4000-8000-${String(lastProduct).padStart(12, "0")}`;
	execute(`begin;
-- Repeated bounded health views do not benefit from per-statement JIT compilation.
set local jit = off;
do $$
declare
  actor uuid;
  occurrence record;
  product record;
  result jsonb;
begin
  if (select count(*) from public.shared_products where id::text like '${scope}000-%') <> 61 then
    raise exception 'Catalog fixture ownership count does not match; retirement refused.';
  end if;
  select id into strict actor from auth.users where email = 'qa-admin@blendcalc.local';
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', actor::text, 'role', 'authenticated', 'app_role', 'admin', 'aal', 'aal2'
  )::text, true);
  for product in
    select id as shared_product_id from public.shared_products
    where id between '${lower}'::uuid and '${upper}'::uuid order by id
  loop
    for occurrence in
      select work.occurrence_key
      from public.catalog_health_actionable_issue_occurrences work
      join public.app_issue_codes issue on issue.code = work.issue_code
      where work.shared_product_id = product.shared_product_id
        and work.source_scope = 'blendcalc_api_publication' and work.status = 'open'
        and issue.enabled and issue.automated_repair_allowed
        and nullif(btrim(issue.automated_repair_key), '') is not null
    loop
      result := public.run_catalog_health_repair(occurrence.occurrence_key, false, null);
      if coalesce(result->>'status','') not in ('completed','completed_with_unresolved')
        or coalesce((result->>'candidateCount')::integer,-1) <> 0 then
        raise exception 'Catalog fixture repair has candidates or failed; retirement refused.';
      end if;
    end loop;
    if exists (
      select 1 from public.catalog_health_actionable_issue_occurrences work
      where work.shared_product_id = product.shared_product_id
        and work.source_scope = 'blendcalc_api_publication' and work.status = 'open'
    ) then
      perform public.finish_catalog_health_product_review(product.shared_product_id,
        'Purpose-created synthetic pagination fixture retired; evidence remains insufficient and public API publication remains withheld.');
    end if;
  end loop;
  -- These trusted fixture rows have finished their browser scenarios. Retire
  -- their lifecycle as well as their review work; keep every row and audit.
  -- Otherwise active-only publication views still reevaluate their deliberately
  -- incomplete evidence on every subsequent privileged dashboard request.
  update public.shared_products set status = 'retired'
  where id between '${lower}'::uuid and '${upper}'::uuid and status = 'active';
end;
$$;
${
	lastProduct === 61
		? `-- Refresh planning statistics after this namespace's bulk lifecycle changes.
-- Subsequent real dashboard requests must not plan against the active fixture corpus.
analyze public.shared_products;
analyze public.shared_product_revisions;
analyze public.shared_product_conflicts;
analyze public.catalog_health_review_dispositions;
analyze public.catalog_provider_change_reviews;
analyze public.official_food_safety_alert_matches;`
		: ""
}
commit;`);
	const remaining = execute(
		`select (select count(*) from public.shared_products where id between '${lower}'::uuid and '${upper}'::uuid and status = 'active') + (select count(*) from public.catalog_health_actionable_issue_occurrences where shared_product_id between '${lower}'::uuid and '${upper}'::uuid and source_scope = 'blendcalc_api_publication' and status = 'open');`,
	)
		.toString()
		.trim();
	if (!/^\d+$/u.test(remaining) || Number(remaining) !== 0) {
		throw new Error(
			"Catalog fixture retirement left active products or actionable publication work.",
		);
	}
};
