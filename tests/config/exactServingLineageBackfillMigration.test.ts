import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260729221000_backfill_exact_serving_lineage.sql",
	"utf8",
);

describe("exact serving lineage backfill migration", () => {
	it("matches serving evidence by exact product barcode and gram weight", () => {
		expect(migration).toContain(
			"observation.barcode = product.barcode",
		);
		expect(migration).toContain(
			")::numeric = serving.gram_weight",
		);
	});

	it("prefers exact serving labels and excludes user-entered observations", () => {
		expect(migration).toContain(
			"observation.source <> 'user-label'",
		);
		expect(migration).toContain(
			"candidate.exact_label_match desc",
		);
	});

	it("records imported exact-barcode evidence rather than provider verification", () => {
		expect(migration).toContain("'imported'");
		expect(migration).toContain("'exact-barcode'");
		expect(migration).not.toContain("'source-verified'");
	});
});
