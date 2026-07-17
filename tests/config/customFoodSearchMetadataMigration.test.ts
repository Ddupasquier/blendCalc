import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260717153000_custom_food_search_metadata.sql",
	"utf8",
);
const defaultMigration = readFileSync(
	"supabase/migrations/20260717154000_custom_food_search_default.sql",
	"utf8",
);

describe("custom food search metadata migration", () => {
	it("keeps searchable custom-food text synchronized", () => {
		expect(migration).toContain("add column if not exists search_text text");
		expect(migration).toContain("create or replace function public.set_custom_food_search_text");
		expect(migration).toContain("before insert or update of barcode, name_key, food");
		expect(migration).toContain("public.food_metadata_search_text(new.food)");
	});

	it("indexes partial custom-food search", () => {
		expect(migration).toContain("create index if not exists custom_foods_search_trgm_idx");
		expect(migration).toContain("search_text gin_trgm_ops");
	});

	it("lets the trigger populate search text for new inserts", () => {
		expect(defaultMigration).toContain("alter column search_text set default ''");
	});
});
