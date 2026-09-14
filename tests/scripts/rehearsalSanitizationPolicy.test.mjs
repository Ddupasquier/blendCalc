import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
	compileSanitizationManifest,
	SANITIZATION_ACTIONS,
} from "../../scripts/lib/rehearsal/sanitization_policy.mjs";

const column = (name, dataType = "text", udtName = "text", ordinal = 1) => ({
	name,
	dataType,
	udtName,
	nullable: false,
	ordinal,
});

describe("Rehearsal sanitization policy", () => {
	it("fails closed when the schema contains an unclassified table", () => {
		expect(() =>
			compileSanitizationManifest({
				tables: [{ name: "new_unreviewed_table", columns: [column("id")] }],
				migrationCutoff: "20260912185527",
			}),
		).toThrow("Unclassified: new_unreviewed_table");
	});

	it("requires every configured table to remain in the inventory", () => {
		expect(() =>
			compileSanitizationManifest({
				tables: [{ name: "app_delight_messages", columns: [column("id")] }],
				migrationCutoff: "20260912185527",
			}),
		).toThrow("Obsolete:");
	});

	it("exposes only the five reviewed actions", () => {
		expect(Object.values(SANITIZATION_ACTIONS)).toEqual([
			"KEEP EXACTLY",
			"PSEUDONYMIZE",
			"REPLACE WITH SYNTHETIC",
			"EXCLUDE",
			"DERIVE",
		]);
	});

	it("uses database relationships for Auth identities without misclassifying brand owners", () => {
		const manifest = JSON.parse(
			readFileSync(
				fileURLToPath(
					new URL(
						"../../infrastructure/rehearsal/application/sanitization-policy.json",
						import.meta.url,
					),
				),
				"utf8",
			),
		);
		const policies = new Map(
			manifest.tables.flatMap((table) =>
				table.columns.map((manifestColumn) => [
					`${table.name}.${manifestColumn.name}`,
					manifestColumn,
				]),
			),
		);

		expect(policies.get("shared_products.brand_owner").action).toBe(
			"KEEP EXACTLY",
		);
		for (const key of [
			"account_moderation.moderated_by",
			"food_image_assets.canonical_selected_by",
			"food_warning_policy_review_cases.opened_by",
			"profile_image_reports.reported_profile_user_id",
		]) {
			expect(policies.get(key)).toMatchObject({
				action: "PSEUDONYMIZE",
				mappingDomain: "identity:auth.users.id",
			});
		}
		for (const key of [
			"catalog_correction_origins.prefilled_food",
			"custom_foods.food",
			"mix_preferences.mix_state",
			"saved_drinks.drink",
			"shared_product_observations.normalized_food",
			"shared_product_revisions.food",
			"shared_product_submissions.food",
			"shared_products.food",
			"user_food_list_items.food",
		]) {
			const policy = policies.get(key);
			if (
				[
					"shared_product_observations.normalized_food",
					"shared_product_revisions.food",
					"shared_products.food",
				].includes(key)
			) {
				expect(policy.action).toBe("KEEP EXACTLY");
			} else {
				expect(policy.jsonPolicy).toMatchObject({
					humanReadableKeys: {
						brandOwner: "Rehearsal brand",
						description: "Rehearsal food",
					},
				});
			}
		}
		expect(
			manifest.tables.find((table) => table.name === "profiles")
				.ownerIdentityColumns,
		).toEqual(["user_id"]);
		expect(policies.get("shared_products.barcode")).toMatchObject({
			action: "KEEP EXACTLY",
			reason: "production-faithful public catalog or image metadata",
		});
		expect(
			policies.get(
				"generic_food_dataset_import_evidence_runs.evidence_reference",
			),
		).toMatchObject({
			action: "REPLACE WITH SYNTHETIC",
			syntheticFormat: "url",
		});
		expect(
			policies.get("product_source_field_coverage.provider_key"),
		).toMatchObject({
			action: "KEEP EXACTLY",
			reason: "non-personal relational topology",
		});
		expect(
			policies.get("nutrient_mapping_deterministic_backfill_results.reason"),
		).toMatchObject({
			action: "KEEP EXACTLY",
			reason: "database-constrained finite vocabulary",
		});
	});
});
