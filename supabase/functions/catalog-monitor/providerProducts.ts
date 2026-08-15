import type {
	JsonObject,
	NormalizedProviderSnapshot,
	ProviderSnapshotChange,
	ProviderSnapshotResult,
} from "./types.ts";

const OPEN_FOOD_FACTS_PRODUCT_URL =
	"https://world.openfoodfacts.org/api/v2/product";
const USDA_FOOD_DETAILS_URL = "https://api.nal.usda.gov/fdc/v1/food";

const OPEN_FOOD_FACTS_MONITOR_FIELDS = [
	"code",
	"product_name",
	"generic_name",
	"brands",
	"ingredients_text",
	"ingredients_text_en",
	"ingredients",
	"ingredients_tags",
	"ingredients_analysis_tags",
	"allergens",
	"allergens_tags",
	"traces",
	"traces_tags",
	"traces_from_ingredients",
	"traces_from_user",
	"categories",
	"categories_tags",
	"serving_size",
	"serving_quantity",
	"serving_quantity_unit",
	"quantity",
	"product_quantity",
	"product_quantity_unit",
	"nutriments",
	"labels_tags",
	"rev",
	"last_modified_t",
	"last_updated_t",
	"schema_version",
	"obsolete",
	"obsolete_since_date",
].join(",");

const CHANGE_FIELDS: Array<{
	key: keyof NormalizedProviderSnapshot;
	label: string;
	severity: ProviderSnapshotChange["severity"];
}> = [
	{ key: "productName", label: "Product name", severity: "high" },
	{ key: "brandOwner", label: "Brand", severity: "high" },
	{ key: "serving", label: "Serving information", severity: "high" },
	{ key: "nutrition", label: "Nutrition", severity: "high" },
	{ key: "ingredients", label: "Ingredients", severity: "high" },
	{ key: "allergens", label: "Allergens", severity: "high" },
	{ key: "traces", label: "May contain", severity: "high" },
	{
		key: "precautionaryStatements",
		label: "Precautionary statements",
		severity: "high",
	},
	{ key: "categories", label: "Categories", severity: "medium" },
	{ key: "package", label: "Package", severity: "medium" },
	{ key: "alcoholByVolume", label: "Alcohol by volume", severity: "high" },
];

const asObject = (value: unknown): JsonObject =>
	value && typeof value === "object" && !Array.isArray(value)
		? value as JsonObject
		: {};

const asString = (value: unknown) =>
	typeof value === "string" && value.trim() ? value.trim() : null;

const asFiniteNumber = (value: unknown) => {
	const number = typeof value === "number" ? value : Number(value);
	return Number.isFinite(number) ? number : null;
};

const uniqueSortedStrings = (value: unknown): string[] => {
	const values = Array.isArray(value)
		? value
		: typeof value === "string"
			? value.split(",")
			: [];
	return [...new Set(values.flatMap((item) => {
		const text = asString(item);
		return text ? [text] : [];
	}))].sort((left, right) => left.localeCompare(right));
};

const normalizeTimestampSeconds = (value: unknown) => {
	const seconds = asFiniteNumber(value);
	if (seconds === null || seconds <= 0) return null;
	return new Date(seconds * 1000).toISOString();
};

const normalizeDate = (value: unknown) => {
	const text = asString(value);
	if (!text) return null;
	const parsed = new Date(text);
	return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const normalizeNutrimentEntries = (value: unknown) =>
	Object.entries(asObject(value))
		.filter(([, nutrientValue]) =>
			["number", "string"].includes(typeof nutrientValue)
		)
		.map(([key, nutrientValue]) => ({ key, value: nutrientValue }))
		.sort((left, right) => left.key.localeCompare(right.key));

const normalizeUsdaNutrients = (value: unknown) =>
	(Array.isArray(value) ? value : [])
		.flatMap((entry) => {
			const row = asObject(entry);
			const nutrient = asObject(row.nutrient);
			const amount = asFiniteNumber(row.amount);
			const id = asFiniteNumber(nutrient.id);
			if (amount === null || id === null) return [];
			return [{
				id,
				name: asString(nutrient.name),
				number: asString(nutrient.number),
				unit: asString(nutrient.unitName),
				amount,
			}];
		})
		.sort((left, right) => left.id - right.id);

const stableValue = (value: unknown): unknown => {
	if (Array.isArray(value)) return value.map(stableValue);
	if (!value || typeof value !== "object") return value;
	return Object.fromEntries(
		Object.entries(value as JsonObject)
			.filter(([, child]) => child !== undefined)
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([key, child]) => [key, stableValue(child)]),
	);
};

