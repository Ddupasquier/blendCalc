import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260909170000_marketing_email_preferences.sql",
	"utf8",
);
const databaseTypes = readFileSync("src/lib/types/database.types.ts", "utf8");
const schemaDocumentation = readFileSync(
	"docs/development/supabase-schema.md",
	"utf8",
);

describe("marketing email preference migration", () => {
	it("keeps optional email categories normalized and default-off", () => {
		expect(migration).toContain("create table public.marketing_email_topics");
		expect(migration).toContain(
			"create table public.user_marketing_email_preferences",
		);
		expect(migration).toContain("is_subscribed boolean not null default false");
		expect(migration).toContain("Missing rows mean not subscribed");
	});

	it("stores append-only consent evidence without copying Auth email", () => {
		expect(migration).toContain(
			"create table public.marketing_email_preference_events",
		);
		expect(migration).not.toMatch(
			/user_marketing_email_preferences[\s\S]{0,500}\bemail\s+text/i,
		);
		expect(migration).not.toMatch(
			/marketing_email_preference_events[\s\S]{0,500}\bemail\s+text/i,
		);
	});

	it("uses owner-scoped functions and blocks direct browser writes", () => {
		expect(migration).toContain("v_user_id uuid := auth.uid()");
		expect(migration).toContain("security definer");
		expect(migration).toContain("set search_path = ''");
		expect(migration).toContain(
			"revoke all on table public.user_marketing_email_preferences from public, anon, authenticated",
		);
		expect(migration).toContain(
			"grant execute on function public.save_current_user_marketing_email_preferences(jsonb, text)",
		);
		expect(databaseTypes).toContain(
			"save_current_user_marketing_email_preferences",
		);
		expect(schemaDocumentation).toContain("`user_marketing_email_preferences`");
	});

	it("records only an explicit registration choice from reviewed metadata", () => {
		expect(migration).toContain(
			"new.raw_user_meta_data -> 'marketing_email_opt_in'",
		);
		expect(migration).toContain("jsonb_typeof(v_opt_in) <> 'boolean'");
		expect(migration).toContain("'registration'");
	});
});
