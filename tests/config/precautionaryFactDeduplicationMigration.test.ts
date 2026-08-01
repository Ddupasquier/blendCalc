import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260731165000_deduplicate_precautionary_facts.sql",
	"utf8",
);
const privateHelperMigration = readFileSync(
	"supabase/migrations/20260731166000_move_compatibility_helper_private.sql",
	"utf8",
);

describe("precautionary fact deduplication migration", () => {
	it("keeps linked lossless evidence instead of duplicate flat trace facts", () => {
		expect(migration).toContain(
			"duplicate.precautionary_statement_id is null",
		);
		expect(migration).toContain(
			"exact_fact.precautionary_statement_id is not null",
		);
		expect(migration).toContain("exact_fact.tag_id = duplicate.tag_id");
	});

	it("refreshes products, observations, and submissions", () => {
		expect(migration).toContain("from public.shared_products product");
		expect(migration).toContain(
			"from public.shared_product_observations observation",
		);
		expect(migration).toContain(
			"from public.shared_product_submissions submission",
		);
	});

	it("keeps the predecessor implementation outside the public API schema", () => {
		expect(privateHelperMigration).toContain("create schema if not exists private");
		expect(privateHelperMigration).toContain(
			"set schema private",
		);
		expect(privateHelperMigration).toContain(
			"private.extract_product_compatibility_facts_pre_precautionary_dedupe",
		);
		expect(privateHelperMigration).toContain(
			"private.extract_product_compatibility_facts_pre_multilingual",
		);
		expect(privateHelperMigration).toContain(
			"private.extract_product_compatibility_facts_base",
		);
		expect(privateHelperMigration).toContain(
			"private.extract_product_compatibility_facts_unlinked",
		);
		expect(privateHelperMigration).toContain("pg_get_functiondef");
	});
});
