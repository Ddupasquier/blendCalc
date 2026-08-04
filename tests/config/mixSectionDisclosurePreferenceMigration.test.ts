import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260803170000_mix_section_disclosure_preference.sql",
	"utf8",
);

describe("Mix section disclosure preference migration", () => {
	it("stores one validated boolean per stable section behind an authoritative write", () => {
		expect(migration).toContain(
			"add column section_disclosure_state jsonb not null",
		);
		expect(migration).toContain(
			"section_disclosure_state - array[",
		);
		expect(migration).toContain(
			"save_mix_section_disclosure_state(",
		);
		expect(migration).toContain("security definer");
		expect(migration).toContain(
			"grant execute on function public.save_mix_section_disclosure_state(jsonb)",
		);
	});
});
