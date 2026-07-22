// Seed runtime product reference data from USDA, Open Food Facts, and NLM UCUM.
// Usage: npm run seed:product-reference-data -- --sample-size=200

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import {
	PRODUCT_DATA_SOURCE_REQUESTS,
	PRODUCT_REFERENCE_QUERIES,
	SERVING_MEASURE_REQUESTS,
	UNIT_STANDARDS_CODES,
} from "../lib/reference-data/catalog.mjs";
import {
	convertUcumUnit,
	fetchWithRetry,
	readHtmlTitle,
} from "../lib/reference-data/api.mjs";
import {
	findCanonicalNutrientMatch,
	normalizeUnitName,
} from "../lib/reference-data/nutrientMatching.mjs";

config({ path: ".env.moderation.local", quiet: true });
config({ path: ".env", quiet: true });

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const fdcApiKey = process.env.VITE_FDC_API_KEY;
const requestedSampleSize = Number(
	process.argv.find((argument) => argument.startsWith("--sample-size="))?.split("=")[1] ??
		200,
);
const sampleSize = Number.isFinite(requestedSampleSize)
	? Math.max(20, Math.min(1000, Math.floor(requestedSampleSize)))
	: 200;
const pageSize = Math.min(50, Math.ceil(sampleSize / PRODUCT_REFERENCE_QUERIES.length));
const observedAt = new Date().toISOString();

if (!supabaseUrl || !serviceRoleKey || !fdcApiKey) {
	throw new Error(
		"PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and VITE_FDC_API_KEY are required.",
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

const normalizeAlias = (value) =>
	String(value ?? "").trim().toLowerCase().replaceAll(".", "").replace(/\s+/g, "");

const addCount = (map, key, amount = 1) => {
	map.set(key, (map.get(key) ?? 0) + amount);
};

const wait = (milliseconds) =>
	new Promise((resolve) => setTimeout(resolve, milliseconds));

const upsertRows = async (table, rows, onConflict) => {
	if (rows.length === 0) return;
	for (let offset = 0; offset < rows.length; offset += 500) {
		const { error } = await supabase
			.from(table)
			.upsert(rows.slice(offset, offset + 500), { onConflict });
		if (error) throw error;
	}
};

const readReferenceRows = async () => {
	const [
		definitionsResult,
		manualFieldsResult,
		requiredResult,
		sharedSourceResult,
		sharedProductsResult,
	] =
		await Promise.all([
			supabase
				.from("nutrient_definitions")
				.select("nutrient_id, nutrient_name, nutrient_number, default_unit_name")
				.range(0, 999),
			supabase
				.from("nutrient_manual_entry_fields")
				.select("nutrient_id, observation_count")
				.eq("enabled", true),
			supabase
				.from("nutrient_manual_entry_required_nutrients")
				.select("nutrient_id")
				.eq("enabled", true),
			supabase
				.from("ingredient_provenance_options")
				.select("filter_label, description")
				.eq("dimension", "source")
				.eq("value", "shared-catalog")
				.single(),
			supabase
				.from("shared_products")
				.select("id", { count: "exact", head: true })
				.eq("status", "active"),
		]);
	for (const result of [
		definitionsResult,
		manualFieldsResult,
		requiredResult,
		sharedSourceResult,
		sharedProductsResult,
	]) {
		if (result.error) throw result.error;
	}
	const observationCounts = new Map(
		(manualFieldsResult.data ?? []).map((row) => [
			row.nutrient_id,
			row.observation_count,
		]),
	);
	return {
		definitions: (definitionsResult.data ?? []).map((definition) => ({
			...definition,
			observation_count: observationCounts.get(definition.nutrient_id) ?? 0,
		})),
		preferredNutrientIds: new Set(
			(requiredResult.data ?? []).map((row) => row.nutrient_id),
		),
		sharedSource: sharedSourceResult.data,
		sharedProductCount: sharedProductsResult.count ?? 0,
	};
};

const fetchUsdaFoods = async () => {
	const foods = [];
	for (const query of PRODUCT_REFERENCE_QUERIES) {
		try {
			const response = await fetchWithRetry(
				`https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(fdcApiKey)}`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ query, pageSize }),
				},
			);
			const payload = await response.json();
			foods.push(...(payload.foods ?? []));
		} catch (error) {
			console.warn(`USDA sample query “${query}” was skipped: ${error.message}`);
		}
		if (foods.length >= sampleSize) break;
		await wait(150);
	}
	return foods.slice(0, sampleSize);
};

