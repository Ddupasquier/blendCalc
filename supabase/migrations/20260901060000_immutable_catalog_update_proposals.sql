create or replace function public.preserve_shared_product_update_proposal()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
	if tg_op = 'DELETE' then
		if old.submission_kind = 'product_update' then
			raise exception 'Catalog update proposals are immutable';
		end if;
		return old;
	end if;

	if old.submission_kind = 'product_update'
		or new.submission_kind = 'product_update' then
		if old.id is distinct from new.id
			or old.submitted_by is distinct from new.submitted_by
			or old.barcode is distinct from new.barcode
			or old.product_name is distinct from new.product_name
			or old.brand_owner is distinct from new.brand_owner
			or old.category_option_id is distinct from new.category_option_id
			or old.food is distinct from new.food
			or old.consent_to_share is distinct from new.consent_to_share
			or old.submission_kind is distinct from new.submission_kind
			or old.submission_intent is distinct from new.submission_intent
			or old.target_shared_product_id is distinct from new.target_shared_product_id
			or old.base_revision_id is distinct from new.base_revision_id
			or old.change_summary is distinct from new.change_summary
			or old.label_observed_at is distinct from new.label_observed_at
			or old.matched_source is distinct from new.matched_source
			or old.matched_reference is distinct from new.matched_reference
			or old.validation_report is distinct from new.validation_report
			or old.evidence_paths is distinct from new.evidence_paths
			or old.evidence_complete is distinct from new.evidence_complete
			or old.created_at is distinct from new.created_at then
			raise exception 'Catalog update proposal fields are immutable';
		end if;
	end if;

	return new;
end;
$$;

create trigger preserve_shared_product_update_proposal
	before update or delete on public.shared_product_submissions
	for each row execute function public.preserve_shared_product_update_proposal();

revoke all on function public.preserve_shared_product_update_proposal()
	from public, anon, authenticated;
