import {
	isCatalogSafetyMonitoringSchemaUnavailable,
	readActiveProductIdsMatchingSafetyAlertMetadata,
} from "$lib/server/products/productSafetyAlerts.server";
import { describe, expect, it } from "vitest";

describe("product safety-alert schema rollout", () => {
	it("keeps catalog reads available before the additive migration reaches a database", () => {
		expect(isCatalogSafetyMonitoringSchemaUnavailable({
			code: "PGRST205",
			message:
				"Could not find the table 'public.official_food_safety_alert_matches' in the schema cache",
		})).toBe(true);
		expect(isCatalogSafetyMonitoringSchemaUnavailable({
			code: "42P01",
			message: 'relation "official_food_safety_alert_matches" does not exist',
		})).toBe(true);
	});

	it("does not hide permissions or unrelated database failures", () => {
		expect(isCatalogSafetyMonitoringSchemaUnavailable({
			code: "42501",
			message: "permission denied for table official_food_safety_alert_matches",
		})).toBe(false);
		expect(isCatalogSafetyMonitoringSchemaUnavailable({
			code: "PGRST205",
			message: "Could not find the table 'public.some_other_table' in the schema cache",
		})).toBe(false);
		expect(isCatalogSafetyMonitoringSchemaUnavailable({
			code: "XX000",
			message: "Unexpected database failure",
		})).toBe(false);
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
			from: (table: string) => table === "official_food_safety_alerts"
				? alertQuery
				: matchQuery,
		};

		await expect(readActiveProductIdsMatchingSafetyAlertMetadata(
			["taylor", "farms"],
			supabase as never,
		)).resolves.toEqual(["product-1", "product-2"]);
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
			from: (table: string) => createQuery(table === "official_food_safety_alerts"
				? { data: [{ id: "alert-1" }], error: null }
				: { data: [{ shared_product_id: "product-1" }], error: null }),
		};

		await readActiveProductIdsMatchingSafetyAlertMetadata(
			["taylor", "farms"],
			supabase as never,
			"any",
		);

		expect(orExpressions).toHaveLength(1);
		expect(orExpressions[0]).toContain(
			"recalling_organization.ilike.%taylor%",
		);
		expect(orExpressions[0]).toContain(
			"recalling_organization.ilike.%farms%",
		);
	});
});
