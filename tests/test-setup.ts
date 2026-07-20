import '@testing-library/jest-dom';
import '@testing-library/svelte/vitest';
import { appReferenceCatalogFixture, nutritionCompletenessCatalogFixture, servingMeasureCatalogFixture } from './fixtures/referenceData';
import { configureServingMeasureCatalog } from '$lib/utils/serving/servingMeasureCatalog';
import { configureNutritionCompletenessCatalog } from '$lib/utils/food/quality/nutritionCompletenessCatalog';
import { configureAppReferenceCatalog } from '$lib/utils/food/reference/appReferenceCatalog';

configureServingMeasureCatalog(servingMeasureCatalogFixture);
configureNutritionCompletenessCatalog(nutritionCompletenessCatalogFixture);
configureAppReferenceCatalog(appReferenceCatalogFixture);
