import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260811160000_restrict_api_v1_catalog_rpcs.sql",
	"utf8",
);

describe("blendCalcAPI v1 raw catalog privacy boundary migration", () => {
	it.each([
		"get_blendcalc_product_v1",
		"search_blendcalc_products_v1",
		"get_blendcalc_product_revision_history_v1",
	])("removes browser execution of %s", (functionName) => {
		const functionPrivileges = migration.slice(
			migration.indexOf(`revoke all on function public.${functionName}`),
		);
		expect(functionPrivileges).toMatch(/from public, anon, authenticated;/);
	});

	it("keeps every raw reader available to the trusted server role", () => {
		expect(migration.match(/to service_role;/g)).toHaveLength(3);
		expect(migration).not.toMatch(/to authenticated(?:,|;)/);
	});
});