export const stableStringify = (value: unknown) =>
	JSON.stringify(stableValue(value));

export const hashJson = async (value: unknown) => {
	const bytes = new TextEncoder().encode(stableStringify(value));
	const digest = await crypto.subtle.digest("SHA-256", bytes);
	return [...new Uint8Array(digest)]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
};

export const normalizeOpenFoodFactsSnapshot = (
	response: JsonObject,
): NormalizedProviderSnapshot => {
	const product = asObject(response.product);
	const nutriments = asObject(product.nutriments);
	const ingredientsText =
		asString(product.ingredients_text_en) ?? asString(product.ingredients_text);
	const updatedAt =
		normalizeTimestampSeconds(product.last_updated_t) ??
		normalizeTimestampSeconds(product.last_modified_t);
	const alcohol =
		asFiniteNumber(nutriments.alcohol_100g) ??
		asFiniteNumber(nutriments.alcohol_value);

	return {
		productName: asString(product.product_name) ?? asString(product.generic_name),
		brandOwner: asString(product.brands),
		serving: asString(product.serving_size) || asFiniteNumber(product.serving_quantity)
			? {
				label: asString(product.serving_size),
				quantity: asFiniteNumber(product.serving_quantity),
				unit: asString(product.serving_quantity_unit),
			}
			: null,
		nutrition: normalizeNutrimentEntries(nutriments),
		ingredients: ingredientsText || Array.isArray(product.ingredients)
			? {
				text: ingredientsText,
				structured: stableValue(Array.isArray(product.ingredients) ? product.ingredients : []),
				tags: uniqueSortedStrings(product.ingredients_tags),
				analysisTags: uniqueSortedStrings(product.ingredients_analysis_tags),
			}
			: null,
		allergens: uniqueSortedStrings(product.allergens_tags ?? product.allergens),
		traces: uniqueSortedStrings(product.traces_tags ?? product.traces),
		precautionaryStatements: uniqueSortedStrings([
			...uniqueSortedStrings(product.traces_from_ingredients),
			...uniqueSortedStrings(product.traces_from_user),
		]),
		categories: uniqueSortedStrings(product.categories_tags ?? product.categories),
		package: asString(product.quantity) || asFiniteNumber(product.product_quantity)
			? {
				label: asString(product.quantity),
				amount: asFiniteNumber(product.product_quantity),
				unit: asString(product.product_quantity_unit),
			}
			: null,
		alcoholByVolume: alcohol === null
			? null
			: { percent: alcohol, basis: "volume-percent" },
		sourceMetadata: {
			barcode: asString(product.code),
			revision: asFiniteNumber(product.rev),
			updatedAt,
			modifiedAt: normalizeTimestampSeconds(product.last_modified_t),
			schemaVersion: asFiniteNumber(product.schema_version),
			obsolete: product.obsolete === true || product.obsolete === "1",
			obsoleteSince: normalizeDate(product.obsolete_since_date),
			labels: uniqueSortedStrings(product.labels_tags),
		},
	};
};

export const normalizeUsdaSnapshot = (
	food: JsonObject,
): NormalizedProviderSnapshot => ({
	productName: asString(food.description),
	brandOwner: asString(food.brandOwner) ?? asString(food.brandName),
	serving: asFiniteNumber(food.servingSize) !== null || asString(food.householdServingFullText)
		? {
			quantity: asFiniteNumber(food.servingSize),
			unit: asString(food.servingSizeUnit),
			label: asString(food.householdServingFullText),
		}
		: null,
	nutrition: normalizeUsdaNutrients(food.foodNutrients),
	ingredients: asString(food.ingredients)
		? { text: asString(food.ingredients) }
		: null,
	allergens: [],
	traces: [],
	precautionaryStatements: [],
	categories: uniqueSortedStrings([
		...uniqueSortedStrings(food.brandedFoodCategory),
		...uniqueSortedStrings(asObject(food.foodCategory).description),
	]),
	package: asString(food.packageWeight)
		? { label: asString(food.packageWeight) }
		: null,
	alcoholByVolume: null,
	sourceMetadata: {
		fdcId: asFiniteNumber(food.fdcId),
		dataType: asString(food.dataType),
		publicationDate: normalizeDate(food.publicationDate),
		modifiedDate: normalizeDate(food.modifiedDate),
		availableDate: normalizeDate(food.availableDate),
		discontinuedDate: normalizeDate(food.discontinuedDate),
	},
});

