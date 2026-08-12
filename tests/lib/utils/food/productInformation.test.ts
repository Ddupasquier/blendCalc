import { describe, expect, it } from "vitest";
import { getProductInformation } from "$lib/utils/food/records/productInformation";

describe("product information", () => {
	it("presents accepted source dates and markets from source metadata", () => {
		const information = getProductInformation({
			fdcId: 123,
			description: "Test Product",
			foodNutrients: [],
			sourceMetadata: {
				publishedAt: "2024-07-17T00:00:00.000Z",
				availableAt: "2024-07-18T00:00:00.000Z",
				modifiedAt: "2024-08-01T12:30:00.000Z",
				discontinuedAt: "2025-01-15T00:00:00.000Z",
				marketCountries: ["United States", "Canada"],
			},
		});

		expect(information.sourceRows).toEqual(
			expect.arrayContaining([
				{ label: "Published", value: "Jul 17, 2024" },
				{ label: "Available since", value: "Jul 18, 2024" },
				{ label: "Last updated", value: "Aug 1, 2024" },
				{ label: "Discontinued", value: "Jan 15, 2025" },
				{ label: "Markets", value: "United States, Canada" },
			]),
		);
	});

	it("retains every distinct attribution available for merged food data", () => {
		const firstAttribution = {
			datasetKey: "usda-sr-legacy",
			datasetName: "USDA SR Legacy",
			datasetVersion: "2018",
			sourceName: "USDA",
			sourceUrl: "https://example.com/usda",
			licenseName: "Public domain",
			licenseUrl: "https://example.com/usda-license",
			attributionText: "USDA attribution",
		};
		const secondAttribution = {
			datasetKey: "cnf-2026",
			datasetName: "Canadian Nutrient File",
			datasetVersion: "2026",
			sourceName: "Health Canada",
			sourceUrl: "https://example.com/cnf",
			licenseName: "Open Government Licence",
			licenseUrl: "https://example.com/cnf-license",
			attributionText: "Health Canada attribution",
		};

		const information = getProductInformation({
			fdcId: 123,
			description: "Test Product",
			foodNutrients: [],
			sourceAttribution: firstAttribution,
			sourceAttributions: [firstAttribution, secondAttribution],
		});

		expect(information.sourceAttributions).toEqual([
			secondAttribution,
			firstAttribution,
		]);
	});
});