const fetchOpenFoodFactsFoods = async () => {
	const foods = [];
	for (const query of PRODUCT_REFERENCE_QUERIES) {
		const url = new URL("https://world.openfoodfacts.org/cgi/search.pl");
		url.searchParams.set("search_terms", query);
		url.searchParams.set("search_simple", "1");
		url.searchParams.set("action", "process");
		url.searchParams.set("json", "1");
		url.searchParams.set("page_size", String(pageSize));
		url.searchParams.set(
			"fields",
			"code,product_name,serving_size,serving_quantity,serving_quantity_unit,nutriments",
		);
		try {
			const response = await fetchWithRetry(url, {
				headers: { accept: "application/json", "user-agent": "blendCalc reference-data seed" },
			});
			const payload = await response.json();
			foods.push(...(payload.products ?? []));
		} catch (error) {
			console.warn(
				`Open Food Facts sample query “${query}” was skipped: ${error.message}`,
			);
		}
		if (foods.length >= sampleSize) break;
		await wait(300);
	}
	return foods.slice(0, sampleSize);
};

const fetchOpenFoodFactsTaxonomy = async () => {
	const response = await fetchWithRetry(
		"https://static.openfoodfacts.org/data/taxonomies/nutrients.json",
	);
	return await response.json();
};

const getSourceDisplayName = (title, fallback) => {
	const cleaned = String(title ?? "").replace(/\s+/g, " ").trim();
	if (!cleaned) return fallback;
	return cleaned.split(/\s+[|–—-]\s+/)[0].trim() || fallback;
};

const seedSources = async ({ usdaCount, offCount, sharedSource, sharedProductCount }) => {
	const observationCounts = {
		usda: usdaCount,
		"open-food-facts": offCount,
		"ucum-nlm": SERVING_MEASURE_REQUESTS.length,
		"shared-catalog": sharedProductCount,
	};
	const rows = [];
	for (const request of PRODUCT_DATA_SOURCE_REQUESTS) {
		const isShared = request.key === "shared-catalog";
		const observedTitle = isShared
			? sharedSource.filter_label
			: await readHtmlTitle(request.homepageUrl, request.displayName);
		rows.push({
			key: request.key,
			display_name: getSourceDisplayName(observedTitle, request.displayName),
			source_type: request.sourceType,
			homepage_url: request.homepageUrl,
			api_base_url: request.apiBaseUrl,
			terms_url: request.termsUrl,
			attribution_text: isShared ? sharedSource.description : request.attributionText,
			enabled: true,
			observation_count: observationCounts[request.key] ?? 0,
			first_observed_at: observedAt,
			last_observed_at: observedAt,
			provenance: {
				seed: "scripts/seeds/seed_product_reference_data.mjs",
				observedTitle,
				sampleSize,
			},
		});
	}
	await upsertRows("product_data_sources", rows, "key");
};

const collectUsdaNutrients = (foods) => {
	const counts = new Map();
	for (const food of foods) {
		for (const nutrient of food.foodNutrients ?? []) {
			const nutrientId = Number(nutrient.nutrientId);
			if (Number.isFinite(nutrientId)) addCount(counts, nutrientId);
		}
	}
	return counts;
};

const collectOpenFoodFactsNutrients = (foods) => {
	const observations = new Map();
	for (const food of foods) {
		const nutriments = food.nutriments ?? {};
		for (const key of Object.keys(nutriments)) {
			const match = key.match(/^(.+)_100g$/);
			if (!match || !Number.isFinite(Number(nutriments[key]))) continue;
			const sourceKey = match[1];
			const sourceUnit = normalizeUnitName(nutriments[`${sourceKey}_unit`]);
			const observationKey = `${sourceKey}\u0000${sourceUnit}`;
			const current = observations.get(observationKey) ?? {
				sourceKey,
				sourceUnit,
				count: 0,
			};
			current.count += 1;
			observations.set(observationKey, current);
		}
	}
	return observations;
};

