create or replace function public.resolve_user_food_list_catalog_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_barcode text := public.food_normalized_barcode(new.food);
	v_shared_product_id uuid;
	v_shared_product_source text;
	v_shared_product_confidence text;
	v_pending_submission_id uuid;
	v_fallback_source text;
begin
	if v_barcode is not null then
		select product.id, product.source, product.confidence
		into v_shared_product_id, v_shared_product_source, v_shared_product_confidence
		from public.shared_products product
		where product.barcode = v_barcode
			and product.status = 'active'
		limit 1;

		select submission.id
		into v_pending_submission_id
		from public.shared_product_submissions submission
		where submission.submitted_by = new.user_id
			and submission.barcode = v_barcode
			and submission.status = 'pending'
		order by submission.created_at desc, submission.id desc
		limit 1;
	end if;

	v_fallback_source := public.food_source_key(new.food);
	new.shared_product_id := v_shared_product_id;
	new.shared_product_submission_id := v_pending_submission_id;
	new.source_key := case
		when v_shared_product_source = 'usda' then 'usda'
		when v_shared_product_source = 'open-food-facts' then 'open-food-facts'
		when v_shared_product_source = 'community-reviewed' then 'shared-catalog'
		else v_fallback_source
	end;
	new.trust_status := case
		when v_pending_submission_id is not null then 'pending-review'
		when v_shared_product_id is not null
			and v_shared_product_confidence in (
				'source-verified',
				'imported',
				'corroborated',
				'moderator-reviewed'
			) then v_shared_product_confidence
		when lower(coalesce(new.food ->> 'customFood', 'false')) = 'true'
			then 'user-private'
		when v_fallback_source = 'usda' then 'source-verified'
		when v_fallback_source = 'open-food-facts' then 'imported'
		else 'user-private'
	end;

	return new;
end;
$$;

update public.user_food_list_items item
set food = item.food;
