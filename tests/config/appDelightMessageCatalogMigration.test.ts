import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260814230000_app_delight_message_catalog.sql",
	"utf8",
);
const referenceCatalogReader = readFileSync(
	"src/lib/utils/food/reference/appVisualReferenceCatalogReader.ts",
	"utf8",
);
const delightMessageResolver = readFileSync(
	"src/lib/utils/delight/delightMessages.ts",
	"utf8",
);

describe("app delight message catalog migration", () => {
	it("stores optional secondary copy in one protected reference table", () => {
		expect(migration).toContain("create table public.app_delight_messages");
		expect(migration).toContain("enable row level security");
		expect(migration).toContain("force row level security");
		expect(migration).toContain("grant select on table public.app_delight_messages to authenticated");
	});

	it("limits messages to reviewed app contexts and bounded matching", () => {
		expect(migration).toContain("context_key in ('app', 'ingredients', 'mix', 'saved')");
		expect(migration).toContain("char_length(message) <= 120");
		expect(migration).toContain("minimum_value <= maximum_value");
	});

	it("keeps the initial catalog broad rather than developer-specific", () => {
		for (const expectedMessage of [
			"Eggcellent choice.",
			"Looking gouda.",
			"The cake may be a lie. Dessert is not.",
			"Your fridge skipped meal-prep day.",
			"Macros understood the assignment.",
		]) {
			expect(migration).toContain(expectedMessage);
		}
		for (const excludedReference of [
			"sudo",
			"merge conflict",
			"working tree",
			"O(nom",
			"GTIN there",
			"Cache me outside",
		]) {
			expect(migration).not.toContain(excludedReference);
		}
	});

	it("states that delight copy cannot replace critical instructions", () => {
		expect(migration).toContain(
			"It never replaces safety, authentication, validation, or failure instructions.",
		);
	});

	it("loads copy through the shared reference catalog instead of component literals", () => {
		expect(referenceCatalogReader).toContain('.from("app_delight_messages")');
		expect(delightMessageResolver).toContain("catalog.delightMessages.filter");
		expect(delightMessageResolver).not.toContain("Eggcellent choice.");
		expect(delightMessageResolver).not.toContain("The cake may be a lie");
	});
});
