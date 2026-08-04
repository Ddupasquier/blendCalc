import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260803180000_close_mix_insight_disclosures.sql",
	"utf8",
);

describe("Mix insight disclosure defaults migration", () => {
	it("closes new and existing supporting insight sections", () => {
		expect(migration).toContain(
			"alter column section_disclosure_state set default",
		);
		expect(migration).toContain("'warnings', false");
		expect(migration).toContain("'suggested-adjustments', false");
		expect(migration).toContain("'nutrient-contributions', false");
		expect(migration).toContain("update public.mix_preferences");
	});
});
