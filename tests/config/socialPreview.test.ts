import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
	APP_SOCIAL_PREVIEW_ALT,
	APP_SOCIAL_PREVIEW_URL,
} from "$lib/config/brand";

const socialPreviewSourcePath = "static/social-preview.svg";
const socialPreviewImagePath = "static/social-preview.png";

describe("social link preview", () => {
	it("uses an absolute, cache-versioned production image URL", () => {
		expect(APP_SOCIAL_PREVIEW_URL).toBe(
			"https://www.blendcalc.food/social-preview.png?v=20260831",
		);
		expect(APP_SOCIAL_PREVIEW_ALT).toContain("nutrition");
		expect(APP_SOCIAL_PREVIEW_ALT).toContain("recalls");
		expect(APP_SOCIAL_PREVIEW_ALT).toContain("allergens");
		expect(APP_SOCIAL_PREVIEW_ALT).toContain("recipes");
	});

	it("keeps the editable source aligned with the current product", () => {
		const source = readFileSync(socialPreviewSourcePath, "utf8");

		expect(source).toContain("blendCalc");
		expect(source).toContain("Know your food.");
		expect(source).toContain("Food warnings");
		expect(source).toContain("Saved recipes");
		expect(source).not.toContain(">Goal<");
		expect(source).not.toContain(">Current<");
		expect(source).not.toMatch(/Smoothie Mixer|Saved mixes|Save blends/i);
	});

	it("renders the standard 1200 by 630 social image", () => {
		const image = readFileSync(socialPreviewImagePath);

		expect(image.subarray(1, 4).toString("ascii")).toBe("PNG");
		expect(image.readUInt32BE(16)).toBe(1200);
		expect(image.readUInt32BE(20)).toBe(630);
	});

	it("uses the shared preview for Open Graph and X cards", () => {
		const layout = readFileSync("src/routes/+layout.svelte", "utf8");

		expect(layout).toContain(
			'<meta property="og:image" content={APP_SOCIAL_PREVIEW_URL} />',
		);
		expect(layout).toContain(
			'<meta name="twitter:image" content={APP_SOCIAL_PREVIEW_URL} />',
		);
		expect(layout).toContain(
			'name="twitter:card" content="summary_large_image"',
		);
	});
});
