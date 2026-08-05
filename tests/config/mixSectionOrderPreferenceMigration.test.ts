import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260803160000_mix_section_order_preference.sql",
	"utf8",
);

describe("Mix section order preference migration", () => {
	it("stores a complete validated section order behind an authoritative write", () => {
		expect(migration).toContain("add column section_order text[] not null");
		expect(migration).toContain("cardinality(section_order) = 7");
		expect(migration).toContain("save_mix_section_order(p_section_order text[])");
		expect(migration).toContain("security definer");
		expect(migration).toContain(
			"grant execute on function public.save_mix_section_order(text[]) to authenticated, service_role",
		);
	});
});
