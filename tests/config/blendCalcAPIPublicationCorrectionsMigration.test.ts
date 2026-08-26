import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260812110000_api_publication_corrections_and_holds.sql",
	"utf8",
);

describe("blendCalcAPI publication corrections and holds migration", () => {
	it("keeps reports and holds private to the trusted server", () => {
		for (const table of ["api_publication_concerns", "api_publication_holds"]) {
			expect(migration).toContain(
				`alter table public.${table} force row level security`,
			);
			expect(migration).toMatch(
				new RegExp(
					`revoke all on table public\\.${table}\\s+from public, anon, authenticated;`,
				),
			);
			expect(migration).toContain(
				`grant all on table public.${table} to service_role`,
			);
		}
	});

	it("uses exact subject references and one active hold per subject", () => {
		for (const subject of ["product", "image", "dataset", "source"]) {
			expect(migration).toContain(
				`api_publication_holds_active_${subject}_unique`,
			);
		}
		expect(migration).toContain(
			"shared_product_id uuid references public.shared_products",
		);
		expect(migration).toContain(
			"food_image_asset_id uuid references public.food_image_assets",
		);
		expect(migration).toContain(
			"dataset_key text references public.generic_food_datasets",
		);
		expect(migration).toContain(
			"source_key text references public.product_data_sources",
		);
	});

	it("withholds held products and source releases without deleting history", () => {
		expect(migration).toContain("sync_product_publication_hold_conflict");
		expect(migration).toContain("'api-publication-hold:' || new.id::text");
		expect(migration).toContain("blendcalc_api_v1_source_has_active_hold");
		expect(migration).toContain(
			"not public.blendcalc_api_v1_source_has_active_hold",
		);
		expect(migration).not.toMatch(/delete\s+from\s+public\.shared_product/i);
	});

	it("prevents reports and holds from claiming unrelated outcomes", () => {
		expect(migration).toContain("validate_api_publication_hold_concern_target");
		expect(migration).toContain("API_PUBLICATION_HOLD_CONCERN_MISMATCH");
		expect(migration).toContain("validate_api_publication_concern_resolution");
		expect(migration).toContain("API_PUBLICATION_RESOLUTION_HOLD_MISSING");
	});
});
