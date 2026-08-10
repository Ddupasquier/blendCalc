export type NutritionLabelOcrMapping = {
	alias: string;
	sourceUnitName: string;
	nutrientId: number;
	nutrientName: string;
	targetUnitName: string;
	priority: number;
	conversionMultiplier: number | null;
};

export type NutritionLabelOcrCandidate = {
	nutrientId: number;
	nutrientName: string;
	value: number;
	unitName: string;
	sourceLine: string;
	alias: string;
};

export type NutritionLabelServingCandidate = {
	label: string;
	gramWeight: number;
};

export type NutritionLabelOcrResult = {
	candidates: NutritionLabelOcrCandidate[];
	serving: NutritionLabelServingCandidate | null;
	rawText: string;
	confidence: number;
};

export type NutritionLabelOcrProgress = {
	status: string;
	progress: number;
};

export type NutritionLabelOcrRecognition = {
	text: string;
	confidence: number;
};

const UNIT_ALIASES: Record<string, string> = {
	CAL: "KCAL",
	CALORIE: "KCAL",
	CALORIES: "KCAL",
	G: "G",
	GRAM: "G",
	GRAMS: "G",
	IU: "IU",
	KCAL: "KCAL",
	MCG: "UG",
	MG: "MG",
	UG: "UG",
	"µG": "UG",
};

const MASS_UNIT_GRAMS: Record<string, number> = {
	G: 1,
	MG: 0.001,
	UG: 0.000001,
};

const normalizeUnit = (value: string) =>
	UNIT_ALIASES[value.trim().toUpperCase()] ?? value.trim().toUpperCase();

const normalizeLine = (value: string) =>
	value
		.normalize("NFKC")
		.replace(/[‐‑‒–—]/gu, "-")
		.replace(/\s+/gu, " ")
		.trim();

const escapeRegExp = (value: string) =>
	value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

const convertAmount = ({
	value,
	fromUnit,
	toUnit,
	conversionMultiplier,
}: {
	value: number;
	fromUnit: string;
	toUnit: string;
	conversionMultiplier: number | null;
}) => {
	const normalizedFrom = normalizeUnit(fromUnit);
	const normalizedTo = normalizeUnit(toUnit);
	if (normalizedFrom === normalizedTo) return value;
	if (conversionMultiplier !== null) return value * conversionMultiplier;

	const fromGrams = MASS_UNIT_GRAMS[normalizedFrom];
	const toGrams = MASS_UNIT_GRAMS[normalizedTo];
	if (fromGrams && toGrams) return value * (fromGrams / toGrams);
	return null;
};

type AliasMatch = {
	mapping: NutritionLabelOcrMapping;
	start: number;
	end: number;
};

const findAliasMatches = (
	line: string,
	mappings: NutritionLabelOcrMapping[],
) => {
	const matches = mappings.flatMap<AliasMatch>((mapping) => {
		const expression = new RegExp(
			`(?:^|\\b)${escapeRegExp(mapping.alias).replace(/\\ /gu, "\\s+")}(?=\\b|$)`,
			"iu",
		);
		const match = expression.exec(line);
		if (!match) return [];
		const leadingBoundaryLength = match[0].length - match[0].trimStart().length;
		const start = match.index + leadingBoundaryLength;
		return [{ mapping, start, end: start + match[0].trimStart().length }];
	});

	return matches
		.sort(
			(left, right) =>
				left.start - right.start ||
				(right.end - right.start) - (left.end - left.start) ||
				left.mapping.priority - right.mapping.priority,
		)
		.filter(
			(match, index, sorted) =>
				!sorted.some(
					(other, otherIndex) =>
						otherIndex !== index &&
						other.start <= match.start &&
						other.end >= match.end &&
						other.end - other.start > match.end - match.start,
				),
		);
};

const AMOUNT_PATTERN = /(?<![\d.])(\d+(?:[.,]\d+)?)\s*(kcal|calories?|mcg|µg|ug|mg|g|iu)?(?![\d.]|\s*%)/giu;

