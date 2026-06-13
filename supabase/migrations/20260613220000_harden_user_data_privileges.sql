revoke all on table public.user_food_list_items from anon;
revoke all on table public.custom_foods from anon;
revoke all on table public.saved_drinks from anon;
revoke all on table public.mix_preferences from anon;

grant select, insert, update, delete on table public.user_food_list_items to authenticated;
grant select, insert, update, delete on table public.custom_foods to authenticated;
grant select, insert, update, delete on table public.saved_drinks to authenticated;
grant select, insert, update, delete on table public.mix_preferences to authenticated;

revoke all on function public.set_updated_at() from public;
revoke all on function public.set_updated_at() from anon;
revoke all on function public.set_updated_at() from authenticated;
