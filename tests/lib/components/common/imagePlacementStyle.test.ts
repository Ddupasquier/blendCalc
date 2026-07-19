import { describe, expect, it } from "vitest";

import { getLegacyImagePlacementCssVars } from "$lib/components/common/images/imagePlacementStyle";

describe("getLegacyImagePlacementCssVars", () => {
	it("moves horizontally and vertically even without extra zoom", () => {
		const style = getLegacyImagePlacementCssVars(
			{ cropX: 25, cropY: 75, cropZoom: 1 },
			"image-placement",
		);

		expect(style).toContain("--image-placement-translate-x: 25%");
		expect(style).toContain("--image-placement-translate-y: -25%");
		expect(style).toContain("--image-placement-zoom: 1");
	});

	it("keeps centered images still when crop is centered", () => {
		const style = getLegacyImagePlacementCssVars(
			{ cropX: 50, cropY: 50, cropZoom: 4 },
			"food-symbol",
		);

		expect(style).toContain("--food-symbol-translate-x: 0%");
		expect(style).toContain("--food-symbol-translate-y: 0%");
	});
});