const readAmounts = (value: string) =>
	[...value.matchAll(AMOUNT_PATTERN)]
		.filter((match) => !value.slice(match.index ?? 0, (match.index ?? 0) + match[0].length + 1).includes("%"))
		.map((match) => ({
			value: Number(match[1].replace(",", ".")),
			unit: match[2] ?? "",
			index: match.index ?? 0,
		}))
		.filter((amount) => Number.isFinite(amount.value) && amount.value >= 0);

const findCandidateForMatch = ({
	line,
	match,
	previousEnd,
	nextStart,
}: {
	line: string;
	match: AliasMatch;
	previousEnd: number;
	nextStart: number;
}): NutritionLabelOcrCandidate | null => {
	const before = line.slice(previousEnd, match.start);
	const after = line.slice(match.end, nextStart);
	const afterAmounts = readAmounts(after);
	const beforeAmounts = readAmounts(before);
	const amount = afterAmounts[0] ?? beforeAmounts.at(-1);
	if (!amount) return null;

	const parsedUnit = amount.unit
		? normalizeUnit(amount.unit)
		: normalizeUnit(match.mapping.sourceUnitName);
	const expectedSourceUnit = normalizeUnit(match.mapping.sourceUnitName);
	if (amount.unit && parsedUnit !== expectedSourceUnit) return null;

	const convertedValue = convertAmount({
		value: amount.value,
		fromUnit: expectedSourceUnit,
		toUnit: match.mapping.targetUnitName,
		conversionMultiplier: match.mapping.conversionMultiplier,
	});
	if (convertedValue === null || !Number.isFinite(convertedValue)) return null;

	return {
		nutrientId: match.mapping.nutrientId,
		nutrientName: match.mapping.nutrientName,
		value: convertedValue,
		unitName: match.mapping.targetUnitName,
		sourceLine: line,
		alias: match.mapping.alias,
	};
};

const parseServingCandidate = (
	lines: string[],
): NutritionLabelServingCandidate | null => {
	for (const line of lines) {
		const servingMatch = /\bserving\s*size\b\s*[:\-]?\s*(.+)$/iu.exec(line);
		if (!servingMatch) continue;
		const servingText = servingMatch[1].trim();
		const gramMatch = /(?:\(|\b)(\d+(?:[.,]\d+)?)\s*g\b\)?/iu.exec(servingText);
		if (!gramMatch) continue;
		const gramWeight = Number(gramMatch[1].replace(",", "."));
		if (!Number.isFinite(gramWeight) || gramWeight <= 0) continue;
		const label = servingText
			.replace(gramMatch[0], " ")
			.replace(/[()]/gu, " ")
			.replace(/\s+/gu, " ")
			.trim();
		return {
			label: label || `${gramWeight}g serving`,
			gramWeight,
		};
	}
	return null;
};

export const parseNutritionLabelText = ({
	text,
	mappings,
	confidence = 0,
}: {
	text: string;
	mappings: NutritionLabelOcrMapping[];
	confidence?: number;
}): NutritionLabelOcrResult => {
	const lines = text
		.split(/\r?\n/gu)
		.map(normalizeLine)
		.filter(Boolean);
	const candidatesByNutrient = new Map<number, NutritionLabelOcrCandidate>();

	for (const line of lines) {
		const matches = findAliasMatches(line, mappings);
		for (const [index, match] of matches.entries()) {
			const candidate = findCandidateForMatch({
				line,
				match,
				previousEnd: matches[index - 1]?.end ?? 0,
				nextStart: matches[index + 1]?.start ?? line.length,
			});
			if (!candidate) continue;
			const existing = candidatesByNutrient.get(candidate.nutrientId);
			if (!existing || candidate.alias.length > existing.alias.length) {
				candidatesByNutrient.set(candidate.nutrientId, candidate);
			}
		}
	}

	return {
		candidates: [...candidatesByNutrient.values()],
		serving: parseServingCandidate(lines),
		rawText: text,
		confidence,
	};
};
