import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260720011000_use_food_name_for_generic_symbol_fallback.sql",
	"utf8",
);

describe("generic food symbol name fallback migration", () => {
	it("only bypasses a category when it resolves to the generic symbol", () => {
		expect(migration).toContain("nullif(category.symbol_key, 'generic')");
		expect(migration).toContain("p_food ->> 'description'");
		expect(migration).toContain("resolve_food_symbol_key");
	});

	it("refreshes existing stored foods after changing the resolver", () => {
		expect(migration).toContain("update public.user_food_list_items");
		expect(migration).toContain("update public.shared_products");
		expect(migration).toContain("update public.custom_foods");
	});
});
