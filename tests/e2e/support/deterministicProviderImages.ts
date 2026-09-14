import type { Page } from "@playwright/test";

const deterministicProviderImage =
	'<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160" viewBox="0 0 240 160"><rect width="240" height="160" fill="#d9b46f"/><rect x="28" y="20" width="184" height="120" rx="12" fill="#f7f1e4"/><text x="120" y="90" text-anchor="middle" font-family="sans-serif" font-size="24" fill="#2f3440">QA label</text></svg>';

export const serveDeterministicOpenFoodFactsImages = (page: Page) =>
	page.route("https://images.openfoodfacts.org/**", (route) =>
		route.fulfill({
			body: deterministicProviderImage,
			contentType: "image/svg+xml",
			status: 200,
		}),
	);
