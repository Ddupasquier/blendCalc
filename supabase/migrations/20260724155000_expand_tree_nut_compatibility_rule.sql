update public.food_compatibility_match_rules rule
set
	match_pattern =
		'\b(?:almonds?|cashews?|hazelnuts?|pecans?|pistachios?|walnuts?|macadamias?|brazil nuts?|tree nuts?)\b',
	updated_at = now()
from public.compatibility_tags tag
where tag.id = rule.tag_id
	and tag.slug = 'tree-nut'
	and rule.field_name = 'ingredients'
	and rule.fact_type = 'ingredient_present';

select public.refresh_shared_product_compatibility_match_facts(product.id)
from public.shared_products product
where product.status = 'active';
