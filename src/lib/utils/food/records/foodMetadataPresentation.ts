const LANGUAGE_TAG_PREFIX = /^[a-z]{2,3}:/i;
const METADATA_ACRONYMS = new Map([
	["afcd", "AFCD"],
	["cnf", "CNF"],
	["cofid", "CoFID"],
	["fdc", "FDC"],
	["gs1", "GS1"],
	["gtin", "GTIN"],
	["id", "ID"],
	["ids", "IDs"],
	["ndb", "NDB"],
	["off", "OFF"],
	["upc", "UPC"],
	["url", "URL"],
	["usda", "USDA"],
]);

export const formatFoodMetadataTag = (value: string) => {
	const cleaned = value
		.trim()
		.replace(LANGUAGE_TAG_PREFIX, "")
		.replace(/[_-]+/g, " ")
		.replace(/\s+/g, " ");
	if (!cleaned) return "";

	return `${cleaned.charAt(0).toLocaleUpperCase("en-US")}${cleaned.slice(1)}`;
};

export const formatFoodMetadataKey = (value: string) =>
	value
		.trim()
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.replace(/[_-]+/g, " ")
		.replace(/\s+/g, " ")
		.split(" ")
		.filter(Boolean)
		.map((part) => {
			const acronym = METADATA_ACRONYMS.get(part.toLocaleLowerCase("en-US"));
			if (acronym) return acronym;
			return `${part.charAt(0).toLocaleUpperCase("en-US")}${part.slice(1).toLocaleLowerCase("en-US")}`;
		})
		.join(" ");

export const getUniqueFoodMetadataTags = (
	values: readonly (string | null | undefined)[],
) => {
	const seen = new Set<string>();
	return values.flatMap((value) => {
		const label = value ? formatFoodMetadataTag(value) : "";
		const key = label.toLocaleLowerCase("en-US");
		if (!label || seen.has(key)) return [];
		seen.add(key);
		return [label];
	});
};
