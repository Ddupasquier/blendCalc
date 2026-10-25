import "@testing-library/jest-dom";
import { act, cleanup } from "@testing-library/svelte";
import "./test-reference-catalog-setup";
import { afterEach, vi } from "vitest";

// Register teardown in each test context instead of relying on a dependency's
// import-time registration in the shared VM dependency cache.
afterEach(async () => {
	await act();
	cleanup();
});

// Standalone component tests have no SvelteKit page bootstrap or payload.
vi.mock("$app/env", async () => {
	const { version } = await import("../package.json");
	return {
		browser: true,
		dev: true,
		building: false,
		prerendering: false,
		version: `${version}+component-test`,
	};
});
vi.mock("$app/env/public", () => ({
	PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
	PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_component_test",
	PUBLIC_SITE_URL: "http://localhost:5174",
	PUBLIC_TURNSTILE_SITE_KEY: "",
}));

if (
	typeof HTMLElement !== "undefined" &&
	typeof HTMLElement.prototype.animate !== "function"
) {
	Object.defineProperty(HTMLElement.prototype, "animate", {
		configurable: true,
		writable: true,
		value: () => {
			let resolveFinished: () => void = () => undefined;
			const finished = new Promise<void>((resolve) => {
				resolveFinished = resolve;
			});
			const animation = {
				cancel: () => resolveFinished(),
				finished,
				onfinish: null as Animation["onfinish"],
			} as unknown as Animation;

			queueMicrotask(() => {
				animation.onfinish?.call(
					animation,
					new Event("finish") as AnimationPlaybackEvent,
				);
				resolveFinished();
			});

			return animation;
		},
	});
}
