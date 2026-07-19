const SOURCE_NAME_ACRONYMS = [
	"bbq",
	"bpa",
	"dna",
	"fda",
	"fdc",
	"gmo",
	"gtin",
	"pb",
	"upc",
	"us",
	"usa",
	"usda",
];
const SOURCE_NAME_LOWERCASE_UNITS = [
	"fl",
	"g",
	"kg",
	"lb",
	"lbs",
	"mcg",
	"mg",
	"ml",
	"oz",
];
const MANAGED_PRODUCT_SOURCE_KEYS = new Set([
	"community",
	"community-reviewed",
	"fdc",
	"fsanz-afcd",
	"health-canada-cnf",
	"open-food-facts",
	"shared-catalog",
	"usda",
	"uk-cofid",
]);

/** @param {unknown} value */
const normalizeWhitespace = (value) => String(value ?? "").trim().replace(/\s+/g, " ");

/** @param {unknown} value */
export const isAllCapsProductName = (value) => {
	const normalized = normalizeWhitespace(value);
	const letters = normalized.match(/\p{L}/gu) ?? [];
	return Boolean(
		letters.length > 0 &&
			normalized === normalized.toLocaleUpperCase("en-US") &&
			normalized !== normalized.toLocaleLowerCase("en-US"),
	);
};

/** @param {string} word */
const formatSourceNameWord = (word) => {
	const lowerWord = word.toLocaleLowerCase("en-US");
	const possessiveMatch = lowerWord.match(/^(.+?)(['’]s)$/u);
	const acronymCandidate = possessiveMatch?.[1] ?? lowerWord;
	const possessiveSuffix = possessiveMatch?.[2] ?? "";

	if (lowerWord === "and") return "&";
	if (SOURCE_NAME_ACRONYMS.includes(acronymCandidate)) {
		return `${acronymCandidate.toLocaleUpperCase("en-US")}${possessiveSuffix}`;
	}
	if (SOURCE_NAME_LOWERCASE_UNITS.includes(lowerWord)) return lowerWord;

	if (/^[a-z](?:&[a-z])+(['’]s)?$/iu.test(word)) {
		return lowerWord.replace(/[a-z]/gi, (letter, offset) =>
			offset === lowerWord.length - 1 && possessiveSuffix
				? letter
				: letter.toLocaleUpperCase("en-US")
		);
	}

	const letters = [...word].filter((character) => /\p{L}/u.test(character));
	const hasIntentionalInnerCapital = letters
		.slice(1)
		.some((character) => character === character.toLocaleUpperCase("en-US") &&
			character !== character.toLocaleLowerCase("en-US"));
	if (hasIntentionalInnerCapital && !isAllCapsProductName(word)) return word;

	const titleWord = lowerWord.replace(/\p{L}/u, (letter) =>
		letter.toLocaleUpperCase("en-US")
	);
	return titleWord.replace(/^([OD])(['’])(\p{L})/u, (_, prefix, apostrophe, letter) =>
		`${prefix}${apostrophe}${letter.toLocaleUpperCase("en-US")}`
	);
};

/** @param {unknown} value */
export const formatSourceProductName = (value) => {
	const normalized = normalizeWhitespace(value);
	return normalized.replace(/[\p{L}\p{N}]+(?:[&'’][\p{L}\p{N}]+)*/gu, (word) =>
		formatSourceNameWord(word)
	);
};

/**
 * @param {{
 *   fdcId?: unknown;
 *   description?: unknown;
 *   customFood?: unknown;
 *   nameProvenance?: unknown;
 *   barcodeSource?: unknown;
 *   sourceKey?: unknown;
 *   sharedProductId?: unknown;
 * } | null | undefined} food
 */
export const isManagedProductName = (food) => {
	if (!food || food.nameProvenance === "user") return false;
	if (food.nameProvenance === "source" || food.nameProvenance === "barcode") {
		return true;
	}

	const sourceKey = String(food.sourceKey ?? "").toLocaleLowerCase("en-US");
	const barcodeSource = String(food.barcodeSource ?? "").toLocaleLowerCase("en-US");
	if (
		MANAGED_PRODUCT_SOURCE_KEYS.has(sourceKey) ||
		MANAGED_PRODUCT_SOURCE_KEYS.has(barcodeSource) ||
		Boolean(food.sharedProductId)
	) {
		return true;
	}

	const fdcId = Number(food.fdcId);
	return food.customFood !== true && Number.isSafeInteger(fdcId) && fdcId > 0;
};

/**
 * @template {{ description?: unknown; nameProvenance?: unknown }} Food
 * @param {Food} food
 * @returns {Food}
 */
export const normalizeFoodProductName = (food) => {
	const managedName = isManagedProductName(food);
	const description = managedName
		? formatSourceProductName(food.description)
		: normalizeWhitespace(food.description);
	const nameProvenance = food.nameProvenance ?? (managedName ? "source" : "user");

	return {
		...food,
		description,
		nameProvenance,
	};
};
