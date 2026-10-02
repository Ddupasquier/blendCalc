-- Match oldest-first cursor reads without sorting every outstanding work item.
create index food_compatibility_feedback_pending_cursor_idx
	on public.food_compatibility_feedback (created_at, id)
	where status = 'pending';

create index food_warning_policy_review_cases_open_cursor_idx
	on public.food_warning_policy_review_cases (created_at, id)
	where status in ('open', 'deferred');

create index catalog_correction_origins_warning_cursor_idx
	on public.catalog_correction_origins (created_at, id)
	where origin_type = 'food_warning_report'
		and status in ('waiting_for_correction', 'linked');
