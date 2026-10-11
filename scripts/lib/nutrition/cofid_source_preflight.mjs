/**
 * Purpose: Validate CoFID source identities before dataset replacement and reconcile
 * persisted counts before activation. Pure preflight never loads credentials or writes.
 * Do not run directly; parent workflow: `npm run import:nutrition:cofid`.
 */

const text = (value) => String(value ?? "").trim();

const refuse = (reason) => {
	const error = new Error(
		`CoFID source refused: ${reason}. Do not replace the existing dataset.`,
	);
	error.code = "COFID_SOURCE_IDENTITY_REFUSED";
	throw error;
};

export const parseCofidSourceValue = (value) => {
	if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
		return { amount: value, status: "measured", qualifier: null };
	}
	const normalized = text(value);
	if (!normalized) return null;
	const numeric = Number(normalized);
	if (Number.isFinite(numeric) && numeric >= 0) {
		return { amount: numeric, status: "measured", qualifier: null };
	}
	const estimate = normalized.match(/^\((\d+(?:\.\d+)?)\)$/u);
	if (estimate && Number.isFinite(Number(estimate[1]))) {
		return {
			amount: Number(estimate[1]),
			status: "measured",
			qualifier: "source-estimate",
		};
	}
	if (/^tr$/iu.test(normalized)) {
		return { amount: null, status: "trace", qualifier: "trace" };
	}
	if (/^n$/iu.test(normalized)) {
		return {
			amount: null,
			status: "present-unquantified",
			qualifier: "present-without-reliable-amount",
		};
	}
	return null;
};

export const preflightCofidSource = ({ foodRows, nutrientSheets }) => {
	if (!Array.isArray(foodRows) || foodRows.length === 0)
		refuse("no food identities");
	if (!Array.isArray(nutrientSheets) || nutrientSheets.length === 0)
		refuse("no nutrient worksheets");
	const foods = new Map();
	for (const row of foodRows) {
		if (!Array.isArray(row) || !text(row[0]) || !text(row[1]))
			refuse("incomplete food identity");
		if (
			(typeof row[0] !== "string" && !Number.isSafeInteger(row[0])) ||
			typeof row[1] !== "string"
		)
			refuse("invalid food identity type");
		const code = String(row[0]);
		if (code !== text(row[0])) refuse("noncanonical food code");
		if (foods.has(code)) refuse("duplicate food code");
		foods.set(code, text(row[1]));
	}
	const sheetNames = new Set();
	const nutrients = new Set();
	let inputNutrientCount = 0;
	for (const worksheet of nutrientSheets) {
		if (!worksheet || typeof worksheet !== "object")
			refuse("invalid nutrient worksheet");
		const { sheet, data } = worksheet;
		if (!text(sheet) || sheetNames.has(sheet))
			refuse("duplicate or missing worksheet identity");
		sheetNames.add(sheet);
		if (
			!Array.isArray(data) ||
			!Array.isArray(data[0]) ||
			!Array.isArray(data[1]) ||
			!Array.isArray(data[2])
		) {
			refuse("missing nutrient headers");
		}
		const columns = [];
		const tags = new Set();
		for (let column = 7; column < data[0].length; column += 1) {
			const tag = text(data[1][column]);
			if (!tag) continue;
			if (tags.has(tag)) refuse("duplicate nutrient header identity");
			tags.add(tag);
			columns.push([column, tag]);
		}
		if (columns.length === 0) refuse("no nutrient identities");
		const sheetFoods = new Set();
		for (const row of data.slice(3)) {
			if (!Array.isArray(row)) refuse("invalid nutrient row");
			if (!row.some((value) => text(value))) continue;
			const code = String(row[0] ?? "");
			if (!foods.has(code) || foods.get(code) !== text(row[1]))
				refuse("worksheet food identity disagrees with Factors");
			if (sheetFoods.has(code)) refuse("repeated worksheet food identity");
			sheetFoods.add(code);
			for (const [column, tag] of columns) {
				if (!parseCofidSourceValue(row[column])) continue;
				inputNutrientCount += 1;
				const key = JSON.stringify([code, tag]);
				if (nutrients.has(key)) refuse("duplicate food/nutrient identity");
				nutrients.add(key);
			}
		}
		if (sheetFoods.size !== foods.size)
			refuse("incomplete worksheet food coverage");
	}
	if (nutrients.size === 0) refuse("no accepted nutrient values");
	return {
		inputFoodCount: foodRows.length,
		distinctFoodCount: foods.size,
		inputNutrientCount,
		distinctNutrientCount: nutrients.size,
	};
};

export const verifyCofidPersistedCounts = async (
	supabase,
	datasetKey,
	expected,
) => {
	const refused = () =>
		Object.assign(
			new Error(
				"CoFID persisted counts could not be reconciled; dataset activation refused.",
			),
			{ code: "COFID_PERSISTED_COUNTS_REFUSED" },
		);
	const counts = {};
	for (const [table, field, expectedCount] of [
		["generic_food_records", "foods", expected.distinctFoodCount],
		["generic_food_nutrients", "nutrients", expected.distinctNutrientCount],
	]) {
		let result;
		try {
			result = await supabase
				.from(table)
				.select("source_food_key", { count: "exact", head: true })
				.eq("dataset_key", datasetKey);
		} catch {
			throw refused();
		}
		const { count, error } = result ?? {};
		if (error || !Number.isSafeInteger(count) || count !== expectedCount) {
			throw refused();
		}
		counts[field] = count;
	}
	return counts;
};
