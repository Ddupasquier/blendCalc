/**
 * Purpose: Download the official Canadian Nutrient File 2026 CSV set, normalize foods,
 * nutrients, measures, source metadata, and values, then replace that dataset's canonical
 * Supabase rows. Downloads use temporary files; the live import writes the database.
 * Validate only: `npm run import:nutrition:cnf -- --dry-run`
 * Import: `npm run import:nutrition:cnf`
 */

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { parse } from "csv-parse";
import WebSocket from "ws";
import {
	createTemporaryDownloadDirectory,
	downloadTemporaryFile,
} from "../../lib/nutrition/nutrition_dataset_import.mjs";

config({ path: ".env.moderation.local", quiet: true });
config({ path: ".env", quiet: true });

const DATASET_KEY = "cnf-2026";
const SOURCE_KEY = "health-canada-cnf";
const BATCH_SIZE = 750;
const WRITE_CONCURRENCY = 4;
const dryRun = process.argv.includes("--dry-run");

const files = {
	foods: {
		name: "Food_Name.csv",
		url: "https://open.canada.ca/data/dataset/1b6139bd-ed7e-4043-bc28-ff00e10f3109/resource/e1ffee62-58cb-4e3e-b359-115c658388ad/download/food_name.csv",
	},
	foodSources: {
		name: "Food_Source.csv",
		url: "https://open.canada.ca/data/dataset/1b6139bd-ed7e-4043-bc28-ff00e10f3109/resource/53819b2a-bf8e-40c1-9a12-0c8897d6dc76/download/food_source.csv",
	},
	foodGroups: {
		name: "CNF_Food_Group.csv",
		url: "https://open.canada.ca/data/dataset/1b6139bd-ed7e-4043-bc28-ff00e10f3109/resource/adc5b26e-14ea-4697-b208-bbb311955c81/download/cnf_food_group.csv",
	},
	nutrientAmounts: {
		name: "Nutrient_Amount.csv",
		url: "https://open.canada.ca/data/dataset/1b6139bd-ed7e-4043-bc28-ff00e10f3109/resource/0ff718fc-1133-4154-80c5-3d619e6c63be/download/nutrient_amount.csv",
	},
	nutrientNames: {
		name: "Nutrient_Name.csv",
		url: "https://open.canada.ca/data/dataset/1b6139bd-ed7e-4043-bc28-ff00e10f3109/resource/e0aca283-16b5-4eba-a54a-4994490a3262/download/nutrient_name.csv",
	},
	nutrientSources: {
		name: "Nutrient_Source.csv",
		url: "https://open.canada.ca/data/dataset/1b6139bd-ed7e-4043-bc28-ff00e10f3109/resource/76c74969-2599-4ebb-8401-d5aaa60a3100/download/nutrient_source.csv",
	},
	measureWeights: {
		name: "Measure_Weight_Conversion.csv",
		url: "https://open.canada.ca/data/dataset/1b6139bd-ed7e-4043-bc28-ff00e10f3109/resource/bb76d816-3ac0-4749-8c4b-f0dbfd0fac76/download/measure_weight_conversion.csv",
	},
	measureTypes: {
		name: "Measure_Type.csv",
		url: "https://open.canada.ca/data/dataset/1b6139bd-ed7e-4043-bc28-ff00e10f3109/resource/e7eac9fc-b46c-4c18-8729-b962d2412fec/download/measure_type.csv",
	},
	measureNames: {
		name: "Measure_Name.csv",
		url: "https://open.canada.ca/data/dataset/1b6139bd-ed7e-4043-bc28-ff00e10f3109/resource/104adbc9-f4cc-40b1-9aaa-08290648e24b/download/measure_name.csv",
	},
};

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
	throw new Error(
		"Add PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.moderation.local.",
	);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
	auth: {
		autoRefreshToken: false,
		detectSessionInUrl: false,
		persistSession: false,
	},
	realtime: { transport: WebSocket },
});

const textOrNull = (value) => {
	const normalized = String(value ?? "").trim();
	return normalized || null;
};

const numberOrNull = (value) => {
	const normalized = String(value ?? "").trim();
	if (!normalized) return null;
	const parsed = Number(normalized);
	return Number.isFinite(parsed) ? parsed : null;
};

const dateOrNull = (value) => {
	const normalized = textOrNull(value);
	return normalized && /^\d{4}-\d{2}-\d{2}$/.test(normalized)
		? normalized
		: null;
};

const normalizeSearchText = (...values) =>
	values
		.flatMap((value) => String(value ?? "").split(/\s+/))
		.map((value) => value.trim().toLowerCase())
		.filter(Boolean)
		.join(" ");

