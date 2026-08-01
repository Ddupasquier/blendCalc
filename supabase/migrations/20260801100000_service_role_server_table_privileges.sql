grant select, insert, update on table public.account_moderation to service_role;
grant select, insert, update, delete on table public.blocked_signup_emails to service_role;
grant select, insert on table public.moderation_actions to service_role;
grant select, insert, update on table public.moderation_email_deliveries to service_role;

grant select, insert, update on table public.product_submission_blocks to service_role;
grant select, update, delete on table public.shared_product_submissions to service_role;
grant select on table public.shared_products to service_role;
grant select on table public.shared_product_revisions to service_role;
grant select on table public.shared_product_field_provenance to service_role;
grant select on table public.food_nutrients to service_role;
