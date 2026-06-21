import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	resolve("supabase/migrations/20260621160000_use_product_compatibility_parent_source.sql"),
	"utf8",
);

describe("product compatibility parent source migration", () => {
	it("keeps the existing function signature while referencing the parent source parameter", () => {
		expect(migration).toContain(
			"create or replace function public.extract_product_compatibility_facts",
		);
		expect(migration).toContain(
			"p_parent_source text default 'shared_product_metadata'",
		);
		expect(migration).toContain(
			"perform coalesce(p_parent_source, 'shared_product_metadata');",
		);
	});
});
