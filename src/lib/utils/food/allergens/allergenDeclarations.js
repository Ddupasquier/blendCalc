const DIRECT_DECLARATION_PATTERN = /\b(may\s+contain|contains)\b(\s*:)?\s*/giu;
const FACILITY_DECLARATION_PATTERN =
	/\b(?:made|manufactured|processed|produced)\s+(?:on\s+(?:shared\s+)?equipment|in\s+(?:a\s+)?facility)\s+(?:that\s+)?(?:also\s+)?(?:handles|processes|uses)\s*:?\s*/giu;
const DECLARATION_PREFIX_PATTERN =
	/^(?:(?:allergen|allergens|allergy information)\s*:?\s*|(?:this|the)\s+(?:food|product)\s*)$/iu;
const NON_ALLERGEN_CONTAINS_PATTERN =
	/^(?:less\s+than\b|\d+(?:\.\d+)?\s*%|one\s+or\s+more\s+of\b|bioengineered\s+food\s+ingredients?\b)/iu;
const BOILERPLATE_PATTERN =
	/\s+(?:all products?|this product|manufactured|processed|produced|made)\b.*$/iu;

/** @param {string} value */
const formatDeclarationTerm = (value) => {
	const normalized = value
		.replace(/^[\s:,-]+|[\s:,-]+$/gu, "")
		.replace(/^(?:the\s+following|any\s+of\s+the\s+following)\s*:?\s*/iu, "")
		.replace(/\s+/gu, " ")
		.trim();
	if (!normalized) return "";

	const letters = normalized.match(/\p{L}/gu) ?? [];
	const isAllCaps = letters.length > 0 &&
		normalized === normalized.toLocaleUpperCase("en-US") &&
		normalized !== normalized.toLocaleLowerCase("en-US");
	if (!isAllCaps) return normalized;

	const lowercase = normalized.toLocaleLowerCase("en-US");
	return lowercase.replace(/\p{L}/u, (letter) =>
		letter.toLocaleUpperCase("en-US")
	);
};

/** @param {string} value */
const splitTopLevelList = (value) => {
	/** @type {string[]} */
	const parts = [];
	let current = "";
	let depth = 0;

	for (const character of value) {
		if (character === "(" || character === "[") depth += 1;
		if (character === ")" || character === "]") depth = Math.max(0, depth - 1);
		if ((character === "," || character === ";") && depth === 0) {
			parts.push(current);
			current = "";
			continue;
		}
		current += character;
	}
	parts.push(current);

	return parts.flatMap((part) => {
		const trimmed = part.trim();
		if (!trimmed) return [];
		if (/[([]/u.test(trimmed)) return [trimmed];
		return trimmed.split(/\s+(?:and|&)\s+/iu);
	});
};

/** @param {string[]} values */
const uniqueTerms = (values) => {
	const seen = new Set();
	return values.flatMap((value) => {
		const term = formatDeclarationTerm(value);
		const key = term.toLocaleLowerCase("en-US");
		if (!term || seen.has(key)) return [];
		seen.add(key);
		return [term];
	});
};

/** @param {string} source @param {number} start */
const getDeclarationText = (source, start) => {
	const remainder = source.slice(start);
	const boundary = remainder.search(/[.;\n\r]/u);
	const sentence = (boundary === -1 ? remainder : remainder.slice(0, boundary))
		.replace(BOILERPLATE_PATTERN, "")
		.trim();
	return NON_ALLERGEN_CONTAINS_PATTERN.test(sentence) ? "" : sentence;
};

/** @param {string} source @param {RegExpExecArray} match */
const hasExplicitDeclarationContext = (source, match) => {
	if (match[2]) return true;
	const marker = match[1] ?? "";
	if (
		marker === marker.toLocaleUpperCase("en-US") &&
		marker !== marker.toLocaleLowerCase("en-US")
	) {
		return true;
	}

	const sentenceBoundary = Math.max(
		source.lastIndexOf(".", match.index - 1),
		source.lastIndexOf(";", match.index - 1),
		source.lastIndexOf("\n", match.index - 1),
		source.lastIndexOf("\r", match.index - 1),
	);
	const prefix = source.slice(sentenceBoundary + 1, match.index).trim();
	return !prefix || DECLARATION_PREFIX_PATTERN.test(prefix);
};

/**
 * Extracts only explicit package-label allergen declarations. It does not infer
 * allergens from ordinary ingredient names.
 *
 * @param {unknown} value
 * @returns {{ contains: string[]; mayContain: string[] }}
 */
export const extractExplicitAllergenDeclarations = (value) => {
	const source = String(value ?? "").trim();
	if (!source) return { contains: [], mayContain: [] };

	/** @type {string[]} */
	const contains = [];
	/** @type {string[]} */
	const mayContain = [];

	DIRECT_DECLARATION_PATTERN.lastIndex = 0;
	for (
		let match = DIRECT_DECLARATION_PATTERN.exec(source);
		match;
		match = DIRECT_DECLARATION_PATTERN.exec(source)
	) {
		if (!hasExplicitDeclarationContext(source, match)) continue;
		const declaration = getDeclarationText(
			source,
			match.index + match[0].length,
		);
		if (!declaration) continue;
		const destination = /^may\s+contain$/iu.test(match[1] ?? "")
			? mayContain
			: contains;
		destination.push(...splitTopLevelList(declaration));
	}

	FACILITY_DECLARATION_PATTERN.lastIndex = 0;
	for (
		let match = FACILITY_DECLARATION_PATTERN.exec(source);
		match;
		match = FACILITY_DECLARATION_PATTERN.exec(source)
	) {
		const declaration = getDeclarationText(
			source,
			match.index + match[0].length,
		);
		if (declaration) mayContain.push(...splitTopLevelList(declaration));
	}

	return {
		contains: uniqueTerms(contains),
		mayContain: uniqueTerms(mayContain),
	};
};
