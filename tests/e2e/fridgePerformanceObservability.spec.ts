import { expect, test, waitForAppReady } from "./support/browserTest";

type BrowserTiming = {
	durationMilliseconds: number;
	name: string;
};

const parseServerTiming = (value: string) =>
	Object.fromEntries(
		value.split(",").map((entry) => {
			const [name, duration] = entry.trim().split(";dur=");
			return [name, Number(duration)];
		}),
	);

test("Fridge exposes privacy-safe server and interaction diagnostics", async ({
	page,
}, testInfo) => {
	test.skip(
		testInfo.project.name !== "desktop-chromium",
		"One primary browser records the repeatable performance diagnostic.",
	);

	await page.addInitScript(() => {
		const performanceWindow = window as typeof window & {
			__blendCalcPerformanceTimings?: BrowserTiming[];
		};
		performanceWindow.__blendCalcPerformanceTimings = [];
		window.addEventListener("blendcalc:performance-timing", (event) => {
			performanceWindow.__blendCalcPerformanceTimings?.push(
				(event as CustomEvent<BrowserTiming>).detail,
			);
		});
	});

	const response = await page.goto("/ingredients/fridge");
	expect(response).not.toBeNull();
	const serverTimingHeader = response?.headers()["server-timing"] ?? "";
	const serverTimings = parseServerTiming(serverTimingHeader);
	for (const phase of [
		"auth",
		"root_profile",
		"root_reference",
		"ingredients",
		"total",
	]) {
		expect(serverTimings[phase]).toBeGreaterThanOrEqual(0);
	}

	await waitForAppReady(page);
	await expect
		.poll(async () =>
			page.evaluate(() => {
				const performanceWindow = window as typeof window & {
					__blendCalcPerformanceTimings?: BrowserTiming[];
				};
				return performanceWindow.__blendCalcPerformanceTimings?.some(
					(timing) => timing.name === "hydration",
				);
			}),
		)
		.toBe(true);

	const loadMoreButton = page.getByRole("button", {
		name: "Load more",
		exact: true,
	});
	if (await loadMoreButton.isVisible()) {
		await loadMoreButton.click();
		await expect
			.poll(async () =>
				page.evaluate(() => {
					const performanceWindow = window as typeof window & {
						__blendCalcPerformanceTimings?: BrowserTiming[];
					};
					return performanceWindow.__blendCalcPerformanceTimings?.some(
						(timing) => timing.name === "fridge_load_more",
					);
				}),
			)
			.toBe(true);
	}

	const browserTimings = await page.evaluate(() => {
		const performanceWindow = window as typeof window & {
			__blendCalcPerformanceTimings?: BrowserTiming[];
		};
		return performanceWindow.__blendCalcPerformanceTimings ?? [];
	});
	await testInfo.attach("fridge-performance-diagnostic", {
		body: JSON.stringify({ browserTimings, serverTimings }, null, 2),
		contentType: "application/json",
	});
});
