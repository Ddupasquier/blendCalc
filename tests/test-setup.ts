import '@testing-library/jest-dom';
import '@testing-library/svelte/vitest';
import { servingMeasureCatalogFixture } from './fixtures/referenceData';
import { configureServingMeasureCatalog } from '$lib/utils/serving/servingMeasureCatalog';

configureServingMeasureCatalog(servingMeasureCatalogFixture);
