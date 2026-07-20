import { createReadStream } from "node:fs";
import readExcelFile from "read-excel-file/node";
import {
	createBatchWriter,
	createNutritionImportClient,
	createTemporaryDownloadDirectory,
	deleteGenericDatasetRows,
	downloadTemporaryFile,
	getFilesChecksum,
	normalizeDatasetSearchText,
	normalizeDatasetUnit,
} from "./lib/nutrition_dataset_import.mjs";

const DATASET_KEY = "cofid-2021";
const SOURCE_KEY = "uk-cofid";
const SOURCE_URL =
	"https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx";
const FILE_NAME = "cofid-2021.xlsx";
const dryRun = process.argv.includes("--dry-run");
const NUTRIENT_SHEETS = new Set([
	"1.3 Proximates",
	"1.4 Inorganics",
	"1.5 Vitamins",
	"1.6 Vitamin Fractions",
	"1.8 (SFA per 100gFood)",
	"1.10 (MUFA per 100gFood)",
	"1.12 (PUFA per 100gFood)",
	"1.13 Phytosterols",
	"1.14 Organic Acids",
]);

const supabase = createNutritionImportClient();

const textOrNull = (value) => {
	const normalized = String(value ?? "").trim();
	return normalized || null;
};

const decodeSourceText = (value) =>
	String(value ?? "")
		.replaceAll("&lt;", "<")
		.replaceAll("&gt;", ">")
		.replaceAll("&amp;", "&")
		.replaceAll("&quot;", '"')
		.replaceAll("&#39;", "'")
		.trim();

