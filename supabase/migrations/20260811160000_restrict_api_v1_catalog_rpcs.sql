-- Keep raw catalog rows behind the SvelteKit API boundary. These security-definer
-- functions return canonical storage documents that are intentionally broader than
-- the stable API v1 response contract, so browser roles must not call them directly.

revoke all on function public.get_blendcalc_product_v1(text)
	from public, anon, authenticated;
revoke all on function public.search_blendcalc_products_v1(
	text,
	text[],
	integer,
	integer
) from public, anon, authenticated;
revoke all on function public.get_blendcalc_product_revision_history_v1(
	text,
	integer,
	integer
) from public, anon, authenticated;

grant execute on function public.get_blendcalc_product_v1(text)
	to service_role;
grant execute on function public.search_blendcalc_products_v1(
	text,
	text[],
	integer,
	integer
) to service_role;
grant execute on function public.get_blendcalc_product_revision_history_v1(
	text,
	integer,
	integer
) to service_role;

comment on function public.get_blendcalc_product_v1(text) is
	'Server-only publication-ready catalog reader. API v1 must sanitize its raw canonical row before returning it.';
comment on function public.search_blendcalc_products_v1(text, text[], integer, integer) is
	'Server-only publication-ready catalog search. API v1 must sanitize each raw canonical row before returning it.';
comment on function public.get_blendcalc_product_revision_history_v1(text, integer, integer) is
	'Server-only publication-ready revision reader. API v1 returns only allowlisted fields and values.';
