import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260718182000_gs1_digital_link_source.sql",
	"utf8",
);

describe("GS1 Digital Link source migration", () => {
	it("registers GS1 as an identifier standard with a safe lookup policy", () => {
		expect(migration).toContain("'gs1-digital-link'");
		expect(migration).toContain("'product_identifier_carrier'");
		expect(migration).toContain("'never_fetch_arbitrary_scanned_urls'");
		expect(migration).toContain(
			"'discard_lot_serial_query_and_fragment_before_persistence'",
		);
	});
});