const csvRows = (filePath) =>
	createReadStream(filePath).pipe(parse({
		bom: true,
		columns: true,
		relax_column_count: true,
		skip_empty_lines: true,
		trim: true,
	}));

const readCsvRows = async (filePath) => {
	const rows = [];
	for await (const row of csvRows(filePath)) rows.push(row);
	return rows;
};

const getFilesChecksum = async (paths) => {
	const hash = createHash("sha256");
	for (const [key, filePath] of Object.entries(paths).sort()) {
		hash.update(key);
		hash.update(await readFile(filePath));
	}
	return hash.digest("hex");
};

const withRetries = async (operation, label) => {
	let lastError;
	for (let attempt = 1; attempt <= 3; attempt += 1) {
		try {
			return await operation();
		} catch (error) {
			lastError = error;
			if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 500));
		}
	}
	throw new Error(`${label} failed after three attempts: ${lastError?.message ?? lastError}`);
};

const upsertBatch = async (table, rows, onConflict) => {
	if (rows.length === 0 || dryRun) return;
	await withRetries(async () => {
		const { error } = await supabase.from(table).upsert(rows, { onConflict });
		if (error) throw error;
	}, `${table} batch`);
};

const createBatchWriter = (table, onConflict) => {
	let batch = [];
	let batchCount = 0;
	const pending = new Set();

	const submit = async () => {
		if (batch.length === 0) return;
		const rows = batch;
		batch = [];
		batchCount += 1;
		const request = upsertBatch(table, rows, onConflict).finally(() => {
			pending.delete(request);
		});
		pending.add(request);
		if (pending.size >= WRITE_CONCURRENCY) await Promise.race(pending);
		if (batchCount % 25 === 0) {
			console.log(`${table}: ${batchCount * BATCH_SIZE} rows processed`);
		}
	};

	return {
		async add(row) {
			batch.push(row);
			if (batch.length >= BATCH_SIZE) await submit();
		},
		async finish() {
			await submit();
			await Promise.all(pending);
		},
	};
};

const deleteDatasetRows = async () => {
	for (const table of [
		"generic_food_dataset_reference_rows",
		"generic_food_source_identifiers",
		"generic_food_measures",
		"generic_food_nutrients",
		"generic_food_records",
	]) {
		const { error } = await supabase.from(table).delete().eq("dataset_key", DATASET_KEY);
		if (error) throw error;
	}
};

const importReferenceRows = async (referenceGroups) => {
	const writer = createBatchWriter(
		"generic_food_dataset_reference_rows",
		"dataset_key,reference_type,source_key",
	);
	for (const [referenceType, { keyField, rows }] of Object.entries(referenceGroups)) {
		for (const row of rows) {
			await writer.add({
				dataset_key: DATASET_KEY,
				reference_type: referenceType,
				source_key: String(row[keyField]),
				payload: row,
			});
		}
	}
	await writer.finish();
};

const downloadDirectory = await createTemporaryDownloadDirectory(
	"blendcalc-cnf-2026-",
);
const downloadedPaths = {};
for (const [key, file] of Object.entries(files)) {
	downloadedPaths[key] = await downloadTemporaryFile({
		directory: downloadDirectory,
		...file,
	});
}

const [
	foodRows,
	foodSourceRows,
	foodGroupRows,
	nutrientNameRows,
	nutrientSourceRows,
	measureTypeRows,
	measureNameRows,
] = await Promise.all([
	readCsvRows(downloadedPaths.foods),
	readCsvRows(downloadedPaths.foodSources),
	readCsvRows(downloadedPaths.foodGroups),
	readCsvRows(downloadedPaths.nutrientNames),
	readCsvRows(downloadedPaths.nutrientSources),
	readCsvRows(downloadedPaths.measureTypes),
	readCsvRows(downloadedPaths.measureNames),
]);

const foodGroups = new Map(
	foodGroupRows.map((row) => [
		String(row.CNF_Food_Group_Code),
		row.CNF_Food_Group_Description_EN,
	]),
);
const nutrientNames = new Map(
	nutrientNameRows.map((row) => [String(row.Nutrient_Code), row]),
);
const measureTypes = new Map(
	measureTypeRows.map((row) => [
		String(row.Measure_Type_Code),
		row.Measure_Type_Description_EN,
	]),
);
const measureNames = new Map(
	measureNameRows.map((row) => [String(row.Measure_Code), row]),
);
const foodKeys = new Set(foodRows.map((row) => String(row.Food_Code)));

let datasetMetadata = {};
let canonicalNutrients = new Map();
const [{ data: dataset, error: datasetError }, { data: definitions, error: definitionError }] =
	await Promise.all([
		supabase
			.from("generic_food_datasets")
			.select("key, import_enabled, license_review_status, metadata")
			.eq("key", DATASET_KEY)
			.single(),
		supabase
			.from("nutrient_definitions")
			.select("nutrient_id, nutrient_number, nutrient_name, default_unit_name"),
	]);