const seedNutrientMappings = async ({
	definitions,
	preferredNutrientIds,
	usdaFoods,
	offFoods,
	taxonomy,
}) => {
	const usdaCounts = collectUsdaNutrients(usdaFoods);
	const mappings = definitions.map((definition) => ({
		source_key: "usda",
		source_nutrient_key: String(definition.nutrient_id),
		source_unit_name: normalizeUnitName(definition.default_unit_name),
		source_nutrient_name: definition.nutrient_name,
		nutrient_id: definition.nutrient_id,
		priority: 0,
		mapping_method: "api_id_match",
		confidence: 1,
		enabled: true,
		review_status: "approved",
		review_reference: "USDA nutrient ID identity",
		reviewed_at: observedAt,
		observation_count: usdaCounts.get(definition.nutrient_id) ?? 0,
		first_observed_at: observedAt,
		last_observed_at: observedAt,
		provenance: {
			seed: "scripts/seeds/seed_product_reference_data.mjs",
			api: "USDA FoodData Central",
			sampleSize: usdaFoods.length,
		},
	}));

	const offObservations = collectOpenFoodFactsNutrients(offFoods);
	const offBySourceKey = new Map();
	for (const observation of offObservations.values()) {
		const values = offBySourceKey.get(observation.sourceKey) ?? [];
		values.push(observation);
		offBySourceKey.set(observation.sourceKey, values);
	}

	for (const [taxonomyKey, entry] of Object.entries(taxonomy)) {
		const sourceKey = taxonomyKey.replace(/^[a-z]{2}:/i, "");
		const sourceName = entry?.name?.en ?? entry?.name?.xx ?? sourceKey;
		const taxonomyUnit = normalizeUnitName(entry?.unit?.en);
		const match = findCanonicalNutrientMatch({
			sourceName,
			sourceUnit: taxonomyUnit,
			definitions,
			preferredNutrientIds,
		});
		if (!match) continue;
		const observations = offBySourceKey.get(sourceKey) ?? [];
		const sourceUnits = new Map([[taxonomyUnit, 0]]);
		for (const observation of observations) {
			sourceUnits.set(observation.sourceUnit, observation.count);
		}
		for (const [sourceUnit, observationCount] of sourceUnits) {
			mappings.push({
				source_key: "open-food-facts",
				source_nutrient_key: sourceKey,
				source_unit_name: sourceUnit,
				source_nutrient_name: sourceName,
				nutrient_id: match.definition.nutrient_id,
					priority: observationCount > 0 ? 10 : 50,
					mapping_method: "api_taxonomy_match",
					confidence: Number(match.score.toFixed(4)),
					enabled: match.automaticApproval,
					review_status: match.automaticApproval ? "approved" : "pending_review",
					review_reference: match.automaticApproval
						? "Exact normalized taxonomy name and compatible unit"
						: null,
					reviewed_at: match.automaticApproval ? observedAt : null,
				observation_count: observationCount,
				first_observed_at: observedAt,
				last_observed_at: observedAt,
				provenance: {
					seed: "scripts/seeds/seed_product_reference_data.mjs",
					taxonomyKey,
					taxonomyName: sourceName,
					taxonomyUnit,
					sampleSize: offFoods.length,
				},
			});
		}
	}

	const uniqueMappings = [...new Map(
		mappings.map((mapping) => [
			`${mapping.source_key}\u0000${mapping.source_nutrient_key}\u0000${mapping.source_unit_name}`,
			mapping,
		]),
	).values()];
	await upsertRows(
		"nutrient_source_mappings",
		uniqueMappings,
		"source_key,source_nutrient_key,source_unit_name",
	);
	return uniqueMappings;
};

const getUcumCode = (unit) => UNIT_STANDARDS_CODES[normalizeUnitName(unit)];

const normalizeNutrientNameForPairing = (value) =>
	String(value ?? "")
		.toLowerCase()
		.replace(/international units?/g, "")
		.replace(/\biu\b/g, "")
		.replace(/[^a-z0-9]+/g, " ")
		.trim();

const getObservedIuConversions = (definitions, usdaFoods) => {
	const definitionsById = new Map(definitions.map((definition) => [definition.nutrient_id, definition]));
	const ratios = new Map();
	for (const food of usdaFoods) {
		const nutrients = (food.foodNutrients ?? []).filter((nutrient) =>
			Number.isFinite(Number(nutrient.value)) && Number(nutrient.value) > 0,
		);
		for (const source of nutrients) {
			const sourceDefinition = definitionsById.get(Number(source.nutrientId));
			if (normalizeUnitName(sourceDefinition?.default_unit_name) !== "IU") continue;
			const normalizedName = normalizeNutrientNameForPairing(sourceDefinition?.nutrient_name);
			const target = nutrients.find((candidate) => {
				const definition = definitionsById.get(Number(candidate.nutrientId));
				return normalizeUnitName(definition?.default_unit_name) === "UG" &&
					normalizeNutrientNameForPairing(definition?.nutrient_name) === normalizedName;
			});
			if (!target) continue;
			const ratio = Number(target.value) / Number(source.value);
			if (!Number.isFinite(ratio) || ratio <= 0) continue;
			const values = ratios.get(normalizedName) ?? [];
			values.push({ ratio, fdcId: food.fdcId });
			ratios.set(normalizedName, values);
		}
	}
	return ratios;
};

