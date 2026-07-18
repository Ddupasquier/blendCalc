import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260718130000_user_food_list_catalog_links.sql",
	"utf8",
);
const defaultsMigration = readFileSync(
	"supabase/migrations/20260718131000_user_food_list_catalog_link_defaults.sql",
	"utf8",
);
const strictStateMigration = readFileSync(
	"supabase/migrations/20260718132000_strict_user_food_list_catalog_state.sql",
	"utf8",
);

describe("saved ingredient catalog links migration", () => {
	it("stores canonical catalog and submission relationships", () => {
		expect(migration).toContain("add column shared_product_id uuid");
		expect(migration).toContain("add column shared_product_submission_id uuid");
		expect(migration).toContain("references public.shared_products(id)");
		expect(migration).toContain("references public.shared_product_submissions(id)");
	});

	it("derives saved-list provenance from current database state", () => {
		expect(migration).toContain(
			"create or replace function public.resolve_user_food_list_catalog_state()",
		);
		expect(migration).toContain("product.status = 'active'");
		expect(migration).toContain("submission.status = 'pending'");
		expect(migration).toContain("then 'pending-review'");
		expect(strictStateMigration).toContain(
			"when v_fallback_source = 'usda' then 'source-verified'",
		);
		expect(strictStateMigration).toContain(
			"when v_fallback_source = 'open-food-facts' then 'imported'",
		);
		expect(strictStateMigration).toContain("else 'user-private'");
		expect(strictStateMigration).not.toContain("public.food_trust_status(new.food)");
	});

	it("refreshes saved items after catalog moderation changes", () => {
		expect(migration).toContain(
			"create trigger refresh_food_list_catalog_state_for_submission",
		);
		expect(migration).toContain(
			"create trigger refresh_food_list_catalog_state_for_product",
		);
		expect(migration).toContain(
			"item.food_identity_key = 'barcode:' || new.barcode",
		);
	});

	it("backfills and indexes the normalized relationships", () => {
		expect(migration).toContain("update public.user_food_list_items item");
		expect(migration).toContain("user_food_list_items_catalog_identity_idx");
		expect(migration).toContain("user_food_list_items_shared_product_idx");
		expect(migration).toContain("user_food_list_items_submission_idx");
		expect(migration).toContain("'pending-review'");
	});

	it("keeps client inserts small while the trigger owns final values", () => {
		expect(defaultsMigration).toContain(
			"alter column source_key set default 'custom'",
		);
		expect(defaultsMigration).toContain(
			"alter column trust_status set default 'user-private'",
		);
	});
});
