export const APP_ISSUE_CODES = [
	"AUTH_REQUIRED",
	"ACCESS_DENIED",
	"INVALID_REQUEST",
	"ROUTE_NOT_FOUND",
	"RESOURCE_NOT_FOUND",
	"SERVICE_UNAVAILABLE",
	"UNEXPECTED_ERROR",
	"MODERATION_DATA_UNAVAILABLE",
	"MODERATION_SELF_ACTION_FORBIDDEN",
	"MODERATION_TARGET_NOT_FOUND",
	"MODERATION_TARGET_FORBIDDEN",
	"SEARCH_PAGINATION_INVALID",
	"SEARCH_QUERY_TOO_LONG",
	"SEARCH_FILTER_INVALID",
	"FOOD_SEARCH_UNAVAILABLE",
	"INVALID_BARCODE",
	"PRODUCT_NOT_FOUND",
	"PRODUCT_NAME_REQUIRED",
	"PRODUCT_NAME_CONFLICT",
	"CATEGORY_REQUIRED",
	"IMAGE_PLACEMENT_INVALID",
	"IMAGE_NOT_FOUND",
	"IMAGE_PLACEMENT_SAVE_UNCONFIRMED",
	"CATALOG_VALIDATION_UNAVAILABLE",
	"CATALOG_SUBMISSION_INVALID",
	"CATALOG_CONSENT_REQUIRED",
	"CATALOG_REVIEW_FLAGS_INVALID",
	"CATALOG_SUBMISSION_BLOCKED",
	"CATALOG_SUBMISSION_FAILED",
	"TUTORIAL_CHOICE_INVALID",
	"TUTORIAL_SAVE_FAILED",
	"NUTRIENT_CHILD_EXCEEDS_PARENT",
	"FOOD_INTRINSIC_ALLERGEN",
	"FOOD_ALLERGEN_CONTAINS",
	"FOOD_ALLERGEN_MAY_CONTAIN",
	"FOOD_INGREDIENT_PRESENT",
	"FOOD_RESTRICTION_CONFLICT",
] as const;

export type AppIssueCode = (typeof APP_ISSUE_CODES)[number];
export type AppIssueKind = "error" | "warning";
export type AppIssueParamValue = string | number | boolean;
export type AppIssueParams = Record<string, AppIssueParamValue>;

export type AppIssuePayload = {
	code: AppIssueCode;
	params?: AppIssueParams;
	message: string;
};

type AppIssueDefinition = {
	kind: AppIssueKind;
	title: string;
	message: string | ((params: AppIssueParams) => string);
};

const issueCodes = new Set<string>(APP_ISSUE_CODES);

const readString = (
	params: AppIssueParams,
	key: string,
	fallback: string,
) => {
	const value = params[key];
	return typeof value === "string" && value.trim()
		? value.trim()
		: fallback;
};

const lowerLabel = (
	params: AppIssueParams,
	key: string,
	fallback: string,
) => readString(params, key, fallback).toLocaleLowerCase();

const sentenceLabel = (
	params: AppIssueParams,
	key: string,
	fallback: string,
) => {
	const words = readString(params, key, fallback).split(/\s+/);
	return words.map((word, index) => {
		if (index === 0) {
			const lower = word.toLocaleLowerCase();
			return `${lower.charAt(0).toLocaleUpperCase()}${lower.slice(1)}`;
		}
		return /^[A-Z][A-Z0-9]*$/.test(word)
			? word
			: word.toLocaleLowerCase();
	}).join(" ");
};