if (datasetError) throw datasetError;
if (definitionError) throw definitionError;
if (!dataset.import_enabled || dataset.license_review_status !== "approved") {
	throw new Error(`${DATASET_KEY} is not approved and enabled for import.`);
}
datasetMetadata = dataset.metadata ?? {};
canonicalNutrients = new Map(
	(definitions ?? []).flatMap((definition) =>
		definition.nutrient_number
			? [[String(definition.nutrient_number), definition]]
			: [],
	),
);

if (!dryRun) {
	const { error: deactivateError } = await supabase
		.from("generic_food_datasets")
		.update({ active: false })
		.eq("key", DATASET_KEY);
	if (deactivateError) throw deactivateError;
	await deleteDatasetRows();
}

const nutrientMappingWriter = createBatchWriter(
	"nutrient_source_mappings",
	"source_key,source_nutrient_key,source_unit_name",
);
const mappingObservedAt = new Date().toISOString();
for (const row of nutrientNameRows) {
	const sourceNutrientKey = String(row.Nutrient_Code);
	const canonicalDefinition = canonicalNutrients.get(sourceNutrientKey);
	if (!canonicalDefinition) continue;
	await nutrientMappingWriter.add({
		source_key: SOURCE_KEY,
		source_nutrient_key: sourceNutrientKey,
		source_unit_name: row.Nutrient_Unit,
		source_nutrient_name: row.Nutrient_Name_EN,
		nutrient_id: canonicalDefinition.nutrient_id,
		priority: 10,
		mapping_method: "standards_dataset",
		confidence: 1,
		enabled: true,
		observation_count: 0,
		first_observed_at: mappingObservedAt,
		last_observed_at: mappingObservedAt,
		provenance: {
			datasetKey: DATASET_KEY,
			nutrientSymbol: textOrNull(row.Nutrient_Symbol),
			tagname: textOrNull(row.Tagname),
		},
	});
}
await nutrientMappingWriter.finish();

const recordWriter = createBatchWriter(
	"generic_food_records",
	"dataset_key,source_food_key",
);
for (const row of foodRows) {
	const foodGroupKey = textOrNull(row.CNF_Food_Group_Code);
	await recordWriter.add({
		dataset_key: DATASET_KEY,
		source_food_key: String(row.Food_Code),
		description: row.Food_Description_EN,
		alternate_description: textOrNull(row.Alternate_Description_EN),
		food_group_key: foodGroupKey,
		food_group_name: foodGroupKey ? foodGroups.get(foodGroupKey) ?? null : null,
		source_food_code: textOrNull(row.Food_Source_Code),
		external_reference: textOrNull(row.USDA_NDB_Code),
		scientific_name: textOrNull(row.ScientificName),
		preparation: null,
		search_text: normalizeSearchText(
			row.Food_Description_EN,
			row.Alternate_Description_EN,
			foodGroupKey ? foodGroups.get(foodGroupKey) : null,
			row.ScientificName,
		),
		source_updated_at: dateOrNull(row.Food_Last_Updated_Date),
		metadata: {
			descriptionFr: textOrNull(row.Food_Description_FR),
			alternateDescriptionFr: textOrNull(row.Alternate_Description_FR),
			commentEn: textOrNull(row.Comment_EN),
			commentFr: textOrNull(row.Comment_FR),
		},
	});
}
await recordWriter.finish();

const sourceIdentifierWriter = createBatchWriter(
	"generic_food_source_identifiers",
	"dataset_key,source_food_key,source_key,identifier_type,identifier_value",
);
for (const row of foodRows) {
	const rawNdbNumber = textOrNull(row.USDA_NDB_Code);
	const digits = rawNdbNumber?.replace(/\D/g, "") ?? "";
	if (!digits) continue;
	await sourceIdentifierWriter.add({
		dataset_key: DATASET_KEY,
		source_food_key: String(row.Food_Code),
		source_key: "usda",
		identifier_type: "ndb-number",
		identifier_value: digits.padStart(5, "0"),
		source_field: "USDA_NDB_Code",
		verification_method: "source-reference",
		metadata: {
			declaredByDataset: DATASET_KEY,
			rawValue: rawNdbNumber,
		},
	});
}
await sourceIdentifierWriter.finish();

