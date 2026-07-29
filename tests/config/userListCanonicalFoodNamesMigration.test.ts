import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260728210000_user_list_canonical_food_names.sql",
	"utf8",
);

describe("user-list canonical food names migration", () => {
	it("backfills canonical names from exact food identities", () => {
		expect(migration).toContain("from public.shared_products product");
		expect(migration).toContain("from public.generic_food_records record");
		expect(migration).toContain("from public.custom_foods custom_food");
		expect(migration).toContain("'{canonicalDescription}'");
	});

	it("preserves the canonical name when assigning a personal list name", () => {
		expect(migration).toContain(
			"create or replace function public.rename_user_food_list_item",
		);
		expect(migration).toContain(
			"v_item.food ->> 'canonicalDescription'",
		);
		expect(migration).toContain(
			"v_item.food ->> 'description'",
		);
		expect(migration).toContain("'{nameProvenance}'");
	});
});