export const APP_ISSUE_DEFINITIONS: Record<AppIssueCode, AppIssueDefinition> = {
	AUTH_REQUIRED: {
		kind: "error",
		title: "Sign in needed",
		message: "Please sign in and try again.",
	},
	ACCESS_DENIED: {
		kind: "error",
		title: "Access unavailable",
		message: "Your account doesn’t have permission to do that.",
	},
	INVALID_REQUEST: {
		kind: "error",
		title: "Check your information",
		message: "Something in this request needs attention. Review it and try again.",
	},
	ROUTE_NOT_FOUND: {
		kind: "error",
		title: "Page not found",
		message: "We couldn’t find that page. It may have moved or no longer be available.",
	},
	RESOURCE_NOT_FOUND: {
		kind: "error",
		title: "Item not found",
		message: "We couldn’t find that item. Refresh the page and try again.",
	},
	SERVICE_UNAVAILABLE: {
		kind: "error",
		title: "Temporarily unavailable",
		message: "This part of blendCalc is unavailable right now. Please try again shortly.",
	},
	UNEXPECTED_ERROR: {
		kind: "error",
		title: "We hit a snag",
		message: "We couldn’t load this screen. Try again or return to Ingredients.",
	},
	MODERATION_DATA_UNAVAILABLE: {
		kind: "error",
		title: "Moderation data unavailable",
		message: "We couldn’t load the moderation information. Please try again.",
	},
	MODERATION_SELF_ACTION_FORBIDDEN: {
		kind: "error",
		title: "Action not available",
		message: "You can’t use this moderation action on your own account.",
	},
	MODERATION_TARGET_NOT_FOUND: {
		kind: "error",
		title: "Account not found",
		message: "That account is no longer available.",
	},
	MODERATION_TARGET_FORBIDDEN: {
		kind: "error",
		title: "Action not available",
		message: "Your role can’t moderate that account.",
	},
	SEARCH_PAGINATION_INVALID: {
		kind: "error",
		title: "Search needs a refresh",
		message: "The search paging options are no longer valid. Refresh and try again.",
	},
	SEARCH_QUERY_TOO_LONG: {
		kind: "error",
		title: "Search is too long",
		message: (params) =>
			`Keep your search under ${readString(params, "maximum", "120")} characters and try again.`,
	},
	SEARCH_FILTER_INVALID: {
		kind: "error",
		title: "Filter unavailable",
		message: "That filter is no longer available. Reset the filters and try again.",
	},
	FOOD_SEARCH_UNAVAILABLE: {
		kind: "error",
		title: "Search unavailable",
		message: "We couldn’t search foods right now. Please try again shortly.",
	},
	INVALID_BARCODE: {
		kind: "error",
		title: "Check the barcode",
		message: "That barcode doesn’t look valid. Check the digits and try again.",
	},
	PRODUCT_NOT_FOUND: {
		kind: "error",
		title: "Product not found",
		message: "We couldn’t find a product for that barcode.",
	},
	PRODUCT_NAME_REQUIRED: {
		kind: "error",
		title: "Product name needed",
		message: "Add a product name before continuing.",
	},
	PRODUCT_NAME_CONFLICT: {
		kind: "warning",
		title: "Product name doesn’t match",
		message: (params) =>
			`This barcode belongs to “${readString(params, "productName", "a different product")}”. Use that product’s information to share it, or remove the barcode to keep your entry only in your profile.`,
	},
	CATEGORY_REQUIRED: {
		kind: "warning",
		title: "Category needed",
		message: "Choose the category that best fits this ingredient before continuing.",
	},
	IMAGE_PLACEMENT_INVALID: {
		kind: "error",
		title: "Placement needs attention",
		message: "Restore the default image placement, then try saving again.",
	},
	IMAGE_NOT_FOUND: {
		kind: "error",
		title: "Image not found",
		message: "We couldn’t find this image. Refresh the page and try again.",
	},
	IMAGE_PLACEMENT_SAVE_UNCONFIRMED: {
		kind: "error",
		title: "Save not confirmed",
		message: "We couldn’t confirm the new image placement. Refresh before trying again.",
	},
	CATALOG_VALIDATION_UNAVAILABLE: {
		kind: "error",
		title: "Sharing check unavailable",
		message: "We couldn’t check this product for sharing. Try again shortly.",
	},
	CATALOG_SUBMISSION_INVALID: {
		kind: "error",
		title: "Product needs attention",
		message: "Some product information isn’t valid. Review the entry and try again.",
	},
	CATALOG_CONSENT_REQUIRED: {
		kind: "error",
		title: "Sharing choice needed",
		message: "Confirm that you want to share this product before continuing.",
	},
	CATALOG_REVIEW_FLAGS_INVALID: {
		kind: "error",
		title: "Review details need attention",
		message: "The review details couldn’t be read. Refresh the form and try again.",
	},
	CATALOG_SUBMISSION_BLOCKED: {
		kind: "error",
		title: "Product sharing is paused",
		message: (params) =>
			`Product sharing is paused for this account until ${readString(params, "blockedUntil", "the review period ends")}. You can still save ingredients to your own profile.`,
	},
	CATALOG_SUBMISSION_FAILED: {
		kind: "error",
		title: "Product wasn’t shared",
		message: "Your ingredient is still saved to your profile. You can try sharing it again later.",
	},
	TUTORIAL_CHOICE_INVALID: {
		kind: "error",
		title: "Tutorial choice unavailable",
		message: "That tutorial choice is no longer available. Refresh and try again.",
	},
	TUTORIAL_SAVE_FAILED: {
		kind: "error",
		title: "Choice wasn’t saved",
		message: "We couldn’t save that choice. Please try again.",
	},
	NUTRIENT_CHILD_EXCEEDS_PARENT: {
		kind: "warning",
		title: "Nutrition values need attention",
		message: (params) =>
			`${sentenceLabel(params, "childLabel", "This nutrient")} cannot exceed ${lowerLabel(params, "parentLabel", "its total")}.`,
	},
	FOOD_INTRINSIC_ALLERGEN: {
		kind: "warning",
		title: "Check this ingredient",
		message: (params) =>
			`This ingredient is ${lowerLabel(params, "factLabel", "a selected allergen")}.`,
	},
	FOOD_ALLERGEN_CONTAINS: {
		kind: "warning",
		title: "Check this ingredient",
		message: (params) =>
			`The label lists ${lowerLabel(params, "factLabel", "an allergen")} as an allergen.`,
	},
	FOOD_ALLERGEN_MAY_CONTAIN: {
		kind: "warning",
		title: "Check this ingredient",
		message: (params) =>
			`The label says this product may contain ${lowerLabel(params, "factLabel", "an allergen")}.`,
	},
	FOOD_INGREDIENT_PRESENT: {
		kind: "warning",
		title: "Check this ingredient",
		message: (params) =>
			`${readString(params, "factLabel", "A flagged ingredient")} appears in the ingredient list.`,
	},
	FOOD_RESTRICTION_CONFLICT: {
		kind: "warning",
		title: "Check this ingredient",
		message: (params) => {
			const restriction = lowerLabel(params, "restrictionLabel", "a selected preference");
			const fact = lowerLabel(params, "factLabel", "a conflicting ingredient");
			const evidenceType = readString(params, "evidenceType", "ingredient");
			if (evidenceType === "contains") {
				return `This may not be ${restriction} because the label lists ${fact} as an allergen.`;
			}
			if (evidenceType === "may_contain") {
				return `This may not be ${restriction} because the label says it may contain ${fact}.`;
			}
			if (evidenceType === "intrinsic") {
				return `This may not be ${restriction} because this ingredient is ${fact}.`;
			}
			if (evidenceType === "source_analysis") {
				return `The source’s ingredient analysis indicates this may not be ${restriction}.`;
			}
			return `This may not be ${restriction} because ${fact} appears in the ingredient list.`;
		},
	},
};