const seedNutrientConversions = async ({ mappings, definitions, usdaFoods }) => {
	const conversionRequests = new Map();
	for (const mapping of mappings.filter((candidate) => candidate.enabled)) {
		const fromUnit = normalizeUnitName(mapping.source_unit_name);
		const definition = definitions.find(
			(candidate) => candidate.nutrient_id === mapping.nutrient_id,
		);
		const toUnit = normalizeUnitName(definition?.default_unit_name);
		if (!fromUnit || !toUnit || fromUnit === toUnit) continue;
		conversionRequests.set(
			`${mapping.source_key}\u0000${mapping.nutrient_id}\u0000${fromUnit}\u0000${toUnit}`,
			{ mapping, definition, fromUnit, toUnit },
		);
	}

	const iuRatios = getObservedIuConversions(definitions, usdaFoods);
	const rows = [];
	for (const request of conversionRequests.values()) {
		const fromCode = getUcumCode(request.fromUnit);
		const toCode = getUcumCode(request.toUnit);
		if (fromCode && toCode) {
			try {
				const conversion = await convertUcumUnit({ fromCode, toCode });
				rows.push({
					source_key: request.mapping.source_key,
					nutrient_id: request.mapping.nutrient_id,
					from_unit_name: request.fromUnit,
					to_unit_name: request.toUnit,
					multiplier: conversion.value,
					conversion_method: "standards_api",
					confidence: 1,
					observation_count: 1,
					provenance: {
						seed: "scripts/seeds/seed_product_reference_data.mjs",
						sourceReference: conversion.sourceReference,
					},
				});
				continue;
			} catch (error) {
				console.warn(`UCUM skipped ${request.fromUnit} → ${request.toUnit}: ${error.message}`);
			}
		}

		if (request.fromUnit === "IU" && request.toUnit === "UG") {
			const values = iuRatios.get(
				normalizeNutrientNameForPairing(request.definition?.nutrient_name),
			) ?? [];
			if (values.length > 0) {
				const sorted = values.map((value) => value.ratio).sort((left, right) => left - right);
				const multiplier = sorted[Math.floor(sorted.length / 2)];
				rows.push({
					source_key: request.mapping.source_key,
					nutrient_id: request.mapping.nutrient_id,
					from_unit_name: request.fromUnit,
					to_unit_name: request.toUnit,
					multiplier,
					conversion_method: "api_observed_ratio",
					confidence: 0.99,
					observation_count: values.length,
					provenance: {
						seed: "scripts/seeds/seed_product_reference_data.mjs",
						fdcIds: values.slice(0, 25).map((value) => value.fdcId),
					},
				});
			}
		}
	}

	for (const mapping of mappings.filter(
		(candidate) => candidate.source_key === "open-food-facts",
	)) {
		const definition = definitions.find(
			(candidate) => candidate.nutrient_id === mapping.nutrient_id,
		);
		if (normalizeUnitName(definition?.default_unit_name) !== "UG") continue;
		const values = iuRatios.get(
			normalizeNutrientNameForPairing(definition?.nutrient_name),
		) ?? [];
		if (values.length === 0) continue;
		const conversionKey = `${mapping.source_key}\u0000${mapping.nutrient_id}\u0000IU\u0000UG`;
		if (rows.some((row) =>
			`${row.source_key}\u0000${row.nutrient_id}\u0000${row.from_unit_name}\u0000${row.to_unit_name}` === conversionKey
		)) continue;
		const sorted = values.map((value) => value.ratio).sort((left, right) => left - right);
		rows.push({
			source_key: mapping.source_key,
			nutrient_id: mapping.nutrient_id,
			from_unit_name: "IU",
			to_unit_name: "UG",
			multiplier: sorted[Math.floor(sorted.length / 2)],
			conversion_method: "api_observed_ratio",
			confidence: 0.99,
			observation_count: values.length,
			provenance: {
				seed: "scripts/seeds/seed_product_reference_data.mjs",
				fdcIds: values.slice(0, 25).map((value) => value.fdcId),
			},
		});
	}
	await upsertRows(
		"nutrient_unit_conversions",
		rows,
		"source_key,nutrient_id,from_unit_name,to_unit_name",
	);
	return rows;
};

