import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260719215000_blendcalc_api_v1_catalog_reads.sql",
	"utf8",
);

describe("blendCalcAPI v1 catalog reads migration", () => {
	it("reads active canonical products and their latest revision", () => {
		expect(migration).toContain("product.status = 'active'");
		expect(migration).toContain("from public.shared_product_revisions");
		expect(migration).toContain(
			"order by product_revision.revision_number desc",
		);
	});

	it("keeps direct database access private", () => {
		expect(migration).toContain("security definer");
		expect(migration).toContain("set search_path = ''");
		expect(migration).toContain("from public, anon");
		expect(migration).toContain("to authenticated, service_role");
	});

	it("bounds search pagination and ranks early name matches first", () => {
		expect(migration).toContain("least(coalesce(p_limit, 15), 50)");
		expect(migration).toContain("least(coalesce(p_offset, 0), 1000)");
		expect(migration).toContain("early_name_text");
		expect(migration).toContain("count(*) over () as total_count");
	});

	it("does not match products with an empty search document", () => {
		expect(migration).toContain(
			"lower(coalesce(product.search_text, product.product_name, ''))",
		);
	});
});
