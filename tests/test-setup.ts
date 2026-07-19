import '@testing-library/jest-dom';
import '@testing-library/svelte/vitest';
import { nutritionCompletenessCatalogFixture, servingMeasureCatalogFixture } from './fixtures/referenceData';
import { configureServingMeasureCatalog } from '$lib/utils/serving/servingMeasureCatalog';
import { configureNutritionCompletenessCatalog } from '$lib/utils/food/quality/nutritionCompletenessCatalog';

configureServingMeasureCatalog(servingMeasureCatalogFixture);
configureNutritionCompletenessCatalog(nutritionCompletenessCatalogFixture);
