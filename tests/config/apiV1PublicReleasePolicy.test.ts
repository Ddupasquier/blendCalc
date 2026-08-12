import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
	API_V1_REQUIRED_PUBLIC_TERMS_REVIEWS,
	BLENDCALC_API_V1_ACCESS_POLICY,
} from "$lib/api/v1/accessPolicy";

const routePaths = [
	"src/routes/api/v1/categories/+server.ts",
	"src/routes/api/v1/foods/search/+server.ts",
	"src/routes/api/v1/products/[barcode]/+server.ts",
	"src/routes/api/v1/products/[barcode]/revisions/+server.ts",
];

describe("API v1 public-release policy", () => {
	it("keeps public access blocked until every terms area has professional review", () => {
		expect(BLENDCALC_API_V1_ACCESS_POLICY.publicAccessEnabled).toBe(false);
		expect(BLENDCALC_API_V1_ACCESS_POLICY.accessMode).toBe(
			"internal-authenticated",
		);
		expect(BLENDCALC_API_V1_ACCESS_POLICY.professionalTermsReview).toEqual({
			status: "pending",
			reviewedAt: null,
			reviewReference: null,
		});
		expect(API_V1_REQUIRED_PUBLIC_TERMS_REVIEWS).toEqual([
			"acceptable-use",
			"privacy",
			"source-and-asset-attribution",
			"correction-and-removal",
			"community-submission-rights",
			"health-and-nutrition-disclaimer",
			"warranty-and-liability",
		]);
	});

	it.each(routePaths)("routes %s through the shared access boundary", (routePath) => {
		const route = readFileSync(routePath, "utf8");
		expect(route).toContain("hasApiV1CatalogReadAccess");
		expect(route).not.toContain("locals.getVerifiedUser()");
	});

	it("keeps the tracked release review explicit and pending", () => {
		const review = readFileSync("docs/public-api-release.md", "utf8");
		for (const section of [
			"Acceptable Use",
			"Privacy",
			"Attribution And Redistribution",
			"Corrections, Rights Notices, And Removal",
			"Health, Nutrition, And Safety",
			"Warranty And Liability",
			"Approval And Release Procedure",
		]) {
			expect(review).toContain(`## ${section}`);
		}
		expect(review).toContain("not approved legal language or legal advice");
		expect(review).toContain("Pending professional drafting");
	});
});
