const DIRECT_DECLARATION_PATTERN = /\b(may\s+contain|contains)\b(\s*:)?\s*/giu;
const FACILITY_DECLARATION_PATTERN =
	/\b(?:made|manufactured|processed|produced)\s+(?:on\s+(?:shared\s+)?equipment|in\s+(?:a\s+)?facility)\s+(?:that\s+)?(?:also\s+)?(?:handles|processes|uses)\s*:?\s*/giu;
const DECLARATION_PREFIX_PATTERN =
	/^(?:(?:allergen|allergens|allergy information)\s*:?\s*|(?:this|the)\s+(?:food|product)\s*)$/iu;
const NON_ALLERGEN_CONTAINS_PATTERN =
	/^(?:less\s+than\b|\d+(?:\.\d+)?\s*%|one\s+or\s+more\s+of\b|bioengineered\s+food\s+ingredients?\b)/iu;
const BOILERPLATE_PATTERN =
	/\s+(?:all products?|this product|manufactured|processed|produced|made)\b.*$/iu;
const SUPPORTED_DECLARATION_LANGUAGE_CODES = new Set(["en"]);
const INGREDIENT_HEADING_PATTERN = /^\s*(?:other\s+)?ingredients?\s*:\s*/iu;
const PROTECTED_UPPERCASE_TERMS = [
	"BHA",
	"BHT",
	"DNA",
	"EDTA",
	"FD&C",
	"GMO",
	"HCl",
	"MCT",
	"MSG",
	"RNA",
	"TBHQ",
];

/** @typedef {"contains" | "may_contain" | "shared_equipment" | "shared_facility" | "other_precautionary"} DeclarationType */
/** @typedef {"may_contain" | "shared_equipment" | "shared_facility" | "other_precautionary"} PrecautionaryType */
/** @typedef {{ type: DeclarationType; text: string; allergens: string[] }} DeclarationStatement */

export const EXTERNAL_INGREDIENT_NORMALIZATION_METHOD =
	"external-ingredient-statement";
export const EXTERNAL_INGREDIENT_NORMALIZATION_VERSION = 1;

/** @param {unknown} value */
const getPrimaryLanguageCode = (value) =>
	String(value ?? "")
		.trim()
		.toLocaleLowerCase()
		.split("-")[0];

/** @param {string} value */
const formatDeclarationTerm = (value) => {
	const normalized = value
		.replace(/^[\s:,-]+|[\s:,-]+$/gu, "")
		.replace(/^(?:the\s+following|any\s+of\s+the\s+following)\s*:?\s*/iu, "")
		.replace(/\s+/gu, " ")
		.trim();
	if (!normalized) return "";

	const letters = normalized.match(/\p{L}/gu) ?? [];
	const isAllCaps =
		letters.length > 0 &&
		normalized === normalized.toLocaleUpperCase("en-US") &&
		normalized !== normalized.toLocaleLowerCase("en-US");
	if (!isAllCaps) return normalized;

	const lowercase = normalized.toLocaleLowerCase("en-US");
	return lowercase.replace(/\p{L}/u, (letter) =>
		letter.toLocaleUpperCase("en-US"),
	);
};

/** @param {string} value */
export const splitNormalizedIngredientStatement = (value) => {
	/** @type {string[]} */
	const parts = [];
	let current = "";
	let depth = 0;

	for (const character of value) {
		if ("([{\u007b".includes(character)) depth += 1;
		if (")]\u007d".includes(character)) depth = Math.max(0, depth - 1);
		if ((character === "," || character === ";") && depth === 0) {
			parts.push(current);
			current = "";
			continue;
		}
		current += character;
	}
	parts.push(current);

	return parts.map((part) => part.trim()).filter(Boolean);
};

