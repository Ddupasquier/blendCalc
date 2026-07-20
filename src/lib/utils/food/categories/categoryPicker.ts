export type FoodCategoryPickerOption = {
	id: string;
	label: string;
	observationCount: number;
	sourceCount: number;
	verificationStatus: string;
	symbolKey: string;
};

export type FoodCategoryPickerData = {
	suggestions: FoodCategoryPickerOption[];
	common: FoodCategoryPickerOption[];
	results: FoodCategoryPickerOption[];
};

export type FoodCategoryPickerRequest = {
	productName?: string;
	query?: string;
	sourceCategories?: string[];
	signal?: AbortSignal;
};

export const FOOD_CATEGORY_SEARCH_DEBOUNCE_MS = 180;

const EMPTY_PICKER_DATA: FoodCategoryPickerData = {
	suggestions: [],
	common: [],
	results: [],
};

const isPickerOption = (value: unknown): value is FoodCategoryPickerOption => {
	if (!value || typeof value !== "object") return false;
	const option = value as Partial<FoodCategoryPickerOption>;
	return typeof option.id === "string"
		&& typeof option.label === "string"
		&& typeof option.observationCount === "number"
		&& Number.isFinite(option.observationCount)
		&& typeof option.sourceCount === "number"
		&& Number.isFinite(option.sourceCount)
		&& typeof option.verificationStatus === "string"
		&& typeof option.symbolKey === "string";
};

const readOptions = (value: unknown) =>
	Array.isArray(value) ? value.filter(isPickerOption) : [];

export const loadFoodCategoryPickerData = async (
	request: FoodCategoryPickerRequest,
	fetcher: typeof fetch = fetch,
): Promise<FoodCategoryPickerData> => {
	const searchParams = new URLSearchParams();
	const productName = request.productName?.trim();
	const query = request.query?.trim();
	if (productName) searchParams.set("productName", productName);
	if (query) searchParams.set("query", query);
	for (const category of request.sourceCategories ?? []) {
		const value = category.trim();
		if (value) searchParams.append("sourceCategory", value);
	}
	const requestUrl = `/api/food-categories?${searchParams.toString()}`;

	const response = await fetcher(requestUrl, {
		headers: { accept: "application/json" },
		signal: request.signal,
	});
	if (!response.ok) {
		throw new Error("Food categories could not be loaded.");
	}

	const payload = await response.json() as Partial<FoodCategoryPickerData>;
	return {
		...EMPTY_PICKER_DATA,
		suggestions: readOptions(payload.suggestions),
		common: readOptions(payload.common),
		results: readOptions(payload.results),
	};
};
