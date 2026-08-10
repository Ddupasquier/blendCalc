import "@testing-library/jest-dom";
import "@testing-library/svelte/vitest";
import {
	appReferenceCatalogFixture,
	nutritionCompletenessCatalogFixture,
	servingMeasureCatalogFixture,
} from "./fixtures/referenceCatalogs";
import { configureServingMeasureCatalog } from "$lib/utils/serving/servingMeasureCatalog";
import { configureNutritionCompletenessCatalog } from "$lib/utils/food/quality/nutritionCompletenessCatalog";
import { configureAppReferenceCatalog } from "$lib/utils/food/reference/appReferenceCatalog";

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

configureServingMeasureCatalog(servingMeasureCatalogFixture);
configureNutritionCompletenessCatalog(nutritionCompletenessCatalogFixture);
configureAppReferenceCatalog(appReferenceCatalogFixture);
