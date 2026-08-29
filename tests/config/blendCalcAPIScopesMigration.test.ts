import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260829093000_blendcalc_api_scopes.sql",
	"utf8",
);

describe("blendCalcAPI scope policy migration", () => {
	it("stores reviewed scopes and operation requirements separately", () => {
		expect(migration).toContain("create table public.blendcalc_api_scopes");
		expect(migration).toContain(
			"create table public.blendcalc_api_scope_policies",
		);
		expect(migration).toContain(
			"required_scope text not null references public.blendcalc_api_scopes(key)",
		);
	});

	it("defines least-privilege scopes for every planned API responsibility", () => {
		for (const scope of [
			"catalog.read",
			"intake.write",
			"corrections.write",
			"moderation.read",
			"moderation.write",
			"administration",
		]) {
			expect(migration).toContain(`'${scope}'`);
		}
	});

	it("keeps scope policy private to trusted server code", () => {
		expect(migration).toContain("enable row level security");
		expect(migration).toContain("from public, anon, authenticated");
		expect(migration).toContain("to service_role");
		expect(migration).not.toMatch(/to\s+(anon|authenticated)\s*;/);
	});
});