export const compareProviderSnapshots = (
	previous: NormalizedProviderSnapshot | null,
	observed: NormalizedProviderSnapshot,
): ProviderSnapshotChange[] => {
	if (!previous) return [];
	return CHANGE_FIELDS.flatMap(({ key, label, severity }) =>
		stableStringify(previous[key]) === stableStringify(observed[key])
			? []
			: [{
				field: key,
				label,
				severity,
				previousValue: previous[key],
				observedValue: observed[key],
			}],
	);
};

export class ProviderRequestError extends Error {
	constructor(
		message: string,
		public readonly result:
			| "not_found"
			| "rate_limited"
			| "provider_unavailable"
			| "invalid_response",
	) {
		super(message);
	}
}

const fetchJson = async (url: URL, headers: HeadersInit = {}) => {
	const response = await fetch(url, {
		headers: { accept: "application/json", ...headers },
		signal: AbortSignal.timeout(15_000),
	});
	if (response.status === 404) {
		throw new ProviderRequestError("Provider record was not found", "not_found");
	}
	if (response.status === 429) {
		throw new ProviderRequestError("Provider request was rate limited", "rate_limited");
	}
	if (!response.ok) {
		throw new ProviderRequestError(
			`Provider request failed with ${response.status}`,
			"provider_unavailable",
		);
	}
	const value = await response.json();
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new ProviderRequestError("Provider response was invalid", "invalid_response");
	}
	return value as JsonObject;
};

export const fetchOpenFoodFactsMetadata = async (barcode: string) => {
	const url = new URL(
		`${OPEN_FOOD_FACTS_PRODUCT_URL}/${encodeURIComponent(barcode)}.json`,
	);
	url.searchParams.set("fields", "code,rev,last_modified_t,last_updated_t");
	const response = await fetchJson(url, { "user-agent": "blendCalc catalog monitor" });
	const product = asObject(response.product);
	if (response.status !== 1 || !asString(product.code)) {
		throw new ProviderRequestError("Open Food Facts record was not found", "not_found");
	}
	return {
		providerRevision: asFiniteNumber(product.rev)?.toString() ?? null,
		providerUpdatedAt:
			normalizeTimestampSeconds(product.last_updated_t) ??
			normalizeTimestampSeconds(product.last_modified_t),
	};
};

export const fetchOpenFoodFactsSnapshot = async (
	barcode: string,
): Promise<ProviderSnapshotResult> => {
	const url = new URL(
		`${OPEN_FOOD_FACTS_PRODUCT_URL}/${encodeURIComponent(barcode)}.json`,
	);
	url.searchParams.set("fields", OPEN_FOOD_FACTS_MONITOR_FIELDS);
	url.searchParams.set("blame", "1");
	const rawPayload = await fetchJson(url, { "user-agent": "blendCalc catalog monitor" });
	if (rawPayload.status !== 1 || !asObject(rawPayload.product).code) {
		throw new ProviderRequestError("Open Food Facts record was not found", "not_found");
	}
	const normalizedSnapshot = normalizeOpenFoodFactsSnapshot(rawPayload);
	return {
		rawPayload,
		normalizedSnapshot,
		contentHash: await hashJson(normalizedSnapshot),
		providerRevision:
			asFiniteNumber(asObject(rawPayload.product).rev)?.toString() ?? null,
		providerUpdatedAt:
			asString(normalizedSnapshot.sourceMetadata.updatedAt) ?? null,
	};
};

export const fetchUsdaSnapshot = async (
	fdcId: string,
	apiKey: string,
): Promise<ProviderSnapshotResult> => {
	const url = new URL(`${USDA_FOOD_DETAILS_URL}/${encodeURIComponent(fdcId)}`);
	url.searchParams.set("api_key", apiKey);
	const rawPayload = await fetchJson(url);
	if (!asFiniteNumber(rawPayload.fdcId)) {
		throw new ProviderRequestError("USDA response was invalid", "invalid_response");
	}
	const normalizedSnapshot = normalizeUsdaSnapshot(rawPayload);
	return {
		rawPayload,
		normalizedSnapshot,
		contentHash: await hashJson(normalizedSnapshot),
		providerRevision: asString(rawPayload.modifiedDate),
		providerUpdatedAt: normalizeDate(rawPayload.modifiedDate),
	};
};
