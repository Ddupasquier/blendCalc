alter table public.profiles
	add column appearance_theme text not null default 'system'
	check (appearance_theme in ('system', 'light', 'dark'));

comment on column public.profiles.appearance_theme is
	'User-selected app color theme: system, light, or dark.';
