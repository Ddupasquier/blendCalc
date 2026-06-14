import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	resolve("supabase/migrations/20260609045900_initial_user_data_tables.sql"),
	"utf8",
);

const profileMigration = readFileSync(
	resolve("supabase/migrations/20260614010000_user_profiles.sql"),
	"utf8",
);

const profileNameMigration = readFileSync(
	resolve("supabase/migrations/20260614020000_simplify_profile_names.sql"),
	"utf8",
);

const moderationMigration = readFileSync(
	resolve("supabase/migrations/20260614030000_moderation_roles_and_consent.sql"),
	"utf8",
);

const userTables = [
	"user_food_list_items",
	"custom_foods",
	"saved_drinks",
	"mix_preferences",
];

describe("Supabase user data isolation", () => {
	it.each(userTables)("enables RLS on %s", (table) => {
		expect(migration).toContain(
			`alter table public.${table} enable row level security;`,
		);
	});

	it.each(userTables)("scopes %s policies to authenticated users", (table) => {
		const tablePolicyBlock = migration.slice(
			migration.indexOf(`on public.${table}`),
		);
		expect(tablePolicyBlock).toContain("to authenticated");
		expect(tablePolicyBlock).toContain("(select auth.uid())");
	});

	it("indexes every user_id policy column", () => {
		expect(migration).toContain("user_food_list_items (user_id, list_type)");
		expect(migration).toContain("custom_foods (user_id, created_at desc)");
		expect(migration).toContain("saved_drinks (user_id, created_at desc)");
		expect(migration).toContain(
			"user_id uuid primary key references auth.users(id)",
		);
	});
});

describe("Supabase profile isolation", () => {
	it("keeps profile creation optional and user-scoped", () => {
		expect(profileMigration).not.toContain("auth.users after insert");
		expect(profileMigration).toContain(
			"user_id uuid primary key references auth.users(id) on delete cascade",
		);
		expect(profileMigration).toContain(
			"alter table public.profiles enable row level security;",
		);
		expect(profileMigration).toContain("user_id = (select auth.uid())");
	});

	it("keeps avatars private and inside each user's folder", () => {
		expect(profileMigration).toContain("'profile-avatars'");
		expect(profileMigration).toContain("false,");
		expect(profileMigration).toContain(
			"(storage.foldername(name))[1] = (select auth.uid())::text",
		);
		expect(profileMigration).toContain("5242880");
	});

	it("migrates legacy usernames before removing the redundant field", () => {
		expect(profileNameMigration).toContain("set display_name = username");
		expect(profileNameMigration).toContain("drop column username");
	});
});

describe("Supabase moderation isolation", () => {
	it("does not grant moderation writes to authenticated users", () => {
		expect(moderationMigration).toContain(
			"revoke all on table public.account_moderation from anon, authenticated;",
		);
		expect(moderationMigration).toContain(
			"revoke all on table public.moderation_actions from anon, authenticated;",
		);
		expect(moderationMigration).toContain(
			"grant select on table public.account_moderation to authenticated;",
		);
		expect(moderationMigration).not.toContain(
			"grant insert, update, delete on table public.account_moderation to authenticated",
		);
	});

	it("keeps elevated roles self-readable and server-managed", () => {
		expect(moderationMigration).toContain(
			"user_id = (select auth.uid())",
		);
		expect(moderationMigration).toContain(
			"grant select on table public.app_role_assignments to authenticated;",
		);
		expect(moderationMigration).not.toContain(
			"grant insert, update, delete on table public.app_role_assignments to authenticated",
		);
	});

	it("stores immutable policy acceptances", () => {
		expect(moderationMigration).toContain(
			"create table public.profile_image_policy_acceptances",
		);
		expect(moderationMigration).toContain(
			"grant select, insert on table public.profile_image_policy_acceptances to authenticated;",
		);
		expect(moderationMigration).not.toContain(
			"grant update on table public.profile_image_policy_acceptances",
		);
	});

	it("provides a restricted before-user-created hook", () => {
		expect(moderationMigration).toContain(
			"create or replace function public.reject_blocked_signup(event jsonb)",
		);
		expect(moderationMigration).toContain(
			"grant execute on function public.reject_blocked_signup(jsonb) to supabase_auth_admin;",
		);
	});
});
