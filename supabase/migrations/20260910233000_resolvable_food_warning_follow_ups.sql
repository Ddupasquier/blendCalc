create or replace function public.resolve_food_warning_policy_review_case(
	p_case_id uuid,
	p_outcome text,
	p_resolution_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_case public.food_warning_policy_review_cases%rowtype;
	v_completed boolean;
begin
	if not public.authorize_app_permission('moderation.warnings.review') then
		raise exception using
			errcode = '42501',
			message = 'MFA-verified food-warning review access is required.';
	end if;
	if p_outcome not in ('resolved', 'dismissed', 'deferred') then
		raise exception 'Food-warning follow-up outcome is invalid';
	end if;
	if btrim(coalesce(p_resolution_note, '')) = '' then
		raise exception 'A food-warning follow-up resolution note is required';
	end if;

	select *
	into v_case
	from public.food_warning_policy_review_cases review_case
	where review_case.id = p_case_id
		and review_case.status in ('open', 'deferred')
	for update;

	if not found then
		return jsonb_build_object('reviewed', false);
	end if;

	if v_case.responsible_group = 'data_operations'
		and not public.authorize_app_permission(
			'data_operations.catalog_health.repair'
		) then
		raise exception using
			errcode = '42501',
			message = 'MFA-verified data-operations repair access is required.';
	end if;

	v_completed := p_outcome in ('resolved', 'dismissed');

	update public.food_warning_policy_review_cases
	set status = p_outcome,
		resolved_by = case when v_completed then (select auth.uid()) else null end,
		resolved_at = case when v_completed then now() else null end,
		resolution_note = left(btrim(p_resolution_note), 2000)
	where id = v_case.id;

	if v_completed then
		update public.food_compatibility_feedback
		set follow_up_status = 'completed'
		where id = v_case.feedback_id
			and follow_up_status = 'open';
	end if;

	return jsonb_build_object(
		'reviewed', true,
		'outcome', p_outcome,
		'followUpCompleted', v_completed
	);
end;
$$;

revoke all on function public.resolve_food_warning_policy_review_case(uuid, text, text)
	from public, anon, authenticated, service_role;
grant execute on function public.resolve_food_warning_policy_review_case(uuid, text, text)
	to authenticated;

comment on function public.resolve_food_warning_policy_review_case(uuid, text, text) is
	'Records an AAL2 evidence decision for an existing food-warning rule or source follow-up without changing catalog data, source mappings, or policy rules.';