await importReferenceRows({
	food_source: { keyField: "Food_Source_Code", rows: foodSourceRows },
	food_group: { keyField: "CNF_Food_Group_Code", rows: foodGroupRows },
	nutrient_definition: { keyField: "Nutrient_Code", rows: nutrientNameRows },
	nutrient_source: { keyField: "Nutrient_Source_Code", rows: nutrientSourceRows },
	measure_type: { keyField: "Measure_Type_Code", rows: measureTypeRows },
	measure_name: { keyField: "Measure_Code", rows: measureNameRows },
});

const nutrientWriter = createBatchWriter(
	"generic_food_nutrients",
	"dataset_key,source_food_key,source_nutrient_key",
);
let nutrientValueCount = 0;
let invalidNutrientCount = 0;
const unmappedNutrientKeys = new Set();
for await (const row of csvRows(downloadedPaths.nutrientAmounts)) {
	const foodKey = String(row.Food_Code);
	const sourceNutrientKey = String(row.Nutrient_Code);
	const amount = numberOrNull(row.Nutrient_Amount);
	const nutrientDefinition = nutrientNames.get(sourceNutrientKey);
	if (!foodKeys.has(foodKey) || !nutrientDefinition || amount === null || amount < 0) {
		invalidNutrientCount += 1;
		continue;
	}
	const nutrientId = canonicalNutrients.get(sourceNutrientKey)?.nutrient_id ?? null;
	if (!nutrientId) unmappedNutrientKeys.add(sourceNutrientKey);
	await nutrientWriter.add({
		dataset_key: DATASET_KEY,
		source_food_key: foodKey,
		source_nutrient_key: sourceNutrientKey,
		nutrient_id: nutrientId,
		source_nutrient_name: nutrientDefinition.Nutrient_Name_EN,
		unit_name: nutrientDefinition.Nutrient_Unit,
		amount_per_100g: amount,
		standard_error: numberOrNull(row.STD_Error),
		observation_count: numberOrNull(row.Observations),
		nutrient_source_code: textOrNull(row.Nutrient_Source_Code),
		source_updated_at: dateOrNull(row.Nutrient_Last_Updated_Date),
		mapping_status: nutrientId ? "canonical" : "unmapped",
		metadata: {},
	});
	nutrientValueCount += 1;
}
await nutrientWriter.finish();

const measureWriter = createBatchWriter(
	"generic_food_measures",
	"dataset_key,source_food_key,source_measure_key,measure_type",
);
let measureCount = 0;
let invalidMeasureCount = 0;
for await (const row of csvRows(downloadedPaths.measureWeights)) {
	const foodKey = String(row.Food_Code);
	const measureKey = String(row.Measure_Code);
	const measureTypeKey = String(row.Measure_Type_Code);
	const measure = measureNames.get(measureKey);
	const measureType = measureTypes.get(measureTypeKey);
	const gramWeight = numberOrNull(row.Measure_Weight_Conversion);
	if (!foodKeys.has(foodKey) || !measure || !measureType || gramWeight === null || gramWeight < 0) {
		invalidMeasureCount += 1;
		continue;
	}
	await measureWriter.add({
		dataset_key: DATASET_KEY,
		source_food_key: foodKey,
		source_measure_key: measureKey,
		measure_type: `${measureTypeKey}:${measureType}`,
		description: measure.Measure_Description_and_Unit_EN,
		gram_weight: gramWeight,
		is_household_measure: measureTypeKey === "6" && gramWeight > 0,
		source_updated_at: dateOrNull(row.Measure_Weight_Conversion_Last_Updated_Date),
		metadata: {
			descriptionFr: textOrNull(measure.Measure_Description_and_Unit_FR),
		},
	});
	measureCount += 1;
}
await measureWriter.finish();

const checksum = await getFilesChecksum(downloadedPaths);
const summary = {
	dataset: DATASET_KEY,
	foods: foodRows.length,
	nutrientValues: nutrientValueCount,
	measures: measureCount,
	unmappedNutrientKeys: unmappedNutrientKeys.size,
	invalidNutrientRows: invalidNutrientCount,
	invalidMeasureRows: invalidMeasureCount,
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
			measure_count: measureCount,
			metadata: {
				...datasetMetadata,
				invalidNutrientRows: invalidNutrientCount,
				invalidMeasureRows: invalidMeasureCount,
				unmappedNutrientKeys: [...unmappedNutrientKeys].sort(),
				files: Object.fromEntries(
					Object.entries(files).map(([key, file]) => [key, file.url]),
				),
			},
		})
		.eq("key", DATASET_KEY);
	if (datasetUpdateError) throw datasetUpdateError;

	const { error: sourceUpdateError } = await supabase
		.from("product_data_sources")
		.update({
			observation_count: foodRows.length,
			last_observed_at: importedAt,
		})
		.eq("key", SOURCE_KEY);
	if (sourceUpdateError) throw sourceUpdateError;
}

console.table([summary]);