const collectServingLabels = (usdaFoods, offFoods) => [
	...usdaFoods.flatMap((food) => [
		food.householdServingFullText,
		food.servingSize && food.servingSizeUnit
			? `${food.servingSize} ${food.servingSizeUnit}`
			: null,
	]),
	...offFoods.flatMap((food) => [
		food.serving_size,
		food.serving_quantity && food.serving_quantity_unit
			? `${food.serving_quantity} ${food.serving_quantity_unit}`
			: null,
	]),
].filter(Boolean);

const seedServingMeasures = async (usdaFoods, offFoods) => {
	const labels = collectServingLabels(usdaFoods, offFoods);
	const observations = new Map();
	for (const request of SERVING_MEASURE_REQUESTS) {
		let count = 0;
		for (const label of labels) {
			const normalizedLabel = normalizeAlias(label);
			if (request.aliases.some((alias) => normalizedLabel.includes(normalizeAlias(alias)))) {
				count += 1;
			}
		}
		observations.set(request.key, count);
	}
	const defaultByDimension = new Map();
	for (const dimension of ["weight", "volume"]) {
		const candidates = SERVING_MEASURE_REQUESTS
			.filter((request) => request.dimension === dimension)
			.sort(
				(left, right) =>
					(observations.get(right.key) ?? 0) - (observations.get(left.key) ?? 0),
			);
		if (!candidates[0] || (observations.get(candidates[0].key) ?? 0) === 0) {
			throw new Error(`No ${dimension} serving unit was observed in the API samples.`);
		}
		defaultByDimension.set(dimension, candidates[0].key);
	}

	const unitRows = [];
	const aliasRows = [];
	for (const request of SERVING_MEASURE_REQUESTS) {
		const conversion = await convertUcumUnit({
			fromCode: request.standardsCode,
			toCode: request.baseUnitKey === "g" ? "g" : "mL",
		});
		unitRows.push({
			key: request.key,
			display_label: request.displayLabel,
			short_label: request.shortLabel,
			dimension: request.dimension,
			base_unit_key: request.baseUnitKey,
			conversion_to_base: conversion.value,
			standards_code: request.standardsCode,
			display_order: request.displayOrder,
			is_default: defaultByDimension.get(request.dimension) === request.key,
			enabled: true,
			source_key: "ucum-nlm",
			source_reference: conversion.sourceReference,
			observed_at: observedAt,
		});
		for (const alias of new Set([request.key, request.shortLabel, ...request.aliases])) {
			const normalizedAlias = normalizeAlias(alias);
			if (!normalizedAlias) continue;
			aliasRows.push({
				unit_key: request.key,
				alias,
				normalized_alias: normalizedAlias,
				source_key: "ucum-nlm",
				observation_count: observations.get(request.key) ?? 0,
				first_observed_at: observedAt,
				last_observed_at: observedAt,
			});
		}
	}
	const { error: clearDefaultsError } = await supabase
		.from("serving_measure_units")
		.update({ is_default: false })
		.eq("is_default", true);
	if (clearDefaultsError) throw clearDefaultsError;
	await upsertRows("serving_measure_units", unitRows, "key");
	await upsertRows(
		"serving_measure_aliases",
		[...new Map(aliasRows.map((row) => [row.normalized_alias, row])).values()],
		"unit_key,normalized_alias",
	);
	return { unitRows, aliasRows };
};

const main = async () => {
	console.log(`Sampling up to ${sampleSize} products from each food API...`);
	const [referenceRows, usdaFoods, offFoods, taxonomy] = await Promise.all([
		readReferenceRows(),
		fetchUsdaFoods(),
		fetchOpenFoodFactsFoods(),
		fetchOpenFoodFactsTaxonomy(),
	]);
	await seedSources({
		usdaCount: usdaFoods.length,
		offCount: offFoods.length,
		sharedSource: referenceRows.sharedSource,
		sharedProductCount: referenceRows.sharedProductCount,
	});
	const mappings = await seedNutrientMappings({
		definitions: referenceRows.definitions,
		preferredNutrientIds: referenceRows.preferredNutrientIds,
		usdaFoods,
		offFoods,
		taxonomy,
	});
	const conversions = await seedNutrientConversions({
		mappings,
		definitions: referenceRows.definitions,
		usdaFoods,
	});
	const servings = await seedServingMeasures(usdaFoods, offFoods);
	console.log(JSON.stringify({
		usdaProducts: usdaFoods.length,
		openFoodFactsProducts: offFoods.length,
		nutrientMappings: mappings.length,
		nutrientConversions: conversions.length,
		servingUnits: servings.unitRows.length,
		servingAliases: servings.aliasRows.length,
	}, null, 2));
};

await main();
supabase.realtime.disconnect();
process.exit(0);
