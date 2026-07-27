import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { APP_ISSUE_CODES } from "$lib/utils/errors/appIssues";

const migration = readFileSync(
	"supabase/migrations/20260726173000_app_issue_codes.sql",
	"utf8",
);

describe("application issue code migration", () => {
	it("keeps the database registry synchronized with the application catalog", () => {
		const migrationCodes = new Set(
			[...migration.matchAll(/\('([A-Z][A-Z0-9_]*)', '(?:error|warning)'/g)]
				.map((match) => match[1]),
		);

		expect([...migrationCodes].sort()).toEqual([...APP_ISSUE_CODES].sort());
	});

	it("stores machine-readable codes instead of nutrient UI sentences", () => {
		expect(migration).toContain(
			"add constraint nutrient_relationship_rules_issue_code_fkey",
		);
		expect(migration).toContain("drop column message");
		expect(migration).toContain(
			"compatibility_rule_conflicts_warning_code_fkey",
		);
	});

	it("keeps the code registry private from browser clients", () => {
		expect(migration).toContain(
			"revoke all on table public.app_issue_codes from public, anon, authenticated",
		);
		expect(migration).toContain(
			"grant all on table public.app_issue_codes to service_role",
		);
	});
});
