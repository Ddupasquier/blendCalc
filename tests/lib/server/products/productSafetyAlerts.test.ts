import {
	isCatalogSafetyMonitoringSchemaUnavailable,
	readActiveProductSafetyAlertsByBarcode,
	readActiveProductIdsMatchingSafetyAlertMetadata,
} from "$lib/server/products/productSafetyAlerts.server";
import { describe, expect, it } from "vitest";

describe("product safety-alert schema rollout", () => {
	it("keeps catalog reads available before the additive migration reaches a database", () => {
		expect(
			isCatalogSafetyMonitoringSchemaUnavailable({
				code: "PGRST205",
				message:
					"Could not find the table 'public.official_food_safety_alert_matches' in the schema cache",
			}),
		).toBe(true);
		expect(
			isCatalogSafetyMonitoringSchemaUnavailable({
				code: "42P01",
				message: 'relation "official_food_safety_alert_matches" does not exist',
			}),
		).toBe(true);
	});

	it("does not hide permissions or unrelated database failures", () => {
		expect(
			isCatalogSafetyMonitoringSchemaUnavailable({
				code: "42501",
				message:
					"permission denied for table official_food_safety_alert_matches",
			}),
		).toBe(false);
		expect(
			isCatalogSafetyMonitoringSchemaUnavailable({
				code: "PGRST205",
				message:
					"Could not find the table 'public.some_other_table' in the schema cache",
			}),
		).toBe(false);
		expect(
			isCatalogSafetyMonitoringSchemaUnavailable({
				code: "XX000",
				message: "Unexpected database failure",
			}),
		).toBe(false);
	});

	it("finds an exact active recall from an unpadded UPC without a catalog product", async () => {
		const responses = new Map<string, unknown>([
			[
				"official_food_safety_alert_identifiers",
				{
					data: [
						{
							alert_id: "alert-1",
							created_at: "2026-08-25T00:00:00.000Z",
							normalized_value: "860014523120",
						},
					],
					error: null,
				},
			],
			[
				"official_food_safety_alerts",
				{
					data: [
						{
							id: "alert-1",
							provider_key: "fda-recalls",
							alert_type: "recall",
							classification: null,
							status: "ongoing",
							product_description: "Everything Sprouts Alfalfa Sprouts",
							reason: "Potential Salmonella and E. coli contamination.",
							recalling_organization: "Everything Sprouts LLC",
							source_url: "https://www.fda.gov/example-recall",
							report_date: "2026-08-20",
							recall_initiated_at: "2026-08-19",
							code_information: "Selected lots",
							package_description: "6/5 oz tray",
							last_seen_at: "2026-08-25T00:00:00.000Z",
						},
					],
					error: null,
				},
			],
			[
				"product_data_sources",
				{
					data: [
						{
							key: "fda-recalls",
							display_name: "FDA Recalls",
							attribution_text: "U.S. Food and Drug Administration",
						},
					],
					error: null,
				},
			],
		]);
		const supabase = {
			from: (table: string) => {
				const response = responses.get(table) as {
					data: unknown[];
					error: null;
				};
				const query = {
					select: () => query,
					in: () => query,
					eq: () => query,
					then: (resolve: (value: typeof response) => unknown) =>
						Promise.resolve(resolve(response)),
				};
				return query;
			},
		};

		await expect(
			readActiveProductSafetyAlertsByBarcode(
				"00860014523120",
				supabase as never,
			),
		).resolves.toMatchObject({
			status: "checked",
			alerts: [
				{
					productDescription: "Everything Sprouts Alfalfa Sprouts",
					matchType: "exact_gtin",
					requiresPackageCheck: true,
				},
			],
		});
	});

	it("finds every product linked to active matching organization metadata", async () => {
		const createQuery = (response: { data: unknown[]; error: null }) => {
			const query = {
				select: () => query,
				eq: () => query,
				limit: () => query,
				or: () => query,
				in: () => query,
				then: (resolve: (value: typeof response) => unknown) =>
					Promise.resolve(resolve(response)),
			};
			return query;
		};
		const alertQuery = createQuery({
			data: [{ id: "alert-1" }],
			error: null,
		});
		const matchQuery = createQuery({
			data: [
				{ shared_product_id: "product-1" },
				{ shared_product_id: "product-2" },
				{ shared_product_id: "product-1" },
			],
			error: null,
		});
		const supabase = {
			from: (table: string) =>
				table === "official_food_safety_alerts" ? alertQuery : matchQuery,
		};

		await expect(
			readActiveProductIdsMatchingSafetyAlertMetadata(
				["taylor", "farms"],
				supabase as never,
			),
		).resolves.toEqual(["product-1", "product-2"]);
	});

	it("supports a wider metadata fallback without hardcoded company aliases", async () => {
		const orExpressions: string[] = [];
		const createQuery = (response: { data: unknown[]; error: null }) => {
			const query = {
				select: () => query,
				eq: () => query,
				limit: () => query,
				or: (expression: string) => {
					orExpressions.push(expression);
					return query;
				},
				in: () => query,
				then: (resolve: (value: typeof response) => unknown) =>
					Promise.resolve(resolve(response)),
			};
			return query;
		};
		const supabase = {
			from: (table: string) =>
				createQuery(
					table === "official_food_safety_alerts"
						? { data: [{ id: "alert-1" }], error: null }
						: { data: [{ shared_product_id: "product-1" }], error: null },
				),
		};

		await readActiveProductIdsMatchingSafetyAlertMetadata(
			["taylor", "farms"],
			supabase as never,
			"any",
		);

		expect(orExpressions).toHaveLength(1);
		expect(orExpressions[0]).toContain("recalling_organization.ilike.%taylor%");
		expect(orExpressions[0]).toContain("recalling_organization.ilike.%farms%");
	});
});
