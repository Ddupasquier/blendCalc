alter table public.shared_product_submissions
	drop constraint if exists shared_product_submissions_verification_status_check;

update public.shared_product_submissions
set verification_status = 'exact_identity'
where verification_status = 'source_verified';

alter table public.shared_product_submissions
	add constraint shared_product_submissions_verification_status_check
		check (
			verification_status in (
				'unverified',
				'exact_identity',
				'manual_review'
			)
		);

create or replace function public.normalize_shared_product_submission_verification()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
	if new.verification_status = 'source_verified' then
		new.verification_status := 'exact_identity';
	end if;
	return new;
end;
$$;

drop trigger if exists normalize_shared_product_submission_verification
	on public.shared_product_submissions;
create trigger normalize_shared_product_submission_verification
	before insert or update of verification_status
	on public.shared_product_submissions
	for each row
	execute function public.normalize_shared_product_submission_verification();

update public.shared_products
set confidence = 'imported',
	food = case
		when food ->> 'sharedProductConfidence' = 'source-verified'
			then jsonb_set(
				food,
				'{sharedProductConfidence}',
				to_jsonb('imported'::text),
				true
			)
		else food
	end,
	updated_at = now()
where confidence = 'source-verified'
	and source in ('usda', 'open-food-facts');

update public.custom_foods custom_food
set food = jsonb_set(
	custom_food.food,
	'{sharedProductConfidence}',
	to_jsonb(shared_product.confidence),
	true
)
from public.shared_products shared_product
where custom_food.food ->> 'sharedProductId' = shared_product.id::text
	and custom_food.food ->> 'sharedProductConfidence'
		is distinct from shared_product.confidence;

update public.user_food_list_items
set food = food
where shared_product_id is not null;

comment on column public.shared_product_submissions.verification_status is
	'Workflow state only: exact_identity confirms an exact product identity match; manual_review records human review. Field verification remains in shared_product_field_provenance.';

revoke all on function public.normalize_shared_product_submission_verification()
	from public, anon, authenticated;
grant execute on function public.normalize_shared_product_submission_verification()
	to service_role;
