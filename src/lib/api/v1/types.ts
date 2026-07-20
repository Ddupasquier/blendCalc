export const BLENDCALC_API_V1 = "1.0" as const;

export type ApiV1Source = {
	source: string;
	reference: string | null;
	confidence: string | null;
};

export type ApiV1Category = {
	id: string;
	name: string;
	slug: string;
	updatedAt: string | null;
};

export type ApiV1Nutrient = {
	id: number;
	name: string;
	number: string | null;
	unit: string;
	amountPer100g: number | null;
	valueStatus: "reported" | "derived" | "missing";
	source: ApiV1Source | null;
};

export type ApiV1Serving = {
	label: string;
	grams: number | null;
	quantity: number | null;
	unit: string | null;
	gramsPerUnit: number | null;
	isPrimary: boolean;
	source: ApiV1Source | null;
};

export type ApiV1ImagePlacement = {
	fitMode: string;
	x: number;
	y: number;
	zoom: number;
	version: number;
};

export type ApiV1Image = {
	role: string;
	url: string;
	thumbnailUrl: string | null;
	license: {
		name: string;
		url: string | null;
		attribution: string | null;
	};
	placement: ApiV1ImagePlacement;
	source: ApiV1Source;
	approvedAt: string | null;
};

export type ApiV1Warning = {
	code: string;
	message: string;
	category: string;
	type: string;
	confidence: string;
	sourceText: string | null;
};

export type ApiV1ProductRevision = {
	id: string | null;
	number: number | null;
	currentSince: string;
	labelObservedAt: string | null;
	updatedAt: string;
	lastVerifiedAt: string | null;
};

export type ApiV1Product = {
	id: string;
	barcode: string;
	name: string;
	brand: string | null;
	category: ApiV1Category | null;
	ingredients: {
		text: string | null;
		allergens: string[];
		traces: string[];
		dietaryTags: string[];
	};
	nutrients: ApiV1Nutrient[];
	servings: ApiV1Serving[];
	images: ApiV1Image[];
	warnings: ApiV1Warning[];
	fieldSources: {
		name: ApiV1Source;
		brand: ApiV1Source | null;
		category: ApiV1Source | null;
		ingredients: ApiV1Source | null;
	};
	revision: ApiV1ProductRevision;
	links: {
		self: string;
	};
};

export type ApiV1Pagination = {
	limit: number;
	offset: number;
	total: number;
	hasMore: boolean;
	nextOffset: number | null;
};

export type ApiV1Success<Data> = {
	apiVersion: typeof BLENDCALC_API_V1;
	data: Data;
	meta?: {
		pagination: ApiV1Pagination;
	};
};

export type ApiV1Error = {
	apiVersion: typeof BLENDCALC_API_V1;
	error: {
		code: string;
		message: string;
	};
};