const parseSourceValue = (value) => {
	if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
		return { amount: value, status: "measured", qualifier: null };
	}
	const normalized = String(value ?? "").trim();
	if (!normalized) return null;
	const numeric = Number(normalized);
	if (Number.isFinite(numeric) && numeric >= 0) {
		return { amount: numeric, status: "measured", qualifier: null };
	}
	const parenthesizedEstimate = normalized.match(/^\((\d+(?:\.\d+)?)\)$/u);
	if (parenthesizedEstimate) {
		return {
			amount: Number(parenthesizedEstimate[1]),
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

const downloadDirectory = await createTemporaryDownloadDirectory(
	"blendcalc-cofid-2021-",
);
const filePath = await downloadTemporaryFile({
	directory: downloadDirectory,
	name: FILE_NAME,
	url: SOURCE_URL,
});
const checksum = await getFilesChecksum({ workbook: filePath });
const sheets = await readExcelFile(createReadStream(filePath));
const factorsSheet = sheets.find(({ sheet }) => sheet === "1.2 Factors");
if (!factorsSheet) throw new Error("CoFID Factors sheet is missing.");

const foodRows = factorsSheet.data.slice(3).filter((row) =>
	textOrNull(row[0]) && textOrNull(row[1])
);
const foodKeys = new Set(foodRows.map((row) => String(row[0])));
const nutrientSheets = sheets.filter(({ sheet }) => NUTRIENT_SHEETS.has(sheet));
if (nutrientSheets.length !== NUTRIENT_SHEETS.size) {
	throw new Error("One or more required CoFID nutrient sheets are missing.");
}

const { data: dataset, error: datasetError } = await supabase
	.from("generic_food_datasets")
	.select("key, import_enabled, license_review_status, metadata")
	.eq("key", DATASET_KEY)
	.single();
if (datasetError) throw datasetError;
if (!dataset.import_enabled || dataset.license_review_status !== "approved") {
	throw new Error(`${DATASET_KEY} is not approved and enabled for import.`);
}

const { data: mappingRows, error: mappingError } = await supabase
	.from("nutrient_source_mappings")
	.select("source_nutrient_key, source_unit_name, nutrient_id")
	.eq("source_key", SOURCE_KEY)
	.eq("enabled", true)
	.order("priority", { ascending: true });
if (mappingError) throw mappingError;
const nutrientMappings = new Map(
	(mappingRows ?? []).map((row) => [
		`${row.source_nutrient_key}|${normalizeDatasetUnit(row.source_unit_name)}`,
		Number(row.nutrient_id),
	]),
);
const per100mlPrefixes = Array.isArray(dataset.metadata?.per100mlFoodGroupPrefixes)
	? dataset.metadata.per100mlFoodGroupPrefixes.map(String)
	: [];

if (!dryRun) {
	const { error: deactivateError } = await supabase
		.from("generic_food_datasets")
		.update({ active: false })
		.eq("key", DATASET_KEY);
	if (deactivateError) throw deactivateError;
	await deleteGenericDatasetRows(supabase, DATASET_KEY);
}

const recordWriter = createBatchWriter({
	supabase,
	table: "generic_food_records",
	onConflict: "dataset_key,source_food_key",
	dryRun,
});
let per100mlFoodCount = 0;
for (const row of foodRows) {
	const sourceFoodKey = String(row[0]);
	const description = decodeSourceText(row[1]);
	const sourceDescription = decodeSourceText(row[2]);
	const foodGroupKey = textOrNull(row[3]);
	const measurementBasis = foodGroupKey && per100mlPrefixes.some((prefix) =>
		foodGroupKey.startsWith(prefix)
	)
		? "per_100ml"
		: "per_100g";
	if (measurementBasis === "per_100ml") per100mlFoodCount += 1;
	await recordWriter.add({
		dataset_key: DATASET_KEY,
		source_food_key: sourceFoodKey,
		description,
		alternate_description: sourceDescription || null,
		food_group_key: foodGroupKey,
		food_group_name: null,
		source_food_code: null,
		external_reference: textOrNull(row[4]),
		scientific_name: null,
		preparation: sourceDescription || null,
		search_text: normalizeDatasetSearchText(
			description,
			sourceDescription,
			foodGroupKey,
		),
		measurement_basis: measurementBasis,
		source_updated_at: null,
		metadata: {
			previousCodes: textOrNull(row[4]),
			mainDataReferences: textOrNull(row[5]),
			footnote: textOrNull(row[6]),
			edibleProportion: textOrNull(row[7]),
			specificGravity: textOrNull(row[8]),
			totalSolids: textOrNull(row[9]),
			nitrogenConversionFactor: textOrNull(row[10]),
			glycerolConversionFactor: textOrNull(row[11]),
		},
	});
}
await recordWriter.finish();

const referenceWriter = createBatchWriter({
	supabase,
	table: "generic_food_dataset_reference_rows",
	onConflict: "dataset_key,reference_type,source_key",
	dryRun,
});
const nutrientDescriptors = new Map();
for (const { sheet, data } of nutrientSheets) {
	const headers = data[0] ?? [];
	const tags = data[1] ?? [];
	const names = data[2] ?? [];
	for (let columnIndex = 7; columnIndex < headers.length; columnIndex += 1) {
		const sourceNutrientKey = textOrNull(tags[columnIndex]);
		if (!sourceNutrientKey) continue;
		const unitMatch = String(headers[columnIndex] ?? "").match(/\(([^()]*)\)\s*$/u);
		const unitName = normalizeDatasetUnit(unitMatch?.[1]);
		const descriptor = {
			sheet,
			columnIndex,
			sourceNutrientKey,
			sourceNutrientName: textOrNull(names[columnIndex]) ?? String(headers[columnIndex]),
			sourceHeader: String(headers[columnIndex]),
			unitName,
		};
		nutrientDescriptors.set(`${sourceNutrientKey}|${unitName}`, descriptor);
		await referenceWriter.add({
			dataset_key: DATASET_KEY,
			reference_type: "nutrient_definition",
			source_key: `${sourceNutrientKey}|${unitName}`,
			payload: descriptor,
		});
	}
}
await referenceWriter.finish();

const nutrientWriter = createBatchWriter({
	supabase,
	table: "generic_food_nutrients",
	onConflict: "dataset_key,source_food_key,source_nutrient_key",
	dryRun,
});
let nutrientValueCount = 0;
let traceValueCount = 0;
let unquantifiedValueCount = 0;
let invalidValueCount = 0;
const observedUnmappedTags = new Set();
for (const { sheet, data } of nutrientSheets) {
	const headers = data[0] ?? [];
	const tags = data[1] ?? [];
	const names = data[2] ?? [];
	for (const row of data.slice(3)) {
		const sourceFoodKey = textOrNull(row[0]);
		if (!sourceFoodKey || !foodKeys.has(sourceFoodKey)) continue;
		for (let columnIndex = 7; columnIndex < headers.length; columnIndex += 1) {
			const sourceNutrientKey = textOrNull(tags[columnIndex]);
			if (!sourceNutrientKey) continue;
			const parsedValue = parseSourceValue(row[columnIndex]);
			if (!parsedValue) {
				if (textOrNull(row[columnIndex])) invalidValueCount += 1;
				continue;
			}
			const unitMatch = String(headers[columnIndex] ?? "").match(/\(([^()]*)\)\s*$/u);
			const unitName = normalizeDatasetUnit(unitMatch?.[1]);
			const nutrientId = nutrientMappings.get(`${sourceNutrientKey}|${unitName}`) ?? null;
			if (!nutrientId) observedUnmappedTags.add(`${sourceNutrientKey}|${unitName}`);
			if (parsedValue.status === "trace") traceValueCount += 1;
			if (parsedValue.status === "present-unquantified") {
				unquantifiedValueCount += 1;
			}
			await nutrientWriter.add({
				dataset_key: DATASET_KEY,
				source_food_key: sourceFoodKey,
				source_nutrient_key: sourceNutrientKey,
				nutrient_id: nutrientId,
				source_nutrient_name: textOrNull(names[columnIndex]) ?? String(headers[columnIndex]),
				unit_name: unitName,
				amount_per_100g: parsedValue.amount,
				value_status: parsedValue.status,
				standard_error: null,
				observation_count: null,
				nutrient_source_code: null,
				source_updated_at: null,
				mapping_status: nutrientId ? "canonical" : "unmapped",
				metadata: {
					sheet,
					sourceHeader: String(headers[columnIndex]),
					sourceToken: textOrNull(row[columnIndex]),
					valueQualifier: parsedValue.qualifier,
				},
			});
			nutrientValueCount += 1;
		}
	}
}
await nutrientWriter.finish();

const summary = {
	dataset: DATASET_KEY,
	foods: foodRows.length,
	per100mlFoodsHeldFromWeightSearch: per100mlFoodCount,
	nutrientDefinitions: nutrientDescriptors.size,
	nutrientValues: nutrientValueCount,
	traceValues: traceValueCount,
	presentUnquantifiedValues: unquantifiedValueCount,
	unmappedObservedTags: observedUnmappedTags.size,
	invalidValues: invalidValueCount,
	checksum,
	dryRun,
};

if (!dryRun) {
	const importedAt = new Date().toISOString();
	const { error: datasetUpdateError } = await supabase
		.from("generic_food_datasets")
		.update({
			active: true,
			imported_at: importedAt,
			source_file_sha256: checksum,
			food_count: foodRows.length,
			nutrient_value_count: nutrientValueCount,
			measure_count: 0,
			metadata: {
				...dataset.metadata,
				per100mlFoodCount,
				traceValueCount,
				presentUnquantifiedValueCount: unquantifiedValueCount,
				unmappedObservedTags: [...observedUnmappedTags].sort(),
				invalidValueCount,
			},
		})
		.eq("key", DATASET_KEY);
	if (datasetUpdateError) throw datasetUpdateError;

	const { error: sourceUpdateError } = await supabase
		.from("product_data_sources")
		.update({ observation_count: foodRows.length, last_observed_at: importedAt })
		.eq("key", SOURCE_KEY);
	if (sourceUpdateError) throw sourceUpdateError;
}

console.table([summary]);
