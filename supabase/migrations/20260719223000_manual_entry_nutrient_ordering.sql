update public.nutrient_manual_entry_groups
set
	title = case id
		when 'advanced-carbohydrate-details' then 'Advanced Carbohydrate Details'
		when 'advanced-fat-details' then 'Advanced Fat Details'
		when 'other-nutrients' then 'Other Nutrients'
		else title
	end,
	updated_at = now()
where id in (
	'advanced-carbohydrate-details',
	'advanced-fat-details',
	'other-nutrients'
);

with ordered_fields as (
	select
		dedupe_key,
		row_number() over (
			partition by group_id
			order by
				case when sort_order between 1 and 999 then 0 else 1 end,
				sort_order,
				lower(display_label),
				nutrient_id
		) * 10 as stable_sort_order
	from public.nutrient_manual_entry_fields
	where enabled
		and classification_status = 'approved'
)
update public.nutrient_manual_entry_fields fields
set
	sort_order = ordered_fields.stable_sort_order,
	updated_at = now()
from ordered_fields
where fields.dedupe_key = ordered_fields.dedupe_key;

create unique index if not exists nutrient_manual_entry_fields_group_sort_idx
	on public.nutrient_manual_entry_fields (group_id, sort_order)
	where enabled and classification_status = 'approved';

comment on index public.nutrient_manual_entry_fields_group_sort_idx is
	'Keeps approved manual-entry fields in a deterministic, collision-free order inside each database-owned group.';
