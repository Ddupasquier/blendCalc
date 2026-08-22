alter table public.profiles
	alter column cheeky_messages_enabled set default true;

update public.profiles
set cheeky_messages_enabled = true
where cheeky_messages_enabled = false;

comment on column public.profiles.cheeky_messages_enabled is
	'Whether the account allows occasional playful secondary copy in eligible non-safety contexts. Defaults on and remains user-disableable.';

comment on column public.app_delight_messages.tone is
	'Presentation tone. Playful copy is available by default, remains user-disableable, and is restricted to eligible non-safety contexts.';
