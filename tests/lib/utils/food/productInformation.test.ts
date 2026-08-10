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
});
