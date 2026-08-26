import {
	appReferenceCatalogFixture,
	nutritionCompletenessCatalogFixture,
	servingMeasureCatalogFixture,
} from "./fixtures/referenceCatalogs";
import { configureServingMeasureCatalog } from "$lib/utils/serving/servingMeasureCatalog";
import { configureNutritionCompletenessCatalog } from "$lib/utils/food/quality/nutritionCompletenessCatalog";
import { configureAppReferenceCatalog } from "$lib/utils/food/reference/appReferenceCatalog";

configureServingMeasureCatalog(servingMeasureCatalogFixture);
configureNutritionCompletenessCatalog(nutritionCompletenessCatalogFixture);
configureAppReferenceCatalog(appReferenceCatalogFixture);