export const isAppIssueCode = (value: unknown): value is AppIssueCode =>
	typeof value === "string" && issueCodes.has(value);

export const normalizeAppIssueParams = (value: unknown): AppIssueParams => {
	if (value === null || typeof value !== "object" || Array.isArray(value)) return {};

	const params: AppIssueParams = {};
	for (const [key, parameter] of Object.entries(value).slice(0, 12)) {
		if (typeof parameter === "string") {
			params[key] = parameter.trim().slice(0, 160);
		} else if (
			(typeof parameter === "number" && Number.isFinite(parameter)) ||
			typeof parameter === "boolean"
		) {
			params[key] = parameter;
		}
	}
	return params;
};

export const getAppIssueMessage = (
	code: AppIssueCode,
	params: AppIssueParams = {},
) => {
	const message = APP_ISSUE_DEFINITIONS[code].message;
	return typeof message === "function"
		? message(normalizeAppIssueParams(params))
		: message;
};

export const getAppIssueTitle = (code: AppIssueCode) =>
	APP_ISSUE_DEFINITIONS[code].title;

export const getAppIssueKind = (code: AppIssueCode) =>
	APP_ISSUE_DEFINITIONS[code].kind;

export const createAppIssuePayload = (
	code: AppIssueCode,
	params?: AppIssueParams,
): AppIssuePayload => {
	const safeParams = normalizeAppIssueParams(params);
	return {
		code,
		...(Object.keys(safeParams).length > 0 ? { params: safeParams } : {}),
		message: getAppIssueMessage(code, safeParams),
	};
};

export const getDefaultAppIssueCode = (status: number): AppIssueCode => {
	if (status === 401) return "AUTH_REQUIRED";
	if (status === 403) return "ACCESS_DENIED";
	if (status === 404) return "ROUTE_NOT_FOUND";
	if (status >= 500) return "UNEXPECTED_ERROR";
	return "INVALID_REQUEST";
};