/** @param {string} value */
const splitAllergenTerms = (value) =>
	splitNormalizedIngredientStatement(value).flatMap((part) =>
		/[([{]/u.test(part) ? [part] : part.split(/\s+(?:and|&)\s+/iu),
	);

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

/** @param {string[]} values */
const uniqueTextValues = (values) => {
	const seen = new Set();
	return values.flatMap((value) => {
		const term = value.trim();
		const key = term.toLocaleLowerCase("en-US");
		if (!term || seen.has(key)) return [];
		seen.add(key);
		return [term];
	});
};

/** @param {string} source @param {number} start */
const getDeclarationSegment = (source, start) => {
	const remainder = source.slice(start);
	const boundary = remainder.search(/[.;\n\r]/u);
	const segment = boundary === -1 ? remainder : remainder.slice(0, boundary);
	const sentence = segment.replace(BOILERPLATE_PATTERN, "").trim();
	const sentenceOffset = sentence ? segment.indexOf(sentence) : 0;
	return {
		allergenText: NON_ALLERGEN_CONTAINS_PATTERN.test(sentence) ? "" : sentence,
		end: start + sentenceOffset + sentence.length,
	};
};

/** @param {string} source @param {number} start @param {number} end */
const getExactStatement = (source, start, end) =>
	source.slice(start, end).replace(/\s+/gu, " ").trim();

/** @param {DeclarationStatement[]} values */
const uniqueStatements = (values) => {
	const seen = new Set();
	return values.filter((value) => {
		const key = `${value.type}\u0000${value.text.toLocaleLowerCase("en-US")}`;
		if (!value.text || value.allergens.length === 0 || seen.has(key))
			return false;
		seen.add(key);
		return true;
	});
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
 * @param {{ languageCode?: string | null; sourceField: string }} context
 * @returns {{ method: "bounded-ingredient-label-pattern"; sourceField: string; languageCode?: string; languageStatus: "supported" | "unsupported" | "unknown"; extractionStatus: "parsed" | "none" | "skipped"; contains: string[]; mayContain: string[]; statements: DeclarationStatement[] }}
 */
export const analyzeIngredientLabelAllergenDeclarations = (value, context) => {
	const source = String(value ?? "").trim();
	const languageCode = getPrimaryLanguageCode(context.languageCode);
	/** @type {"supported" | "unsupported" | "unknown"} */
	const languageStatus = !languageCode
		? "unknown"
		: SUPPORTED_DECLARATION_LANGUAGE_CODES.has(languageCode)
			? "supported"
			: "unsupported";
	const emptyResult = {
		method: /** @type {const} */ ("bounded-ingredient-label-pattern"),
		sourceField: context.sourceField,
		...(languageCode ? { languageCode } : {}),
		languageStatus,
		extractionStatus: /** @type {"skipped" | "none"} */ (
			languageStatus === "unsupported" ? "skipped" : "none"
		),
		contains: [],
		mayContain: [],
		statements: [],
	};
	if (!source || languageStatus === "unsupported") return emptyResult;

	/** @type {string[]} */
	const contains = [];
	/** @type {string[]} */
	const mayContain = [];
	/** @type {DeclarationStatement[]} */
	const statements = [];

	DIRECT_DECLARATION_PATTERN.lastIndex = 0;
	for (
		let match = DIRECT_DECLARATION_PATTERN.exec(source);
		match;
		match = DIRECT_DECLARATION_PATTERN.exec(source)
	) {
		if (!hasExplicitDeclarationContext(source, match)) continue;
		const declaration = getDeclarationSegment(
			source,
			match.index + match[0].length,
		);
		if (!declaration.allergenText) continue;
		const destination = /^may\s+contain$/iu.test(match[1] ?? "")
			? mayContain
			: contains;
		const allergens = uniqueTerms(splitAllergenTerms(declaration.allergenText));
		destination.push(...allergens);
		statements.push({
			type: destination === mayContain ? "may_contain" : "contains",
			text: getExactStatement(source, match.index, declaration.end),
			allergens,
		});
	}

	FACILITY_DECLARATION_PATTERN.lastIndex = 0;
	for (
		let match = FACILITY_DECLARATION_PATTERN.exec(source);
		match;
		match = FACILITY_DECLARATION_PATTERN.exec(source)
	) {
		const declaration = getDeclarationSegment(
			source,
			match.index + match[0].length,
		);
		if (!declaration.allergenText) continue;
		const allergens = uniqueTerms(splitAllergenTerms(declaration.allergenText));
		mayContain.push(...allergens);
		statements.push({
			type: /\bon\s+(?:shared\s+)?equipment\b/iu.test(match[0])
				? "shared_equipment"
				: "shared_facility",
			text: getExactStatement(source, match.index, declaration.end),
			allergens,
		});
	}

	const uniqueContains = uniqueTerms(contains);
	const uniqueMayContain = uniqueTerms(mayContain);
	const uniqueDeclarationStatements = uniqueStatements(statements);
	return {
		...emptyResult,
		extractionStatus:
			uniqueDeclarationStatements.length > 0 ? "parsed" : "none",
		contains: uniqueContains,
		mayContain: uniqueMayContain,
		statements: uniqueDeclarationStatements,
	};
};

/** @param {string} value */
const replaceControlCharacters = (value) =>
	[...value]
		.map((character) => {
			const code = character.codePointAt(0) ?? 0;
			return code <= 31 || code === 127 ? " " : character;
		})
		.join("");

/** @param {string} value */
const normalizeStructuralArtifacts = (value) =>
	replaceControlCharacters(value.normalize("NFKC"))
		.replace(/_+/gu, "")
		.replace(/\s+/gu, " ")
		.replace(/\s+([,.;:)]|\])/gu, "$1")
		.replace(/([([])\s+/gu, "$1")
		.replace(/([,;:])(?=\S)/gu, "$1 ")
		.trim();

/** @param {string} value */
const restoreTechnicalTerms = (value) => {
	let result = value;
	for (const term of PROTECTED_UPPERCASE_TERMS) {
		const escaped = term.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
		result = result.replace(new RegExp(`\\b${escaped}\\b`, "giu"), term);
	}
	return result
		.replace(/\be\s*-?\s*(\d{3,4}[a-z]?)\b/giu, "E$1")
		.replace(
			/\bvitamin\s+([abdek])\s*(\d{1,2})?\b/giu,
			(_match, letter, number) =>
				`vitamin ${String(letter).toLocaleUpperCase("en-US")}${number ?? ""}`,
		);
};

/** @param {string} value @param {string} languageCode */
const formatAllCapsEnglish = (value, languageCode) => {
	if (languageCode !== "en") return value;
	const letters = value.match(/\p{L}/gu) ?? [];
	if (letters.length === 0) return value;
	const uppercaseLetters = letters.filter(
		(letter) => letter === letter.toLocaleUpperCase("en-US"),
	);
	if (uppercaseLetters.length / letters.length < 0.9) return value;

	const lowercase = value.toLocaleLowerCase("en-US");
	const sentenceCase = lowercase.replace(
		/(^|[.!?]\s+)(\p{L})/gu,
		(_match, prefix, letter) => `${prefix}${letter.toLocaleUpperCase("en-US")}`,
	);
	return restoreTechnicalTerms(sentenceCase);
};

/**
 * Converts provider ingredient evidence into a stable presentation/storage form.
 * Raw provider payloads remain unchanged in the private source cache.
 *
 * @param {unknown} value
 * @param {{ languageCode?: string | null; sourceField: string }} context
 * @returns {{ ingredientText: string; ingredientList: string[]; declarationAnalysis: ReturnType<typeof analyzeIngredientLabelAllergenDeclarations>; precautionaryStatements: Array<{ type: PrecautionaryType; text: string; allergens: string[] }>; normalization: { method: "external-ingredient-statement"; version: number; sourceField: string; languageCode?: string } }}
 */
export const normalizeExternalIngredientStatement = (value, context) => {
	const languageCode = getPrimaryLanguageCode(context.languageCode);
	const structurallyNormalized = normalizeStructuralArtifacts(
		String(value ?? ""),
	);
	const declarationAnalysis = analyzeIngredientLabelAllergenDeclarations(
		structurallyNormalized,
		context,
	);
	const firstDeclarationIndex = declarationAnalysis.statements.reduce(
		(earliest, statement) => {
			const index = structurallyNormalized
				.toLocaleLowerCase("en-US")
				.indexOf(statement.text.toLocaleLowerCase("en-US"));
			return index >= 0 ? Math.min(earliest, index) : earliest;
		},
		structurallyNormalized.length,
	);
	const ingredientOnlyText = structurallyNormalized
		.slice(0, firstDeclarationIndex)
		.replace(INGREDIENT_HEADING_PATTERN, "")
		.replace(/[.;:\s]+$/gu, "")
		.trim();
	const ingredientText = formatAllCapsEnglish(ingredientOnlyText, languageCode);
	const ingredientList = uniqueTextValues(
		splitNormalizedIngredientStatement(ingredientText),
	);
	const precautionaryStatements = declarationAnalysis.statements.flatMap(
		(statement) => {
			if (statement.type === "contains") return [];
			return [
				{
					...statement,
					type: /** @type {PrecautionaryType} */ (statement.type),
				},
			];
		},
	);

	return {
		ingredientText,
		ingredientList,
		declarationAnalysis,
		precautionaryStatements,
		normalization: {
			method: /** @type {const} */ ("external-ingredient-statement"),
			version: EXTERNAL_INGREDIENT_NORMALIZATION_VERSION,
			sourceField: context.sourceField,
			...(languageCode ? { languageCode } : {}),
		},
	};
};

/** Compatibility export for cached-only catalog backfills. */
export const extractExplicitAllergenDeclarations =
	analyzeIngredientLabelAllergenDeclarations;
