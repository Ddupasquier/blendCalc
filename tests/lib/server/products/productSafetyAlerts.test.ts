import {
	isCatalogSafetyMonitoringSchemaUnavailable,
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
});
